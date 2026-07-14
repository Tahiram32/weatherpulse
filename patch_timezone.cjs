const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target1 = `    const now = Timestamp.now().toDate();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateOptions = { timeZone: 'UTC', month: 'short', day: 'numeric' };
    const dateString = \`\${oneWeekAgo.toLocaleDateString('en-US', dateOptions)} - \${now.toLocaleDateString('en-US', dateOptions)}\`;
    for (const doc of clientsSnapshot.docs) {
      const client = doc.data();
      if (!client.email) continue;`;

const replacement1 = `    const now = Timestamp.now().toDate();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    for (const doc of clientsSnapshot.docs) {
      const client = doc.data();
      if (!client.email) continue;
      
      const clientTimeZone = client.timezone || "America/Los_Angeles";
      const dateOptions = { timeZone: clientTimeZone, month: 'short', day: 'numeric' };
      const dateString = \`\${oneWeekAgo.toLocaleDateString('en-US', dateOptions)} - \${now.toLocaleDateString('en-US', dateOptions)}\`;`;

code = code.replace(target1, replacement1);

fs.writeFileSync('server.ts', code);
