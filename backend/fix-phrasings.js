import mongoose from 'mongoose';
import 'dotenv/config';
import anyAscii from 'any-ascii';
import KnowledgeBase from './src/models/KnowledgeBase.js';
import FaqPhrasing from './src/models/FaqPhrasing.js';
import { generateEmbedding } from './src/services/smartResponder.js';
import { embeddingForTenant } from './src/config/embeddingConfig.js';
import Setting from './src/models/Setting.js';

async function fixPhrasings() {
    if (!process.env.MONGO_URI) {
        console.error('MONGO_URI is missing. Please set it in .env');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const faqs = await KnowledgeBase.find();
    console.log(`Found ${faqs.length} FAQs to process.`);

    for (const faq of faqs) {
        if (/[^\x00-\x7F]/.test(faq.question)) {
            const rom = anyAscii(faq.question).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
            if (rom && rom.length > 2) {
                // Find existing generated romanized phrasings (we don't have an explicit flag, but we can look for English-only phrasings that might be old transliteration)
                // Actually, the safest is just to check if this exact 'rom' exists, and if not, add it.
                const exists = await FaqPhrasing.findOne({ faq_id: faq._id, phrasing: rom });
                if (!exists) {
                    const setting = await Setting.findOne({ singletonId: 'admin_settings' });
                    const model = embeddingForTenant(setting?.bot_settings || {});
                    
                    let vec = [];
                    try {
                        vec = await generateEmbedding(rom, { modelId: model.modelId, prefix: model.passagePrefix });
                    } catch (e) {
                        console.warn('Embedding failed for', rom, e.message);
                    }

                    await FaqPhrasing.create({
                        tenant_id: faq.tenant_id,
                        faq_id: faq._id,
                        phrasing: rom,
                        phrasing_vector: vec,
                        embedding_model: model.key,
                    });
                    console.log(`Added new Romanized phrasing for FAQ ${faq._id}: "${rom}"`);
                }
            }
        }
    }
    
    console.log('Done fixing phrasings.');
    process.exit(0);
}

fixPhrasings().catch(console.error);
