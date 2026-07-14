const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `const voiceRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  message: {
    error: "Too many voice interactions from this IP, please try again later.",
  },
});`;

const replacement = `const voiceIpMap = new Map<string, { count: number; timestamp: number }>();
const voiceRateLimiter = (req: any, res: any, next: any) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  
  const record = voiceIpMap.get(ip as string);
  if (!record) {
    voiceIpMap.set(ip as string, { count: 1, timestamp: now });
    return next();
  }
  
  if (now - record.timestamp > windowMs) {
    voiceIpMap.set(ip as string, { count: 1, timestamp: now });
    return next();
  }
  
  if (record.count >= 10) {
    return res.status(429).json({ error: "Too many voice interactions from this IP, please try again later." });
  }
  
  record.count += 1;
  voiceIpMap.set(ip as string, record);
  return next();
};`;

code = code.replace(target, replacement);

fs.writeFileSync('server.ts', code);
