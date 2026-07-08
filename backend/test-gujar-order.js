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
            body: JSON.stringify({ message: 'ઓર્ડર કન્ફર્મ કરવા માટે કયા વિગતો આવશ્યક છે?' })
        });
        const testData = await testRes.json();
        console.log("REPLY:", JSON.stringify(testData.reply, null, 2));
        console.log("MATCHES:");
        for(const m of testData.matches) {
           console.log(`- ${m.score} -> ${m.question}`);
        }
    } catch (e) {
        console.error(e);
    }
}
run();
