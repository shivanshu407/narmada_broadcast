import { generateEmbedding } from './src/services/smartResponder.js';

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function run() {
    console.log('Generating exact match embeddings...');
    const qVec = await generateEmbedding('tamari dukan kya che?', { modelId: 'Xenova/multilingual-e5-small', prefix: 'query: '});
    const pVec = await generateEmbedding('tamari dukan kya che?', { modelId: 'Xenova/multilingual-e5-small', prefix: 'passage: '});
    
    const score = cosineSimilarity(qVec, pVec);
    console.log(`\nExact match score (query vs passage prefix): ${score.toFixed(4)}`);
}

run();
