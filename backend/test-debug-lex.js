async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const res = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/debug-lex', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                message: "order karva mate kai details aapvi padse",
                tenant_id: "6a45f7d09a181c0003085484"
            })
        });
        const data = await res.json();
        console.log("LEX DATA:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
