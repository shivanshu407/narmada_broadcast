import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { env, pipeline } from '@huggingface/transformers';
import KnowledgeBase from '../models/KnowledgeBase.js';
import Product from '../models/Product.js';
import FaqPhrasing from '../models/FaqPhrasing.js';
import { MATCH_THRESHOLD, flagEnabled } from '../config/botConfig.js';
import { sanitizeProductDescriptionForCatalogue } from '../utils/productCatalogue.js';
import { embeddingForTenant } from '../config/embeddingConfig.js';

const LEGACY_MODEL_ID = 'Xenova/multilingual-e5-small';
const TRANSFORMERS_CACHE_DIR = process.env.TRANSFORMERS_CACHE_DIR || path.join(os.tmpdir(), 'narmada-transformers-cache');
const extractors = new Map();

function configureTransformersRuntime() {
    try {
        fs.mkdirSync(TRANSFORMERS_CACHE_DIR, { recursive: true });
        env.cacheDir = TRANSFORMERS_CACHE_DIR;
    } catch (err) {
        console.warn('[SmartResponder] Unable to prepare local model cache:', err.message);
    }
}

configureTransformersRuntime();

export async function getExtractor(modelId = LEGACY_MODEL_ID) {
    if (!extractors.has(modelId)) {
        console.log(`[SmartResponder] Loading local embedding model ${modelId}...`);
        const extractor = await pipeline('feature-extraction', modelId);
        extractors.set(modelId, extractor);
        console.log(`[SmartResponder] Model ${modelId} loaded successfully.`);
    }
    return extractors.get(modelId);
}

export async function initModel() {
    try {
        await getExtractor();
    } catch (err) {
        console.error('[SmartResponder] Error pre-warming local model:', err);
    }
}

export async function generateEmbedding(text, opts = {}) {
    const modelId = opts.modelId || LEGACY_MODEL_ID;
    const prefix = opts.prefix || '';
    const extractor = await getExtractor(modelId);
    const input = prefix ? `${prefix}${text}` : text;
    const output = await extractor(input, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

export function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProductSum = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProductSum += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProductSum / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function dotProduct(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    return cosineSimilarity(vecA, vecB);
}

export function normalizeText(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

const STOP_WORDS = new Set([
    // English
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'do', 'does', 'for',
    'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or',
    'please', 'the', 'to', 'we', 'what', 'when', 'where', 'which', 'who',
    'with', 'you', 'your',
    
    // Hinglish (Romanized Hindi)
    'hai', 'he', 'ho', 'hu', 'tha', 'thi', 'the', 
    'kya', 'kha', 'kaha', 'kahan', 'kab', 'kyu', 'kaise', 'kon',
    'ye', 'wo', 'yaha', 'waha', 
    'mera', 'meri', 'mere', 'hum', 'humara', 'hamara', 'aap', 'aapka', 'aapki', 'apka', 'apki',
    'ko', 'se', 'ke', 'ki', 'ka', 'mein', 'me', 'par', 'pe',

    // Gujlish (Romanized Gujarati)
    'chhe', 'che', 'chu', 'cho', 'hata', 'hati', 'hato',
    'shu', 'su', 'kya', 'kyare', 'kem', 'kevi', 'rite', 'kone',
    'aa', 'te', 'ahiya', 'tya',
    'maru', 'mara', 'mari', 'amaru', 'amara', 'amari', 'tame', 'tamaru', 'tamara', 'tamari',
    'nu', 'no', 'ni', 'na', 'thi', 'ma', 'mate', 'ni', 'ne'
]);

function tokenizeForMatch(text) {
    return normalizeText(text)
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function scoreTextMatch(query, candidate) {
    const normalizedQuery = normalizeText(query);
    const normalizedCandidate = normalizeText(candidate);
    if (!normalizedQuery || !normalizedCandidate) return 0;

    if (normalizedQuery === normalizedCandidate) {
        return 1.0;
    }

    const queryTokens = tokenizeForMatch(normalizedQuery);
    const candidateTokens = tokenizeForMatch(normalizedCandidate);
    if (!queryTokens.length || !candidateTokens.length) return 0;

    const candidateSet = new Set(candidateTokens);
    const overlapCount = queryTokens.filter((token) => candidateSet.has(token)).length;
    if (overlapCount === 0) return 0;

    const queryCoverage = overlapCount / queryTokens.length;
    const candidateCoverage = overlapCount / candidateTokens.length;
    return Math.min(0.9, 0.15 + (queryCoverage * 0.55) + (candidateCoverage * 0.2));
}

const TENANT_VECTOR_TTL_MS = 5 * 60 * 1000;
const tenantVectorCache = new Map();

export function invalidateTenantVectorCache(tenantId) {
    if (tenantId === undefined || tenantId === null) {
        tenantVectorCache.clear();
    } else {
        tenantVectorCache.delete(String(tenantId));
        tenantVectorCache.delete('single-tenant'); // To ensure no leaks across fallbacks
    }
}

function parseVector(value) {
    if (!value) return null;
    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
        return null;
    }
}

export async function getTenantKnowledge(tenantId, { force = false } = {}) {
    const key = String(tenantId || 'single-tenant');
    const cached = tenantVectorCache.get(key);
    if (!force && cached && (Date.now() - cached.ts) < TENANT_VECTOR_TTL_MS) {
        return cached;
    }

    const faqRows = await KnowledgeBase.find({ is_active: true }).lean();
    const phrasingRows = await FaqPhrasing.find({}).lean();

    const phrasingsByFaq = new Map();
    for (const p of phrasingRows) {
        const vec = parseVector(p.phrasing_vector);
        if (!p.faq_id) continue;
        const fid = p.faq_id.toString();
        if (!phrasingsByFaq.has(fid)) phrasingsByFaq.set(fid, []);
        phrasingsByFaq.get(fid).push({ text: p.phrasing, vec, model: p.embedding_model || null });
    }

    const faqs = faqRows
        .map((f) => ({
            id: f._id.toString(),
            question: f.question,
            answer: f.answer,
            vec: parseVector(f.question_vector),
            model: f.embedding_model || null,
            phrasings: phrasingsByFaq.get(f._id.toString()) || [],
        }));

    const prodRows = await Product.find({ inventory_available: { $ne: false } });
    const products = prodRows
        .map((p) => ({
            _id: p._id,
            id: p._id.toString(),
            name: p.name,
            sku: p.sku,
            description: sanitizeProductDescriptionForCatalogue(p.description),
            mrp: p.mrp,
            selling_price: p.selling_price,
            category: p.category,
            image_url: p.image_url,
            vec: parseVector(p.product_vector),
            model: p.embedding_model || null,
        }));

    const entry = { ts: Date.now(), faqs, products };
    tenantVectorCache.set(key, entry);
    return entry;
}

async function applySmartFlowSlots(reply, context, botSettings) {
    if (!reply || !flagEnabled(botSettings, 'smart_flows')) return reply;
    if (reply.type !== 'faq' || !reply.text) return reply;
    try {
        const { renderSlots } = await import('./smartFlows.js');
        return {
            ...reply,
            text: renderSlots(reply.text, {
                tenant: context.tenant,
                botSettings,
                order: context.order,
            }),
        };
    } catch (err) {
        console.warn('[SmartResponder] Slot rendering skipped:', err.message);
        return reply;
    }
}

function isDeferredFlowReply(reply) {
    return reply?.type === 'handoff' && reply?.reason === 'order_not_found';
}

export async function handleSmartReply(tenantId, messageBody, chatHistory = [], botSettings = {}, context = {}) {
    if (!messageBody || messageBody.trim() === '') return null;

    // Intercept simple greetings to show a native WhatsApp language selection button
    const lowerBody = messageBody.trim().toLowerCase();
    const isGreeting = ['hi', 'hello', 'hey', 'hii', 'hiii', 'namaste', 'kem cho', 'kem cho?', 'menu'].includes(lowerBody);
    if (isGreeting && (!chatHistory || chatHistory.length === 0)) {
        return {
            type: 'language_selection',
            text: `Welcome to ${context.tenant?.name || 'Narmada Essence'}! 🌸\n\nTo assist you better, please tap a button below to select your preferred language:`,
            band: 'high'
        };
    }

    // Intercept catalogue requests to show the native WhatsApp Catalog Button
    const catalogKeywords = ['catalog', 'catalogue', 'menu', 'products list', 'product list', 'show catalogue', 'show catalog', 'view catalogue', 'કૅટેલોગ', 'કેટેલોગ', 'મેનુ', 'कैटलॉग', 'मेनू'];
    const isCatalogRequest = catalogKeywords.some(kw => lowerBody.includes(kw));
    if (isCatalogRequest && context.tenant?.whatsapp_catalog_id) {
        // Detect language from current message or recent chat history
        const contextStr = messageBody + ' ' + chatHistory.map(m => m.body || '').join(' ');
        const isGujarati = /[\u0A80-\u0AFF]/.test(contextStr);
        const isHindi = /[\u0900-\u097F]/.test(contextStr);
        
        let catalogText = "To view our full catalog, please visit our WhatsApp Catalog below. Our team will help you choose the best products for your needs.";
        if (isGujarati) {
            catalogText = "અમારો સંપૂર્ણ કેટલોગ જોવા માટે, કૃપા કરીને અમારા WhatsApp કેટલોગની મુલાકાત લો. અમારી ટીમ તમારી જરૂરિયાત મુજબ શ્રેષ્ઠ ઉત્પાદન પસંદ કરવામાં મદદ કરશે.";
        } else if (isHindi) {
            catalogText = "हमारी पूरी कैटलॉग देखने के लिए, कृपया हमारे WhatsApp कैटलॉग पर जाएं। हमारी टीम आपको आपकी आवश्यकता के अनुसार बेहतरीन उत्पाद चुनने में मदद करेगी।";
        }

        return {
            type: 'catalog_message',
            text: catalogText,
            band: 'high'
        };
    }

    let retrievalReply = null;
    let deferredFlowReply = null;
    
    // Attempt DeepSeek LLM responder first
    try {
        const { generateLLMReply } = await import('./llmResponder.js');
        const llmReply = await generateLLMReply(tenantId, messageBody, chatHistory, context.tenant);
        if (llmReply) {
            return await applySmartFlowSlots(llmReply, context, botSettings);
        }
    } catch (err) {
        console.error('[SmartResponder] DeepSeek LLM failed, falling back to local retrieval:', err.message);
    }

    if (flagEnabled(botSettings, 'smart_flows')) {
        try {
            const { handleSmartFlow } = await import('./smartFlows.js');
            const flowReply = await handleSmartFlow({
                tenantId,
                messageBody,
                botSettings,
                tenant: context.tenant,
                phone: context.phone,
                conversationId: context.conversationId,
                persistState: context.persistState !== false,
            });
            if (isDeferredFlowReply(flowReply)) {
                deferredFlowReply = flowReply;
            } else if (flowReply) {
                return flowReply;
            }
        } catch (err) {
            console.error('[SmartResponder] smart_flows failed:', err.message);
        }
    }

    // Per user request, manual FAQ fallbacks (retrieval_v2 & legacy) have been removed.
    // The bot now strictly relies on DeepSeek.
    return deferredFlowReply;
}

async function handleSmartReplyLegacy(tenantId, messageBody, chatHistory = [], botSettings = {}) {
    try {
        const { faqs, products } = await getTenantKnowledge(tenantId);
        if ((!faqs || faqs.length === 0) && (!products || products.length === 0)) {
            return null;
        }

        let contextString = messageBody;
        if (chatHistory && chatHistory.length > 0) {
            const historyText = chatHistory.map(m => `${m.direction === 'inbound' ? 'User' : 'Bot'}: ${m.body}`).join('\n');
            contextString = `Conversation Context:\n${historyText}\n\nCurrent Message: ${messageBody}`;
        }

        let messageVector = null;
        try {
            const embedConfig = embeddingForTenant(botSettings);
            messageVector = await generateEmbedding(contextString, {
                modelId: embedConfig.modelId,
                prefix: embedConfig.queryPrefix
            });
        } catch (embeddingError) {
            console.warn('[SmartResponder] Embedding unavailable, using text fallback:', embeddingError.message);
        }

        let bestFaqMatch = null;
        let highestFaqScore = -1;

        if (faqs && faqs.length > 0) {
            for (const faq of faqs) {
                const scores = [
                    scoreTextMatch(messageBody, faq.question),
                    ...(faq.phrasings || []).map((phrasing) => scoreTextMatch(messageBody, phrasing.text)),
                ];
                if (messageVector && faq.vec) {
                    scores.push(cosineSimilarity(messageVector, faq.vec));
                }
                if (messageVector && faq.phrasings?.length) {
                    for (const phrasing of faq.phrasings) {
                        if (phrasing.vec) scores.push(cosineSimilarity(messageVector, phrasing.vec));
                    }
                }
                const score = Math.max(0, ...scores);
                if (score > highestFaqScore) {
                    highestFaqScore = score;
                    bestFaqMatch = faq;
                }
            }
        }

        let bestProductMatch = null;
        let highestProductScore = -1;

        if (products && products.length > 0) {
            for (const product of products) {
                const productText = [product.name, product.description, product.category].filter(Boolean).join(' ');
                const scores = [scoreTextMatch(messageBody, productText)];
                if (messageVector && product.vec) {
                    scores.push(cosineSimilarity(messageVector, product.vec));
                }
                const score = Math.max(0, ...scores);
                if (score > highestProductScore) {
                    highestProductScore = score;
                    bestProductMatch = product;
                }
            }
        }

        const THRESHOLD = embedConfig && embedConfig.key === 'multilingual-e5-small' 
            ? (embedConfig.bands?.medium || 0.82) 
            : MATCH_THRESHOLD;

        console.log(`[SmartResponder] Message: "${messageBody}"`);
        console.log(`  - Best FAQ: ${bestFaqMatch?.question || 'None'} (Score: ${highestFaqScore.toFixed(2)})`);
        console.log(`  - Best Product: ${bestProductMatch?.name || 'None'} (Score: ${highestProductScore.toFixed(2)})`);

        if (highestProductScore >= THRESHOLD && highestProductScore > highestFaqScore) {
            return { type: 'product', data: bestProductMatch, score: highestProductScore };
        } else if (highestFaqScore >= THRESHOLD) {
            return { type: 'faq', text: bestFaqMatch.answer, faqId: bestFaqMatch.id, score: highestFaqScore };
        }

        return null;
    } catch (error) {
        console.error('[SmartResponder] Error processing smart reply:', error);
        return null;
    }
}
