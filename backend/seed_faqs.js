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
