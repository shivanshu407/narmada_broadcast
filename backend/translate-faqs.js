import fs from 'fs';
import { translate } from 'bing-translate-api';

async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const engFaqs = JSON.parse(fs.readFileSync('eng_faqs.json', 'utf8'));
        console.log(`Translating ${engFaqs.length} FAQs...`);

        // Skip the ones we already did with Google before it rate limited
        let start = 19; // We failed at 20 in the last log

        let count = start;
        for (let i = start; i < engFaqs.length; i++) {
            const eng = engFaqs[i];
            console.log(`Processing [${count + 1}/${engFaqs.length}]: ${eng.question.substring(0, 30)}...`);
            
            // Translate to Gujarati
            try {
                const guResQ = await translate(eng.question, null, 'gu');
                const guResA = await translate(eng.answer, null, 'gu');
                
                await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({
                        question: guResQ.translation,
                        answer: guResA.translation,
                        is_active: true
                    })
                });
                console.log(`  -> Gujarati OK`);
            } catch (err) {
                console.error(`  -> Gujarati failed:`, err.message);
            }

            // Translate to Hindi
            try {
                const hiResQ = await translate(eng.question, null, 'hi');
                const hiResA = await translate(eng.answer, null, 'hi');
                
                await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({
                        question: hiResQ.translation,
                        answer: hiResA.translation,
                        is_active: true
                    })
                });
                console.log(`  -> Hindi OK`);
            } catch (err) {
                console.error(`  -> Hindi failed:`, err.message);
            }
            
            count++;
            
            // Wait to avoid rate limits
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("Done!");
    } catch (e) {
        console.error(e);
    }
}
run();
