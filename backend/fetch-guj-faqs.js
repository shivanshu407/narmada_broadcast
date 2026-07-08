import fs from 'fs';

async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const res = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const gujFaqs = data.faqs.filter(f => /[\u0A80-\u0AFF]/.test(f.question));
        
        const output = gujFaqs.map(f => ({
            id: f.id,
            q: f.question
        }));
        
        fs.writeFileSync('guj_faqs.json', JSON.stringify(output, null, 2));
        console.log(`Saved ${output.length} Gujarati FAQs.`);
    } catch (e) {
        console.error(e);
    }
}
run();
