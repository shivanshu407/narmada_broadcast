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

        const faqsRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base?limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const faqsData = await faqsRes.json();
        
        console.log("Total FAQs:", faqsData.faqs.length);
        
        const engFaqs = faqsData.faqs.filter(f => !/[અ-૿]/.test(f.question)); // Check if it DOES NOT contain Gujarati characters
        console.log("English FAQs:", engFaqs.length);

        fs.writeFileSync('eng_faqs.json', JSON.stringify(engFaqs, null, 2));

    } catch (e) {
        console.error(e);
    }
}
run();
