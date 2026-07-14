const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const targetCron = `    console.log("📅 [CRON] Running Weekly Value Receipt job...");`;
const replacementCron = `    console.log("📅 [CRON] Running Weekly Value Receipt job...");
    
    // Server-Side Incrementing Counter for Platform Metrics (Global Reset & Aggregate)
    let globalTrades = 0;
    let globalRevenue = 0;
`;

code = code.replace(targetCron, replacementCron);

const targetRevenue = `      const syndicateQuery = await db
        .collection("syndicate_ledger")
        .where("sourceDomain", "==", domain)
        .where("timestamp", ">=", oneWeekAgo.toISOString())
        .get();
      const numTraded = syndicateQuery.size;
      let referralFees = 0;
      syndicateQuery.forEach((s) => {
        referralFees += s.data().feeEarned || 50;
      });`;

const replacementRevenue = `      const syndicateQuery = await db
        .collection("syndicate_ledger")
        .where("sourceDomain", "==", domain)
        .where("timestamp", ">=", oneWeekAgo.toISOString())
        .get();
      const numTraded = syndicateQuery.size;
      let referralFees = 0;
      syndicateQuery.forEach((s) => {
        referralFees += s.data().feeEarned || 50;
      });
      globalTrades += numTraded;
      globalRevenue += revenue;`;

code = code.replace(targetRevenue, replacementRevenue);

const targetCronEnd = `      console.log(\`✅ [CRON] Sent Weekly Value Receipt to \${client.email}\`);
    }`;
const replacementCronEnd = `      console.log(\`✅ [CRON] Sent Weekly Value Receipt to \${client.email}\`);
    }

    // Update the single global document for the Admin Dashboard
    await db.collection("_metadata").doc("platform_stats").set({
      weeklyTrades: globalTrades,
      weeklyRevenue: globalRevenue,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
`;

code = code.replace(targetCronEnd, replacementCronEnd);

fs.writeFileSync('server.ts', code);
