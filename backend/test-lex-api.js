async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const res = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/test', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ message: "Order karva mate kai details aapvi padse?" })
        });
        const data = await res.json();
        const match = data.matches.find(m => m.id === '6a4df87e8d01c02ad2a150d4');
        console.log("MATCH:", match);
        const debugFaq = data._direct_retrieve._debug_scores.find(f => f.id === '6a4df87e8d01c02ad2a150d4');
        console.log("DEBUG FAQ:", debugFaq);
    } catch (e) {
        console.error(e);
    }
}
run();
