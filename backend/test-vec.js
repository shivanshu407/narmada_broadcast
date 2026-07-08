async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const res = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/6a4df87e8d01c02ad2a150d4/phrasings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const phrVec = data.phrasings[0].phrasing_vector;
        console.log("Vector from Vercel DB length:", phrVec.length);
        console.log("First 5 elements:", phrVec.slice(0, 5));
    } catch (e) {
        console.error(e);
    }
}
run();
