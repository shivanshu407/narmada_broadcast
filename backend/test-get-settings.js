async function run() {
    try {
        const loginRes = await fetch('https://broadcast-gilt.vercel.app/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const res = await fetch('https://broadcast-gilt.vercel.app/api/v1/tenant-settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        console.log(JSON.stringify(data.bot_settings, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
