import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(!existsSync('.env.local')){writeFileSync('.env.local',`APP_URL=http://127.0.0.1:5173\nINTEGRATION_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nCRON_SECRET=${randomBytes(32).toString('hex')}\n`);console.log('Created ignored local encryption and scheduler secrets. No external service connected.')}else console.log('Existing local environment kept.');
