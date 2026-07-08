import { generateEmbedding, normalizeText } from './src/services/smartResponder.js';
async function run() {
    try {
        const queryNorm = normalizeText("Order karva mate kai details aapvi padse?");
        const queryVec = await generateEmbedding(queryNorm, { modelId: 'Xenova/multilingual-e5-small', prefix: 'query: '});
        
        // I know the vector from DB for phrasing: "Order confirm karva mate kaya details jaruri chhe?"
        const dbVecRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const { token } = await dbVecRes.json();
        const phrRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/6a4df87e8d01c02ad2a150d4/phrasings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const phrData = await phrRes.json();
        const passageVec = phrData.phrasings[0].phrasing_vector;
        
        let dotProduct = 0;
        for (let i = 0; i < queryVec.length; i++) {
            dotProduct += queryVec[i] * passageVec[i];
        }
        console.log("EXACT Vector similarity with Vercel DB:", dotProduct);
    } catch (e) {
        console.error(e);
    }
}
run();
