const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf-8').split('\n');
[799, 877, 978, 1816].forEach(line => {
  console.log(`Line ${line}:`, lines[line - 1]);
});
