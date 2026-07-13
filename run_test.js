fetch("http://127.0.0.1:3000/api/cron/publish-articles", {
  method: "POST",
  headers: { "Authorization": "Bearer nexus2026" }
}).then(r => r.text()).then(console.log);
