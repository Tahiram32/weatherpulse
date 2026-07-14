const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `          : zeroPartnersFound
            ? \`🚨 CRITICAL OVERRIDE 🚨: We are currently fully booked and our partner network in your area is at capacity.
      You MUST inform the user: "We are currently fully booked and our partner network in your area is at capacity. However, I have placed you at the top of our priority waitlist. Our manager will text you the second a slot opens."\`
            : ""`;

const replacement = `          : zeroPartnersFound
            ? \`[SYSTEM INSTRUCTION: The partner network is currently at capacity. Inform the user they are added to the priority waitlist and maintain a helpful, conversational tone for any follow-up questions].\`
            : ""`;

code = code.replace(target, replacement);

fs.writeFileSync('server.ts', code);
