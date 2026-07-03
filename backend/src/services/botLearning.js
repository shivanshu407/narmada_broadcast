import BotUnanswered from '../models/BotUnanswered.js';
import BotInteraction from '../models/BotInteraction.js';
import BotSuggestion from '../models/BotSuggestion.js';
import FaqPhrasing from '../models/FaqPhrasing.js';
import KnowledgeBase from '../models/KnowledgeBase.js';
import { embeddingForTenant } from '../config/embeddingConfig.js';
import { generateEmbedding, normalizeText, invalidateTenantVectorCache } from './smartResponder.js';
import { triageUnansweredMessage } from './messageTriage.js';

function safeRatio(numerator, denominator) {
    const n = Number(numerator) || 0;
    const d = Number(denominator) || 0;
    return d > 0 ? n / d : 0;
}

export async function logUnanswered({
    tenantId = 'single-tenant',
    conversationId = null,
    phone = null,
    messageBody,
    bestMatchType = null,
    bestMatchId = null,
    score = null,
    learningStatus = 'candidate',
    triage = null,
    metadata = {},
}) {
    const normalized = normalizeText(messageBody);
    if (!normalized) return null;
    learningStatus = ['candidate', 'noise', 'chatter', 'handoff', 'resolved', 'ignored'].includes(learningStatus)
        ? learningStatus
        : 'candidate';

    const result = await BotUnanswered.create({
        tenant_id: tenantId || 'single-tenant',
        conversation_id: conversationId,
        phone: phone,
        message_body: messageBody,
        normalized_message: normalized,
        best_match_type: bestMatchType,
        best_match_id: bestMatchId,
        score: score,
        learning_status: learningStatus,
        metadata: {
            ...(metadata || {}),
            triage: triage || null,
        }
    });
    return result._id.toString();
}

export async function logBotInteraction({
    tenantId = 'single-tenant',
    conversationId = null,
    phone = null,
    interactionType,
    source = 'bot',
    faqId = null,
    productId = null,
    intent = null,
    outcome = 'sent',
    metadata = {},
}) {
    if (!interactionType) return null;
    const result = await BotInteraction.create({
        tenant_id: tenantId || 'single-tenant',
        conversation_id: conversationId,
        phone: phone,
        interaction_type: interactionType,
        source: source,
        faq_id: faqId,
        product_id: productId,
        intent: intent,
        outcome: outcome,
        metadata: metadata || {}
    });
    return result._id.toString();
}

export async function captureDisambiguationTap({
    tenantId = 'single-tenant',
    conversationId = null,
    phone = null,
    faqId,
    originalQuestion,
    selectedQuestion = null,
    botSettings = {},
}) {
    await logBotInteraction({
        tenantId,
        conversationId,
        phone,
        interactionType: 'disambiguation_tap',
        source: 'customer',
        faqId,
        intent: 'faq_disambiguation',
        outcome: 'selected',
        metadata: { originalQuestion, selectedQuestion },
    });

    const phrasing = normalizeText(originalQuestion);
    if (!faqId || !phrasing || phrasing === normalizeText(selectedQuestion)) return null;

    const existing = await FaqPhrasing.findOne({
        faq_id: faqId,
        phrasing: { $regex: new RegExp(`^${originalQuestion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existing) return existing._id.toString();

    const model = embeddingForTenant(botSettings);
    const phrasingVector = await generateEmbedding(phrasing, {
        modelId: model.modelId,
        prefix: model.passagePrefix,
    });
    const result = await FaqPhrasing.create({
        tenant_id: tenantId || 'single-tenant',
        faq_id: faqId,
        phrasing: originalQuestion,
        phrasing_vector: phrasingVector,
        embedding_model: model.key
    });
    invalidateTenantVectorCache(tenantId);
    return result._id.toString();
}

export async function clusterUnansweredSuggestions(tenantId = 'single-tenant', { limit = 100 } = {}) {
    const effectiveTenantId = tenantId || 'single-tenant';
    const safeLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 500);

    const legacyRows = await BotUnanswered.find({
        tenant_id: effectiveTenantId,
        status: 'new',
        learning_status: { $exists: false },
    }).limit(500);
    for (const row of legacyRows) {
        const triage = triageUnansweredMessage(row.message_body);
        row.learning_status = triage.learningStatus;
        row.metadata = { ...(row.metadata || {}), triage };
        row.updated_at = new Date();
        await row.save();
    }
    
    const rows = await BotUnanswered.aggregate([
        { $match: { tenant_id: tenantId || 'single-tenant', status: 'new', learning_status: 'candidate' } },
        {
            $group: {
                _id: '$normalized_message',
                source_count: { $sum: 1 },
                sample: { $first: '$message_body' },
                max_created_at: { $max: '$created_at' }
            }
        },
        { $sort: { source_count: -1, max_created_at: -1 } },
        { $limit: safeLimit }
    ]);

    const candidateKeys = rows.map((row) => row._id).filter(Boolean);
    await BotSuggestion.updateMany(
        {
            tenant_id: effectiveTenantId,
            suggestion_type: 'faq_gap',
            status: 'open',
            'payload.normalized_message': { $nin: candidateKeys },
        },
        {
            $set: {
                status: 'ignored',
                updated_at: new Date(),
                'payload.closed_reason': 'no_candidate_unanswered',
            },
        }
    );

    const suggestions = [];
    for (const row of rows) {
        const title = String(row.sample || row._id || 'Unanswered question').slice(0, 255);
        const payload = {
            normalized_message: row._id,
            sample: row.sample,
            learning_status: 'candidate',
        };
        await BotSuggestion.findOneAndUpdate(
            { tenant_id: effectiveTenantId, suggestion_type: 'faq_gap', title: title },
            {
                $set: {
                    tenant_id: effectiveTenantId,
                    source_count: row.source_count,
                    payload: payload,
                    status: 'open',
                    updated_at: new Date()
                }
            },
            { upsert: true, new: true }
        );
        suggestions.push(payload);
    }
    return suggestions;
}

export async function teachFromConversation({
    tenantId = 'single-tenant',
    conversationId,
    question,
    answer,
    sourceMessageId = null,
    botSettings = {},
}) {
    const cleanQuestion = String(question || '').trim();
    const cleanAnswer = String(answer || '').trim();
    if (!cleanQuestion || !cleanAnswer) {
        throw new Error('question and answer are required');
    }

    const model = embeddingForTenant(botSettings);
    const vector = await generateEmbedding(normalizeText(cleanQuestion), {
        modelId: model.modelId,
        prefix: model.passagePrefix,
    });

    const result = await KnowledgeBase.create({
        tenant_id: tenantId || 'single-tenant',
        question: cleanQuestion,
        answer: cleanAnswer,
        question_vector: vector,
        embedding_model: model.key,
        is_active: true
    });

    await BotUnanswered.updateMany(
        { normalized_message: normalizeText(cleanQuestion) },
        { $set: { status: 'resolved', updated_at: new Date() } }
    );

    await logBotInteraction({
        tenantId,
        conversationId,
        interactionType: 'teach_from_chat',
        source: 'agent',
        faqId: result._id.toString(),
        outcome: 'created_faq',
        metadata: { sourceMessageId },
    });

    invalidateTenantVectorCache(tenantId);
    return { faq_id: result._id.toString() };
}

export async function shadowReplayKnowledgeBase(tenantId = 'single-tenant', botSettings = {}, { limit = 25 } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);
    const samples = await BotUnanswered.find({}).sort({ created_at: -1 }).limit(safeLimit);

    const { retrieveAnswer } = await import('./retrievalEngine.js');
    const results = [];
    for (const sample of samples) {
        const reply = await retrieveAnswer(tenantId, sample.message_body, botSettings);
        results.push({
            unanswered_id: sample._id.toString(),
            message: sample.message_body,
            reply_type: reply?.type || null,
            faq_id: reply?.faqId || null,
            score: reply?.score || null,
            band: reply?.band || null,
        });
    }
    return results;
}

export async function getBotAnalytics(tenantId = 'single-tenant') {
    const [interactions, unanswered, handoffs, faqHits, productHits, taps] = await Promise.all([
        BotInteraction.countDocuments({}),
        BotUnanswered.countDocuments({ learning_status: 'candidate' }),
        BotInteraction.countDocuments({ interaction_type: 'handoff_requested' }),
        BotInteraction.countDocuments({ interaction_type: 'faq_answer' }),
        BotInteraction.countDocuments({ interaction_type: { $in: ['product_list', 'product_answer'] } }),
        BotInteraction.countDocuments({ interaction_type: 'disambiguation_tap' }),
    ]);

    const topUnansweredResult = await BotUnanswered.aggregate([
        { $match: { learning_status: 'candidate' } },
        { $group: { _id: '$normalized_message', count: { $sum: 1 }, sample: { $first: '$message_body' } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    const topMatchedResult = await BotInteraction.aggregate([
        { $group: { _id: { intent: '$intent', interaction_type: '$interaction_type' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    const total = interactions + unanswered;
    const deflection = safeRatio(interactions - handoffs, total);
    const handoffRate = safeRatio(handoffs, total);

    return {
        total_interactions: interactions,
        unanswered_count: unanswered,
        faq_hits: faqHits,
        product_hits: productHits,
        disambiguation_taps: taps,
        handoff_count: handoffs,
        deflection_rate: Math.round(deflection * 100),
        auto_resolved_rate: Math.round(deflection * 100),
        handoff_rate: Math.round(handoffRate * 100),
        top_unanswered: topUnansweredResult.map(r => ({ normalized_message: r._id, count: r.count, sample: r.sample })),
        top_matched: topMatchedResult.map(r => ({ intent: r._id.intent, interaction_type: r._id.interaction_type, count: r.count })),
    };
}

export async function botSmartnessScore(tenantId = 'single-tenant') {
    const analytics = await getBotAnalytics(tenantId);
    const openSuggestions = await BotSuggestion.countDocuments({ status: 'open' });
    const base = 50;
    const score = Math.max(0, Math.min(100,
        base
        + analytics.deflection_rate * 0.35
        + Math.min(20, analytics.disambiguation_taps * 2)
        - Math.min(25, openSuggestions * 3)
        - Math.min(20, analytics.handoff_rate * 0.25)
    ));

    return {
        score: Math.round(score),
        open_suggestions: openSuggestions,
        analytics,
    };
}

export async function weeklyDigest(tenantId = 'single-tenant') {
    const score = await botSmartnessScore(tenantId);
    const suggestions = await BotSuggestion.find({}).sort({ source_count: -1, updated_at: -1 }).limit(5);

    return {
        score: score.score,
        deflection_rate: score.analytics.deflection_rate,
        handoff_rate: score.analytics.handoff_rate,
        open_suggestions: score.open_suggestions,
        top_suggestions: suggestions.map((s) => ({
            id: s._id.toString(),
            title: s.title,
            source_count: s.source_count,
            status: s.status,
            payload: s.payload || {},
            created_at: s.created_at
        })),
    };
}
