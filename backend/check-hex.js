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

        for (const faq of faqsData.faqs || []) {
            if (faq.question.includes('દુકાન')) {
                const phrRes = await fetch(`https://broadcast-gilt.vercel.app/api/v1/knowledge-base/${faq._id}/phrasings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const phrData = await phrRes.json();
                for (const p of phrData.phrasings) {
                    console.log(`Phrasing: "${p.phrasing}"`);
                    console.log(Buffer.from(p.phrasing).toString('hex'));
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}
run();
