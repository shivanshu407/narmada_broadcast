import OpenAI from 'openai';
import { getTenantKnowledge } from './smartResponder.js';
import { sanitizeProductDescriptionForCatalogue } from '../utils/productCatalogue.js';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: DEEPSEEK_API_KEY || 'MISSING_KEY'
});

export async function generateLLMReply(tenantId, messageBody, chatHistory = [], tenant = null) {
    if (!messageBody || messageBody.trim() === '') return null;

    try {
        const { faqs, products } = await getTenantKnowledge(tenantId);
        
        if ((!faqs || faqs.length === 0) && (!products || products.length === 0)) {
            return null; // No knowledge base to answer from
        }

        // Build context from Knowledge Base
        let contextText = "You are a helpful, professional, and friendly AI Assistant for a business";
        if (tenant && tenant.name) {
            contextText += ` named "${tenant.name}"`;
        }
        contextText += ".\n\nHere is your entire knowledge base. YOU MUST STRICTLY USE THIS INFORMATION TO ANSWER THE USER. If the user asks something not covered here, reply saying you don't have that information but a human agent will assist them shortly.\n\n";

        if (faqs && faqs.length > 0) {
            contextText += "--- FREQUENTLY ASKED QUESTIONS ---\n";
            faqs.forEach(f => {
                contextText += `Q: ${f.question}\nA: ${f.answer}\n\n`;
            });
        }

        if (products && products.length > 0) {
            contextText += "--- PRODUCTS IN STOCK ---\n";
            products.forEach(p => {
                const desc = sanitizeProductDescriptionForCatalogue(p.description);
                contextText += `Product ID: ${p._id}\nName: ${p.name}\nCategory: ${p.category || 'General'}\nPrice: ₹${p.selling_price || p.mrp}\nDescription: ${desc}\n\n`;
            });
        }

        contextText += "\nCRITICAL RULES:\n";
        contextText += "1. STRICT LANGUAGE MATCHING: You MUST reply in the EXACT same language AND script that the user used in their last message. If they write in English, reply in English. If they write in Gujarati script, reply in Gujarati script. If they write in Hinglish or Gujlish (Roman script), reply in Roman script. Do NOT translate their language into the language of the FAQs.\n";
        contextText += "2. You MUST respond in pure JSON format.\n";
        contextText += `   - If answering a general question: { "type": "faq", "text": "Your answer in the correct language" }\n`;
        contextText += `   - If the user asks about or wants to see a specific product: { "type": "product", "productId": "the_Product_ID_here", "text": "Here is the product you asked for!" } (You MUST use the exact Product ID, NOT the Name)\n`;
        contextText += `   - If the user asks to see your catalog, all products, or a list of your items: { "type": "catalog_link", "text": "Here is our complete catalog!" }\n`;
        contextText += "3. Keep your answers brief and friendly.\n";
        contextText += "4. NEVER invent prices, products, or policies not listed above.\n";

        const messages = [
            { role: "system", content: contextText }
        ];

        // Add history if any
        if (chatHistory && chatHistory.length > 0) {
            // Keep last 4 messages to avoid blowing up context window
            const recentHistory = chatHistory.slice(-4);
            recentHistory.forEach(m => {
                messages.push({
                    role: m.direction === 'inbound' ? 'user' : 'assistant',
                    content: m.body || ''
                });
            });
        }

        messages.push({ role: "user", content: messageBody });

        const response = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: messages,
            max_tokens: 400,
            temperature: 0.1, // Lower temp for strict JSON adherence
            response_format: { type: "json_object" }
        });

        const replyRaw = response.choices[0]?.message?.content?.trim();
        
        if (!replyRaw) return null;

        // Robustly extract JSON from markdown if present
        let jsonString = replyRaw;
        const jsonMatch = replyRaw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (jsonMatch && jsonMatch[1]) {
            jsonString = jsonMatch[1].trim();
        }

        try {
            const parsed = JSON.parse(jsonString);
            
            if (parsed.type === 'product' && parsed.productId) {
                const searchId = String(parsed.productId).toLowerCase();
                const p = products.find(prod => 
                    prod._id.toString() === parsed.productId || 
                    (prod.name && prod.name.toLowerCase().includes(searchId)) ||
                    (prod.sku && prod.sku.toLowerCase() === searchId) ||
                    (searchId.includes(prod.name?.toLowerCase()))
                );
                if (p) {
                    return {
                        type: 'product',
                        data: p,
                        text: parsed.text || "Here is the product:",
                        confidence: 'high',
                        band: 'high',
                        _source: 'deepseek_llm'
                    };
                }
            }

            if (parsed.type === 'catalog_link') {
                return {
                    type: 'catalog_link',
                    text: parsed.text || "Here is our complete catalog!",
                    confidence: 'high',
                    band: 'high',
                    _source: 'deepseek_llm'
                };
            }

            return {
                type: 'faq', 
                text: parsed.text || replyRaw,
                confidence: 'high',
                band: 'high',
                _source: 'deepseek_llm'
            };
        } catch (e) {
            console.error('[LLMResponder] Failed to parse JSON, falling back to raw text');
            
            // Safety net to prevent raw JSON from leaking to the customer if parse fails
            let fallbackText = jsonString;
            const textMatch = jsonString.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
            if (textMatch && textMatch[1]) {
                fallbackText = textMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
            } else {
                // Strip JSON braces if it looks like an object
                if (fallbackText.startsWith('{') && fallbackText.endsWith('}')) {
                    fallbackText = "I found the product, please check our catalog!";
                }
            }

            return {
                type: 'faq',
                text: fallbackText,
                confidence: 'high',
                band: 'high',
                _source: 'deepseek_llm'
            };
        }

    } catch (error) {
        console.error('[LLMResponder] DeepSeek API Error:', error);
        return null; // Fallback to local vector retrieval
    }
}
