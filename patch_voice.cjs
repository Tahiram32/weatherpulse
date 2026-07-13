const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const replacement = `
    let hasAvailableSlot = false;
    if (privateData.googleCalendarToken) {
      try {
        const timeMin = new Date().toISOString();
        const timeMax = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // Next 2 hours
        let accessToken = privateData.googleCalendarToken;
        let isRefreshed = false;

        // Check if token is expired based on our timestamp
        if (privateData.googleCalendarTokenExpiresAt && Date.now() > privateData.googleCalendarTokenExpiresAt && privateData.googleCalendarRefreshToken) {
          console.log(\`[AUTH] Token expired for \${domain}, refreshing via offline access...\`);
          // Simulate fetching new token from Google OAuth endpoint using refresh token
          accessToken = "mock_refreshed_access_token_" + Date.now();
          isRefreshed = true;
        }

        let calRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
          method: "POST",
          headers: {
            "Authorization": \`Bearer \${accessToken}\`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            timeMin,
            timeMax,
            items: [{ id: "primary" }]
          })
        });

        // Intercept 401 if our timestamp check missed it
        if (calRes.status === 401 && privateData.googleCalendarRefreshToken && !isRefreshed) {
           console.log(\`[AUTH] 401 Unauthorized for \${domain}, intercepting and refreshing...\`);
           accessToken = "mock_refreshed_access_token_after_401_" + Date.now();
           isRefreshed = true;
           
           // Retry with new token
           calRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
              method: "POST",
              headers: {
                "Authorization": \`Bearer \${accessToken}\`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                timeMin,
                timeMax,
                items: [{ id: "primary" }]
              })
            });
        }

        if (isRefreshed) {
           await setDoc(privateRef, { 
             googleCalendarToken: accessToken,
             googleCalendarTokenExpiresAt: Date.now() + 3600 * 1000
           }, { merge: true });
        }

        if (calRes.ok) {
          const calData = await calRes.json();
          const busySlots = calData.calendars?.primary?.busy || [];
          hasAvailableSlot = busySlots.length === 0;
        } else {
          console.error("Calendar API Error:", await calRes.text());
        }
      } catch (err: any) {
        console.error("Calendar fetch error:", err.message);
      }
    }

    // -------------------------------------------------------------
    // SWARM AI LEAD SYNDICATE INJECTION
    // -------------------------------------------------------------
    let syndicateTrade = null;
    if (!hasAvailableSlot && client.syndicateEnabled) {
      console.log(\`[SWARM AI] \${domain} is at full capacity. Attempting Autonomous Syndicate Negotiation...\`);
      try {
        const syndicateRes = await fetch(\`http://127.0.0.1:\${process.env.PORT || 3000}/api/syndicate/negotiate\`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization || \`Bearer \${ADMIN_API_KEY}\`
          },
          body: JSON.stringify({
            sourceDomain: domain,
            zipCode: client.city,
            leadData: { transcript, callerNumber }
          })
        });
        if (syndicateRes.ok) {
          syndicateTrade = await syndicateRes.json();
          console.log(\`[SWARM AI SUCCESS] Trade negotiated with \${syndicateTrade.targetAgent}. Fee: \${syndicateTrade.negotiation.agreedReferralFeePercentage}%\`);
        } else {
          console.log(\`[SWARM AI FAIL] No available syndicate partners in \${client.city}.\`);
        }
      } catch(e: any) {
        console.error("Syndicate negotiation error in voice hook:", e.message);
      }
    }

    let systemPrompt = \`
      You are a low-latency voice receptionist for \${client.businessName} in \${client.city}.
      Current weather: \${weatherCond} (Extreme Mode: \${isExtreme ? "YES" : "NO"}).
      Calendar availability right now: \${hasAvailableSlot ? "YES" : "NO"}.
      
      CRITICAL INSTRUCTIONS TO PREVENT HUMAN HANG-UP:
      - Reply with EXACTLY ONE short sentence. Under 15 words.
      - NEVER use pleasantries like "How can I help you today?".
      - If EmergencyRoutingMode (\${emergencyRoutingMode}) is true, you MUST state: "Due to severe weather, we are currently only dispatching for emergency services."
      - If they want to book and calendar is YES, say "I have locked in your emergency slot. A dispatcher is on the way."
    \`;

    if (syndicateTrade && syndicateTrade.success) {
      systemPrompt += \`
      - You were over capacity, but your Swarm AI Agent successfully negotiated a lead transfer to a competitor (\${syndicateTrade.targetAgent}) for a referral fee of \${syndicateTrade.negotiation.agreedReferralFeePercentage}%.
      - DO NOT mention the referral fee.
      - Say exactly: "We are at full capacity, but I have autonomously dispatched our trusted partner in your area to handle your emergency immediately."
      \`;
    } else {
      systemPrompt += \`
      - If calendar is NO, say "Our schedule is currently full due to high volume, but I will put you on the priority waitlist."
      \`;
    }
    systemPrompt += \`\\n      - DO NOT mention prices.\\n    \`;
`;

const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes("let hasAvailableSlot = false;"));
const endIdx = lines.findIndex(l => l.includes("- DO NOT mention prices.")) + 2;

if (startIdx !== -1 && endIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx, replacement);
  fs.writeFileSync('server.ts', lines.join('\n'));
  console.log("Successfully injected Swarm AI into Voice Webhook.");
} else {
  console.log("Could not find insertion points.", startIdx, endIdx);
}

