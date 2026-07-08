async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const testRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/test', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ message: "Order karva mate kai details aapvi padse?" })
        });
        const testData = await testRes.json();
        console.log("REPLY:", testData.reply);
        console.log("DEBUG:", JSON.stringify(testData._debug_test, null, 2));
        console.log("DIRECT RETRIEVE:", JSON.stringify(testData._direct_retrieve, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
