const { execSync } = require('child_process');
const fs = require('fs');

async function check() {
    for (let i = 0; i < 20; i++) {
        try {
            console.log(`Try ${i+1}...`);
            execSync('node test-debug-lex.js > output10.txt', { stdio: 'inherit' });
            const output = fs.readFileSync('output10.txt', 'utf8');
            if (output.includes('LEX OBJ')) {
                console.log('Success!');
                break;
            } else {
                console.log('Failed, waiting 5s...');
                await new Promise(r => setTimeout(r, 5000));
            }
        } catch (e) {
            console.log('Failed, waiting 5s...');
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}
check();
