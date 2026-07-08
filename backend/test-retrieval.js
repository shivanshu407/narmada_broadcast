import mongoose from 'mongoose';
import { retrieveAnswer } from './src/services/retrievalEngine.js';
import Setting from './src/models/Setting.js';

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://kaneriyamaulik1:kaneriyamaulik1@cluster0.z2g6y.mongodb.net/whatsapp-broadcast?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to DB');

    const setting = await Setting.findOne();
    const tenantId = setting._id.toString();

    console.log('\n--- Testing Romanized Gujarati ---');
    const result1 = await retrieveAnswer(tenantId, 'tamari dukan kya che?', setting.bot_settings);
    console.log(JSON.stringify(result1, null, 2));

    process.exit(0);
}

run();
