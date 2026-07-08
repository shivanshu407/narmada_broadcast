async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const loginResText = await loginRes.text();
        console.log("LOGIN STATUS:", loginRes.status);
        console.log("LOGIN BODY:", loginResText);
        const loginData = JSON.parse(loginResText);
        const token = loginData.token;

        const res = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/test', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ message: "Order karva mate kai details aapvi padse?" })
        });
        const text = await res.text();
        console.log("STATUS:", res.status);
        console.log("BODY:", text);
    } catch (e) {
        console.error(e);
    }
}
run();
