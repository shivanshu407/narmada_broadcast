async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const testRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/knowledge-base/test', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ message: 'tamari dukan kya che?' })
        });
        const testData = await testRes.json();
        for (const m of testData.matches) {
            console.log(`${m.id} - ${m.question} -> ${m.score}`);
        }
    } catch (e) {
        console.error(e);
    }
}
run();
