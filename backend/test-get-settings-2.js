async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const testRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/tenant-settings', {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            }
        });
        const testData = await testRes.json();
        console.log("Settings:");
        console.log(JSON.stringify(testData.bot_settings, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
