import mongoose from 'mongoose';
import KnowledgeBase from './src/models/KnowledgeBase.js';
import { initDatabase } from './src/database.js';

const faqs = [
    {
        question: "How should the bot greet customers?",
        answer: "Welcome to *Narmada Essence*! 🌸 Thank you for contacting us. We offer premium fragrance solutions for homes, offices, hotels, restaurants, retail stores, and commercial spaces.",
        is_active: true
    },
    {
        question: "How should we describe Narmada Essence in 1-2 lines?",
        answer: "*Narmada Essence* is a premium fragrance solutions company offering aroma diffusers, automatic fragrance dispensers, and over 100 luxurious fragrances to create refreshing spaces for homes and businesses. We provide free demos, free home delivery in Surat, and a lifetime warranty on eligible machines.",
        is_active: true
    },
    {
        question: "What makes your products different from regular air fresheners?",
        answer: "Our fragrance solutions offer the perfect balance of *premium quality and affordability*. Unlike many expensive diffuser brands, *Narmada Essence* provides high-quality aroma diffusers at budget-friendly prices, using natural, long-lasting fragrance oils. We also back our eligible machines with a *lifetime warranty*, ensuring excellent value and peace of mind.",
        is_active: true
    },
    {
        question: "Do you manufacture the products yourself?",
        answer: "Yes. *Narmada Essence* manufactures and supplies its own products.",
        is_active: true
    },
    {
        question: "Which customer types do you serve: home, office, showroom, hotel, commercial, car, or other?",
        answer: "*Narmada Essence* provides premium fragrance solutions for every space—from homes and offices to hotels, airports, railways, cargo ships, and commercial facilities. *If you can imagine the space, we can fragrance it.*",
        is_active: true
    },
    {
        question: "What main product categories should the bot mention?",
        answer: "*Narmada Essence* offers premium aroma diffusers, automatic and remote-controlled fragrance dispensers, air freshener refills, natural fragrance oils, commercial fragrance machines, home and car fragrance solutions, scent marketing solutions for businesses, and a complete range of fragrance accessories and refills.",
        is_active: true
    },
    {
        question: "What is the difference between refill, dispenser, mini diffuser, and diffuser?",
        answer: "• *Diffusers:* Premium fragrance machines designed to spread natural fragrance evenly in medium to large spaces such as homes, offices, hotels, and commercial areas.\n• *Mini Diffusers:* Compact fragrance machines ideal for small rooms, cabins, bedrooms, and personal spaces.\n• *Dispensers:* Automatic or remote-controlled air freshener machines that release fragrance at preset intervals, making them suitable for washrooms, offices, and public areas.\n• *Refills:* High-quality natural fragrance oils or air freshener refills used to refill diffusers and dispensers. Available in 100+ premium fragrance varieties.",
        is_active: true
    },
    {
        question: "Which products are best for home use?",
        answer: "For home use, we recommend our *Mini Diffusers, Premium Aroma Diffusers,* and *Automatic Fragrance Dispensers*. Mini diffusers are ideal for bedrooms and small spaces, premium diffusers are perfect for living rooms and larger areas, and dispensers are a convenient option for washrooms, kitchens, hallways, and other spaces where automatic fragrance at preset intervals is preferred. All our products use natural fragrance oils and are available in over 100 premium fragrance varieties.",
        is_active: true
    },
    {
        question: "Which products are best for office, showroom, or commercial use?",
        answer: "For offices, showrooms, hotels, retail stores, and other commercial spaces, we recommend our *Premium Aroma Diffusers, Commercial Diffusers, Automatic Fragrance Dispensers,* and *Remote-Controlled Dispensers*. These products are designed to cover larger areas, provide consistent and long-lasting fragrance, and create a pleasant, luxurious environment. They are compatible with our natural fragrance oils, available in over 100 premium fragrance varieties.",
        is_active: true
    },
    {
        question: "Which products are best for car use?",
        answer: "For car use, we recommend our *Manual Fragrance Refills*, which are easy to use and provide a long-lasting, natural fragrance to keep your car fresh and pleasant. Choose from over *100 premium fragrance varieties* to match your personal preference.",
        is_active: true
    },
    {
        question: "Which fragrances are available?",
        answer: "We offer *100+ premium fragrance varieties* to suit every preference and space. Our collection includes *Floral, Fruity, Citrus, Woody, Fresh, Aqua, Herbal, Oriental, Coffee, Vanilla, Chocolate, Luxury Perfume-Inspired, and Seasonal fragrances*. If you're unsure which fragrance to choose, we can recommend the best option based on your space and personal preference.",
        is_active: true
    },
    {
        question: "Which fragrances are most popular?",
        answer: "Our most popular fragrances include *Davidoff Cool Water, Marriott, Ferrari, Cherry Blossom, White Oud, Sandalwood, Lavender, Lemongrass, Jasmine, Rose, Vanilla, Ocean Breeze, Fresh Linen, Green Tea, Coffee, Citrus Blast, Royal Musk, Black Orchid, White Tea,* and *Mogra*. With over *100 premium fragrance varieties*, we have the perfect scent for homes, offices, hotels, showrooms, cars, and commercial spaces.",
        is_active: true
    },
    {
        question: "Which fragrance should we recommend for someone who wants a fresh smell?",
        answer: "We recommend *Davidoff Cool Water, Ocean Breeze, Fresh Linen, White Tea, Green Tea, Lemongrass, Citrus Blast,* or *Marriott*. These fragrances create a refreshing, pleasant, and long-lasting ambience, making them ideal for homes, offices, showrooms, hotels, and commercial spaces.",
        is_active: true
    },
    {
        question: "Which fragrance should we recommend for someone who wants a premium or luxury smell?",
        answer: "We recommend *Marriott, Ferrari, Davidoff Cool Water, White Oud, Black Orchid, Royal Musk, Sandalwood, Cherry Blossom,* or *White Tea*. These fragrances create an elegant, sophisticated, and long-lasting ambience, making them perfect for homes, offices, hotels, showrooms, luxury retail stores, and commercial spaces.",
        is_active: true
    },
    {
        question: "How long does one refill usually last?",
        answer: "The life of one refill depends on the machine, fragrance intensity, and usage settings. On average, a refill lasts *30 to 90 days* with normal daily use. Our team can recommend the right refill size and settings based on your space and fragrance requirements.",
        is_active: true
    },
    {
        question: "How long does one diffuser or dispenser product usually last?",
        answer: "Our diffusers and dispensers are built for long-term use with high-quality components. With proper care and regular maintenance, they can last for many years. We also provide a *lifetime warranty on eligible machines*, giving you reliable performance and complete peace of mind.",
        is_active: true
    },
    {
        question: "Are refills compatible with all dispensers or only Narmada dispensers?",
        answer: "Our refills are compatible with *Narmada Essence diffusers and dispensers*, as well as *most standard dispensers available in the market*. They are designed to deliver excellent fragrance performance and long-lasting freshness. If you're using a different brand and are unsure about compatibility, simply share the machine model and we'll help you confirm it.",
        is_active: true
    },
    {
        question: "Can customers buy refills separately?",
        answer: "Yes, absolutely! Customers can purchase *fragrance refills separately* at any time.",
        is_active: true
    },
    {
        question: "Do you provide bulk or commercial orders?",
        answer: "Yes, we specialize in *bulk and commercial orders*.",
        is_active: true
    },
    {
        question: "If the bot does not understand, should it ask before adding human support?",
        answer: "Yes. If the bot does not understand the customer's question, it should first ask for clarification instead of immediately transferring to a human.",
        is_active: true
    },
    {
        question: "Should the bot speak in English, Hindi, Gujarati, or all three?",
        answer: "The bot should be able to communicate in English, Hindi, and Gujarati, and automatically respond in the same language the customer uses for a smooth and personalized experience.",
        is_active: true
    },
    {
        question: "Should replies be short and direct or detailed?",
        answer: "The bot should keep replies short, clear, and direct by default. If a customer asks for more information or needs detailed guidance, the bot should provide a more detailed explanation. This ensures quick responses while still being helpful when needed.",
        is_active: true
    },
    {
        question: "Should the bot use emojis or keep it professional?",
        answer: "The bot should maintain a professional, friendly, and welcoming tone. It may use a few simple emojis (such as 😊, ✿, 🚚, or 📞) where appropriate to make conversations feel warm and engaging, but it should avoid excessive emojis and always keep replies clear and professional.",
        is_active: true
    },
    {
        question: "Any words or claims the bot must avoid?",
        answer: "Yes. The bot should avoid making misleading or unverifiable claims. It should not use words or promises such as:\n• \"Guaranteed results\" or \"100% guaranteed.\"\n• \"Best in India,\" \"No.1,\" or \"World's best\" unless officially verified.\n• Any medical or health claims (e.g., \"cures allergies,\" \"kills viruses,\" or \"improves health\").\n• False promises about fragrance lasting forever or working in every environment.\n• Competitor comparisons that are misleading or disrespectful.\n• Incorrect pricing, offers, or delivery timelines.\n• Claims that a product is available or in stock unless confirmed.",
        is_active: true
    },
    {
        question: "Website currently shows support time as 24/7. Is that correct for WhatsApp support?",
        answer: "WhatsApp Support Hours: 10:00 AM to 7:00 PM (Monday to Saturday)\nOur WhatsApp bot is available to answer common questions anytime. However, if you need assistance from our support team, our human representatives are available Monday to Saturday, 10:00 AM to 7:00 PM. Messages received outside these hours will be answered during the next business day.",
        is_active: true
    },
    {
        question: "Website shipping policy currently says order processing is 1-3 business days. Is that correct?",
        answer: "Order Processing Time: Orders are typically processed and dispatched within 1-2 business days after order confirmation, subject to product availability. Bulk or customized orders may require additional processing time, and our team will inform customers of the estimated dispatch schedule.",
        is_active: true
    },
    {
        question: "Website shipping policy currently says delivery is 3-7 business days. Is that correct?",
        answer: "Delivery Time: We offer free home delivery within Surat, which is usually completed within 1-2 days. For deliveries across Gujarat and the rest of India, orders are typically delivered within 3-7 business days, depending on the destination and courier service.",
        is_active: true
    },
    {
        question: "Website return policy currently says return requests are accepted within 7 days for unused and unopened products. Is that correct?",
        answer: "Yes, that's correct. Return requests are accepted within 7 days of delivery for unused, unopened products in their original packaging. If a product is damaged, defective, leaking, or the wrong item is delivered, customers should report the issue within 24 hours of delivery by sharing clear photos or a video on WhatsApp so we can arrange a replacement or an appropriate resolution.",
        is_active: true
    },
    {
        question: "Which timing should the WhatsApp bot use for damaged/defective reports?",
        answer: "Recommended WhatsApp Bot Policy: Customers should report any damaged, defective, leaking, incorrect, or missing product within 24 hours of delivery by sharing their order details along with clear photos or a video on WhatsApp. Our team will verify the issue and arrange a replacement or an appropriate resolution.",
        is_active: true
    }
];

async function seed() {
    await initDatabase();
    
    let insertedCount = 0;
    for (const faqData of faqs) {
        // Check if exists to avoid duplicates
        const exists = await KnowledgeBase.findOne({ question: faqData.question });
        if (!exists) {
            const faq = new KnowledgeBase({
                ...faqData,
                created_at: new Date(),
                updated_at: new Date()
            });
            await faq.save();
            insertedCount++;
            console.log(`Inserted: ${faq.question}`);
        } else {
            console.log(`Skipped (already exists): ${faqData.question}`);
        }
    }
    
    console.log(`\nSuccessfully inserted ${insertedCount} new FAQs.`);
    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
