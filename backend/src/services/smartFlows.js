import WhatsAppConversation from '../models/WhatsAppConversation.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { embeddingForTenant } from '../config/embeddingConfig.js';
import { generateEmbedding, dotProduct, normalizeText } from './smartResponder.js';
import { productPriceAmount } from '../utils/productCatalogue.js';

export const FLOW_INTENTS = {
    order_status: {
        label: 'Order status',
        seeds: [
            'where is my order',
            'track my order',
            'what is my order status',
            'has my order shipped',
            'delivery status for my order',
            'payment status for my order',
        ],
        lexical: [
            /\border\b.*\b(status|track|tracking|where|shipped|delivered|delivery|payment)\b/i,
            /\b(status|track|tracking|where|shipped|delivered|delivery|payment)\b.*\border\b/i,
            /\bparcel\b.*\b(status|track|tracking|delivery)\b/i,
        ],
    },
    product_search: {
        label: 'Product search',
        seeds: [
            'show me products',
            'find products under budget',
            'show catalogue items',
            'do you have this product',
            'show cheaper options',
            'show more like this',
        ],
        lexical: [
            /\b(show|find|search|browse|catalog|catalogue|product|products|item|items|options)\b/i,
            /\b(under|below|less than|between|cheaper|cost|price)\b/i,
        ],
    },
    human_handoff: {
        label: 'Human handoff',
        seeds: [
            'connect me to a human',
            'talk to support agent',
            'need customer support',
            'please call me',
            'agent help needed',
        ],
        lexical: [
            /\b(human|agent|person|representative|support team|customer support)\b/i,
            /\b(call me|talk to someone|speak to someone|need help)\b/i,
        ],
    },
};

const intentVectorCache = new Map();
const DEFAULT_INTENT_THRESHOLDS = {
    'all-MiniLM-L6-v2': 0.42,
    'multilingual-e5-small': 0.78,
};

function toSqlDate(value) {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return String(value);
    }
}

function formatMoney(value, currency = 'INR') {
    const n = Number(value);
    if (!Number.isFinite(n)) return `${currency} ${value || 0}`;
    return `${currency} ${n.toFixed(2)}`;
}

function storeHoursText(storeHours = {}) {
    if (!storeHours || storeHours.enabled === false) return 'Store hours are not configured';
    const start = storeHours.start || '09:00';
    const end = storeHours.end || '18:00';
    const timezone = storeHours.timezone || 'Asia/Kolkata';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = Array.isArray(storeHours.days) && storeHours.days.length
        ? storeHours.days.map((d) => dayNames[d]).filter(Boolean).join(', ')
        : 'Mon-Fri';
    return `${days} ${start}-${end} ${timezone}`;
}

function lexicalIntent(normalized) {
    let best = null;
    for (const [intent, config] of Object.entries(FLOW_INTENTS)) {
        const matched = config.lexical.some((rx) => rx.test(normalized));
        if (!matched) continue;
        const confidence = intent === 'human_handoff' || intent === 'order_status' ? 0.95 : 0.78;
        if (!best || confidence > best.confidence) {
            best = { intent, confidence, method: 'lexical' };
        }
    }
    return best;
}

async function getIntentVectors(model) {
    const cacheKey = model.key;
    if (intentVectorCache.has(cacheKey)) return intentVectorCache.get(cacheKey);

    const vectors = {};
    for (const [intent, config] of Object.entries(FLOW_INTENTS)) {
        vectors[intent] = [];
        for (const seed of config.seeds) {
            const vec = await generateEmbedding(normalizeText(seed), {
                modelId: model.modelId,
                prefix: model.queryPrefix,
            });
            vectors[intent].push(vec);
        }
    }
    intentVectorCache.set(cacheKey, vectors);
    return vectors;
}

export async function detectSmartFlowIntent(messageBody, botSettings = {}) {
    const normalized = normalizeText(messageBody);
    if (!normalized) return null;

    const lexical = lexicalIntent(normalized);
    const model = embeddingForTenant(botSettings);
    
    // Disable semantic intent matching for e5 due to vector space collapse
    // causing extreme false positives (gibberish > 0.82 similarity).
    if (model.key === 'multilingual-e5-small') {
        return lexical;
    }

    const threshold = Number(botSettings.smart_flow_intent_threshold)
        || DEFAULT_INTENT_THRESHOLDS[model.key]
        || 0.5;

    try {
        const queryVec = await generateEmbedding(normalized, {
            modelId: model.modelId,
            prefix: model.queryPrefix,
        });
        const intentVectors = await getIntentVectors(model);
        let best = null;

        for (const [intent, vectors] of Object.entries(intentVectors)) {
            let score = -1;
            for (const vec of vectors) {
                if (vec.length !== queryVec.length) continue;
                score = Math.max(score, dotProduct(queryVec, vec));
            }
            if (lexical?.intent === intent) score += 0.08;
            if (!best || score > best.confidence) {
                best = { intent, confidence: score, method: lexical?.intent === intent ? 'hybrid' : 'embedding' };
            }
        }

        if (best && best.confidence >= threshold) return best;
    } catch (err) {
        console.warn('[SmartFlows] Embedding intent router failed, using lexical fallback:', err.message);
    }

    return lexical;
}

export function renderSlots(text, context = {}) {
    if (!text) return text;
    const tenant = context.tenant || {};
    const botSettings = context.botSettings || {};
    const order = context.order || {};
    const customSlots = botSettings.slots && typeof botSettings.slots === 'object' ? botSettings.slots : {};

    const values = {
        store_name: tenant.name,
        store_phone: tenant.phone,
        support_phone: botSettings.support_phone || tenant.phone,
        support_email: botSettings.support_email || tenant.email,
        store_hours: storeHoursText(botSettings.store_hours),
        payment_link: order.payment_link,
        order_id: order.id,
        order_status: order.fulfillment_status,
        payment_status: order.payment_status,
        ...customSlots,
    };

    return String(text).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
        const value = values[key];
        return value === undefined || value === null || value === '' ? match : String(value);
    });
}

export async function getConversationBotState(tenantId, conversationId) {
    if (!conversationId) return {};
    const row = await WhatsAppConversation.findById(conversationId);
    return row?.bot_state || {};
}

export async function setConversationBotState(tenantId, conversationId, patch = {}) {
    if (!conversationId) return {};
    const current = await getConversationBotState(tenantId, conversationId);
    const next = {
        ...current,
        ...patch,
        updated_at: new Date().toISOString(),
    };
    await WhatsAppConversation.findByIdAndUpdate(conversationId, {
        $set: { bot_state: next }
    });
    return next;
}

export async function getLatestOrderStatus(tenantId, phone) {
    const order = await Order.findOne({ phone: phone }).sort({ created_at: -1 });
    if (!order) return null;
    return order.toObject();
}

export function formatOrderStatusReply(order) {
    if (!order) {
        return "I could not find a recent order for this WhatsApp number. I have marked this chat for human support so the team can help.";
    }

    const itemLines = (order.items || []).slice(0, 5).map((item) => {
        const qty = Number(item.quantity) || 1;
        return `- ${item.item_name || item.name} x ${qty}`;
    });

    const lines = [
        `Order #${order.id || order._id}`,
        `Placed: ${toSqlDate(order.created_at)}`,
        `Order status: ${order.fulfillment_status || 'pending'}`,
        `Payment: ${order.payment_status || 'pending'}`,
        `Total: ${formatMoney(order.total_amount || order.amount, order.currency || 'INR')}`,
    ];
    if (itemLines.length) lines.push('Items:', ...itemLines);
    if (order.payment_link && order.payment_status !== 'paid') lines.push(`Payment link: ${order.payment_link}`);
    return lines.join('\n');
}

function parseProductFilters(messageBody, previousFilters = {}) {
    const normalized = normalizeText(messageBody);
    const filters = { ...previousFilters };

    const maxMatch = normalized.match(/\b(?:under|below|less than|upto|up to|max)\s*(?:rs\.?|inr|rupees)?\s*([0-9]{2,7})\b/);
    if (maxMatch) filters.maxPrice = Number(maxMatch[1]);

    const minMatch = normalized.match(/\b(?:above|over|more than|min)\s*(?:rs\.?|inr|rupees)?\s*([0-9]{2,7})\b/);
    if (minMatch) filters.minPrice = Number(minMatch[1]);

    const betweenMatch = normalized.match(/\bbetween\s*([0-9]{2,7})\s*(?:and|-)\s*([0-9]{2,7})\b/);
    if (betweenMatch) {
        filters.minPrice = Number(betweenMatch[1]);
        filters.maxPrice = Number(betweenMatch[2]);
    }

    return filters;
}

export async function searchProductsForMessage(tenantId, messageBody, previousFilters = {}) {
    const filters = parseProductFilters(messageBody, previousFilters);
    const normalized = normalizeText(messageBody);

    const categories = await Product.distinct('category', { inventory_available: { $ne: false }, category: { $ne: null } });

    const matchedCategory = (categories || []).find((cat) => {
        const c = normalizeText(cat);
        return c && normalized.includes(c);
    });
    if (matchedCategory) filters.category = matchedCategory;

    const query = { inventory_available: { $ne: false } };
    if (filters.category) {
        query.category = filters.category;
    }
    if (Number.isFinite(filters.minPrice) || Number.isFinite(filters.maxPrice)) {
        query.$or = [
            { selling_price: {} },
            { mrp: {} }
        ];
        if (Number.isFinite(filters.minPrice)) {
            query.$or[0].selling_price.$gte = filters.minPrice;
            query.$or[1].mrp.$gte = filters.minPrice;
        }
        if (Number.isFinite(filters.maxPrice)) {
            query.$or[0].selling_price.$lte = filters.maxPrice;
            query.$or[1].mrp.$lte = filters.maxPrice;
        }
    }

    const products = await Product.find(query).sort({ selling_price: 1, mrp: 1 }).limit(10);
    return { products: products.map(p => ({ ...p.toObject(), id: p._id.toString() })), filters };
}

export function formatProductListReply(products = [], filters = {}) {
    if (!products.length) {
        return 'I could not find matching products right now. I have marked this chat for human support so the team can help.';
    }

    const label = filters.category ? `${filters.category} products` : 'matching products';
    const lines = [`I found ${products.length} ${label}:`];
    for (const product of products.slice(0, 5)) {
        const price = productPriceAmount(product);
        lines.push(`- ${product.name} - ${formatMoney(price, 'INR')}`);
    }
    lines.push('Tap a product from the catalogue list if available, or reply with your preferred budget.');
    return lines.join('\n');
}

export async function handleSmartFlow({ tenantId, phone, messageBody, botSettings = {}, tenant = {}, conversationId = null, persistState = true }) {
    const state = conversationId ? await getConversationBotState(tenantId, conversationId) : {};
    const normalized = normalizeText(messageBody);
    let detected = await detectSmartFlowIntent(messageBody, botSettings);

    if (!detected && state.last_intent === 'product_search' && /\b(cheaper|costlier|more|another|under|below|above|over|budget)\b/i.test(normalized)) {
        detected = { intent: 'product_search', confidence: 0.72, method: 'state_followup' };
    }

    if (!detected) return null;

    if (conversationId && persistState) {
        await setConversationBotState(tenantId, conversationId, {
            last_intent: detected.intent,
            last_confidence: detected.confidence,
            last_method: detected.method,
        });
    }

    if (detected.intent === 'order_status') {
        const order = await getLatestOrderStatus(tenantId, phone);
        const text = renderSlots(formatOrderStatusReply(order), { tenant, botSettings, order });
        if (!order) return { type: 'handoff', text, reason: 'order_not_found', intent: detected };
        return { type: 'order_status', text, order, intent: detected };
    }

    if (detected.intent === 'product_search') {
        const previousFilters = state.last_intent === 'product_search' ? state.product_filters || {} : {};
        const { products, filters } = await searchProductsForMessage(tenantId, messageBody, previousFilters);
        if (conversationId && persistState) {
            await setConversationBotState(tenantId, conversationId, { last_intent: 'product_search', product_filters: filters });
        }
        const text = formatProductListReply(products, filters);
        if (!products.length) return { type: 'handoff', text, reason: 'product_not_found', intent: detected };
        return { type: 'product_list', text, products, filters, intent: detected };
    }

    if (detected.intent === 'human_handoff') {
        return {
            type: 'handoff',
            text: 'I have notified the store team. A person will join this chat shortly.',
            reason: 'customer_requested_human',
            intent: detected,
        };
    }

    return null;
}
