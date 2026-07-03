import mongoose from 'mongoose';

const BotUnansweredSchema = new mongoose.Schema({
    tenant_id: { type: String, required: true, index: true },
    conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppConversation', default: null },
    phone: { type: String, default: '' },
    message_body: { type: String, required: true },
    normalized_message: { type: String, required: true },
    best_match_type: { type: String, default: null },
    best_match_id: { type: String, default: null },
    score: { type: Number, default: 0 },
    status: { type: String, default: 'new', index: true },
    learning_status: { type: String, enum: ['candidate', 'noise', 'chatter', 'handoff', 'resolved', 'ignored'], default: 'candidate', index: true },
    cluster_key: { type: String, default: '' },
    metadata: { type: Object, default: {} },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export default mongoose.model('BotUnanswered', BotUnansweredSchema);
