export const UNANSWERED_NOISE_RETRY_TEXT =
    "I couldn't understand that. Please type your question again, or type human to connect with support.";

export const UNANSWERED_CHATTER_ACK_TEXT =
    "You're welcome. What can I help you with?";

const CHATTER_TERMS = new Set([
    'hi', 'hello', 'hey', 'hii', 'hiii', 'thanks', 'thank', 'you', 'thankyou',
    'ok', 'okay', 'fine', 'good', 'morning', 'afternoon', 'evening', 'night',
    'bye', 'welcome'
]);

const SHORT_VALID_TERMS = new Set([
    'cod', 'mrp', 'sku', 'gst', 'emi', 'upi', 'pay', 'price', 'rate', 'cost',
    'order', 'help', 'human', 'agent', 'shop', 'store', 'surat'
]);

const HUMAN_TERMS = new Set([
    'human', 'agent', 'person', 'support', 'team', 'executive', 'representative'
]);

const BUSINESS_TERMS = new Set([
    'address', 'amount', 'available', 'bottle', 'buy', 'cancel', 'catalog',
    'catalogue', 'cod', 'cost', 'delivery', 'diffuser', 'dispenser', 'emi',
    'exchange', 'fragrance', 'freshener', 'gst', 'help', 'location', 'mrp',
    'order', 'pay', 'payment', 'price', 'product', 'rate', 'refund', 'refill',
    'return', 'scent', 'shipping', 'shop', 'spray', 'store', 'support',
    'track', 'warranty'
]);

function normalizeForTriage(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[^a-z0-9\s?]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(value) {
    return normalizeForTriage(value)
        .replace(/\?/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

function clampScore(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function countUniqueMatches(tokens, dictionary) {
    const matches = new Set();
    for (const token of tokens) {
        if (dictionary.has(token)) {
            matches.add(token);
        }
    }
    return matches;
}

function looksLikeKeyboardSmash(compact) {
    if (!compact || compact.length < 6) return false;
    if (/(.)\1{4,}/.test(compact)) return true;
    if (/^([a-z]{1,3})\1{2,}$/i.test(compact)) return true;
    if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(compact)) return true;
    return false;
}

export function triageUnansweredMessage(messageBody) {
    const raw = String(messageBody || '').trim();
    const normalized = normalizeForTriage(raw);
    const compact = normalized.replace(/[^a-z0-9]/g, '');
    const tokens = tokenize(raw);
    const reasonCodes = [];

    if (!normalized || !compact) {
        return {
            learningStatus: 'ignored',
            replyAction: 'ignore',
            messageKind: 'empty',
            qualityScore: 0,
            businessScore: 0,
            reasonCodes: ['empty_message'],
        };
    }

    const businessMatches = countUniqueMatches(tokens, BUSINESS_TERMS);
    const humanMatches = countUniqueMatches(tokens, HUMAN_TERMS);
    const shortValidMatches = countUniqueMatches(tokens, SHORT_VALID_TERMS);
    const hasQuestionShape = /\?|\b(what|where|when|how|can|do|does|is|are|will|please)\b/.test(normalized);
    const hasLetters = /[a-z]/i.test(compact);
    const vowelCount = (compact.match(/[aeiou]/gi) || []).length;
    const letterCount = (compact.match(/[a-z]/gi) || []).length;
    const vowelRatio = letterCount > 0 ? vowelCount / letterCount : 0;

    let businessScore = 0;
    if (businessMatches.size > 0) {
        businessScore += Math.min(0.75, businessMatches.size * 0.35);
    }
    if (shortValidMatches.size > 0) {
        businessScore += 0.25;
    }
    if (hasQuestionShape && businessMatches.size > 0) {
        businessScore += 0.15;
    }
    businessScore = clampScore(businessScore);

    const isOnlyChatter = tokens.length > 0 && tokens.every((token) => CHATTER_TERMS.has(token));
    if (isOnlyChatter && raw.length <= 40) {
        return {
            learningStatus: 'chatter',
            replyAction: 'acknowledge',
            messageKind: 'chatter',
            qualityScore: 0.55,
            businessScore,
            reasonCodes: ['small_talk'],
        };
    }

    if (humanMatches.size > 0 && (tokens.length <= 3 || /\b(want|need|connect|talk|speak|call|support|help)\b/.test(normalized))) {
        return {
            learningStatus: 'handoff',
            replyAction: 'direct_handoff',
            messageKind: 'human_request',
            qualityScore: 0.9,
            businessScore: Math.max(0.7, businessScore),
            reasonCodes: ['human_requested'],
        };
    }

    if (businessScore >= 0.35) {
        return {
            learningStatus: 'candidate',
            replyAction: 'confirm_handoff',
            messageKind: 'business_question',
            qualityScore: 0.75,
            businessScore,
            reasonCodes: ['business_terms'],
        };
    }

    if (looksLikeKeyboardSmash(compact)) {
        reasonCodes.push('keyboard_smash');
    }
    if (hasLetters && letterCount >= 5 && vowelRatio === 0) {
        reasonCodes.push('no_vowels');
    }
    if (tokens.length <= 1 && compact.length < 3 && shortValidMatches.size === 0) {
        reasonCodes.push('too_short');
    }

    if (reasonCodes.length > 0) {
        return {
            learningStatus: 'noise',
            replyAction: 'retry',
            messageKind: 'noise',
            qualityScore: 0.2,
            businessScore,
            reasonCodes,
        };
    }

    const qualityScore = clampScore(
        0.25
        + Math.min(0.35, tokens.length * 0.08)
        + (hasQuestionShape ? 0.15 : 0)
        + (vowelRatio >= 0.2 ? 0.15 : 0)
    );

    return {
        learningStatus: qualityScore >= 0.45 ? 'candidate' : 'noise',
        replyAction: qualityScore >= 0.45 ? 'confirm_handoff' : 'retry',
        messageKind: qualityScore >= 0.45 ? 'unknown_question' : 'noise',
        qualityScore,
        businessScore,
        reasonCodes: qualityScore >= 0.45 ? ['meaningful_unknown'] : ['low_quality_unknown'],
    };
}
