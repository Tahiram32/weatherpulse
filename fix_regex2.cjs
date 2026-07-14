const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/\/eval\\\\\(\/gi/g, '/eval\\(/gi');
code = code.replace(/\/function\\\\\(\/gi/g, '/function\\(/gi');

fs.writeFileSync('server.ts', code);
