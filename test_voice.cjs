fetch("http://127.0.0.1:3000/api/webhooks/voice", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": "Bearer nexus2026" },
  body: JSON.stringify({
    domain: "test.com",
    transcript: "My roof is leaking really bad, I need someone to come right now!",
    callerNumber: "+15551234567"
  })
}).then(r => r.json()).then(console.log).catch(console.error);
