async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const phrasings = [
            { id: "6a4df87e8d01c02ad2a150d4", text: "Order confirm karva mate kaya details jaruri chhe?" },
            { id: "6a4dfb9248223316633769d0", text: "Maro order kya che?" },
            { id: "6a4dfb765a11690839a5e3c2", text: "Tamari dukan kya che?" },
            { id: "6a4df8adda7c7abf1936ac6b", text: "whatsapp par order kevi rite aapvo?" },
            { id: "6a4df8fd63f9325a49465992", text: "free shipping chhe?" }
        ];

        for (const p of phrasings) {
            console.log("Attaching to", p.id, ":", p.text);
            const res = await fetch(`https://broadcast-gilt.vercel.app/api/v1/knowledge-base/${p.id}/phrasings`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ phrasing: p.text })
            });
            console.log(res.status, await res.text());
        }
    } catch (e) {
        console.error(e);
    }
}
run();
