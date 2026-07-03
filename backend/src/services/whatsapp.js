/**
 * Meta WhatsApp Cloud API Service
 * Multi-tenant: reads credentials from tenant object
 */
import {
    formatMetaCataloguePrice,
    sanitizeProductDescriptionForCatalogue,
} from '../utils/productCatalogue.js';

const WHATSAPP_API_VERSION = 'v22.0';
const WHATSAPP_API_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

function getCredentials(tenant) {
    if (!tenant) throw new Error('Tenant context required for WhatsApp operations');
    const token = tenant.whatsapp_access_token?.trim();
    const phoneId = tenant.whatsapp_phone_number_id?.trim();
    if (!token || !phoneId) throw new Error('WhatsApp not configured. Add your Meta API credentials in Settings.');
    return { token, phoneId, wabaId: tenant.whatsapp_business_account_id?.trim() };
}

function formatMetaError(data, defaultMsg) {
    if (!data || !data.error) return defaultMsg;
    const err = data.error;
    let msg = err.error_user_title ? `${err.error_user_title}: ${err.error_user_msg}` : (err.error_user_msg || err.error_data?.details || err.message || defaultMsg);
    if (err.code) msg += ` (Code ${err.code})`;
    return msg;
}

/**
 * Normalize Indian phone numbers to WhatsApp format (91XXXXXXXXXX)
 */
export function normalizePhone(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return '91' + cleaned;
    if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned;
    if (cleaned.startsWith('0') && cleaned.length === 11) return '91' + cleaned.slice(1);
    if (cleaned.startsWith('091') && cleaned.length === 13) return cleaned.slice(1);
    return cleaned.length >= 10 ? cleaned : null;
}

// Caches
const templateDefCache = new Map();
const mediaIdCache = new Map();

function tenantCacheKey(tenant, key) {
    return `${tenant.id}:${key}`;
}

async function processAndCacheMediaId(imageUrl, tenant) {
    const cacheKey = tenantCacheKey(tenant, imageUrl);
    if (mediaIdCache.has(cacheKey)) return mediaIdCache.get(cacheKey);

    try {
        const { token, phoneId } = getCredentials(tenant);
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.statusText}`);

        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

        const blob = new Blob([buffer], { type: contentType });
        const formData = new FormData();
        formData.append('file', blob, 'header_image.jpg');
        formData.append('type', contentType);
        formData.append('messaging_product', 'whatsapp');

        const uploadRes = await fetch(`${WHATSAPP_API_URL}/${phoneId}/media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const uploadData = await uploadRes.json();
        if (uploadData.id) {
            mediaIdCache.set(cacheKey, uploadData.id);
            return uploadData.id;
        }
        return null;
    } catch (err) {
        console.error('[WhatsApp] Error processing media URL:', err.message);
        return null;
    }
}

export async function getTemplateDefinition(templateName, tenant) {
    const cacheKey = tenantCacheKey(tenant, templateName);
    const cached = templateDefCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) return cached.data;

    try {
        const templates = await fetchTemplates(tenant);
        const tpl = templates.find(t => t.name === templateName);
        if (tpl) templateDefCache.set(cacheKey, { data: tpl, fetchedAt: Date.now() });
        return tpl || null;
    } catch (err) {
        console.error(`[WhatsApp] Failed to fetch template definition for "${templateName}":`, err.message);
        return null;
    }
}

/**
 * Send a template message
 */
export async function sendTemplateMessage(phone, campaignName, templateParams = [], userName = '', languageCode = null, tenant) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error(`Invalid phone number: ${phone}`);

    const { token, phoneId } = getCredentials(tenant);
    const tplDef = await getTemplateDefinition(campaignName, tenant);
    const tplComponents = tplDef?.components || [];
    const components = [];

    // HEADER
    const headerComp = tplComponents.find(c => c.type === 'HEADER');
    if (headerComp) {
        if (headerComp.format === 'IMAGE') {
            const imageUrl = headerComp.example?.header_handle?.[0] || headerComp.example?.header_url?.[0];
            if (imageUrl) {
                let imageSpec = { link: imageUrl };
                if (imageUrl.includes('scontent.whatsapp.net')) {
                    const mediaId = await processAndCacheMediaId(imageUrl, tenant);
                    if (mediaId) imageSpec = { id: mediaId };
                }
                components.push({ type: "header", parameters: [{ type: "image", image: imageSpec }] });
            }
        } else if (headerComp.format === 'VIDEO') {
            const videoUrl = headerComp.example?.header_handle?.[0] || headerComp.example?.header_url?.[0];
            if (videoUrl) components.push({ type: "header", parameters: [{ type: "video", video: { link: videoUrl } }] });
        } else if (headerComp.format === 'DOCUMENT') {
            const docUrl = headerComp.example?.header_handle?.[0] || headerComp.example?.header_url?.[0];
            if (docUrl) components.push({ type: "header", parameters: [{ type: "document", document: { link: docUrl } }] });
        }
    }

    // BODY
    const filledParams = templateParams.filter(p => p && String(p).trim() !== '');
    if (filledParams.length > 0) {
        components.push({
            type: "body",
            parameters: filledParams.map(param => {
                let textVal = String(param);
                if (textVal.includes('{name}')) textVal = textVal.replace(/{name}/g, userName || 'Customer');
                if (textVal.includes('{{name}}')) textVal = textVal.replace(/{{name}}/g, userName || 'Customer');
                return { type: "text", text: textVal };
            })
        });
    }

    // BUTTONS
    const buttonsComp = tplComponents.find(c => c.type === 'BUTTONS');
    if (buttonsComp?.buttons) {
        buttonsComp.buttons.forEach((btn, idx) => {
            if (btn.type === 'URL' && btn.url?.includes('{{')) {
                components.push({ type: "button", sub_type: "url", index: String(idx), parameters: [{ type: "text", text: "details" }] });
            }
        });
    }

    const langCode = languageCode || tplDef?.language || (campaignName === 'hello_world' ? 'en_US' : 'en');

    const payload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "template",
        template: {
            name: campaignName,
            language: { code: langCode },
            components: components.length > 0 ? components : undefined
        }
    };

    const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, `WhatsApp Cloud API error (${response.status})`));

    return {
        messageId: data.messages?.[0]?.id || null,
        data
    };
}

/**
 * Send an interactive message (buttons, list, catalog)
 */
export async function sendInteractiveMessage(phone, interactivePayload, tenant) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error(`Invalid phone number: ${phone}`);

    const { token, phoneId } = getCredentials(tenant);

    const payload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "interactive",
        interactive: interactivePayload
    };

    const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, `WhatsApp API error (${response.status})`));

    return { messageId: data.messages?.[0]?.id || null, data };
}

/**
 * Send a free-form text message (within 24h window)
 */
export async function sendTextMessage(phone, text, tenant) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error(`Invalid phone number: ${phone}`);

    const { token, phoneId } = getCredentials(tenant);

    const payload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "text",
        text: { body: text }
    };

    const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, `WhatsApp API error (${response.status})`));

    return { messageId: data.messages?.[0]?.id || null, data };
}

/**
 * Send a contact (vCard) message
 */
export async function sendContactMessage(phone, contactInfo, tenant) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error(`Invalid phone number: ${phone}`);

    const { token, phoneId } = getCredentials(tenant);

    const payload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "contacts",
        contacts: [contactInfo]
    };

    const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, `WhatsApp API error (${response.status})`));

    return { messageId: data.messages?.[0]?.id || null, data };
}

/**
 * Upload binary buffer directly to Meta API to get a media ID for messaging
 */
export async function uploadMediaForMessage(buffer, mimeType, filename, tenant) {
    const { token, phoneId } = getCredentials(tenant);

    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, filename || 'image.jpg');
    formData.append('type', mimeType);
    formData.append('messaging_product', 'whatsapp');

    const uploadRes = await fetch(`${WHATSAPP_API_URL}/${phoneId}/media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(formatMetaError(uploadData, 'Failed to upload media to Meta'));
    return uploadData.id;
}

/**
 * Send a media message (image/document/video within 24h window)
 */
export async function sendMediaMessage(phone, mediaType, mediaData, caption, tenant) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error(`Invalid phone number: ${phone}`);

    const { token, phoneId } = getCredentials(tenant);

    // mediaData can be a URL string or an object { id: 'meta_media_id' }
    const mediaPayload = typeof mediaData === 'string' ? { link: mediaData } : { id: mediaData.id };
    if (caption && mediaType !== 'audio') mediaPayload.caption = caption;

    const payload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: mediaType,
        [mediaType]: mediaPayload
    };

    const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, `WhatsApp API error (${response.status})`));

    return { messageId: data.messages?.[0]?.id || null, data };
}

/**
 * Get media URL from Meta (for viewing inbound media)
 */
export async function getMediaUrl(mediaId, tenant) {
    const { token } = getCredentials(tenant);

    const response = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, 'Failed to get media URL'));

    return data.url;
}

/**
 * Send bulk template messages with rate limiting
 */
export async function sendBulkMessages(recipients, campaignName, templateParams = [], batchSize = 0, delayMs = 100, languageCode = null, tenant) {
    const results = { successful: 0, failed: 0, errors: [], messageIds: [] };

    const validRecipients = recipients.filter(r => {
        const normalized = normalizePhone(r.phone);
        if (!normalized) { results.failed++; results.errors.push({ phone: r.phone, name: r.name, error: 'Invalid phone number' }); return false; }
        return true;
    }).map(r => ({ ...r, normalizedPhone: normalizePhone(r.phone) }));

    // Send all at once (no batching unless explicitly set)
    const actualBatch = batchSize > 0 ? batchSize : validRecipients.length;

    for (let i = 0; i < validRecipients.length; i += actualBatch) {
        const batch = validRecipients.slice(i, i + actualBatch);
        const batchPromises = batch.map(async (recipient) => {
            try {
                const data = await sendTemplateMessage(recipient.normalizedPhone, campaignName, templateParams, recipient.name || 'Customer', languageCode, tenant);
                results.successful++;
                results.messageIds.push({ phone: recipient.normalizedPhone, name: recipient.name, messageId: data.messageId });
            } catch (error) {
                results.failed++;
                results.errors.push({ phone: recipient.phone, name: recipient.name, error: error.message });
            }
        });

        await Promise.all(batchPromises);
        if (i + actualBatch < validRecipients.length) await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return results;
}

/**
 * Upload media for template creation (resumable upload)
 */
export async function uploadMediaForTemplate(imageBuffer, mimeType = 'image/jpeg', fileName = 'template_header.jpg', tenant) {
    const { token } = getCredentials(tenant);

    const sessionUrl = `${WHATSAPP_API_URL}/app/uploads?file_length=${imageBuffer.length}&file_type=${encodeURIComponent(mimeType)}&file_name=${encodeURIComponent(fileName)}`;
    const sessionRes = await fetch(sessionUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    const sessionData = await sessionRes.json();
    if (!sessionRes.ok || !sessionData.id) throw new Error(formatMetaError(sessionData, 'Failed to create upload session'));

    const uploadRes = await fetch(`${WHATSAPP_API_URL}/${sessionData.id}`, {
        method: 'POST',
        headers: { 'Authorization': `OAuth ${token}`, 'file_offset': '0', 'Content-Type': mimeType },
        body: imageBuffer,
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.h) throw new Error(formatMetaError(uploadData, 'Failed to upload media file'));

    return uploadData.h;
}

/**
 * Create a new WhatsApp template
 */
export async function createTemplate({ name, category, language, bodyText, headerImageHandle, footerText, buttons = [] }, tenant) {
    const { token, wabaId } = getCredentials(tenant);
    if (!wabaId) throw new Error('WhatsApp Business Account ID not configured.');

    const components = [];

    if (headerImageHandle) {
        components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [headerImageHandle] } });
    }

    const bodyComponent = { type: 'BODY', text: bodyText };
    const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g);
    if (variableMatches && variableMatches.length > 0) {
        bodyComponent.example = { body_text: [variableMatches.map((_, i) => `Sample ${i + 1}`)] };
    }
    components.push(bodyComponent);

    if (footerText?.trim()) components.push({ type: 'FOOTER', text: footerText.trim() });

    // Build buttons component (supports PHONE_NUMBER, URL, QUICK_REPLY)
    const validButtons = (buttons || []).filter(b => b && b.type);
    if (validButtons.length > 0) {
        const metaButtons = validButtons.map(btn => {
            if (btn.type === 'PHONE_NUMBER' && btn.text && btn.phone) {
                return {
                    type: 'PHONE_NUMBER',
                    text: btn.text.substring(0, 25),
                    phone_number: btn.phone.startsWith('+') ? btn.phone : `+${btn.phone}`,
                };
            }
            if (btn.type === 'URL' && btn.text && btn.url) {
                const urlBtn = {
                    type: 'URL',
                    text: btn.text.substring(0, 25),
                    url: btn.url,
                };
                // If URL contains {{1}}, it's a dynamic URL — add example
                if (btn.url.includes('{{1}}')) {
                    urlBtn.example = [btn.urlExample || 'https://example.com'];
                }
                return urlBtn;
            }
            if (btn.type === 'QUICK_REPLY' && btn.text) {
                return { type: 'QUICK_REPLY', text: btn.text.substring(0, 25) };
            }
            return null;
        }).filter(Boolean);

        if (metaButtons.length > 0) {
            components.push({ type: 'BUTTONS', buttons: metaButtons });
        }
    }

    const payload = {
        name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category: category || 'MARKETING',
        language: language || 'en',
        components
    };

    const response = await fetch(`${WHATSAPP_API_URL}/${wabaId}/message_templates`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, `Failed to create template (${response.status})`));

    return { id: data.id, status: data.status, category: data.category };
}

/**
 * Fetch all templates from Meta
 */
export async function fetchTemplates(tenant) {
    const { token, wabaId } = getCredentials(tenant);
    if (!wabaId) throw new Error('WhatsApp Business Account ID not configured.');

    const response = await fetch(`${WHATSAPP_API_URL}/${wabaId}/message_templates?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, 'Failed to fetch templates'));
    return data.data || [];
}

/**
 * Edit an existing WhatsApp template (Meta API: POST /{template_id})
 * Only components can be edited — name, category, language cannot change.
 */
export async function editTemplate(templateId, { bodyText, headerImageHandle, footerText, buttons = [] }, tenant) {
    const { token, wabaId } = getCredentials(tenant);
    if (!wabaId) throw new Error('WhatsApp Business Account ID not configured.');

    const components = [];

    if (headerImageHandle) {
        components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [headerImageHandle] } });
    }

    const bodyComponent = { type: 'BODY', text: bodyText };
    const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g);
    if (variableMatches && variableMatches.length > 0) {
        bodyComponent.example = { body_text: [variableMatches.map((_, i) => `Sample ${i + 1}`)] };
    }
    components.push(bodyComponent);

    if (footerText?.trim()) components.push({ type: 'FOOTER', text: footerText.trim() });

    // Build buttons component (supports PHONE_NUMBER, URL, QUICK_REPLY)
    const validButtons = (buttons || []).filter(b => b && b.type);
    if (validButtons.length > 0) {
        const metaButtons = validButtons.map(btn => {
            if (btn.type === 'PHONE_NUMBER' && btn.text && btn.phone) {
                return {
                    type: 'PHONE_NUMBER',
                    text: btn.text.substring(0, 25),
                    phone_number: btn.phone.startsWith('+') ? btn.phone : `+${btn.phone}`,
                };
            }
            if (btn.type === 'URL' && btn.text && btn.url) {
                const urlBtn = {
                    type: 'URL',
                    text: btn.text.substring(0, 25),
                    url: btn.url,
                };
                if (btn.url.includes('{{1}}')) {
                    urlBtn.example = [btn.urlExample || 'https://example.com'];
                }
                return urlBtn;
            }
            if (btn.type === 'QUICK_REPLY' && btn.text) {
                return { type: 'QUICK_REPLY', text: btn.text.substring(0, 25) };
            }
            return null;
        }).filter(Boolean);

        if (metaButtons.length > 0) {
            components.push({ type: 'BUTTONS', buttons: metaButtons });
        }
    }

    const payload = { components };

    const response = await fetch(`${WHATSAPP_API_URL}/${templateId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, `Failed to edit template (${response.status})`));

    // Invalidate template cache for this tenant
    for (const [key] of templateDefCache) {
        if (key.startsWith(`${tenant.id}:`)) templateDefCache.delete(key);
    }

    return { success: true, ...data };
}

/**
 * Delete a template from Meta
 */
export async function deleteTemplate(templateName, tenant) {
    const { token, wabaId } = getCredentials(tenant);
    if (!wabaId) throw new Error('WhatsApp Business Account ID not configured.');

    const response = await fetch(`${WHATSAPP_API_URL}/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(formatMetaError(data, 'Failed to delete template'));
    return data;
}

/**
 * Sync product to Meta Commerce Catalog
 */
export async function syncProductToMeta(tenant, product) {
    if (!tenant.whatsapp_catalog_id || !tenant.whatsapp_access_token) return product.meta_product_id || null;

    const priceString = formatMetaCataloguePrice(product);
    const description = sanitizeProductDescriptionForCatalogue(product.description, product.name);
    const fallbackUrl = `https://wa.me/${tenant.phone || ''}?text=Inquiry+about+${encodeURIComponent(product.name)}`;
    
    const updateData = {
        id: product.sku || String(product.id),
        title: product.name,
        description: description || product.name,
        price: priceString,
        link: fallbackUrl,
        image_link: product.image_url || 'https://via.placeholder.com/600x600.png?text=No+Image',
        brand: tenant.name || 'Brand',
        condition: 'new',
        availability: 'in stock',
        origin_country: 'IN',
        manufacturer_info: tenant.name || 'Manufacturer'
    };

    if (product.images && Array.isArray(product.images) && product.images.length > 1) {
        updateData.additional_image_link = product.images.slice(1).slice(0, 10).join(',');
    }

    // Create an items batch request for upserting
    const payload = {
        item_type: 'PRODUCT_ITEM',
        requests: [
            {
                method: "UPDATE",
                data: updateData
            }
        ]
    };

    const url = `${WHATSAPP_API_URL}/${tenant.whatsapp_catalog_id}/items_batch`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tenant.whatsapp_access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) {
        throw new Error(formatMetaError(data, 'Meta Commerce API Error'));
    }

    // items_batch doesn't necessarily return a meta_product_id if it's async,
    // but we use the retailer_id (sku or id) as our primary sync key.
    return product.sku || String(product.id);
}

/**
 * Delete product from Meta Commerce Catalog
 */
export async function deleteProductFromMeta(tenant, metaProductId) {
    if (!tenant.whatsapp_catalog_id || !tenant.whatsapp_access_token || !metaProductId) return;

    // Use items_batch DELETE method
    const payload = {
        item_type: 'PRODUCT_ITEM',
        requests: [
            {
                method: "DELETE",
                data: {
                    id: metaProductId
                }
            }
        ]
    };

    const url = `${WHATSAPP_API_URL}/${tenant.whatsapp_catalog_id}/items_batch`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tenant.whatsapp_access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) {
        throw new Error(formatMetaError(data, 'Meta Commerce API Error'));
    }
}

export default {
    normalizePhone, sendTemplateMessage, sendTextMessage, sendMediaMessage, sendInteractiveMessage,
    getMediaUrl, sendBulkMessages, uploadMediaForTemplate, createTemplate,
    editTemplate, fetchTemplates, deleteTemplate, getTemplateDefinition,
    syncProductToMeta, deleteProductFromMeta,
};
