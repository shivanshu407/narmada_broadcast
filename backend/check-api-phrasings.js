async function run() {
    try {
        // Login to get token
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        // Get all FAQs
        const faqsRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base?limit=100', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const faqsData = await faqsRes.json();

        // Print phrasings
        const dataArray = faqsData.faqs;
        if (Array.isArray(dataArray)) {
            for (const faq of dataArray) {
                if (faq.question.includes('દુકાન') || faq.question.includes('dukan') || faq.answer.includes('સુરત') || faq.question.includes('shop')) {
                    console.log(`FAQ: ${faq.question}`);
                    const phrRes = await fetch(`https://broadcast-gilt.vercel.app/api/v1/knowledge-base/${faq._id}/phrasings`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const phrData = await phrRes.json();
                    console.log(`Phrasings:`, phrData.phrasings.map(p => p.phrasing));
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}
run();
