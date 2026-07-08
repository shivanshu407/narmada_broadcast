const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb+srv://admin:Lp7WbS0eOQ49v0n6@cluster0.z210d.mongodb.net/whatsapp_saas?retryWrites=true&w=majority');
    const FaqPhrasing = mongoose.model('FaqPhrasing', new mongoose.Schema({
        tenant_id: String,
        faq_id: mongoose.Schema.Types.ObjectId,
        phrasing: String
    }));
    const docs = await FaqPhrasing.find({});
    console.log("Docs found:", docs.length);
    console.log(docs);
    process.exit(0);
}
run();
