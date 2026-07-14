const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `      let aiSpeechText = "";
      try {
        const result = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            { role: "system", parts: [{ text: systemPrompt }] },
            { role: "user", parts: [{ text: transcript }] },
          ],
          config: {
            maxOutputTokens: 30, // Force brevity to ensure low TTS latency
            temperature: 0.2,
          },
        });
        aiSpeechText =
          result.text ||
          "I'm having trouble connecting to the network. Please call back.";
      } catch (aiErr) {
        console.warn("AI generation failed for voice:", aiErr.message);
        aiSpeechText =
          "I'm currently offline for maintenance. Please leave a message.";
      }`;

const replacement = `      let aiSpeechText = "";
      if (zeroPartnersFound) {
        aiSpeechText = "We are currently fully booked and our partner network in your area is at capacity. However, I have placed you at the top of our priority waitlist. Our manager will text you the second a slot opens.";
      } else {
        try {
          const result = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
              { role: "system", parts: [{ text: systemPrompt }] },
              { role: "user", parts: [{ text: transcript }] },
            ],
            config: {
              maxOutputTokens: 30, // Force brevity to ensure low TTS latency
              temperature: 0.2,
            },
          });
          aiSpeechText =
            result.text ||
            "I'm having trouble connecting to the network. Please call back.";
        } catch (aiErr) {
          console.warn("AI generation failed for voice:", aiErr.message);
          aiSpeechText =
            "I'm currently offline for maintenance. Please leave a message.";
        }
      }`;

code = code.replace(target, replacement);

fs.writeFileSync('server.ts', code);
