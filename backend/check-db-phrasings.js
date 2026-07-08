import mongoose from 'mongoose';
import KnowledgeBase from './src/models/KnowledgeBase.js';
import FaqPhrasing from './src/models/FaqPhrasing.js';

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://kaneriyamaulik1:kaneriyamaulik1@cluster0.z2g6y.mongodb.net/whatsapp-broadcast?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to DB');
    
    const phrasings = await FaqPhrasing.find({});
    for (const p of phrasings) {
        if (p.phrasing.includes('dukan') || p.phrasing.includes('દુકાન')) {
            console.log(`- ${p.phrasing}`);
        }
    }
    process.exit(0);
}
run();
