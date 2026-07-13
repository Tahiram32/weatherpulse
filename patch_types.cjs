const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');
content = content.replace('lastUpdated?: string;', 'lastUpdated?: string;\n  syndicateEnabled?: boolean;');
fs.writeFileSync('src/types.ts', content);
console.log("Patched types.ts");
