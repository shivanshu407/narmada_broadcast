import mongoose from 'mongoose';
import { handleSmartReply } from './src/services/smartResponder.js';

async function run() {
    try {
        await mongoose.connect('mongodb+srv://admin:L388gEpt1zZ2nK02@cluster0.zox2x4h.mongodb.net/broadcast?retryWrites=true&w=majority');

        const tenantId = '666ee32f6b158022d8db1426'; // Narmada Essence
        const message = 'Order karva mate kai details aapvi padse?';
        const botSettings = {
            flags: {
                retrieval_v2: true,
                embeddings_v2: true,
                disambiguation: true,
                smart_flows: true
            },
            embedding_model: 'multilingual-e5-small'
        };

        const reply = await handleSmartReply(tenantId, message, [], botSettings, { persistState: false });
        console.log("REPLY:", JSON.stringify(reply, null, 2));

        mongoose.connection.close();
    } catch (e) {
        console.error(e);
        mongoose.connection.close();
    }
}
run();
