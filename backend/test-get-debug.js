async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        // Since I can't call getTenantKnowledge directly over the network, I will fetch GET /api/v1/knowledge-base/
        // Wait, GET /api/v1/knowledge-base/ doesn't return phrasings!
        // But /api/v1/knowledge-base/test DOES return matches with _debug_scores if my latest code deployed!
        
        const testRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/test', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ message: "Order karva mate kai details aapvi padse?" })
        });
        const testData = await testRes.json();
        console.log("DEBUG SCORES:", JSON.stringify(testData._direct_retrieve?._debug_scores, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
