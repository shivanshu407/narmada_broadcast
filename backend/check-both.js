async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const faqsRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base?limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const faqsData = await faqsRes.json();

        for (const faq of faqsData.faqs || []) {
            if (faq.question.includes('દુકાન')) {
                console.log(`FAQ: "${faq.question}", ID: ${faq._id}, tenant_id: ${faq.tenant_id}`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}
run();
