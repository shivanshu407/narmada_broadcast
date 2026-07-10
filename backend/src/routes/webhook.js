import { Router } from 'express';
import WhatsAppMessage from '../models/WhatsAppMessage.js';
import WhatsAppConversation from '../models/WhatsAppConversation.js';
import WhatsAppChatMessage from '../models/WhatsAppChatMessage.js';
import Contact from '../models/Contact.js';
import Setting from '../models/Setting.js';
import { emitToTenant } from '../services/websocket.js';
import { normalizePhone, sendTextMessage, sendMediaMessage, sendInteractiveMessage } from '../services/whatsapp.js';
import { flagEnabled } from '../config/botConfig.js';
import { initDatabase } from '../database.js';
import {
    HUMAN_HANDOFF_CONFIRMATION_PROMPT,
    buildHumanHandoffConfirmationPrompt,
    parseHumanHandoffConfirmationReply,
} from '../services/humanHandoffConfirmation.js';
import {
    SUPPORT_FEEDBACK_THANK_YOU,
    parseSupportFeedbackReply,
} from '../services/supportFeedback.js';
import {
    UNANSWERED_CHATTER_ACK_TEXT,
    UNANSWERED_NOISE_RETRY_TEXT,
    triageUnansweredMessage,
} from '../services/messageTriage.js';
import {
    productPriceAmount,
    sanitizeProductDescriptionForCatalogue,
} from '../utils/productCatalogue.js';

const router = Router();

/**
 * POST /api/v1/whatsapp-webhook
 * Meta Cloud API Webhook to receive messages and message delivery statuses
 */
router.post('/', async (req, res) => {
    try {
        await initDatabase();
        const body = req.body;
        console.log('[Webhook] Received payload:', JSON.stringify(body, null, 2));

        if (body.object !== 'whatsapp_business_account') {
            return res.sendStatus(404);
        }

        // We only have one tenant for now, fetch the global settings to get the tenant ID
        let setting = await Setting.findOne({ singletonId: 'admin_settings' });
        if (!setting) {
            setting = await Setting.findOne();
            if (setting && !setting.singletonId) {
                setting.singletonId = 'admin_settings';
                await setting.save();
            }
        }
        if (!setting) {
            setting = new Setting({ singletonId: 'admin_settings' });
            await setting.save();
        }
        const tenantId = setting._id.toString();

        for (const entry of body.entry) {
            for (const change of entry.changes) {
                const value = change.value;

                // 1. Handle incoming messages
                if (value.messages && value.messages.length > 0) {
                    for (const msg of value.messages) {
                        const fromPhone = normalizePhone(msg.from) || msg.from;
                        const messageId = msg.id;
                        const contactName = value.contacts?.[0]?.profile?.name || fromPhone;
                        
                        let bodyText = '[Unsupported Media]';
                        let mediaId = null;
                        let mediaMimeType = null;
                        
                        let parsedOrderItems = null;
                        let orderTotalAmount = 0;
                        let cancelOrderId = null;
                        
                        if (msg.type === 'text') {
                            bodyText = msg.text?.body || '';
                        } else if (msg.type === 'image') {
                            bodyText = msg.image?.caption || '📷 Image';
                            mediaId = msg.image?.id;
                            mediaMimeType = msg.image?.mime_type;
                        } else if (msg.type === 'document') {
                            bodyText = msg.document?.caption || msg.document?.filename || '📎 Document';
                            mediaId = msg.document?.id;
                            mediaMimeType = msg.document?.mime_type;
                        } else if (msg.type === 'audio') {
                            bodyText = '🎤 Voice Note';
                            mediaId = msg.audio?.id;
                            mediaMimeType = msg.audio?.mime_type;
                        } else if (msg.type === 'video') {
                            bodyText = msg.video?.caption || '🎥 Video';
                            mediaId = msg.video?.id;
                            mediaMimeType = msg.video?.mime_type;
                        } else if (msg.type === 'button') {
                            bodyText = msg.button?.text || '[Button Clicked]';
                        } else if (msg.type === 'interactive') {
                            if (msg.interactive?.type === 'button_reply') {
                                bodyText = msg.interactive?.button_reply?.title || '[Button Reply]';
                                const payloadId = msg.interactive?.button_reply?.id || '';
                                
                                // --- Detect Cancel Order Button ---
                                if (payloadId.startsWith('cancel_order_')) {
                                    cancelOrderId = payloadId.split('cancel_order_')[1];
                                }
                            } else if (msg.interactive?.type === 'list_reply') {
                                bodyText = msg.interactive?.list_reply?.title || '[List Reply]';
                            }
                        } else if (msg.type === 'order') {
                            const { default: Product } = await import('../models/Product.js');
                            const orderItems = msg.order?.product_items || [];
                            parsedOrderItems = [];
                            
                            let itemLines = [];
                            for (const item of orderItems) {
                                const sku = item.product_retailer_id;
                                const qty = parseInt(item.quantity || 1);
                                let itemPrice = parseFloat(item.item_price || 0);
                                
                                const product = await Product.findOne({ sku });
                                const name = product ? product.name : `Product (${sku})`;
                                if (product) {
                                    itemPrice = product.selling_price || product.mrp || itemPrice;
                                }
                                
                                orderTotalAmount += itemPrice * qty;
                                parsedOrderItems.push({
                                    product_id: product?._id,
                                    sku,
                                    item_name: name,
                                    quantity: qty,
                                    price: itemPrice
                                });
                                itemLines.push(`• ${name} (x${qty})`);
                            }
                            
                            bodyText = `🛒 Cart Received: ${orderItems.length} items\n\n${itemLines.join('\n')}\n\nTotal: ₹${orderTotalAmount.toFixed(2)}`;
                        }

                        // Check if message already exists
                        const existingMsg = await WhatsAppChatMessage.findOne({ provider_message_id: messageId });
                        if (existingMsg) continue;

                        // Find or create conversation
                        let conversation = await WhatsAppConversation.findOne({ tenant_id: tenantId, phone: fromPhone });
                        
                        if (!conversation) {
                            let contact = await Contact.findOne({ phone: { $regex: new RegExp(`${fromPhone.slice(-10)}$`) } });
                            if (!contact) {
                                contact = await Contact.create({
                                    name: contactName,
                                    phone: `+${fromPhone}`,
                                    source: 'whatsapp',
                                    whatsapp_consent: true
                                });
                            }
                            conversation = new WhatsAppConversation({
                                tenant_id: tenantId,
                                phone: fromPhone,
                                contact_name: contact?.name || contactName,
                                contact_id: contact?._id || null,
                                window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
                            });
                        } else {
                            if (!conversation.contact_name) conversation.contact_name = contactName;
                            if (!conversation.contact_id) {
                                const contact = await Contact.findOne({ phone: { $regex: new RegExp(`${fromPhone.slice(-10)}$`) } });
                                if (contact) conversation.contact_id = contact._id;
                            }
                        }

                        // Save chat message
                        const newMsg = await WhatsAppChatMessage.create({
                            tenant_id: tenantId,
                            conversation_id: conversation._id,
                            direction: 'inbound',
                            message_type: msg.type || 'text',
                            body: bodyText,
                            media_id: mediaId,
                            media_mime_type: mediaMimeType,
                            provider_message_id: messageId,
                            status: 'received'
                        });

                        // Update conversation
                        conversation.last_message_text = bodyText.substring(0, 100);
                        conversation.last_message_at = new Date();
                        conversation.unread_count = (conversation.unread_count || 0) + 1;
                        // Renew 24h window for inbound messages
                        conversation.window_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        
                        await conversation.save();

                        emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });

                        // --- Execute Cancel Order Action ---
                        if (cancelOrderId) {
                            try {
                                const { default: Order } = await import('../models/Order.js');
                                await Order.findByIdAndUpdate(cancelOrderId, {
                                    $set: { checkout_status: 'cancelled', fulfillment_status: 'cancelled', payment_status: 'failed' }
                                });
                                const cancelReply = "Your order has been cancelled successfully. 🛑\nIf you'd like to order again, simply send us a new cart.";
                                const result = await sendTextMessage(fromPhone, cancelReply, setting);
                                if (result && result.messageId) {
                                    await WhatsAppChatMessage.create({
                                        tenant_id: tenantId,
                                        conversation_id: conversation._id,
                                        direction: 'outbound',
                                        message_type: 'text',
                                        body: cancelReply,
                                        provider_message_id: result.messageId,
                                        status: 'sent'
                                    });
                                }
                                conversation.last_message_text = cancelReply.substring(0, 100);
                                conversation.last_message_at = new Date();
                                await conversation.save();
                                emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                            } catch (err) {
                                console.error('[Webhook] Failed to cancel order:', err);
                            }
                            continue; // Stop further bot processing for this message
                        }

                        // --- NEW: Handle Order Creation ---
                        if (msg.type === 'order' && parsedOrderItems) {
                            try {
                                const { default: Order } = await import('../models/Order.js');
                                const crypto = await import('crypto');
                                const Razorpay = (await import('razorpay')).default;
                                const checkoutToken = crypto.randomBytes(24).toString('hex');
                                
                                const newOrder = await Order.create({
                                    tenant_id: tenantId,
                                    contact_id: conversation.contact_id,
                                    phone: fromPhone,
                                    customer_name: conversation.contact_name,
                                    total_amount: orderTotalAmount,
                                    currency: 'INR',
                                    items: parsedOrderItems,
                                    source_channel: 'whatsapp_cart',
                                    checkout_token: checkoutToken,
                                    checkout_status: 'open',
                                    checkout_expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
                                });
                                
                                conversation.bot_state = {
                                    ...(conversation.bot_state || {}),
                                    awaiting_order_address: true,
                                    pending_order_id: newOrder._id.toString()
                                };
                                conversation.markModified('bot_state');
                                await conversation.save();
                                
                                const confirmText = `Thank you for your order! 🎉\n\nYour cart has been received. Your total is ₹${orderTotalAmount.toFixed(2)}.\n\n*Please reply with your full delivery address* to proceed with the payment.`;
                                const result = await sendTextMessage(fromPhone, confirmText, setting);
                                
                                if (result && result.messageId) {
                                    await WhatsAppChatMessage.create({
                                        tenant_id: tenantId,
                                        conversation_id: conversation._id,
                                        direction: 'outbound',
                                        message_type: 'text',
                                        body: confirmText,
                                        provider_message_id: result.messageId,
                                        status: 'sent'
                                    });
                                    conversation.last_message_text = confirmText.substring(0, 100);
                                    conversation.last_message_at = new Date();
                                    await conversation.save();
                                    emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                }
                            } catch (err) {
                                console.error('[Webhook] Failed to process incoming order:', err);
                            }
                            
                            // Skip automated bot reply since we handled the cart
                            continue;
                        }

                        const supportFeedbackRating = parseSupportFeedbackReply({
                            interactive: msg.interactive,
                            button: msg.button,
                        });
                        if (supportFeedbackRating) {
                            conversation.bot_state = {
                                ...(conversation.bot_state || {}),
                                last_support_feedback: {
                                    rating: supportFeedbackRating,
                                    received_at: new Date().toISOString(),
                                    message_id: newMsg._id.toString(),
                                },
                            };
                            conversation.markModified('bot_state');

                            const result = await sendTextMessage(fromPhone, SUPPORT_FEEDBACK_THANK_YOU, setting);
                            if (result && result.messageId) {
                                await WhatsAppChatMessage.create({
                                    tenant_id: tenantId,
                                    conversation_id: conversation._id,
                                    direction: 'outbound',
                                    message_type: 'text',
                                    body: SUPPORT_FEEDBACK_THANK_YOU,
                                    provider_message_id: result.messageId,
                                    status: 'sent'
                                });
                                conversation.last_message_text = SUPPORT_FEEDBACK_THANK_YOU;
                                conversation.last_message_at = new Date();
                                conversation.unread_count = 0;
                            }

                            await conversation.save();
                            emitToTenant(tenantId, 'chat_updated', {
                                type: 'support_feedback_received',
                                conversationId: conversation._id.toString(),
                                rating: supportFeedbackRating,
                            });
                            continue;
                        }

                        const botSettings = setting.bot_settings || {};
                        const botState = conversation.bot_state || {};
                        
                        // --- NEW: Handle Address Collection ---
                        if (botState.awaiting_order_address && msg.type === 'text') {
                            try {
                                const { default: Order } = await import('../models/Order.js');
                                const Razorpay = (await import('razorpay')).default;
                                
                                const order = await Order.findById(botState.pending_order_id);
                                if (order) {
                                    order.shipping_address = bodyText;
                                    order.checkout_status = 'ordered';
                                    
                                    // Generate direct Razorpay Payment Link
                                    let directPaymentLink = '';
                                    try {
                                        // Use db setting or fallback to test keys
                                        const keyId = setting.razorpay_key_id || process.env.RAZORPAY_KEY_ID || 'rzp_test_Sp8ow2u4uVKQIl';
                                        const keySecret = setting.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || 'HZ0Pp5Jblm8gys1HjRkIqCK4';
                                        
                                        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
                                        const rzpLink = await razorpay.paymentLink.create({
                                            amount: Math.round(order.total_amount * 100),
                                            currency: 'INR',
                                            description: `Order #${order._id} from WhatsApp`,
                                            customer: { contact: fromPhone, name: conversation.contact_name || 'Customer' },
                                            notify: { sms: true },
                                            notes: { order_id: order._id.toString() }
                                        });
                                        directPaymentLink = rzpLink.short_url;
                                        order.payment_link = directPaymentLink;
                                        order.payment_link_id = rzpLink.id;
                                    } catch (rzpErr) {
                                        console.error('[Webhook] Razorpay Link Gen Error:', rzpErr.message);
                                    }
                                    
                                    await order.save();
                                    
                                    let paymentText = `Thank you! Your address has been saved.\n\n`;
                                    if (directPaymentLink) {
                                        paymentText += `Please complete your payment securely using this Razorpay link:\n${directPaymentLink}`;
                                    } else {
                                        paymentText += `Our team will process it and send you a payment link shortly.`;
                                    }
                                    
                                    const { sendInteractiveMessage } = await import('../services/whatsapp.js');
                                    const interactivePayload = {
                                        type: "button",
                                        body: { text: paymentText },
                                        action: {
                                            buttons: [
                                                {
                                                    type: "reply",
                                                    reply: {
                                                        id: `cancel_order_${order._id}`,
                                                        title: "Cancel Order 🛑"
                                                    }
                                                }
                                            ]
                                        }
                                    };
                                    
                                    const result = await sendInteractiveMessage(fromPhone, interactivePayload, setting);
                                    
                                    if (result && result.messageId) {
                                        await WhatsAppChatMessage.create({
                                            tenant_id: tenantId,
                                            conversation_id: conversation._id,
                                            direction: 'outbound',
                                            message_type: 'interactive',
                                            body: paymentText,
                                            provider_message_id: result.messageId,
                                            status: 'sent'
                                        });
                                        conversation.last_message_text = paymentText.substring(0, 100);
                                        conversation.last_message_at = new Date();
                                    }
                                }
                                
                                // Clear the awaiting address state
                                botState.awaiting_order_address = false;
                                botState.pending_order_id = null;
                                conversation.bot_state = botState;
                                conversation.markModified('bot_state');
                                await conversation.save();
                                emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                
                            } catch (err) {
                                console.error('[Webhook] Failed to process address collection:', err);
                            }
                            continue; // Stop further bot processing for this message
                        }

                        const awaitingHumanConfirmation = Boolean(botState.awaiting_human_confirmation);
                        if (awaitingHumanConfirmation) {
                            const confirmationReply = parseHumanHandoffConfirmationReply({
                                bodyText,
                                interactive: msg.interactive,
                                button: msg.button,
                            });

                            if (confirmationReply === 'yes') {
                                const handoffText = 'I have notified the store team. A person will join this chat shortly.';
                                conversation.needs_human = true;
                                conversation.bot_paused = true;
                                conversation.handoff_reason = 'customer_confirmed_handoff';
                                conversation.bot_state = { ...(conversation.bot_state || {}), awaiting_human_confirmation: false };
                                conversation.markModified('bot_state');
                                await conversation.save();
                                emitToTenant(tenantId, 'handoff_requested', {
                                    conversationId: conversation._id.toString(),
                                    reason: 'customer_confirmed_handoff',
                                });

                                const result = await sendTextMessage(fromPhone, handoffText, setting);
                                if (result && result.messageId) {
                                    await WhatsAppChatMessage.create({
                                        tenant_id: tenantId,
                                        conversation_id: conversation._id,
                                        direction: 'outbound',
                                        message_type: 'text',
                                        body: handoffText,
                                        provider_message_id: result.messageId,
                                        status: 'sent'
                                    });
                                    conversation.last_message_text = handoffText.substring(0, 100);
                                    conversation.last_message_at = new Date();
                                    conversation.unread_count = 0;
                                    await conversation.save();
                                    emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                }

                                if (flagEnabled(botSettings, 'learning')) {
                                    try {
                                        const { logBotInteraction } = await import('../services/botLearning.js');
                                        await logBotInteraction({
                                            tenantId,
                                            conversationId: conversation._id.toString(),
                                            phone: fromPhone,
                                            interactionType: 'handoff_requested',
                                            intent: 'human_handoff_confirmation',
                                            outcome: 'confirmed',
                                            metadata: { source: 'unknown_message_confirmation' },
                                        });
                                    } catch (e) {}
                                }
                                continue;
                            }

                            if (confirmationReply === 'no') {
                                const retryText = "No problem. Please rephrase your question and I'll try again.";
                                conversation.bot_state = { ...(conversation.bot_state || {}), awaiting_human_confirmation: false };
                                conversation.markModified('bot_state');
                                await conversation.save();

                                const result = await sendTextMessage(fromPhone, retryText, setting);
                                if (result && result.messageId) {
                                    await WhatsAppChatMessage.create({
                                        tenant_id: tenantId,
                                        conversation_id: conversation._id,
                                        direction: 'outbound',
                                        message_type: 'text',
                                        body: retryText,
                                        provider_message_id: result.messageId,
                                        status: 'sent'
                                    });
                                    conversation.last_message_text = retryText.substring(0, 100);
                                    conversation.last_message_at = new Date();
                                    conversation.unread_count = 0;
                                    await conversation.save();
                                    emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                }

                                if (flagEnabled(botSettings, 'learning')) {
                                    try {
                                        const { logBotInteraction } = await import('../services/botLearning.js');
                                        await logBotInteraction({
                                            tenantId,
                                            conversationId: conversation._id.toString(),
                                            phone: fromPhone,
                                            interactionType: 'human_handoff_confirmation',
                                            intent: 'human_handoff_confirmation',
                                            outcome: 'declined',
                                            metadata: { source: 'unknown_message_confirmation' },
                                        });
                                    } catch (e) {}
                                }
                                continue;
                            }

                            conversation.bot_state = { ...(conversation.bot_state || {}), awaiting_human_confirmation: false };
                            conversation.markModified('bot_state');
                            await conversation.save();
                        }

                        // --- AI Bot Smart Responder Logic ---
                        if (conversation.bot_paused) {
                            console.log(`[Webhook] Bot paused for conversation #${conversation._id}. Skipping automated reply.`);
                            continue;
                        }

                        const automationEnabled = botSettings.enabled !== false;
                        if (!automationEnabled) {
                            continue;
                        }

                        try {
                            // Handle disambiguation tap
                            if (msg.type === 'interactive' && msg.interactive?.type === 'list_reply' && msg.interactive?.list_reply?.id?.startsWith('faq_pick_')) {
                                const pickId = msg.interactive.list_reply.id.replace('faq_pick_', '');
                                if (pickId === 'none') {
                                    const result = await sendTextMessage(fromPhone, "No problem! Please type your question again in your own words and I'll do my best to help.", setting);
                                    if (result && result.messageId) {
                                        await WhatsAppChatMessage.create({
                                            tenant_id: tenantId,
                                            conversation_id: conversation._id,
                                            direction: 'outbound',
                                            message_type: 'text',
                                            body: "No problem! Please type your question again in your own words and I'll do my best to help.",
                                            provider_message_id: result.messageId,
                                            status: 'sent'
                                        });
                                        conversation.last_message_text = "No problem! Please type your question again in your own words and I'll do my best to help.";
                                        conversation.last_message_at = new Date();
                                        conversation.unread_count = 0;
                                        await conversation.save();
                                        emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                    }
                                    continue;
                                }
                                const { default: KnowledgeBase } = await import('../models/KnowledgeBase.js');
                                const picked = await KnowledgeBase.findOne({ _id: pickId, is_active: true });
                                const replyText = picked ? picked.answer : 'Sorry, that option is no longer available. Please type your question again.';
                                const result = await sendTextMessage(fromPhone, replyText, setting);
                                if (result && result.messageId) {
                                    await WhatsAppChatMessage.create({
                                        tenant_id: tenantId,
                                        conversation_id: conversation._id,
                                        direction: 'outbound',
                                        message_type: 'text',
                                        body: replyText,
                                        provider_message_id: result.messageId,
                                        status: 'sent'
                                    });
                                    conversation.last_message_text = replyText.substring(0, 100);
                                    conversation.last_message_at = new Date();
                                    conversation.unread_count = 0;
                                    await conversation.save();
                                    emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                }
                                continue;
                            }

                            const { handleSmartReply } = await import('../services/smartResponder.js');
                            let chatHistory = [];
                            try {
                                const historyRows = await WhatsAppChatMessage.find({ conversation_id: conversation._id })
                                    .sort({ created_at: -1 })
                                    .limit(4)
                                    .lean();
                                if (historyRows && historyRows.length > 0) {
                                    chatHistory = historyRows.reverse();
                                }
                            } catch (err) {
                                console.error('[Bot] Failed to fetch chat history for memory:', err.message);
                            }

                            const botReply = await handleSmartReply(tenantId, bodyText, chatHistory, botSettings, {
                                tenant: setting,
                                phone: fromPhone,
                                conversationId: conversation._id.toString(),
                            });

                            if (botReply) {
                                if (botReply.type === 'disambiguation') {
                                    const rows = (botReply.candidates || []).slice(0, 9).map((c) => {
                                        const q = String(c.question || '').trim();
                                        const title = q.length > 24 ? `${q.slice(0, 23)}…` : (q || 'Option');
                                        const row = { id: `faq_pick_${c._id || c.id}`, title };
                                        if (q.length > 24) row.description = q.slice(0, 72);
                                        return row;
                                    });
                                    rows.push({ id: 'faq_pick_none', title: 'None of these' });

                                    const interactiveOptions = {
                                        type: 'list',
                                        header: { type: 'text', text: 'Did you mean?' },
                                        body: { text: 'I found a few possible matches. Tap the one closest to your question:' },
                                        footer: { text: 'Select an option' },
                                        action: { button: 'View options', sections: [{ title: 'Suggestions', rows }] },
                                    };
                                    const result = await sendInteractiveMessage(fromPhone, interactiveOptions, setting);
                                    if (result && result.messageId) {
                                        await WhatsAppChatMessage.create({
                                            tenant_id: tenantId,
                                            conversation_id: conversation._id,
                                            direction: 'outbound',
                                            message_type: 'interactive',
                                            body: '[Did You Mean Sent]',
                                            provider_message_id: result.messageId,
                                            status: 'sent'
                                        });
                                        conversation.last_message_text = '[Did You Mean Sent]';
                                        conversation.last_message_at = new Date();
                                        conversation.unread_count = 0;
                                        await conversation.save();
                                        emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                    }
                                    if (flagEnabled(botSettings, 'learning')) {
                                        try {
                                            const { logBotInteraction } = await import('../services/botLearning.js');
                                            await logBotInteraction({
                                                tenantId,
                                                conversationId: conversation._id.toString(),
                                                phone: fromPhone,
                                                interactionType: 'disambiguation_shown',
                                                intent: 'faq_disambiguation',
                                                outcome: 'awaiting_tap',
                                                metadata: { candidates: botReply.candidates || [] },
                                            });
                                        } catch (e) {}
                                    }
                                    continue;
                                }

                                if (botReply.type === 'order_status') {
                                    const result = await sendTextMessage(fromPhone, botReply.text, setting);
                                    if (result && result.messageId) {
                                        await WhatsAppChatMessage.create({
                                            tenant_id: tenantId,
                                            conversation_id: conversation._id,
                                            direction: 'outbound',
                                            message_type: 'text',
                                            body: botReply.text,
                                            provider_message_id: result.messageId,
                                            status: 'sent'
                                        });
                                        conversation.last_message_text = botReply.text.substring(0, 100);
                                        conversation.last_message_at = new Date();
                                        conversation.unread_count = 0;
                                        await conversation.save();
                                        emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                    }
                                    continue;
                                }

                                if (botReply.type === 'handoff') {
                                    conversation.needs_human = true;
                                    conversation.bot_paused = true;
                                    conversation.handoff_reason = botReply.reason || 'smart_flow_handoff';
                                    await conversation.save();
                                    emitToTenant(tenantId, 'handoff_requested', { conversationId: conversation._id.toString(), reason: botReply.reason || 'smart_flow_handoff' });

                                    const result = await sendTextMessage(fromPhone, botReply.text, setting);
                                    if (result && result.messageId) {
                                        await WhatsAppChatMessage.create({
                                            tenant_id: tenantId,
                                            conversation_id: conversation._id,
                                            direction: 'outbound',
                                            message_type: 'text',
                                            body: botReply.text,
                                            provider_message_id: result.messageId,
                                            status: 'sent'
                                        });
                                        conversation.last_message_text = botReply.text.substring(0, 100);
                                        conversation.last_message_at = new Date();
                                        conversation.unread_count = 0;
                                        await conversation.save();
                                        emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                    }
                                    continue;
                                }

                                let result;
                                let textToSave = '';
                                let typeToSave = 'text';
                                let interactionType = botReply.type;
                                let interactionMetadata = { score: botReply.score, band: botReply.band };

                                if (botReply.type === 'faq') {
                                    let replyText = botReply.text;
                                    if (flagEnabled(botSettings, 'smart_flows')) {
                                        try {
                                            const { renderSlots } = await import('../services/smartFlows.js');
                                            replyText = renderSlots(replyText, { tenant: setting, botSettings });
                                        } catch (slotErr) {}
                                    }
                                    result = await sendTextMessage(fromPhone, replyText, setting);
                                    textToSave = replyText;
                                    interactionType = 'faq_answer';
                                } else if (botReply.type === 'product') {
                                    const product = botReply.data;
                                    interactionType = 'product_answer';
                                    interactionMetadata.product_id = product._id || product.id;
                                    const description = sanitizeProductDescriptionForCatalogue(product.description);
                                    const caption = [
                                        `*${product.name}*`,
                                        description,
                                        `Price: ₹${productPriceAmount(product)}`
                                    ].filter(Boolean).join('\n');

                                    if (setting.whatsapp_catalog_id && product.sku) {
                                        const interactivePayload = {
                                            type: "product",
                                            body: { text: caption },
                                            action: {
                                                catalog_id: setting.whatsapp_catalog_id,
                                                product_retailer_id: product.sku
                                            }
                                        };
                                        const { sendInteractiveMessage } = await import('../services/whatsapp.js');
                                        result = await sendInteractiveMessage(fromPhone, interactivePayload, setting);
                                        textToSave = caption;
                                        typeToSave = 'interactive';
                                    } else if (product.image_url) {
                                        result = await sendMediaMessage(fromPhone, 'image', { link: product.image_url }, caption, setting);
                                        textToSave = caption;
                                        typeToSave = 'image';
                                    } else {
                                        result = await sendTextMessage(fromPhone, caption, setting);
                                        textToSave = caption;
                                    }
                                } else if (botReply.type === 'language_selection') {
                                    interactionType = 'language_selection';
                                    const interactivePayload = {
                                        type: "button",
                                        body: { text: botReply.text || "Welcome! Please select your preferred language:" },
                                        action: {
                                            buttons: [
                                                { type: "reply", reply: { id: "lang_en", title: "English" } },
                                                { type: "reply", reply: { id: "lang_gu", title: "ગુજરાતી" } },
                                                { type: "reply", reply: { id: "lang_hi", title: "हिंदी" } }
                                            ]
                                        }
                                    };
                                    const { sendInteractiveMessage } = await import('../services/whatsapp.js');
                                    result = await sendInteractiveMessage(fromPhone, interactivePayload, setting);
                                    textToSave = botReply.text || "Welcome! Please select your preferred language:";
                                    typeToSave = 'interactive';
                                } else if (botReply.type === 'catalog_message') {
                                    interactionType = 'catalog_message';
                                    const interactivePayload = {
                                        type: "catalog_message",
                                        body: { text: botReply.text },
                                        action: {
                                            name: "catalog_message"
                                        }
                                    };
                                    const { sendInteractiveMessage } = await import('../services/whatsapp.js');
                                    result = await sendInteractiveMessage(fromPhone, interactivePayload, setting);
                                    textToSave = botReply.text;
                                    typeToSave = 'interactive';
                                }

                                if (result && result.messageId) {
                                    await WhatsAppChatMessage.create({
                                        tenant_id: tenantId,
                                        conversation_id: conversation._id,
                                        direction: 'outbound',
                                        message_type: typeToSave,
                                        body: textToSave,
                                        provider_message_id: result.messageId,
                                        status: 'sent'
                                    });
                                    conversation.last_message_text = textToSave.substring(0, 100);
                                    conversation.last_message_at = new Date();
                                    conversation.unread_count = 0;
                                    await conversation.save();
                                    emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });

                                    if (flagEnabled(botSettings, 'learning')) {
                                        try {
                                            const { logBotInteraction } = await import('../services/botLearning.js');
                                            await logBotInteraction({
                                                tenantId,
                                                conversationId: conversation._id.toString(),
                                                phone: fromPhone,
                                                interactionType,
                                                faqId: botReply.faqId || null,
                                                productId: interactionMetadata.product_id || null,
                                                intent: botReply.type,
                                                outcome: 'answered',
                                                metadata: interactionMetadata,
                                            });
                                        } catch (e) {}
                                    }
                                }
                            } else {
                                const triage = triageUnansweredMessage(bodyText);
                                try {
                                    if (flagEnabled(botSettings, 'learning')) {
                                        const { logUnanswered } = await import('../services/botLearning.js');
                                        await logUnanswered({
                                            tenantId,
                                            conversationId: conversation._id.toString(),
                                            phone: fromPhone,
                                            messageBody: bodyText,
                                            learningStatus: triage.learningStatus,
                                            triage,
                                            metadata: { messageType: msg.type, inboundMessageId: newMsg._id.toString() },
                                        });
                                    }
                                } catch (e) {}

                                const sendAutomationText = async (replyText) => {
                                    const result = await sendTextMessage(fromPhone, replyText, setting);
                                    if (result && result.messageId) {
                                        await WhatsAppChatMessage.create({
                                            tenant_id: tenantId,
                                            conversation_id: conversation._id,
                                            direction: 'outbound',
                                            message_type: 'text',
                                            body: replyText,
                                            provider_message_id: result.messageId,
                                            status: 'sent'
                                        });
                                        conversation.last_message_text = replyText.substring(0, 100);
                                        conversation.last_message_at = new Date();
                                        conversation.unread_count = 0;
                                        await conversation.save();
                                        emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });
                                    }
                                };

                                if (triage.replyAction === 'retry') {
                                    await sendAutomationText(UNANSWERED_NOISE_RETRY_TEXT);
                                    continue;
                                }

                                if (triage.replyAction === 'acknowledge') {
                                    await sendAutomationText(UNANSWERED_CHATTER_ACK_TEXT);
                                    continue;
                                }

                                if (triage.replyAction === 'direct_handoff') {
                                    const handoffText = 'I have notified the store team. A person will join this chat shortly.';
                                    conversation.needs_human = true;
                                    conversation.bot_paused = true;
                                    conversation.handoff_reason = 'customer_requested_handoff';
                                    conversation.bot_state = { ...(conversation.bot_state || {}), awaiting_human_confirmation: false };
                                    conversation.markModified('bot_state');
                                    await conversation.save();
                                    emitToTenant(tenantId, 'handoff_requested', {
                                        conversationId: conversation._id.toString(),
                                        reason: 'customer_requested_handoff',
                                    });
                                    await sendAutomationText(handoffText);

                                    if (flagEnabled(botSettings, 'learning')) {
                                        try {
                                            const { logBotInteraction } = await import('../services/botLearning.js');
                                            await logBotInteraction({
                                                tenantId,
                                                conversationId: conversation._id.toString(),
                                                phone: fromPhone,
                                                interactionType: 'handoff_requested',
                                                intent: 'human_request',
                                                outcome: 'direct_handoff',
                                                metadata: { messageType: msg.type, inboundMessageId: newMsg._id.toString(), triage },
                                            });
                                        } catch (e) {}
                                    }
                                    continue;
                                }

                                if (triage.replyAction === 'confirm_handoff') {
                                    const confirmationPrompt = buildHumanHandoffConfirmationPrompt();
                                    const result = await sendInteractiveMessage(fromPhone, confirmationPrompt, setting);
                                    if (result && result.messageId) {
                                        await WhatsAppChatMessage.create({
                                            tenant_id: tenantId,
                                            conversation_id: conversation._id,
                                            direction: 'outbound',
                                            message_type: 'interactive',
                                            body: HUMAN_HANDOFF_CONFIRMATION_PROMPT,
                                            provider_message_id: result.messageId,
                                            status: 'sent'
                                        });
                                        conversation.bot_state = { ...(conversation.bot_state || {}), awaiting_human_confirmation: true };
                                        conversation.markModified('bot_state');
                                        conversation.last_message_text = HUMAN_HANDOFF_CONFIRMATION_PROMPT.substring(0, 100);
                                        conversation.last_message_at = new Date();
                                        conversation.unread_count = 0;
                                        await conversation.save();
                                        emitToTenant(tenantId, 'chat_updated', { type: 'new_message', conversationId: conversation._id.toString() });

                                        if (flagEnabled(botSettings, 'learning')) {
                                            try {
                                                const { logBotInteraction } = await import('../services/botLearning.js');
                                                await logBotInteraction({
                                                    tenantId,
                                                    conversationId: conversation._id.toString(),
                                                    phone: fromPhone,
                                                    interactionType: 'human_handoff_confirmation',
                                                    intent: 'unknown_message',
                                                    outcome: 'awaiting_customer_confirmation',
                                                    metadata: { messageType: msg.type, inboundMessageId: newMsg._id.toString(), triage },
                                                });
                                            } catch (e) {}
                                        }
                                    }
                                }
                            }
                        } catch (botErr) {
                            console.error('[Bot] Failed to run Smart Responder:', botErr.message);
                        }
                    }
                }

                // 2. Handle message statuses (sent, delivered, read, failed)
                if (value.statuses && value.statuses.length > 0) {
                    for (const status of value.statuses) {
                        const messageId = status.id;
                        const updateData = { status: status.status };
                        
                        if (status.status === 'failed' && status.errors) {
                            updateData.error_message = status.errors[0]?.message || 'Unknown error';
                        }
                        
                        // Update broadcast message status
                        await WhatsAppMessage.updateOne(
                            { provider_message_id: messageId },
                            { $set: updateData }
                        );

                        // Update chat message status
                        const chatMsg = await WhatsAppChatMessage.findOneAndUpdate(
                            { provider_message_id: messageId },
                            { $set: updateData },
                            { new: true }
                        );

                        if (chatMsg) {
                            emitToTenant(tenantId, 'chat_updated', { type: 'status_update', conversationId: chatMsg.conversation_id.toString(), messageId: chatMsg._id.toString(), status: updateData.status });
                        }
                    }
                }
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.sendStatus(500);
    }
});

/**
 * GET /api/v1/whatsapp-webhook
 * Meta Cloud API Webhook Verification
 */
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe') {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

export default router;
