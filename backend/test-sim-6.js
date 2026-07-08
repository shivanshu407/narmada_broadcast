import { generateEmbedding, normalizeText } from './src/services/smartResponder.js';
async function run() {
    try {
        const queryNorm = normalizeText("Order karva mate kai details aapvi padse?");
        const queryVec = await generateEmbedding(queryNorm, { modelId: 'Xenova/multilingual-e5-small', prefix: 'query: '});
        
        const engPassageNorm = normalizeText("What details are needed to confirm an order?");
        const engPassageVec = await generateEmbedding(engPassageNorm, { modelId: 'Xenova/multilingual-e5-small', prefix: 'passage: '});
        
        let dotProductEng = 0;
        for (let i = 0; i < queryVec.length; i++) {
            dotProductEng += queryVec[i] * engPassageVec[i];
        }
        console.log("Similarity with English FAQ:", dotProductEng);
    } catch (e) {
        console.error(e);
    }
}
run();
