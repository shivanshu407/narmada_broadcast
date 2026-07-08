async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const faqsRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base?limit=100', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const faqsData = await faqsRes.json();

        const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'please', 'the', 'to', 'we', 'what', 'when', 'where', 'which', 'who', 'with', 'you', 'your']);

        function normalizeText(text) {
            if (!text) return '';
            return String(text).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, ' ').trim();
        }

        function tokenizeForMatch(text) {
            return normalizeText(text)
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
        }

        function testScore(query, candidate) {
            const queryTokens = tokenizeForMatch(query);
            const candidateTokens = tokenizeForMatch(candidate);
            if (!queryTokens.length || !candidateTokens.length) return 0;
            const candidateSet = new Set(candidateTokens);
            const overlapCount = queryTokens.filter((token) => candidateSet.has(token)).length;
            if (overlapCount === 0) return 0;
            const queryCoverage = overlapCount / queryTokens.length;
            const candidateCoverage = overlapCount / candidateTokens.length;
            return Math.min(0.9, 0.15 + (queryCoverage * 0.55) + (candidateCoverage * 0.2));
        }

        const msg = "tamari dukan kya che?";

        for (const faq of faqsData.faqs || []) {
            if (testScore(msg, faq.question) > 0.49) console.log(`${faq.question} -> ${testScore(msg, faq.question)}`);
            if (testScore(msg, faq.answer) > 0.49) console.log(`${faq.answer} -> ${testScore(msg, faq.answer)}`);
            const phrRes = await fetch(`https://broadcast-gilt.vercel.app/api/v1/knowledge-base/${faq._id}/phrasings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const phrData = await phrRes.json();
            for (const p of phrData.phrasings) {
                if (testScore(msg, p.phrasing) > 0.48) {
                    console.log(`"${p.phrasing}" -> ${testScore(msg, p.phrasing)}`);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}
run();
