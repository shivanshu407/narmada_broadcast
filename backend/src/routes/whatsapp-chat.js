import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { sendTextMessage, sendMediaMessage, sendTemplateMessage, normalizePhone, getTemplateDefinition, uploadMediaForMessage } from '../services/whatsapp.js';
import { emitToTenant } from '../services/websocket.js';
import { checkWhatsAppEnabled } from '../middleware/limits.js';
import WhatsAppConversation from '../models/WhatsAppConversation.js';
import WhatsAppChatMessage from '../models/WhatsAppChatMessage.js';
import Contact from '../models/Contact.js';
import User from '../models/User.js';
import Setting from '../models/Setting.js';
import { getUploadsDir } from '../utils/uploads.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

async function resolveTemplateBody(templateName, templateParams = [], tenant) {
    try {
        const tpl = await getTemplateDefinition(templateName, tenant);
        if (!tpl) return `[Template: ${templateName}]`;

        const components = tpl.components || [];
        const bodyComp = components.find(c => c.type === 'BODY');
        const headerComp = components.find(c => c.type === 'HEADER');
        const footerComp = components.find(c => c.type === 'FOOTER');
        const buttonsComp = components.find(c => c.type === 'BUTTONS');

        let bodyText = bodyComp?.text || '';
        bodyText = bodyText.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
            const paramIdx = parseInt(idx) - 1;
            return templateParams[paramIdx] || `{{${idx}}}`;
        });

        const templateData = {
            _type: 'template_rich',
            template_name: templateName,
            body: bodyText,
        };

        if (headerComp) {
            templateData.header = { format: headerComp.format };
            if (headerComp.format === 'TEXT') {
                templateData.header.text = headerComp.text || '';
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                templateData.header.url = headerComp.example?.header_handle?.[0] || headerComp.example?.header_url?.[0] || '';
            }
        }

        if (footerComp?.text) {
            templateData.footer = footerComp.text;
        }

        if (buttonsComp?.buttons?.length) {
            templateData.buttons = buttonsComp.buttons.map(btn => ({
                type: btn.type,
                text: btn.text,
            }));
        }

        return JSON.stringify(templateData);
    } catch (err) {
        console.error('resolveTemplateBody error:', err.message);
        return `[Template: ${templateName}]`;
    }
}

function getTemplatePlainText(resolvedBody) {
    try {
        const data = JSON.parse(resolvedBody);
        if (data._type === 'template_rich') {
            return data.body || `[Template: ${data.template_name}]`;
        }
    } catch {}
    return resolvedBody;
}

async function sendFeedbackRequest(conversation, req) {
    const { sendInteractiveMessage } = await import('../services/whatsapp.js');
    const interactiveOptions = {
        type: 'button',
        body: { text: 'Your support chat has been resolved. Please rate your experience:' },
        action: {
            buttons: [
                { type: 'reply', reply: { id: 'feedback_good', title: 'Good' } },
                { type: 'reply', reply: { id: 'feedback_bad', title: 'Bad' } },
            ],
        },
    };

    const result = await sendInteractiveMessage(conversation.phone, interactiveOptions, req.tenant);
    if (!result?.messageId) return false;

    await WhatsAppChatMessage.create({
        tenant_id: req.tenantId,
        conversation_id: conversation._id,
        direction: 'outbound',
        message_type: 'interactive',
        body: '[Feedback Request Sent]',
        provider_message_id: result.messageId,
        status: 'sent',
        sent_by: req.user.userId
    });

    conversation.last_message_text = '[Feedback Request Sent]';
    conversation.last_message_at = new Date();
    conversation.unread_count = 0;
    await conversation.save();

    emitToTenant(req.tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
    return true;
}

router.use((req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
});
router.use(checkWhatsAppEnabled);

router.post('/conversations/new', async (req, res) => {
    try {
        const { phone, contactName, templateName, templateParams = [], languageCode = 'en_US' } = req.body;
        if (!phone || !templateName) {
            return res.status(400).json({ error: 'Phone number and template name are required' });
        }

        const normalized = normalizePhone(phone);
        if (!normalized) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        let conversation = await WhatsAppConversation.findOne({ phone: normalized, tenant_id: req.tenantId });

        if (!conversation) {
            const contact = await Contact.findOne({ phone: { $regex: new RegExp(`${normalized.slice(-10)}$`) }, tenant_id: req.tenantId });
            
            const initialBody = await resolveTemplateBody(templateName, templateParams, req.tenant);

            conversation = await WhatsAppConversation.create({
                tenant_id: req.tenantId,
                phone: normalized,
                contact_name: contactName || contact?.name || normalized,
                contact_id: contact?._id || null,
                last_message_text: getTemplatePlainText(initialBody).substring(0, 100),
                last_message_at: new Date(),
                window_expires_at: null
            });
        }

        const resolvedBody = await resolveTemplateBody(templateName, templateParams, req.tenant);

        const result = await sendTemplateMessage(
            normalized, templateName, templateParams,
            contactName || conversation.contact_name || 'Customer',
            languageCode, req.tenant
        );

        await WhatsAppChatMessage.create({
            tenant_id: req.tenantId,
            conversation_id: conversation._id,
            direction: 'outbound',
            message_type: 'template',
            body: resolvedBody,
            provider_message_id: result.messageId,
            status: 'sent',
            sent_by: req.user.userId
        });

        conversation.last_message_text = getTemplatePlainText(resolvedBody).substring(0, 100);
        conversation.last_message_at = new Date();
        await conversation.save();

        emitToTenant(req.tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });

        res.json({ success: true, conversationId: conversation._id.toString(), messageId: result.messageId });
    } catch (error) {
        console.error('Start new conversation error:', error);
        res.status(500).json({ error: error.message || 'Failed to start conversation' });
    }
});

router.get('/conversations', async (req, res) => {
    try {
        const { search, archived = '0', page = 1, limit = 30, paid, needs_human } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const filter = { tenant_id: req.tenantId, is_archived: archived === '1' };

        if (needs_human === '1') {
            filter.needs_human = true;
        }

        // For paid, we would ideally need a relationship to Order or check the phone in orders.
        // Assuming we omit `paid` filtering for simplicity or we should look it up first.
        // If we strictly need it, we'd do a complex aggregation.
        // Let's keep it simple for now, as it's a UI filter and `paid` requires orders check.
        if (paid === '1') {
            const { default: Order } = await import('../models/Order.js');
            const paidOrders = await Order.find({ tenant_id: req.tenantId, payment_status: 'paid' }).select('phone').lean();
            const paidPhones = paidOrders.map(o => o.phone).filter(Boolean);
            filter.phone = { $in: paidPhones };
        }

        if (search) {
            filter.$or = [
                { contact_name: { $regex: new RegExp(search, 'i') } },
                { phone: { $regex: new RegExp(search, 'i') } }
            ];
        }

        const safeLimit = parseInt(limit) || 30;
        
        const conversations = await WhatsAppConversation.find(filter)
            .populate('contact_id', 'name email')
            .sort({ last_message_at: -1 })
            .skip(offset)
            .limit(safeLimit)
            .lean();

        const unreadResult = await WhatsAppConversation.aggregate([
            { $match: { tenant_id: req.tenantId, is_archived: false } },
            { $group: { _id: null, total_unread: { $sum: "$unread_count" } } }
        ]);
        const totalUnread = unreadResult.length > 0 ? unreadResult[0].total_unread : 0;

        res.json({
            conversations: conversations.map(conv => ({
                ...conv,
                id: conv._id.toString(),
                display_name: conv.contact_id?.name || conv.contact_name || conv.phone,
                matched_contact_name: conv.contact_id?.name,
                matched_contact_email: conv.contact_id?.email,
                is_window_open: conv.window_expires_at ? new Date(conv.window_expires_at) > new Date() : false,
                window_remaining_minutes: conv.window_expires_at
                    ? Math.max(0, Math.round((new Date(conv.window_expires_at) - new Date()) / 60000))
                    : 0,
            })),
            total_unread: totalUnread,
        });
    } catch (error) {
        console.error('Fetch conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

router.get('/conversations/:id/messages', async (req, res) => {
    try {
        const { limit = 50, before_id } = req.query;

        const conversation = await WhatsAppConversation.findOne({ _id: req.params.id, tenant_id: req.tenantId }).lean();
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const safeLimit = Math.min(parseInt(limit) || 50, 200);

        const filter = { conversation_id: conversation._id, tenant_id: req.tenantId };
        if (before_id) {
            filter._id = { $lt: before_id };
        }

        const messages = await WhatsAppChatMessage.find(filter)
            .sort({ _id: -1 })
            .limit(safeLimit)
            .lean();

        messages.reverse(); // chronological

        const total = await WhatsAppChatMessage.countDocuments({ conversation_id: conversation._id, tenant_id: req.tenantId });

        res.json({
            conversation: {
                ...conversation,
                id: conversation._id.toString(),
                is_window_open: conversation.window_expires_at ? new Date(conversation.window_expires_at) > new Date() : false,
                window_remaining_minutes: conversation.window_expires_at
                    ? Math.max(0, Math.round((new Date(conversation.window_expires_at) - new Date()) / 60000))
                    : 0,
            },
            messages: messages.map(m => ({
                ...m,
                id: m._id.toString(),
                sender_name: typeof m.sent_by === 'object' ? m.sent_by?.name : (m.sent_by || m.direction === 'outbound' ? 'Admin User' : undefined)
            })),
            total,
            has_more: before_id ? messages.length === safeLimit : total > safeLimit,
        });
    } catch (error) {
        console.error('Fetch messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

router.post('/conversations/:id/send', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ error: 'Message text is required' });

        const conversation = await WhatsAppConversation.findOne({ _id: req.params.id, tenant_id: req.tenantId });
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const windowOpen = conversation.window_expires_at && new Date(conversation.window_expires_at) > new Date();
        if (!windowOpen) {
            return res.status(400).json({
                error: '24-hour messaging window has expired. Send a template message to re-engage.',
                window_expired: true,
            });
        }

        const result = await sendTextMessage(conversation.phone, text.trim(), req.tenant);

        await WhatsAppChatMessage.create({
            tenant_id: req.tenantId,
            conversation_id: conversation._id,
            direction: 'outbound',
            message_type: 'text',
            body: text.trim(),
            provider_message_id: result.messageId,
            status: 'sent',
            sent_by: req.user.userId
        });

        conversation.last_message_text = text.trim().substring(0, 100);
        conversation.last_message_at = new Date();
        await conversation.save();

        emitToTenant(req.tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });

        res.json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Send chat message error:', error);
        res.status(500).json({ error: error.message || 'Failed to send message' });
    }
});

router.post('/conversations/:id/send-media', upload.single('media'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No media file provided' });
        
        const conversation = await WhatsAppConversation.findOne({ _id: req.params.id, tenant_id: req.tenantId });
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const now = new Date();
        const windowExpires = conversation.window_expires_at ? new Date(conversation.window_expires_at) : new Date(0);
        if (now > windowExpires) {
            return res.status(400).json({ error: '24-hour service window has expired. You can only send template messages.' });
        }

        let uploadMime = req.file.mimetype;
        let uploadName = req.file.originalname;
        let uploadBuffer = req.file.buffer;

        if (uploadMime.includes('webm') || uploadName.endsWith('.webm')) {
            try {
                const { transcodeWebmToOgg } = await import('../services/transcoder.js');
                uploadBuffer = await transcodeWebmToOgg(req.file.buffer);
                uploadMime = 'audio/ogg';
                uploadName = uploadName.replace(/\.webm$/, '.ogg');
                req.file.mimetype = 'audio/ogg';
                req.file.originalname = uploadName;
                req.file.buffer = uploadBuffer;
            } catch (transcodeErr) {
                console.error('[Transcoder] WebM to OGG transcoding failed:', transcodeErr.message);
                return res.status(400).json({ error: 'Failed to process voice note audio format: ' + transcodeErr.message });
            }
        }

        const metaMediaId = await uploadMediaForMessage(uploadBuffer, uploadMime, uploadName, req.tenant);
        
        const isImage = req.file.mimetype.startsWith('image/');
        const isAudio = req.file.mimetype.startsWith('audio/');
        const isVideo = req.file.mimetype.startsWith('video/');
        let mediaType = 'document';
        if (isImage) mediaType = 'image';
        else if (isAudio) mediaType = 'audio';
        else if (isVideo) mediaType = 'video';
        
        const result = await sendMediaMessage(conversation.phone, mediaType, { id: metaMediaId }, req.body.caption || '', req.tenant);

        const uploadDir = getUploadsDir();
        
        const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const localFileName = `${Date.now()}_${safeFilename}`;
        fs.writeFileSync(path.join(uploadDir, localFileName), req.file.buffer);
        const localMediaId = `local_media:${localFileName}`;

        await WhatsAppChatMessage.create({
            tenant_id: req.tenantId,
            conversation_id: conversation._id,
            direction: 'outbound',
            message_type: mediaType,
            body: req.body.caption || '',
            media_id: localMediaId,
            media_mime_type: req.file.mimetype,
            provider_message_id: result.messageId,
            status: 'sent',
            sent_by: req.user.userId
        });

        let preview = `📎 Document`;
        if (isImage) preview = `📷 Image`;
        else if (isAudio) preview = `🎤 Voice Note`;
        else if (isVideo) preview = `🎥 Video`;

        conversation.last_message_text = req.body.caption || preview;
        conversation.last_message_at = new Date();
        await conversation.save();

        emitToTenant(req.tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });

        res.json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Send media message error:', error);
        res.status(500).json({ error: error.message || 'Failed to send media' });
    }
});

router.post('/conversations/:id/send-template', async (req, res) => {
    try {
        const { templateName, templateParams = [], languageCode } = req.body;
        if (!templateName) return res.status(400).json({ error: 'Template name is required' });

        const conversation = await WhatsAppConversation.findOne({ _id: req.params.id, tenant_id: req.tenantId });
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const { sendTemplateMessage } = await import('../services/whatsapp.js');

        const resolvedBody = await resolveTemplateBody(templateName, templateParams, req.tenant);

        const result = await sendTemplateMessage(
            conversation.phone, templateName, templateParams,
            conversation.contact_name || 'Customer', languageCode, req.tenant
        );

        await WhatsAppChatMessage.create({
            tenant_id: req.tenantId,
            conversation_id: conversation._id,
            direction: 'outbound',
            message_type: 'template',
            body: resolvedBody,
            provider_message_id: result.messageId,
            status: 'sent',
            sent_by: req.user.userId
        });

        conversation.last_message_text = getTemplatePlainText(resolvedBody).substring(0, 100);
        conversation.last_message_at = new Date();
        await conversation.save();

        emitToTenant(req.tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });

        res.json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Send template in chat error:', error);
        res.status(500).json({ error: error.message || 'Failed to send template' });
    }
});

router.patch('/conversations/:id/read', async (req, res) => {
    try {
        await WhatsAppConversation.updateOne(
            { _id: req.params.id, tenant_id: req.tenantId },
            { $set: { unread_count: 0 } }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

router.patch('/conversations/:id/archive', async (req, res) => {
    try {
        const conv = await WhatsAppConversation.findOne({ _id: req.params.id, tenant_id: req.tenantId });
        if (!conv) return res.status(404).json({ error: 'Not found' });

        conv.is_archived = !conv.is_archived;
        await conv.save();
        
        res.json({ success: true, is_archived: conv.is_archived });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

router.patch('/conversations/:id/bot-pause', async (req, res) => {
    try {
        const { paused, send_feedback } = req.body;
        if (typeof paused !== 'boolean') {
            return res.status(400).json({ error: 'paused must be a boolean' });
        }

        const conv = await WhatsAppConversation.findOne({ _id: req.params.id, tenant_id: req.tenantId });
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });

        conv.bot_paused = paused;
        await conv.save();

        if (send_feedback && !paused) {
            const { sendInteractiveMessage } = await import('../services/whatsapp.js');
            const interactiveOptions = {
                type: "button",
                body: { text: "Your support chat has been resolved. Please rate your experience:" },
                action: {
                    buttons: [
                        { type: "reply", reply: { id: "feedback_good", title: "👍 Good" } },
                        { type: "reply", reply: { id: "feedback_bad", title: "👎 Bad" } }
                    ]
                }
            };
            const result = await sendInteractiveMessage(conv.phone, interactiveOptions, req.tenant);
            if (result && result.messageId) {
                await WhatsAppChatMessage.create({
                    tenant_id: req.tenantId,
                    conversation_id: conv._id,
                    direction: 'outbound',
                    message_type: 'interactive',
                    body: "[Feedback Request Sent]",
                    provider_message_id: result.messageId,
                    status: 'sent',
                    sent_by: req.user.userId
                });

                conv.last_message_text = "[Feedback Request Sent]";
                conv.last_message_at = new Date();
                conv.unread_count = 0;
                await conv.save();

                emitToTenant(req.tenantId, 'chat_updated', { type: 'new_message', conversationId: conv._id.toString() });
            }
        }

        res.json({ success: true, bot_paused: paused });
    } catch (error) {
        console.error('[Bot Pause] Update error:', error);
        res.status(500).json({ error: 'Failed to update bot pause' });
    }
});

router.patch('/conversations/:id/handoff/resolve', async (req, res) => {
    try {
        const { send_feedback } = req.body || {};

        const conv = await WhatsAppConversation.findOne({ _id: req.params.id, tenant_id: req.tenantId });
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });

        conv.needs_human = false;
        conv.bot_paused = false;
        conv.handoff_reason = null;
        conv.unread_count = 0;
        await conv.save();

        if (send_feedback) {
            await sendFeedbackRequest(conv, req);
        }

        emitToTenant(req.tenantId, 'chat_updated', { type: 'handoff_resolved', conversationId: conv._id.toString() });
        res.json({ success: true, needs_human: false, bot_paused: false });
    } catch (error) {
        console.error('[Handoff] Resolve error:', error);
        res.status(500).json({ error: 'Failed to resolve handoff' });
    }
});

router.post('/conversations/:id/teach', async (req, res) => {
    try {
        const { question, answer, source_message_id } = req.body || {};
        if (!String(question || '').trim() || !String(answer || '').trim()) {
            return res.status(400).json({ error: 'question and answer are required' });
        }

        const conversation = await WhatsAppConversation.findOne({ _id: req.params.id, tenant_id: req.tenantId }).lean();
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const setting = req.tenant || await Setting.findOne({ singletonId: 'admin_settings' }).lean();
        const { teachFromConversation } = await import('../services/botLearning.js');
        const result = await teachFromConversation({
            tenantId: req.tenantId,
            conversationId: conversation._id.toString(),
            question,
            answer,
            sourceMessageId: source_message_id,
            botSettings: setting?.bot_settings || {},
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[Teach Bot] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to teach bot' });
    }
});

router.patch('/conversations/:id/labels', async (req, res) => {
    try {
        const { labels } = req.body;
        if (!Array.isArray(labels)) return res.status(400).json({ error: 'labels must be an array' });

        const conv = await WhatsAppConversation.findOne({ _id: req.params.id, tenant_id: req.tenantId });
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });

        conv.labels = labels;
        await conv.save();

        if (conv.contact_id) {
            await Contact.updateOne({ _id: conv.contact_id, tenant_id: req.tenantId }, { $set: { labels } });
        }

        res.json({ success: true, labels });
    } catch (error) {
        console.error('[Labels] Update error:', error);
        res.status(500).json({ error: 'Failed to update labels' });
    }
});

router.get('/media/:media_id', async (req, res) => {
    try {
        const { media_id } = req.params;

        const msg = await WhatsAppChatMessage.findOne({ media_id, tenant_id: req.tenantId }).lean();
        if (!msg) return res.status(404).json({ error: 'Media not found or unauthorized' });

        if (media_id.startsWith('local_media:')) {
            const fileName = media_id.replace('local_media:', '');
            const safeName = path.basename(fileName);
            const filePath = path.join(getUploadsDir(), safeName);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Local media file not found on disk' });
            }
            
            res.setHeader('Content-Type', msg.media_mime_type || 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            return fs.createReadStream(filePath).pipe(res);
        }

        const tenant = await Setting.findOne({ singletonId: 'admin_settings' });
        if (!tenant || !tenant.whatsapp_access_token) return res.status(400).json({ error: 'WhatsApp not configured' });

        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${media_id}`, {
            headers: { Authorization: `Bearer ${tenant.whatsapp_access_token}` }
        });
        const metaData = await metaRes.json();
        if (!metaData.url) throw new Error('Failed to get media URL from Meta: ' + JSON.stringify(metaData));

        const mediaRes = await fetch(metaData.url, {
            headers: { Authorization: `Bearer ${tenant.whatsapp_access_token}` }
        });

        if (!mediaRes.ok) throw new Error('Failed to download media binary');

        res.setHeader('Content-Type', metaData.mime_type || msg.media_mime_type || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        const arrayBuffer = await mediaRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);

    } catch (error) {
        console.error('Media download error:', error.message);
        res.status(500).json({ error: 'Failed to download media' });
    }
});

export default router;
