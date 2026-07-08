import { generateEmbedding } from './src/services/smartResponder.js';
async function run() {
    try {
        const vec1 = await generateEmbedding("Order confirm karva mate kaya details jaruri chhe?", { modelId: 'Xenova/multilingual-e5-small', prefix: 'query: '});
        console.log("Vector length:", vec1.length);
        console.log("First 5 elements:", vec1.slice(0, 5));
    } catch (e) {
        console.error(e);
    }
}
run();
