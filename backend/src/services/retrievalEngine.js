import KnowledgeBase from '../models/KnowledgeBase.js';
import Product from '../models/Product.js';
import {
    generateEmbedding,
    dotProduct,
    normalizeText,
    getTenantKnowledge,
    scoreTextMatch,
} from './smartResponder.js';
import { confidenceBands, classifyBand, flagEnabled } from '../config/botConfig.js';
import { embeddingForTenant, modelMatches } from '../config/embeddingConfig.js';

const MAX_DISAMBIGUATION_CANDIDATES = 3;
const RRF_K = 60;

async function embedQuery(message, model) {
    const normalized = normalizeText(message);
    return generateEmbedding(normalized, { modelId: model.modelId, prefix: model.queryPrefix });
}

function bestFaqSimilarity(queryVec, faq, activeModel, messageBody) {
    let best = -1;
    if (scoreTextMatch(messageBody, faq.question) >= 0.95) return 1.0;

    if (queryVec && faq.vec && modelMatches(faq.model, activeModel) && faq.vec.length === queryVec.length) {
        best = Math.max(best, dotProduct(queryVec, faq.vec));
    }
    for (const phr of faq.phrasings || []) {
        if (scoreTextMatch(messageBody, phr.text) >= 0.95) return 1.0;

        if (!queryVec || !phr.vec || !modelMatches(phr.model, activeModel) || phr.vec.length !== queryVec.length) continue;
        best = Math.max(best, dotProduct(queryVec, phr.vec));
    }
    return best;
}

function reciprocalRankFusion(rankedLists, k = RRF_K) {
    const fused = new Map();
    for (const list of rankedLists) {
        list.forEach((id, idx) => {
            fused.set(id, (fused.get(id) || 0) + 1 / (k + idx + 1));
        });
    }
    return fused;
}

async function lexicalScoresFaq(normalizedMsg) {
    if (!normalizedMsg) return new Map();
    const map = new Map();
    try {
        const regex = new RegExp(normalizedMsg.split(' ').filter(Boolean).join('|'), 'i');
        const rows = await KnowledgeBase.find({ is_active: true, $or: [{ question: regex }, { answer: regex }] });
        for (const r of rows) {
            map.set(r._id.toString(), 1.0);
        }
    } catch (err) {
        console.warn(`[RetrievalV2] Lexical search skipped for FAQ:`, err.message);
    }
    return map;
}

async function lexicalScoresProduct(normalizedMsg) {
    if (!normalizedMsg) return new Map();
    const map = new Map();
    try {
        const regex = new RegExp(normalizedMsg.split(' ').filter(Boolean).join('|'), 'i');
        const rows = await Product.find({ inventory_available: { $ne: false }, $or: [{ name: regex }, { description: regex }] });
        for (const r of rows) {
            map.set(r._id.toString(), 1.0);
        }
    } catch (err) {
        console.warn(`[RetrievalV2] Lexical search skipped for Products:`, err.message);
    }
    return map;
}

export async function retrieveAnswer(tenantId, messageBody, botSettings = {}) {
    const normalized = normalizeText(messageBody);
    if (!normalized) return null;

    const { faqs, products } = await getTenantKnowledge(tenantId);
    if ((!faqs || faqs.length === 0) && (!products || products.length === 0)) {
        return null;
    }

    const model = embeddingForTenant(botSettings);
    const activeModel = model.key;
    const queryVec = await embedQuery(messageBody, model);
    const bands = confidenceBands(botSettings, model.bands);

    const [faqLex, productLex] = await Promise.all([
        lexicalScoresFaq(normalized),
        lexicalScoresProduct(normalized),
    ]);

    const faqScored = faqs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        vecScore: bestFaqSimilarity(queryVec, f, activeModel, messageBody),
        lexScore: faqLex.get(f.id) || 0,
    })).filter((f) => f.vecScore > -1 || f.lexScore > 0);

    let bestFaq = null;
    let faqCandidates = [];
    const exactMatches = faqScored.filter(f => f.vecScore === 1.0);
    
    if (exactMatches.length > 0) {
        bestFaq = exactMatches[0];
        faqCandidates = exactMatches;
    } else {
        const vecRankedFaqIds = [...faqScored].sort((a, b) => b.vecScore - a.vecScore).map((f) => f.id);
        const lexRankedFaqIds = [...faqScored].filter((f) => f.lexScore > 0)
            .sort((a, b) => b.lexScore - a.lexScore).map((f) => f.id);
        const fused = reciprocalRankFusion([vecRankedFaqIds, lexRankedFaqIds]);

        faqCandidates = [...faqScored].sort((a, b) => {
            const fa = fused.get(a.id) || 0;
            const fb = fused.get(b.id) || 0;
            if (fb !== fa) return fb - fa;
            return b.vecScore - a.vecScore;
        });

        bestFaq = faqCandidates[0] || null;
    }

    let bestProduct = null;
    let bestProductScore = -1;
    for (const p of products || []) {
        if (!queryVec || !modelMatches(p.model, activeModel) || p.vec.length !== queryVec.length) continue;
        const s = dotProduct(queryVec, p.vec);
        if (s > bestProductScore) {
            bestProductScore = s;
            bestProduct = p;
        }
    }

    const bestFaqScore = bestFaq ? bestFaq.vecScore : -1;

    console.log(`[RetrievalV2] tenant=${tenantId} msg="${messageBody}" model=${activeModel}`);
    console.log(`  bands=${JSON.stringify(bands)} bestFaq=${bestFaq?.question || 'None'} (${bestFaqScore.toFixed(3)}, lex=${bestFaq?.lexScore || 0}) bestProduct=${bestProduct?.name || 'None'} (${bestProductScore.toFixed(3)})`);

    if (bestProduct && bestProductScore >= bands.medium && bestProductScore > bestFaqScore) {
        const band = classifyBand(bestProductScore, bands, false);
        if (band === 'low') return null;
        return { type: 'product', data: bestProduct, score: bestProductScore, band };
    }

    if (!bestFaq) return null;

    const band = classifyBand(bestFaqScore, bands, bestFaq.lexScore > 0);

    if (band === 'high') {
        return { type: 'faq', text: bestFaq.answer, faqId: bestFaq.id, score: bestFaqScore, band: 'high' };
    }

    if (band === 'medium') {
        const candidates = faqCandidates
            .filter((c) => c.vecScore > 0 || c.lexScore > 0)
            .slice(0, MAX_DISAMBIGUATION_CANDIDATES)
            .map((c) => ({ id: c.id, question: c.question, answer: c.answer, score: c.vecScore }));

        if (flagEnabled(botSettings, 'disambiguation') && candidates.length >= 2) {
            return { type: 'disambiguation', candidates, band: 'medium' };
        }
        return { type: 'faq', text: bestFaq.answer, faqId: bestFaq.id, score: bestFaqScore, band: 'medium' };
    }

    return null;
}
