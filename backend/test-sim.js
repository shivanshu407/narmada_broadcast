import { generateEmbedding } from './src/services/smartResponder.js';
async function run() {
    try {
        const vec1 = await generateEmbedding("Order confirm karva mate kaya details jaruri chhe?", { modelId: 'Xenova/multilingual-e5-small', prefix: 'query: '});
        const vec2 = await generateEmbedding("Order karva mate kai details aapvi padse?", { modelId: 'Xenova/multilingual-e5-small', prefix: 'passage: '});
        
        let dotProduct = 0;
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
        }
        console.log("Vector similarity:", dotProduct);
    } catch (e) {
        console.error(e);
    }
}
run();
