async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const newFaqId = '6a4de8ac63aeba00dc6008d9'; // The active one
        
        const phrasingsToUpload = [
            'tamaru address su che?',
            'location su che?',
            'dukan kya aaveli che?',
            'tamari dukan kya che?'
        ];

        for (const phr of phrasingsToUpload) {
            console.log(`Uploading phrasing: ${phr}`);
            const res = await fetch(`https://broadcast-gilt.vercel.app/api/v1/knowledge-base/${newFaqId}/phrasings`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ phrasing: phr })
            });
            const data = await res.json();
            console.log(`Result:`, data);
        }

    } catch (e) {
        console.error(e);
    }
}
run();
