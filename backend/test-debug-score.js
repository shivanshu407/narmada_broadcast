async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const res = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/debug-score', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                query: "Order karva mate kai details aapvi padse?",
                candidate: "Order confirm karva mate kaya details jaruri chhe?"
            })
        });
        const data = await res.json();
        console.log("SCORE:", data.score);
    } catch (e) {
        console.error(e);
    }
}
run();
