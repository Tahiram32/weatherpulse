const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `const app = express();`;
const replacement = `const app = express();
app.set("trust proxy", 1); // Respect Cloud Run proxy headers for accurate IP rate limiting`;

code = code.replace(target, replacement);

fs.writeFileSync('server.ts', code);
