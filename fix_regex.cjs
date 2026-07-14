const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  'cleaned = cleaned.replace(/[^a-zA-Z0-9\\\\s&.,\\\\-\\\'\\\\!\\\\?#]/g, "");',
  'cleaned = cleaned.replace(/[^a-zA-Z0-9\\\\s&.,\\-\\\'!?#]/g, "");'
);

fs.writeFileSync('server.ts', code);
