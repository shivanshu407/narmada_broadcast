const mapping = {
  'मेरा ऑर्डर कहाँ है?': 'Mera order kahan hai',
  'आपकी दुकान कहाँ है?': 'Aapki dukan kahan hai',
  'नमस्ते': 'Hello',
  'बॉट को ग्राहकों का अभिवादन कैसे करना चाहिए?': 'Bot ko customers ko kaise greet karna chahiye',
  'नर्मदा एसेंस का वर्णन 1-2 पंक्तियों में कैसे करें?': 'Narmada Essence ko 1-2 lines mein kaise describe karein',
  'आपके उत्पाद नियमित एयर फ्रेशनर से कैसे अलग हैं?': 'Aapke products regular air freshener se kaise alag hain',
  'क्या आप स्वयं उत्पादों का निर्माण करते हैं?': 'Kya aap products khud manufacture karte ho',
  'आप किस प्रकार के ग्राहकों को सेवा देते हैं: घर, कार्यालय, शोरूम, होटल या कमर्शियल?': 'Aap kin customers ko serve karte ho home office showroom hotel ya commercial',
  'बॉट को किन मुख्य उत्पाद श्रेणियों का उल्लेख करना चाहिए?': 'Main product categories kaun si hai',
  'रिफिल, डिस्पेंसर, मिनी डिफ्यूज़र और डिफ्यूज़र में क्या अंतर है?': 'Refill dispenser mini diffuser aur diffuser mein kya difference hai',
  'घर के लिए कौन से उत्पाद सबसे अच्छे हैं?': 'Ghar ke liye best products kaun se hai',
  'कार्यालय, शोरूम या व्यावसायिक उपयोग के लिए कौन से उत्पाद सबसे अच्छे हैं?': 'Office showroom ya commercial use ke liye best products kaun se hai',
  'कार के लिए कौन से उत्पाद सबसे अच्छे हैं?': 'Car ke liye best products kaun se hai',
  'कौन सी खुशबू उपलब्ध हैं?': 'Kaun kaun si fragrances available hai',
  'कौन सी खुशबू सबसे लोकप्रिय हैं?': 'Kaun si fragrance sabse popular hai',
  'कौन से उत्पाद कार के लिए सबसे अच्छे हैं?': 'Car ke liye best products kaun se hai',
  'हम किसी ऐसे व्यक्ति के लिए कौन सा खुशबू सुझाएँ जो ताजा खुशबू चाहता है?': 'Fresh smell ke liye kaun si fragrance best hai',
  'हम किस सुगंध की सिफारिश किसी के लिए कर सकते हैं जो प्रीमियम या लक्ज़री खुशबू चाहता है?': 'Premium ya luxury smell ke liye kaun si fragrance best hai',
  'एक रिफिल आम तौर पर कितने समय तक चलती है?': 'Ek refill normally kitne time chalti hai',
  'एक डिफ्यूज़र या डिस्पेंसर उत्पाद आमतौर पर कितने समय तक चलता है?': 'Ek diffuser ya dispenser normally kitne time chalta hai',
  'क्या रिफिल सभी डिस्पेंसर के साथ संगत हैं या केवल नर्मदा डिस्पेंसर के साथ ही?': 'Kya refills sabhi dispenser ke sath compatible hai ya sirf narmada dispenser ke sath',
  'क्या ग्राहक अलग से रीफिल खरीद सकते हैं?': 'Kya customers alag se refill kharid sakte hai',
  'क्या आप थोक या व्यावसायिक आदेश प्रदान करते हैं?': 'Kya aap wholesale ya commercial orders lete ho',
  'क्या बॉट को कीमतों का उल्लेख करना चाहिए, या कह देना चाहिए कि कृपया नवीनतम कीमत सूची में देखें?': 'Kya bot ko prices batani chahiye ya price list dekhne bolna chahiye',
  'क्या छूट हमेशा उपलब्ध होती हैं या केवल ऑफ़रों के दौरान?': 'Kya discount hamesha milta hai ya sirf offers ke time',
  'क्या मुफ्त शिपिंग है? अगर हाँ, तो सभी ऑर्डर्स पर या केवल एक निश्चित मूल्य से ऊपर के ऑर्डर्स पर?': 'Kya free shipping hai aur agar hai to kya sabhi orders par',
  'क्या कोई न्यूनतम आदेश मात्रा है?': 'Kya koi minimum order quantity hai',
  'क्या कीमतों में जीएसटी और कर शामिल हैं?': 'Kya prices mein GST aur tax included hai',
  'ग्राहक व्हाट्सएप पर ऑर्डर कैसे दें?': 'Customers WhatsApp par order kaise dein',
  'क्या बॉट को ग्राहकों को WhatsApp सूची की ओर मार्गदर्शन करना चाहिए?': 'Kya bot ko customers ko whatsapp catalog ki taraf guide karna chahiye',
  'ऑर्डर की पुष्टि के लिए किन विवरणों की आवश्यकता होती है?': 'Order confirm karne ke liye kya details chahiye',
  'क्या ग्राहक एक आदेश रद्द कर सकते हैं? किस चरण तक?': 'Kya customer order cancel kar sakte hai aur kis stage tak',
  'यदि कोई ग्राहक पूछे: मेरी ऑर्डर कहाँ है, तो बॉट क्या कहे?': 'Agar customer puche mera order kahan hai to bot kya kahe',
  'डिस्पैच में आमतौर पर कितने दिन लगते हैं?': 'Dispatch mein normally kitne din lagte hai',
  'डिलीवरी में आमतौर पर कितने दिन लगते हैं?': 'Delivery mein normally kitne din lagte hai',
  'आप किन स्थानों पर डिलीवरी करते हैं?': 'Aap kin locations par delivery karte ho',
  'क्या आप गुजरात के बाहर या पूरे भारत में शिपमेंट करते हैं?': 'Kya aap gujarat ke bahar ya pan india ship karte ho',
  'ग्राहक ट्रैकिंग विवरण कैसे प्राप्त करेंगे?': 'Customers ko tracking details kaise milegi',
  'अगर डिलीवरी में देरी हो तो बॉट को क्या कहना चाहिए?': 'Agar delivery delay ho to bot ko kya kehna chahiye',
  'आपकी रिटर्न विंडो क्या है?': 'Aapki return window kya hai',
  'कौन से उत्पाद लौटाए नहीं जा सकते?': 'Kaun se products return nahi ho sakte',
  'ग्राहकों को क्या करना चाहिए अगर उत्पाद खराब, लीक हो रहा हो, या गलत वस्तु हो?': 'Agar product damaged ya leaking ya wrong ho to kya kare',
  'कितने घंटे या दिनों के भीतर खराब उत्पादों की रिपोर्ट करनी चाहिए?': 'Kitne time mein damaged product report karna chahiye',
  'रिफंड या प्रतिस्थापन: आप पहले क्या पेश करना पसंद करेंगे?': 'Refund ya replacement aap pehle kya prefer karte ho',
  'स्वीकृति के बाद रिफंड में कितने दिन लगते हैं?': 'Approval ke baad refund aane mein kitne din lagte hai',
  'क्या उत्तर संक्षिप्त और सीधे या विस्तृत होने चाहिए?': 'Kya answers short aur direct hone chahiye ya detailed',
  'क्या बॉट को इमोजी का उपयोग करना चाहिए या इसे पेशेवर रखना चाहिए?': 'Kya bot ko emoji use karna chahiye ya professional rakhna chahiye',
  'क्या कोई ऐसा शब्द या दावा है जिससे बॉट को बचना चाहिए?': 'Kya koi aise words hai jo bot ko avoid karne chahiye',
  'वेबसाइट वर्तमान में समर्थन समय 24/7 दिखाती है। क्या यह व्हाट्सएप सपोर्ट के लिए सही है?': 'Website 24/7 support dikhati hai kya whatsapp par bhi aisa hai',
  'वेबसाइट शिपिंग नीति वर्तमान में कहती है कि ऑर्डर प्रोसेसिंग में 1-3 कार्यदिवस लगते हैं। क्या वह सही है?': 'Website kehti hai order processing 1-3 days mein hoti hai kya ye sahi hai',
  'वेबसाइट शिपिंग नीति वर्तमान में कहती है कि डिलीवरी 3-7 कार्यदिवस है। क्या वह सही है?': 'Website kehti hai delivery 3-7 days mein hoti hai kya ye sahi hai',
  'वेबसाइट वापसी नीति वर्तमान में कहती है कि अप्रयुक्त और बंद उत्पादों के लिए वापसी अनुरोध 7 दिनों के भीतर स्वीकार किए जाते हैं। क्या वह सही है?': 'Website return policy 7 days hai kya ye sahi hai',
  'व्हाट्सएप बॉट को क्षतिग्रस्त/दोषपूर्ण रिपोर्ट के लिए किस समय का उपयोग करना चाहिए?': 'Damaged report ke liye bot ko kya time batana chahiye'
};

async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const res = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        const hindiFaqs = data.faqs.filter(f => /[अ-ह]/.test(f.question));
        
        for (const faq of hindiFaqs) {
            const slang = mapping[faq.question];
            if (slang) {
                console.log(`Adding slang to FAQ: ${faq.question} -> ${slang}`);
                await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/' + (faq._id || faq.id) + '/phrasings', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token 
                    },
                    body: JSON.stringify({ phrasing: slang })
                });
            }
        }
        console.log('Done injecting slang for Hindi FAQs');
    } catch (e) {
        console.error(e);
    }
}
run();
