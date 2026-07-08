import { Router } from 'express';
import KnowledgeBase from '../models/KnowledgeBase.js';
import FaqPhrasing from '../models/FaqPhrasing.js';
import {
    generateEmbedding,
    handleSmartReply,
    invalidateTenantVectorCache,
    scoreTextMatch,
} from '../services/smartResponder.js';
import { embeddingForTenant } from '../config/embeddingConfig.js';

const router = Router();
const MATCH_THRESHOLD = 0.45;

function tenantIdFromRequest(req) {
    return req.tenantId || req.tenant?.id || req.tenant?._id?.toString?.() || 'single-tenant';
}

function faqToClient(faq) {
    const doc = typeof faq.toObject === 'function' ? faq.toObject() : faq;
    return {
        ...doc,
        id: doc._id?.toString?.() || doc.id,
    };
}

async function optionalEmbedding(text, botSettings = {}) {
    const model = embeddingForTenant(botSettings);
    try {
        return {
            vector: await generateEmbedding(text, { modelId: model.modelId, prefix: model.passagePrefix }),
            model: model.key,
        };
    } catch (error) {
        console.warn('[KnowledgeBase] Local embedding skipped:', error.message);
        return { vector: [], model: model.key };
    }
}

async function getPhrasingsByFaq(faqIds) {
    if (!faqIds.length) return new Map();
    const rows = await FaqPhrasing.find({ faq_id: { $in: faqIds } }).lean();
    const grouped = new Map();
    for (const row of rows) {
        const faqId = row.faq_id?.toString();
        if (!grouped.has(faqId)) grouped.set(faqId, []);
        grouped.get(faqId).push({
            ...row,
            id: row._id?.toString(),
        });
    }
    return grouped;
}

router.get('/', async (req, res) => {
    try {
        const faqs = await KnowledgeBase.find().sort({ created_at: -1 });
        res.json({ faqs: faqs.map(faqToClient) });
    } catch (error) {
        console.error('Knowledge base list error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/test', async (req, res) => {
    try {
        const message = String(req.body?.message || '').trim();
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const tenantId = tenantIdFromRequest(req);
        const botSettings = req.tenant?.bot_settings || {};
        const reply = await handleSmartReply(tenantId, message, [], botSettings, {
            tenant: req.tenant,
            persistState: false,
            debugTest: true,
        });

        let directRetrieve = null;
        try {
            const { retrieveAnswer } = await import('../services/retrievalEngine.js');
            directRetrieve = await retrieveAnswer(tenantId, message, botSettings);
        } catch (e) {
            directRetrieve = { error: e.message, stack: e.stack };
        }

        const faqRows = await KnowledgeBase.find({ is_active: true }).sort({ created_at: -1 }).lean();
        const phrasingsByFaq = await getPhrasingsByFaq(faqRows.map((faq) => faq._id));
        const matches = faqRows
            .map((faq) => {
                const phrasings = phrasingsByFaq.get(faq._id.toString()) || [];
                const score = Math.max(
                    scoreTextMatch(message, faq.question),
                    scoreTextMatch(message, faq.answer),
                    ...phrasings.map((phrasing) => scoreTextMatch(message, phrasing.phrasing))
                );
                return {
                    id: faq._id.toString(),
                    question: faq.question,
                    answer: faq.answer,
                    score,
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const bestMatch = matches[0] || null;
        const matchedAnswer = reply?.type === 'faq'
            ? reply.text
            : (bestMatch?.score >= MATCH_THRESHOLD ? bestMatch.answer : null);

        res.json({
            would_reply: Boolean(reply || matchedAnswer),
            matched_answer: matchedAnswer,
            reply,
            matches,
            _debug_test: reply || 'none',
            _direct_retrieve: directRetrieve || 'none',
        });
    } catch (error) {
        console.error('Knowledge base test error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { question, answer } = req.body;
        if (!question || !answer) return res.status(400).json({ error: 'Question and answer required' });

        const embedding = await optionalEmbedding(question, req.tenant?.bot_settings || {});
        const tenantId = tenantIdFromRequest(req);
        const faq = new KnowledgeBase({
            tenant_id: tenantId,
            question,
            answer,
            question_vector: embedding.vector,
            embedding_model: embedding.model,
            is_active: true,
        });
        await faq.save();
        invalidateTenantVectorCache(tenantId);
        res.status(201).json(faqToClient(faq));
    } catch (error) {
        console.error('Knowledge base create error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/import', async (req, res) => {
    try {
        const { faqs } = req.body;
        if (!Array.isArray(faqs)) return res.status(400).json({ error: 'Array required' });

        let imported = 0;
        let skipped = 0;
        const tenantId = tenantIdFromRequest(req);

        for (const f of faqs) {
            if (!f.question || !f.answer) {
                skipped++;
                continue;
            }
            const embedding = await optionalEmbedding(f.question, req.tenant?.bot_settings || {});
            const faq = new KnowledgeBase({
                tenant_id: tenantId,
                question: f.question,
                answer: f.answer,
                question_vector: embedding.vector,
                embedding_model: embedding.model,
                is_active: f.is_active ?? true,
            });
            await faq.save();
            imported++;
        }

        invalidateTenantVectorCache(tenantId);
        res.json({ imported, skipped });
    } catch (error) {
        console.error('Knowledge base import error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:id/phrasings', async (req, res) => {
    try {
        const phrasings = await FaqPhrasing.find({ faq_id: req.params.id }).sort({ created_at: -1 }).lean();
        res.json({
            phrasings: phrasings.map((phrasing) => ({
                ...phrasing,
                id: phrasing._id.toString(),
            })),
        });
    } catch (error) {
        console.error('Knowledge base phrasings list error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/:id/phrasings', async (req, res) => {
    try {
        const phrasing = String(req.body?.phrasing || '').trim();
        if (!phrasing) return res.status(400).json({ error: 'Phrasing is required' });

        const faq = await KnowledgeBase.findById(req.params.id);
        if (!faq) return res.status(404).json({ error: 'FAQ not found' });

        const tenantId = tenantIdFromRequest(req);
        const embedding = await optionalEmbedding(phrasing, req.tenant?.bot_settings || {});
        const created = await FaqPhrasing.create({
            tenant_id: tenantId,
            faq_id: faq._id,
            phrasing,
            phrasing_vector: embedding.vector,
            embedding_model: embedding.model,
        });
        invalidateTenantVectorCache(tenantId);
        res.status(201).json({
            ...created.toObject(),
            id: created._id.toString(),
        });
    } catch (error) {
        console.error('Knowledge base phrasing create error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:id/phrasings/:phrasingId', async (req, res) => {
    try {
        const deleted = await FaqPhrasing.findOneAndDelete({
            _id: req.params.phrasingId,
            faq_id: req.params.id,
        });
        if (!deleted) return res.status(404).json({ error: 'Phrasing not found' });

        invalidateTenantVectorCache(tenantIdFromRequest(req));
        res.status(204).send();
    } catch (error) {
        console.error('Knowledge base phrasing delete error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { question, answer, is_active } = req.body;
        if (!question || !answer) return res.status(400).json({ error: 'Question and answer required' });

        const embedding = await optionalEmbedding(question, req.tenant?.bot_settings || {});
        const tenantId = tenantIdFromRequest(req);
        const faq = await KnowledgeBase.findByIdAndUpdate(
            req.params.id,
            {
                question,
                answer,
                question_vector: embedding.vector,
                embedding_model: embedding.model,
                is_active: is_active ?? true,
            },
            { new: true }
        );

        if (!faq) return res.status(404).json({ error: 'Not found' });
        invalidateTenantVectorCache(tenantId);
        res.json(faqToClient(faq));
    } catch (error) {
        console.error('Knowledge base update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const faq = await KnowledgeBase.findByIdAndDelete(req.params.id);
        if (!faq) return res.status(404).json({ error: 'Not found' });
        invalidateTenantVectorCache(tenantIdFromRequest(req));
        res.status(204).send();
    } catch (error) {
        console.error('Knowledge base delete error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.patch('/:id/toggle', async (req, res) => {
    try {
        const { is_active } = req.body;
        const faq = await KnowledgeBase.findByIdAndUpdate(req.params.id, { is_active }, { new: true });
        if (!faq) return res.status(404).json({ error: 'Not found' });
        invalidateTenantVectorCache(tenantIdFromRequest(req));
        res.json(faqToClient(faq));
    } catch (error) {
        console.error('Knowledge base toggle error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
