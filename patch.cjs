const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const syndicateCode = `
// ============================================================================
// SCI-FI ARCHITECTURE 2: THE AUTONOMOUS B2B LEAD SYNDICATE (SWARM AI)
// ============================================================================
app.post("/api/syndicate/negotiate", requireRole(["gateway", "unified"]), async (req, res) => {
  try {
    const { sourceDomain, leadData, zipCode } = req.body;
    if (!sourceDomain || !zipCode) {
      return res.status(400).json({ error: "Missing sourceDomain or zipCode" });
    }

    // 1. Find a competitor in the same zip code who has capacity (syndicateEnabled = true)
    const clientsSnap = await db.collection("clients")
      .where("city", "==", zipCode) // Assuming city is used as area/zip
      .where("syndicateEnabled", "==", true)
      .get();
      
    const competitors = clientsSnap.docs
      .filter(doc => doc.id !== sourceDomain)
      .map(doc => ({ id: doc.id, ...doc.data() }));

    if (competitors.length === 0) {
      return res.status(404).json({ error: "No available competitors in the syndicate for this region." });
    }

    const targetCompetitor = competitors[0]; // Pick the first available

    // 2. Swarm AI Negotiation (Machine-to-Machine)
    // We use Gemini to simulate the millisecond negotiation between the two autonomous agents
    const aiNegotiationPrompt = \`
      You are an autonomous negotiation engine facilitating a lead transfer between two AI business agents.
      Agent A (\${sourceDomain}) is over capacity and has an emergency lead.
      Agent B (\${targetCompetitor.id}) has open capacity.
      They are negotiating a referral fee percentage (standard is 10-20%).
      The platform skims a 5% transaction fee.
      Output a JSON object with:
      - agreedReferralFeePercentage: number
      - platformFeePercentage: 5
      - agentAMessage: string
      - agentBMessage: string
      - status: "DEAL_STRUCK"
    \`;

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: aiNegotiationPrompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const negotiationResult = JSON.parse(result.text || "{}");

    // 3. Execute the Trade & Log it to the Syndicate Ledger
    const tradeId = \`trd_\${Date.now()}\`;
    await db.collection("syndicate_ledger").doc(tradeId).set({
      timestamp: new Date().toISOString(),
      sourceAgent: sourceDomain,
      targetAgent: targetCompetitor.id,
      leadData,
      financials: negotiationResult
    });

    return res.status(200).json({
      success: true,
      tradeId,
      targetAgent: targetCompetitor.id,
      negotiation: negotiationResult
    });
  } catch (err: any) {
    console.error("❌ [SWARM AI FAIL]", err.message);
    res.status(500).json({ error: "Syndicate negotiation failed." });
  }
});

`;

content = content.replace('// 3.4. Autonomous Voice Receptionist Webhook', syndicateCode + '\// 3.4. Autonomous Voice Receptionist Webhook');
fs.writeFileSync('server.ts', content);
console.log("Patched server.ts with /api/syndicate/negotiate");
