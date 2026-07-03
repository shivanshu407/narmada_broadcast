import { initDatabase } from './src/database.js';
import Setting from './src/models/Setting.js';
import mongoose from 'mongoose';

async function run() {
    await initDatabase();
    
    // We must use strict: false or update directly via mongoose collection because razorpay_key_id is not in the schema
    await mongoose.connection.collection('settings').updateOne(
        { singletonId: 'admin_settings' },
        { $set: { razorpay_key_id: 'rzp_test_Sp8ow2u4uVKQIl', razorpay_key_secret: 'HZ0Pp5Jblm8gys1HjRkIqCK4' } },
        { upsert: true }
    );
    
    console.log('Keys saved to DB successfully!');
    process.exit(0);
}

run().catch(console.error);
