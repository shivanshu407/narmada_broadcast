const { execSync } = require('child_process');

async function check() {
    for (let i = 0; i < 20; i++) {
        try {
            console.log(`Try ${i+1}...`);
            execSync('node test-debug-score.js > output9.txt', { stdio: 'inherit' });
            console.log('Success!');
            break;
        } catch (e) {
            console.log('Failed, waiting 5s...');
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}
check();
