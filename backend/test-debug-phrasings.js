async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const res = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/debug-phrasings', {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });
        const data = await res.json();
        const faq = data.faqs.find(f => f.id === '6a4df87e8d01c02ad2a150d4');
        console.log("FAQ:", JSON.stringify(faq, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
