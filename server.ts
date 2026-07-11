/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { executeMeteorologicalSync, executeSingleClientSyncTask } from "./meteorological-sync-engine";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure path is resilient across development (tsx server.ts) and production (dist/server.cjs)
const rootDir = __dirname.endsWith("dist") ? path.join(__dirname, "..") : __dirname;

// Read Firebase config from the auto-provisioned configuration file safely
let firebaseConfig: any = {};
try {
  const firebaseConfigPath = path.join(rootDir, "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  }
} catch (configErr: any) {
  console.error("⚠️ [SECURITY] Failed to read firebase-applet-config.json:", configErr.message);
}

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const firebaseDatabaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "(default)";

// Initialize Firebase Admin SDK with robust validation, prioritizing cloud-native ADC in production
const isProduction = (process.env.NODE_ENV === "production" || !!process.env.K_SERVICE || !!process.env.K_REVISION) && !process.env.APPLET_ID;
let adminApp;

if (isProduction) {
  // Rely on ambient Application Default Credentials (ADC) without looking at environment JSON variables in production
  adminApp = getApps().length === 0 ? initializeApp({
    projectId: firebaseProjectId
  }) : getApp();
} else {
  // Only attempt service account credential parsing and repair in development mode
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey && serviceAccountKey.trim() !== "") {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      
      // Strict schema validation to prevent synchronous boot crashing on malformed or missing fields in dev
      if (!serviceAccount || typeof serviceAccount !== "object") {
        throw new Error("Credentials must be a valid JSON object.");
      }
      if (!serviceAccount.private_key || typeof serviceAccount.private_key !== "string") {
        throw new Error("Missing or invalid 'private_key' field in service account credentials.");
      }
      if (!serviceAccount.client_email || typeof serviceAccount.client_email !== "string") {
        throw new Error("Missing or invalid 'client_email' field in service account credentials.");
      }

      // Repair escaped PEM formatting safely and resiliently
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

      adminApp = getApps().length === 0 ? initializeApp({
        credential: cert(serviceAccount),
        projectId: firebaseProjectId
      }) : getApp();
    } catch (err: any) {
      console.error(`⚠️ [SECURITY] Failed to initialize Firebase Admin with development credentials: ${err.message}`);
      // Fallback to ADC in development
      adminApp = getApps().length === 0 ? initializeApp({
        projectId: firebaseProjectId
      }) : getApp();
    }
  } else {
    // If no key is configured in development, use default ambient configuration
    adminApp = getApps().length === 0 ? initializeApp({
      projectId: firebaseProjectId
    }) : getApp();
  }
}

const db = getFirestore(adminApp, firebaseDatabaseId);

// Custom, lightweight, fully-compatible modular Firestore-like wrapper over admin-side Firestore SDK to preserve all existing call-sites perfectly
export function doc(database: any, collectionPath: string, docId: string) {
  return db.collection(collectionPath).doc(docId);
}

export function collection(database: any, collectionPath: string) {
  return db.collection(collectionPath);
}

export async function getDoc(docRef: any) {
  const snap = await docRef.get();
  return {
    exists: () => snap.exists,
    data: () => snap.data() as any
  };
}

export async function getDocs(collectionRef: any) {
  const snap = await collectionRef.get();
  return {
    empty: snap.empty,
    docs: snap.docs.map((d: any) => ({
      id: d.id,
      data: () => d.data() as any
    }))
  };
}

export async function setDoc(docRef: any, data: any, options?: any) {
  if (options && options.merge) {
    return await docRef.set(data, { merge: true });
  }
  return await docRef.set(data);
}

export async function deleteDoc(docRef: any) {
  return await docRef.delete();
}

// Initialize Gemini SDK
const apiKey = process.env.GEMINI_API_KEY || "";
const hasRealApiKey = apiKey && apiKey !== "MY_GEMINI_API_KEY";

const ai = new GoogleGenAI({
  apiKey: hasRealApiKey ? apiKey : "dummy-key",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const app = express();
app.use(express.json());

// Helper function to render a high-fidelity client's weather-responsive site
function renderClientSite(client: any, req: any, res: any) {
  // Set secure HTTP headers (allowing framing inside AI Studio)
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");

  const copy = client.lastWeatherCopy || {
    heroTitle: `Professional HVAC Repair & Install | ${client.businessName}`,
    heroSubtitle: `Your trusted local comfort experts in ${client.city}. Call us today at ${client.phone} for professional service.`,
    alertBanner: "",
    seoHeading: `Premium Heating & Cooling Services in ${client.city}`,
    seoArticle: `Welcome to ${client.businessName}. We provide high-quality furnace, air conditioning, and heat pump repair, maintenance, and installations for residential and commercial customers throughout ${client.city} and the surrounding area. Contact us today.`,
    promotions: ["$20 Off First Service Call", "Free Estimates on System Replacements"],
    cacheTags: ["homepage", "fallback"]
  };

  const isAlertActive = copy.alertBanner && copy.alertBanner.trim().length > 0;

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${client.businessName} - HVAC Solutions in ${client.city}</title>
  <meta name="description" content="${copy.heroTitle}">
  
  <!-- Precompiled Critical CSS to achieve perfect Core Web Vitals (Instant FCP & ZERO CLS) -->
  <style>
    /* Reset & Base Styles */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { line-height: 1.5; -webkit-text-size-adjust: 100%; -moz-tab-size: 4; tab-size: 4; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; display: flex; flex-direction: column; min-height: 100vh; }
    
    /* Layout Containers */
    .max-w-7xl { max-width: 80rem; }
    .max-w-5xl { max-width: 64rem; }
    .max-w-4xl { max-width: 56rem; }
    .max-w-3xl { max-width: 48rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
    .py-16 { padding-top: 4rem; padding-bottom: 4rem; }
    .py-24 { padding-top: 6rem; padding-bottom: 6rem; }
    
    /* Structural Elements */
    .sticky { position: -webkit-sticky; position: sticky; }
    .top-0 { top: 0; }
    .z-50 { z-index: 50; }
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    
    /* Responsive grids */
    @media (min-width: 640px) {
      .sm\\:flex-row { flex-direction: row; }
      .sm\\:py-24 { padding-top: 6rem; padding-bottom: 6rem; }
    }
    @media (min-width: 768px) {
      .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .md\\:flex-row { flex-direction: row; }
    }
    
    /* Backgrounds & Borders */
    .bg-white { background-color: #ffffff; }
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-slate-900 { background-color: #0f172a; }
    .bg-emerald-600 { background-color: #059669; }
    .bg-emerald-500 { background-color: #10b981; }
    .bg-red-600 { background-color: #dc2626; }
    .border-b { border-bottom: 1px solid #e2e8f0; }
    .border-slate-200 { border-color: #e2e8f0; }
    
    /* Typography & Coloring */
    .text-white { color: #ffffff; }
    .text-slate-900 { color: #0f172a; }
    .text-slate-500 { color: #64748b; }
    .text-slate-400 { color: #94a3b8; }
    .text-slate-300 { color: #cbd5e1; }
    .text-emerald-400 { color: #34d399; }
    .text-emerald-600 { color: #059669; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .font-extrabold { font-weight: 800; }
    .font-black { font-weight: 900; }
    .font-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace; }
    .text-xs { font-size: 0.75rem; }
    .text-sm { font-size: 0.875rem; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-3xl { font-size: 1.875rem; }
    .text-5xl { font-size: 3rem; }
    .tracking-wide { letter-spacing: 0.025em; }
    .tracking-tight { letter-spacing: -0.025em; }
    .uppercase { text-transform: uppercase; }
    .text-center { text-align: center; }
    
    /* Custom Components & Effects */
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
    .rounded { border-radius: 0.25rem; }
    .rounded-full { border-radius: 9999px; }
    .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .hover\\:bg-emerald-700:hover { background-color: #047857; }
    .hover\\:bg-emerald-600:hover { background-color: #059669; }
    .hover\\:bg-slate-800:hover { background-color: #1e293b; }
    .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
    
    /* Inline SVGs & utilities */
    .w-4 { width: 1rem; } .h-4 { height: 1rem; }
    .w-6 { width: 1.5rem; } .h-6 { height: 1.5rem; }
    .inline-flex { display: inline-flex; align-items: center; justify-content: center; }
  </style>
  
  <!-- Progressive Enhancement: Load Tailwind CSS CDN in the background to handle responsive utility variants -->
  <script src="https://unpkg.com/@tailwindcss/browser@4" defer></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
</head>
<body class="bg-[#f8fafc] text-[#0f172a] flex flex-col min-h-screen">
  <!-- Dynamic Alert Banner -->
  ${isAlertActive ? `
  <div class="bg-red-600 text-white py-3 px-4 text-center font-semibold text-sm tracking-wide shadow-md animate-pulse">
    <div class="max-w-7xl mx-auto flex items-center justify-center gap-2">
      <span class="bg-white text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">CRITICAL</span>
      <span>${copy.alertBanner}</span>
    </div>
  </div>
  ` : ''}

  <!-- Header / Navigation -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
    <div class="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
      <div class="flex items-center gap-3">
        <div class="bg-slate-900 text-emerald-400 p-2 font-mono font-bold text-lg rounded shadow">
          ❆
        </div>
        <div>
          <h1 class="text-lg font-extrabold text-slate-900 tracking-tight leading-none">${client.businessName}</h1>
          <span class="text-xs text-slate-500 font-mono uppercase tracking-wider">${client.city} • LICENSED HVAC</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <a href="tel:${client.phone.replace(/\D/g, '')}" class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded shadow-lg transition-all text-sm uppercase tracking-wide">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
          </svg>
          CALL ${client.phone}
        </a>
      </div>
    </div>
  </header>

  <!-- Hero Section with Weather Accent -->
  <section class="relative py-16 sm:py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent)]"></div>
    <div class="max-w-5xl mx-auto px-6 relative text-center">
      <div class="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1 border border-emerald-500/20 rounded-full text-xs font-mono mb-6 uppercase tracking-wider">
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        Weather-Optimized Active Campaign
      </div>
      <h2 class="text-3xl sm:text-5xl font-black text-slate-100 tracking-tight max-w-4xl mx-auto leading-tight mb-6">
        ${copy.heroTitle}
      </h2>
      <p class="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
        ${copy.heroSubtitle}
      </p>
      <div class="flex flex-wrap gap-4 justify-center">
        <a href="tel:${client.phone.replace(/\D/g, '')}" class="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold py-3.5 px-8 text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 transition-all rounded">
          Instant Comfort Dispatch
        </a>
        <a href="#seo-info" class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold py-3.5 px-8 text-sm uppercase tracking-wider transition-all rounded">
          Local Maintenance Guide
        </a>
      </div>
    </div>
  </section>

  <!-- Dynamic Service Promotions -->
  <section class="py-12 bg-white border-b border-slate-200">
    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center mb-8">
        <span class="text-xs font-bold text-emerald-600 uppercase tracking-widest font-mono">SEASONAL SPECIALS</span>
        <h3 class="text-2xl font-extrabold text-slate-900 mt-1">Direct-to-Consumer Savings Programs</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        ${copy.promotions.map((promo: string) => `
        <div class="bg-slate-50 border border-slate-200/80 p-6 rounded relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
          <div class="absolute top-0 right-0 bg-emerald-500 text-slate-950 font-mono font-black text-[9px] px-3 py-1 rounded-bl uppercase" style="position: absolute; top: 0; right: 0;">
            ACTIVE
          </div>
          <div class="mt-2">
            <span class="text-slate-400 text-[10px] font-mono tracking-wider block mb-1">PROMOTION CODE: COMFORT-${client.city.toUpperCase()}</span>
            <p class="text-lg font-bold text-slate-800 leading-tight">${promo}</p>
          </div>
          <div class="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs" style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
            <span class="text-slate-500">Expires soon</span>
            <a href="tel:${client.phone.replace(/\D/g, '')}" class="text-emerald-600 hover:text-emerald-700 font-bold uppercase tracking-wider">CLAIM OFFER &rarr;</a>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- SEO / Hydrated Article Section -->
  <section id="seo-info" class="py-16 bg-slate-50">
    <div class="max-w-4xl mx-auto px-6">
      <div class="bg-white border border-slate-200 p-8 sm:p-12 shadow-sm rounded">
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #f1f5f9;">
          <div class="bg-emerald-500/10 text-emerald-600 p-2.5 rounded-full" style="padding: 0.625rem; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.1);">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 1.5rem; height: 1.5rem;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono" style="display: block; font-size: 0.75rem; color: #94a3b8; text-transform: uppercase;">EDUCATIONAL BRIEFING</span>
            <h4 class="text-lg sm:text-xl font-bold text-slate-900 mt-0.5" style="margin-top: 0.125rem; font-size: 1.125rem; color: #0f172a;">${copy.seoHeading}</h4>
          </div>
        </div>
        <p class="text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line font-medium mb-6" style="margin-bottom: 1.5rem; line-height: 1.625; color: #475569;">
          ${copy.seoArticle}
        </p>
        <div class="bg-slate-50 p-4 border border-slate-200/60 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs" style="background-color: #f8fafc; border: 1px solid rgba(226, 232, 240, 0.6); padding: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
          <div>
            <span class="font-bold text-slate-700" style="font-weight: 700; color: #334155;">Need Immediate Assistance?</span>
            <p class="text-slate-500 mt-0.5" style="color: #64748b; margin-top: 0.125rem;">Our diagnostic dispatchers are online. Save on repair fees when scheduling now.</p>
          </div>
          <a href="tel:${client.phone.replace(/\D/g, '')}" class="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-none uppercase tracking-wide text-[11px] whitespace-nowrap shadow" style="background-color: #0f172a; color: #ffffff; font-weight: 700; padding: 0.5rem 1rem; text-transform: uppercase; font-size: 11px; text-decoration: none; display: inline-block;">
            BOOK REPAIR ONLINE
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-slate-900 text-slate-400 py-12 mt-auto border-t border-slate-800">
    <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6" style="display: flex; justify-content: space-between; align-items: center; gap: 1.5rem;">
      <div class="text-center md:text-left">
        <p class="text-white text-sm font-bold tracking-wide" style="color: #ffffff; font-size: 0.875rem; font-weight: 700;">${client.businessName}</p>
        <p class="text-xs text-slate-500 mt-1" style="color: #64748b; font-size: 0.75rem; margin-top: 0.25rem;">&copy; ${new Date().getFullYear()} All rights reserved. Managed autonomously by Living Website AI Systems.</p>
      </div>
      <div class="text-center md:text-right font-mono text-[10px] text-slate-500 flex flex-col items-center md:items-end gap-1" style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; font-family: monospace; font-size: 10px; color: #64748b;">
        <span>STATUS: SERVER_HYDRATED (SSR)</span>
        <span>LAST_MUTATION: ${new Date(client.lastUpdated).toLocaleString()}</span>
        <span>CACHE_TAGS: [${copy.cacheTags.join(', ')}]</span>
      </div>
    </div>
  </footer>
</body>
</html>
  `);
}

// 1. Clickjacking Mitigation and Custom Domain Host-Header Routing Middlewares
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(async (req, res, next) => {
  let host = req.headers.host ? req.headers.host.split(":")[0].toLowerCase().trim() : "";
  
  // Support testing custom domain host re-routing locally or inside AI Studio using query params or headers
  const overrideHost = req.query.host || req.headers["x-override-host"];
  if (overrideHost) {
    host = String(overrideHost).toLowerCase().trim();
  }

  const adminHosts = ["localhost", "127.0.0.1", "0.0.0.0", "3000", "3001"];
  const isConsoleHost = adminHosts.some(h => host === h) || 
                        host.includes("run.app") || 
                        host.includes("github.dev") || 
                        host.includes("aistudio");

  const isSystemPath = req.path.startsWith("/api") || 
                       req.path.startsWith("/assets") || 
                       req.path.startsWith("/site") || 
                       req.path.startsWith("/@vite") || 
                       req.path.startsWith("/node_modules") || 
                       req.path.startsWith("/src");

  if (!isConsoleHost && host && !isSystemPath && req.path === "/") {
    try {
      const docRef = doc(db, "clients", host);
      const clientDoc = await getDoc(docRef);
      if (clientDoc.exists()) {
        return renderClientSite(clientDoc.data(), req, res);
      }
    } catch (err) {
      console.error("Custom domain routing error:", err);
    }
  }
  next();
});

const PORT = 3000;

// Healthcheck: High-performance lightweight probe for container orchestrator
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Express APIs

// 0. Get API and API Key status info
app.get("/api/status", (req, res) => {
  res.json({ hasRealApiKey });
});

// 1. Get all HVAC tenants from Firestore
app.get("/api/clients", async (req, res) => {
  try {
    const clientsCol = collection(db, "clients");
    const snapshot = await getDocs(clientsCol);
    const clients = snapshot.docs.map(doc => doc.data());
    res.json(clients);
  } catch (error) {
    console.error("Error fetching clients from Firestore:", error);
    res.status(500).json({ error: "Failed to read clients database from Firestore." });
  }
});

// 2. Add / Update tenant in Firestore
app.post("/api/clients", async (req, res) => {
  try {
    const newClient = req.body;

    if (!newClient.domain || !newClient.businessName || !newClient.city || !newClient.phone) {
      return res.status(400).json({ error: "Missing required fields (domain, businessName, city, phone)" });
    }

    const domain = newClient.domain.toLowerCase().trim();
    const docRef = doc(db, "clients", domain);
    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : null;

    const clientData = {
      domain,
      businessName: newClient.businessName.trim(),
      city: newClient.city.trim(),
      phone: newClient.phone.trim(),
      isrUrl: newClient.isrUrl ? newClient.isrUrl.trim() : `https://${domain}/api/revalidate`,
      isrSecret: newClient.isrSecret ? newClient.isrSecret.trim() : "sec_default_secret",
      lastUpdated: new Date().toISOString(),
      lastWeatherCopy: existingData ? (existingData.lastWeatherCopy || null) : null,
    };

    await setDoc(docRef, clientData, { merge: true });
    res.json({ message: "Client saved successfully", client: clientData });
  } catch (error) {
    console.error("Error saving client to Firestore:", error);
    res.status(500).json({ error: "Failed to write to database." });
  }
});

// 3. Delete tenant from Firestore
app.delete("/api/clients/:domain", async (req, res) => {
  try {
    const domain = req.params.domain.toLowerCase().trim();
    const docRef = doc(db, "clients", domain);
    const existingDoc = await getDoc(docRef);

    if (!existingDoc.exists()) {
      return res.status(404).json({ error: "Client not found." });
    }

    await deleteDoc(docRef);
    res.json({ message: "Client deleted successfully" });
  } catch (error) {
    console.error("Error deleting client from Firestore:", error);
    res.status(500).json({ error: "Failed to edit database." });
  }
});

// 3.5. Trigger the Autonomous Meteorological Sync Engine (Cloud Scheduler CRON Entrypoint)
app.post("/api/pipeline/sync-weather", async (req, res) => {
  try {
    const { async = true, queueMode = "distributed" } = req.body || {};
    
    if (async) {
      // Background / Distributed execution
      executeMeteorologicalSync({ queueMode }).catch((err) => {
        console.error("❌ [CRON] Background Meteorological Sync crashed:", err.message);
      });
      return res.status(202).json({
        message: `Meteorological Sync Engine triggered successfully in autonomous ${queueMode} background mode.`,
        queueMode,
        timestamp: new Date().toISOString()
      });
    } else {
      // Synchronous execution (useful for manual debugging & testing)
      const result = await executeMeteorologicalSync({ queueMode });
      return res.status(200).json({
        message: `Meteorological Sync Engine successfully completed in ${queueMode} mode.`,
        result,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error("❌ [CRON] Failed to trigger Meteorological Sync:", error.message);
    res.status(500).json({ error: "Failed to trigger weather sync", details: error.message });
  }
});

// 3.6. Secure Task Worker Endpoint for Distributed Google Cloud Tasks / Simulated Workers
app.post("/api/pipeline/task-worker", async (req, res) => {
  try {
    const { domain, weather, runLogRefId } = req.body || {};
    
    // Strict authorization guard to safeguard origin against unauthenticated write attempts
    const authorization = req.headers.authorization;
    const expectedSecret = process.env.TASK_WORKER_SECRET || "sec_default_task_secret";
    
    if (!authorization || authorization !== `Bearer ${expectedSecret}`) {
      console.warn(`🚨 [SECURITY] Unauthorized attempt to invoke Task Worker for domain '${domain || "unknown"}'`);
      return res.status(401).json({ error: "Unauthorized. Invalid secure worker token." });
    }

    if (!domain || !weather) {
      return res.status(400).json({ error: "Bad Request. Payload must define 'domain' and 'weather' context." });
    }

    console.log(`🔌 [TASK-WORKER] Launching isolated mutation worker for tenant: ${domain}`);
    const result = await executeSingleClientSyncTask(domain, weather, runLogRefId);
    
    return res.status(200).json({
      status: "success",
      domain,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error(`❌ [TASK-WORKER-FAIL] Background worker failed for tenant '${req.body?.domain}':`, err.message);
    return res.status(500).json({
      status: "failed",
      error: err.message
    });
  }
});

// 4. Trigger the Autonomous Pipeline for a City
app.post("/api/pipeline", async (req, res) => {
  const { city, delayMs = 1500 } = req.body;

  if (!city) {
    return res.status(400).json({ error: "City parameter is required." });
  }

  const runId = `run_${Date.now()}`;
  const clientsCol = collection(db, "clients");
  const clientsSnapshot = await getDocs(clientsCol);
  const clients = clientsSnapshot.docs.map(doc => doc.data());
  
  // Find matching clients
  const matchingClients = clients.filter(
    (c: any) => c.city.toLowerCase() === city.toLowerCase()
  );

  const newRun: {
    id: string;
    status: string;
    city: string;
    startedAt: string;
    completedAt?: string;
    totalClients: number;
    processedClients: number;
    successfulClients: number;
    failedClients: number;
    logs: any[];
  } = {
    id: runId,
    status: "running",
    city: city.charAt(0).toUpperCase() + city.slice(1),
    startedAt: new Date().toISOString(),
    totalClients: matchingClients.length,
    processedClients: 0,
    successfulClients: 0,
    failedClients: 0,
    logs: [],
  };

  const runRef = doc(db, "runs", runId);
  await setDoc(runRef, newRun);

  const addLog = async (level: "info" | "warn" | "error" | "success", message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    newRun.logs.push({ timestamp, level, message } as any);
    console.log(`[PIPELINE - ${runId}] ${message}`);
    try {
      await setDoc(runRef, newRun);
    } catch (err) {
      console.error("Error writing run logs to Firestore:", err);
    }
  };

  // Return immediately to avoid blocking client
  res.json({ runId, message: "Pipeline started sequentially in background." });

  // Background Process
  (async () => {
    await addLog("info", `Starting Webmaster Autonomous Weather-Pipeline for city: ${city}`);
    await addLog("info", `Identified ${matchingClients.length} registered multi-tenant domain(s) in Firestore.`);

    if (matchingClients.length === 0) {
      await addLog("warn", `No active tenants located in city: ${city}. Halting pipeline execution safely.`);
      newRun.status = "completed";
      newRun.completedAt = new Date().toISOString();
      await setDoc(runRef, newRun);
      return;
    }

    // Geocoding and Weather fetching from Open-Meteo
    let weatherData: any = null;
    try {
      await addLog("info", `Contacting Open-Meteo Geocoding services for: ${city}...`);
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`Could not geocode city name: '${city}'`);
      }

      const { latitude, longitude, name: canonicalCity } = geoData.results[0];
      await addLog("success", `Resolved geocode coordinates: ${canonicalCity} (Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)})`);

      await addLog("info", `Querying real-time atmospheric readings from Open-Meteo...`);
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&temperature_unit=fahrenheit`;
      const weatherRes = await fetch(weatherUrl);
      const rawWeather = await weatherRes.json();

      if (!rawWeather.current) {
        throw new Error("Invalid weather data envelope received from Open-Meteo.");
      }

      const temp = rawWeather.current.temperature_2m;
      const humidity = rawWeather.current.relative_humidity_2m;
      const code = rawWeather.current.weather_code;

      // Simple mapping of codes
      let condition = "Moderate Clear";
      if (code === 0) condition = "Sunny/Clear";
      else if ([1, 2, 3].includes(code)) condition = "Partly Cloudy";
      else if ([45, 48].includes(code)) condition = "Foggy";
      else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) condition = "Rainy/Wet";
      else if ([71, 73, 75, 77, 85, 86].includes(code)) condition = "Snowy/Freezing";
      else if ([95, 96, 99].includes(code)) condition = "Severe Thunderstorms";

      weatherData = {
        temp,
        condition,
        humidity,
        isExtreme: temp >= 95 || temp <= 32 || code >= 95,
      };

      await addLog(
        "success",
        `Retrieved live atmospheric data: Temp ${temp}°F | Humidity ${humidity}% | Condition: ${condition} (Extreme: ${weatherData.isExtreme ? "YES" : "NO"})`
      );
    } catch (err: any) {
      await addLog("error", `Atmospheric sync failed: ${err.message || err}. Falling back to default baseline metrics (Dallas heatwave proxy).`);
      weatherData = {
        temp: 101.5,
        condition: "Intense Heat Dome",
        humidity: 62,
        isExtreme: true,
      };
    }

    // Process clients SEQUENTIALLY to respect API limits and rates
    for (let i = 0; i < matchingClients.length; i++) {
      const client = matchingClients[i];
      await addLog("info", `[Queue ${i + 1}/${matchingClients.length}] Initiating sequence task for domain: '${client.domain}'...`);

      // 1. Throttle / sequential queue delay
      if (i > 0) {
        await addLog("info", `Delaying ${delayMs}ms to maintain rate-limiting threshold...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      // 2. Call Gemini (or Template Sandbox if no key)
      let generatedCopy = null;
      try {
        if (hasRealApiKey) {
          await addLog("info", `Invoking Gemini-3.5-Flash with native JSON responseSchema enforcement...`);

          const prompt = `
            You are "The Living Website" Autonomous AI Webmaster. Your task is to update the homepage contents for an HVAC business named "${client.businessName}" located in ${client.city} dynamically based on the current weather.
            
            Current Weather in ${client.city}:
            - Temperature: ${weatherData.temp}°F
            - Condition: ${weatherData.condition}
            - Relative Humidity: ${weatherData.humidity}%
            - Extreme Weather Status: ${weatherData.isExtreme ? "YES (Active Extreme Thermal Warning)" : "NO"}
            
            Company Phone Number: ${client.phone}
            
            Create highly specific, professional, and seasonally optimized copywriting. If the weather is extreme (heatwave or deep freeze), trigger urgent safety advisory headlines and priority call-to-actions.
          `;

          const responseSchema = {
            type: Type.OBJECT,
            properties: {
              heroTitle: {
                type: Type.STRING,
                description: "Bold weather-adaptive main title incorporating the HVAC brand, city name, and current temperature or condition."
              },
              heroSubtitle: {
                type: Type.STRING,
                description: "Sub-headline emphasizing current comfort solutions and a clear call-to-action utilizing the company phone number."
              },
              alertBanner: {
                type: Type.STRING,
                description: "Short urgent red-banner text if weather is extreme, otherwise empty string. Max 80 chars."
              },
              seoHeading: {
                type: Type.STRING,
                description: "An SEO keyword rich subtitle or H2 tag for an educational section."
              },
              seoArticle: {
                type: Type.STRING,
                description: "A highly educational, engaging 150-word guide/notice relating current weather conditions (like humidity or intense heat/cold) to air conditioner or furnace strain and maintenance."
              },
              promotions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exactly 2 to 3 seasonal promotion/coupon items. E.g. ['$49 Emergency Service', 'Free Carbon Monoxide Audit']"
              },
              cacheTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Next.js ISR tags list. E.g. ['homepage', 'weather', 'deals']"
              }
            },
            required: ["heroTitle", "heroSubtitle", "alertBanner", "seoHeading", "seoArticle", "promotions", "cacheTags"]
          };

          const result = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: responseSchema,
              temperature: 0.7,
            },
          });

          const rawText = result.text;
          if (!rawText) throw new Error("Received empty content response from Gemini.");
          
          generatedCopy = JSON.parse(rawText.trim());
          await addLog("success", `Gemini response schema validated successfully. Token consumption complete.`);
        } else {
          // Robust Sandbox Mode Template Builder
          await addLog("warn", `Operating in local sandbox mode. Instantiating high-fidelity template generator.`);
          
          const isHot = weatherData.temp >= 85;
          const isCold = weatherData.temp <= 45;
          
          let hTitle = `${weatherData.condition} in ${client.city}: Keep Cool with ${client.businessName}!`;
          let hSub = `Beat the ${weatherData.temp}°F weather with our expert, local HVAC technicians. Calls dispatched immediately at ${client.phone}.`;
          let alertText = "";
          let sHeading = `Is Your HVAC System Configured for ${client.city}'s Weather?`;
          let sArticle = `In ${client.city}, sudden atmospheric shifts place massive stresses on ventilation compressors. Running systems with dusty air filter grids causes evaporator coils to restrict and overheat. Ensure comfort and double equipment lifespans by coordinating professional diagnostics.`;
          let promoList = [`$49 Routine Inspection`, `Free System Filter Upgrade`];
          
          if (isHot) {
            hTitle = `Scorching ${weatherData.temp}°F Heat in ${client.city}: Rapid AC Restoration!`;
            hSub = `Same-day emergency AC solutions. Keep your household safe and insulated. Speak to a live operator now at ${client.phone}.`;
            alertText = `⚠️ SEVERE HEAT ALERT: Cooling systems in ${client.city} under heavy electrical strain. Priority repair slots open.`;
            sHeading = `Avoiding AC Condensation Floods and Airflow Bottlenecks`;
            sArticle = `With temperatures peaking at ${weatherData.temp}°F, your residential cooling unit struggles to maintain indoor splits. To protect system compressors, replace standard pleated filters, keep return grilles unobstructed, and check drainage channels. ${client.businessName} provides instant 24/7 service.`;
            promoList = [`$50 Off Emergency AC Diagnostics`, `Free Condensate Line Flush with Repair`, `Same-Day Compressor Installs`];
          } else if (isCold) {
            hTitle = `Freezing ${weatherData.temp}°F Winter in ${client.city}: Immediate Furnace Relief!`;
            hSub = `24/7 emergency heating and heat-pump repair. Protect plumbing pipes. Speak to local experts at ${client.phone}.`;
            alertText = `❄️ HARD FREEZE WARNING: Sub-freezing temperatures detected. Priority heating dispatch active.`;
            sHeading = `Ensuring Furnace Combustion Safety and Consistent Heat Delivery`;
            sArticle = `When the mercury drops to ${weatherData.temp}°F, carbon monoxide risk spikes as combustion systems work continuously. Cascade blockages in vents or failing flame sensors can cause total safety shut-offs. Schedule an urgent heating system audit to prevent burst water pipes and ensure deep-winter safety.`;
            promoList = [`$49 Cold-Snap Furnace Safety Sweeps`, `Free CO Detector Audit`, `$500 Off Premium Heating Installs`];
          }

          generatedCopy = {
            heroTitle: hTitle,
            heroSubtitle: hSub,
            alertBanner: alertText,
            seoHeading: sHeading,
            seoArticle: sArticle,
            promotions: promoList,
            cacheTags: ["homepage", "weather", `city-${client.city.toLowerCase()}`],
          };
        }

        // Apply mutation to Firestore
        const clientDocRef = doc(db, "clients", client.domain);
        await setDoc(clientDocRef, {
          lastWeatherCopy: generatedCopy,
          lastUpdated: new Date().toISOString()
        }, { merge: true });

        await addLog("success", `Committed new weather copy mutations to Firestore database for docId: '${client.domain}'`);

        // 3. Trigger Next.js ISR via secure POST request wrapped in isolated try/catch block
        await addLog("info", `Initiating native Next.js ISR cache revalidation fetch...`);
        await addLog("info", `Sending POST to: ${client.isrUrl} with tags: ${JSON.stringify(generatedCopy.cacheTags)}`);

        try {
          // Identify mock sandbox domains to simulate successful ISR revalidation without network fetch failures
          const isMockDomain = ["hendersonhvac.com", "desertbreeze-cooling.com", "windycityheating.com", "cascadeclimate.com"].some(
            (mockDom) => client.domain.toLowerCase().includes(mockDom)
          );

          if (isMockDomain) {
            await addLog("info", `[SANDBOX SIMULATION] Detected mock client domain '${client.domain}'. Simulating high-fidelity Next.js ISR revalidation...`);
            await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate propagation latency
            await addLog("success", `[ISR OK] Domain '${client.domain}' revalidated successfully (Simulated): {"revalidated":true,"cache":"purged","tags":${JSON.stringify(generatedCopy.cacheTags)}}`);
            newRun.successfulClients++;
          } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second network limit

            const isrRes = await fetch(client.isrUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${client.isrSecret}`,
                "X-Revalidate-Tags": generatedCopy.cacheTags.join(","),
              },
              body: JSON.stringify({
                tags: generatedCopy.cacheTags,
                businessName: client.businessName,
                weatherCopy: generatedCopy,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!isrRes.ok) {
              throw new Error(`Client ISR endpoint returned HTTP Status ${isrRes.status} (${isrRes.statusText})`);
            }

            const isrJson = await isrRes.json().catch(() => ({}));
            await addLog("success", `[ISR OK] Domain '${client.domain}' revalidated successfully: ${JSON.stringify(isrJson)}`);
            newRun.successfulClients++;
          }
        } catch (isrErr: any) {
          // Isolated catch: A client revalidation crash never drops the entire pipeline!
          const errMsg = isrErr.name === "AbortError" 
            ? "Network request timed out after 4000ms" 
            : isrErr.message || String(isrErr);
          
          await addLog("warn", `[ISR ISOLATED WARNING] Target revalidation failed for ${client.domain}: ${errMsg}`);
          await addLog("warn", `Safely bypassed client failure. Pipeline flow maintains continuity.`);
          newRun.failedClients++;
        }

      } catch (clientErr: any) {
        await addLog("error", `[TASK CRITICAL FAIL] Uncaught failure processing tenant '${client.domain}': ${clientErr.message || clientErr}`);
        newRun.failedClients++;
      }

      newRun.processedClients++;
      await setDoc(runRef, newRun);
    }

    newRun.status = "completed";
    newRun.completedAt = new Date().toISOString();
    await setDoc(runRef, newRun);
    await addLog("success", `Autonomous Weather-Pipeline finalized. Output: ${newRun.successfulClients} success, ${newRun.failedClients} failures, ${newRun.totalClients} total.`);
  })();
});

// Endpoint for Edge Worker Fallback to bypass eventual consistency
app.get("/api/clients/resolve", async (req, res) => {
  try {
    const host = req.query.domain ? String(req.query.domain).toLowerCase().trim() : "";
    if (!host) {
      return res.status(400).json({ error: "Missing 'domain' query parameter" });
    }

    const docRef = doc(db, "clients", host);
    const clientDoc = await getDoc(docRef);

    if (!clientDoc.exists()) {
      return res.status(404).json({ error: `Domain '${host}' not found in registrar.` });
    }

    res.json(clientDoc.data());
  } catch (error: any) {
    console.error("Error resolving client domain:", error);
    res.status(500).json({ error: "Internal server error during resolution.", message: error.message });
  }
});

// 5. Query Pipeline logs from Firestore
app.get("/api/pipeline/runs", async (req, res) => {
  try {
    const runsCol = collection(db, "runs");
    const snapshot = await getDocs(runsCol);
    const runs = snapshot.docs.map(doc => doc.data());
    // Sort in-memory to avoid needing firestore composite indexes on startedAt
    runs.sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    res.json(runs);
  } catch (error) {
    console.error("Error fetching runs:", error);
    res.status(500).json({ error: "Failed to fetch runs." });
  }
});

app.get("/api/pipeline/runs/:runId", async (req, res) => {
  try {
    const runRef = doc(db, "runs", req.params.runId);
    const runDoc = await getDoc(runRef);
    if (!runDoc.exists()) {
      return res.status(404).json({ error: "Pipeline run not found." });
    }
    res.json(runDoc.data());
  } catch (error) {
    console.error("Error fetching run details:", error);
    res.status(500).json({ error: "Failed to fetch run details." });
  }
});

// 6. Dynamic Standalone Server-Side Hydrated (SSR) Webpage for Clients
app.get("/site/:domain", async (req, res) => {
  try {
    const domain = req.params.domain.toLowerCase().trim();
    const docRef = doc(db, "clients", domain);
    const clientDoc = await getDoc(docRef);

    if (!clientDoc.exists()) {
      return res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 100px;">
          <h1 style="color: #ef4444;">Tenant Not Found</h1>
          <p style="color: #64748b;">The HVAC domain "${domain}" is not registered in our database.</p>
          <a href="/" style="color: #10b981; text-decoration: none; font-weight: bold;">Go to Autonomous Webmaster Console</a>
        </div>
      `);
    }

    return renderClientSite(clientDoc.data(), req, res);
  } catch (error) {
    console.error("Error rendering standalone HVAC client page:", error);
    res.status(500).send("Fatal error compiling standalone webpage template.");
  }
});

// 7. Helper: Verify PayPal Webhook Signature using official API, replay protection, and domain sanitization
async function verifyPayPalSignature(req: any): Promise<{ verified: boolean; reason: string }> {
  const transmissionId = req.headers["paypal-transmission-id"];
  const transmissionTime = req.headers["paypal-transmission-time"];
  const transmissionSig = req.headers["paypal-transmission-sig"];
  const certUrl = req.headers["paypal-cert-url"];
  const authAlgo = req.headers["paypal-auth-algo"];

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  // 1. Structural audit: Validate presence of critical headers
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return {
      verified: false,
      reason: "Missing critical PayPal cryptographic validation headers."
    };
  }

  // 2. DNS/SSRF defense: Strict origin validation of the cert_url domain
  try {
    const parsedCertUrl = new URL(String(certUrl));
    if (!parsedCertUrl.hostname.endsWith(".paypal.com")) {
      return {
        verified: false,
        reason: `Potential SSRF/Spoof Attack: Certificate hostname '${parsedCertUrl.hostname}' does not match official PayPal domains.`
      };
    }
    if (parsedCertUrl.protocol !== "https:") {
      return {
        verified: false,
        reason: "Insecure protocol for certificate download. HTTPS is strictly required."
      };
    }
  } catch (err: any) {
    return {
      verified: false,
      reason: `Malformed Certificate URL format: ${err.message}`
    };
  }

  // 3. Replay attack defense: Timestamp window verification (Reduced to standard 5-minute/300s delta)
  const txTimeMs = Date.parse(String(transmissionTime));
  if (isNaN(txTimeMs)) {
    return {
      verified: false,
      reason: "Malformed transmission timestamp header."
    };
  }
  const timeDiffSec = Math.abs(Date.now() - txTimeMs) / 1000;
  if (timeDiffSec > 300) {
    return {
      verified: false,
      reason: `Potential Replay Attack: Webhook event timestamp age (${Math.round(timeDiffSec)} seconds) exceeds the 5-minute maximum security envelope.`
    };
  }

  // 5. Fail-Closed Check: Ensure PayPal credentials and Webhook ID are present
  if (!clientId || !clientSecret || !webhookId) {
    return {
      verified: false,
      reason: "CRITICAL SECURITY EXCEPTION: PayPal API client credentials or Webhook ID is missing. Failing closed to prevent unauthorized domain hijacking."
    };
  }

  // 6. High-fidelity cryptographic challenge verification via PayPal REST API
  try {
    // Exchange credentials for a secure PayPal OAuth2 Access Token
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    
    // Determine the correct PayPal API host (Production vs Sandbox)
    const isProdMode = process.env.PAYPAL_ENV === "production";
    const paypalApiHost = isProdMode ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const oauthResponse = await fetch(`${paypalApiHost}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    if (!oauthResponse.ok) {
      const errDetails = await oauthResponse.text();
      return {
        verified: false,
        reason: `PayPal OAuth hand-shake failed (HTTP ${oauthResponse.status}): ${errDetails}`
      };
    }

    const tokenPayload: any = await oauthResponse.json();
    const accessToken = tokenPayload.access_token;

    // Challenge signature via PayPal's official signature verification endpoint
    const verificationPayload = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: req.body
    };

    const verifyResponse = await fetch(`${paypalApiHost}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(verificationPayload)
    });

    if (!verifyResponse.ok) {
      const errDetails = await verifyResponse.text();
      return {
        verified: false,
        reason: `PayPal Signature API challenge failed (HTTP ${verifyResponse.status}): ${errDetails}`
      };
    }

    const verificationResult: any = await verifyResponse.json();
    if (verificationResult.verification_status === "SUCCESS") {
      return {
        verified: true,
        reason: "Cryptographic verification completed successfully."
      };
    }

    return {
      verified: false,
      reason: `PayPal API rejected the signature: status '${verificationResult.verification_status}'`
    };
  } catch (err: any) {
    return {
      verified: false,
      reason: `System exception during signature verification request: ${err.message}`
    };
  }
}

// 8. Live PayPal Webhook Integration for Automated SaaS Client Onboarding
app.post("/api/webhooks/paypal", async (req, res) => {
  const event = req.body;
  const transmissionId = req.headers["paypal-transmission-id"];
  console.log("Incoming PayPal webhook payload. Event:", event?.event_type);

  try {
    // 1. FIRST: Challenge Cryptographic signature headers to defend monetization pipeline
    const sigResult = await verifyPayPalSignature(req);
    if (!sigResult.verified) {
      console.error(`[SECURITY BLOCKED] Unauthorized PayPal webhook callback rejected: ${sigResult.reason}`);
      return res.status(401).json({
        status: "unauthorized",
        error: "Cryptographic signature validation failed",
        reason: sigResult.reason
      });
    }

    console.log(`[SECURITY PASSED] PayPal webhook signature verified: ${sigResult.reason}`);

    // 2. SECOND: Strict Idempotency Check to protect core DB from race collisions and replay attacks
    if (transmissionId) {
      try {
        const txRef = doc(db, "paypal_transactions", String(transmissionId));
        const txDoc = await getDoc(txRef);
        if (txDoc.exists()) {
          console.log(`[PAYPAL IDEMPOTENCY LOCK] Transmission ID '${transmissionId}' already processed. Ignoring duplicate.`);
          return res.status(200).json({
            status: "ignored",
            reason: `Idempotency Block: Webhook transmission ID '${transmissionId}' has already been processed.`
          });
        }
      } catch (err: any) {
        console.error("Idempotency check failed:", err);
        return res.status(500).json({
          status: "error",
          error: "Idempotency database read failure"
        });
      }
    }

    // 3. THIRD: Tenant Provisioning and Database Updates (Synchronous to prevent Serverless execution throttling/termination)
    const isSuccessEvent = event?.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" || 
                           event?.event_type === "PAYMENT.SALE.COMPLETED" ||
                           event?.event_type === "BILLING.SUBSCRIPTION.CREATED";

    if (isSuccessEvent) {
      const resource = event.resource || {};
      const customIdStr = resource.custom_id || resource.custom || "";
      
      let tenantData: any = null;
      if (customIdStr) {
        try {
          tenantData = JSON.parse(customIdStr);
        } catch (e) {
          console.log("Parsing custom_id as JSON failed, falling back to CSV parsing:", customIdStr);
          const parts = customIdStr.split(",");
          if (parts.length >= 4) {
            tenantData = {
              domain: parts[0].trim(),
              businessName: parts[1].trim(),
              city: parts[2].trim(),
              phone: parts[3].trim()
            };
          }
        }
      }

      // Fallback for demonstration
      if (!tenantData || !tenantData.domain) {
        const randomId = Math.floor(1000 + Math.random() * 9000);
        tenantData = {
          domain: `paypal-hvac-${randomId}.com`,
          businessName: `PayPal Certified Climate #${randomId}`,
          city: "Dallas",
          phone: "(214) 555-PAYP"
        };
      }

      const domain = tenantData.domain.toLowerCase().trim();
      const docRef = doc(db, "clients", domain);

      const clientData = {
        domain,
        businessName: tenantData.businessName.trim(),
        city: tenantData.city || "Dallas",
        phone: tenantData.phone.trim(),
        isrUrl: `https://${domain}/api/revalidate`,
        isrSecret: `sec_paypal_${Math.random().toString(36).substring(2, 8)}`,
        lastUpdated: new Date().toISOString(),
        lastWeatherCopy: {
          heroTitle: `Welcome to ${tenantData.businessName} | Live Subscription Active`,
          heroSubtitle: `Your weather-optimized autonomous climate agent is online for ${tenantData.city}. Call dispatch at ${tenantData.phone} to lock in a premium tune-up rate.`,
          alertBanner: "🎉 SUBSCRIPTION PROVISIONED: Live PayPal subscription webhook received and database tenant created.",
          seoHeading: `Local Heating, AC, and Ventilation in ${tenantData.city}`,
          seoArticle: `Welcome to ${tenantData.businessName}. We provide fully weather-adaptive smart heating and cooling diagnostics to protect local families from catastrophic summer heat and freezing winter sweeps. Fully licensed and insured.`,
          promotions: ["$50 Initial Dispatch Discount", "Free Multi-point Air Quality Scan"],
          cacheTags: ["homepage", "onboarding", "paypal-webhook"]
        }
      };

      // Commit tenant to core Firestore database
      await setDoc(docRef, clientData, { merge: true });

      // Save PayPal transmission ID to prevent future Replay attacks (Idempotency)
      if (transmissionId) {
        await setDoc(doc(db, "paypal_transactions", String(transmissionId)), {
          processedAt: new Date().toISOString(),
          domain: domain,
          eventType: event.event_type
        });
        console.log(`[PAYPAL IDEMPOTENCY RECORDED] Transmission ID '${transmissionId}' marked as completed.`);
      }

      console.log(`[PAYPAL WEBHOOK SUCCESS] Provisioned multi-tenant client: ${domain}`);

      return res.status(200).json({
        status: "success",
        message: `Tenant ${domain} successfully onboarded via live webhook payload.`,
        client: clientData
      });
    }

    return res.status(200).json({ status: "ignored", message: "Non-provisioning PayPal event received." });
  } catch (err: any) {
    console.error("[LIVE WEBHOOK ERROR] Synchronous processing exception:", err);
    return res.status(500).json({ error: "Failed to process PayPal webhook", message: err.message });
  }
});

// 8.5 Dedicated Unauthenticated Mock Webhook Endpoint for Sandboxed Simulations (Dev only)
if (process.env.NODE_ENV !== "production") {
  app.post("/api/webhooks/mock-paypal", async (req, res) => {
    const host = req.headers.host || "";
    const isDevEnv = process.env.NODE_ENV !== "production" || 
                     host.includes("run.app") || 
                     host.includes("github.dev") || 
                     host.includes("localhost") || 
                     host.includes("127.0.0.1") || 
                     host.includes("3000");

    if (!isDevEnv) {
      return res.status(403).json({ error: "Access Denied: Simulator only available in development sandbox." });
    }

    const event = req.body;
    const transmissionId = req.headers["paypal-transmission-id"] || `mock_tx_${Date.now()}`;
    console.log("[MOCK WEBHOOK PAYPAL] Processing simulation request. Event:", event?.event_type);

    try {
      // 1. FIRST: Strict Idempotency Check (Synchronous) to mimic production security posture
      try {
        const txRef = doc(db, "paypal_transactions", String(transmissionId));
        const txDoc = await getDoc(txRef);
        if (txDoc.exists()) {
          console.log(`[MOCK PAYPAL IDEMPOTENCY LOCK] Transmission ID '${transmissionId}' already processed. Ignoring duplicate.`);
          return res.status(200).json({
            status: "ignored",
            reason: `Idempotency Block: Webhook transmission ID '${transmissionId}' has already been processed.`
          });
        }
      } catch (err) {
        console.error("Mock fast idempotency check failed:", err);
        return res.status(500).json({ status: "error", error: "Mock idempotency database read failure" });
      }

      // 2. SECOND: Synchronous Tenant Provisioning and Database Updates to prevent serverless throttling
      const isSuccessEvent = event?.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" || 
                             event?.event_type === "PAYMENT.SALE.COMPLETED" ||
                             event?.event_type === "BILLING.SUBSCRIPTION.CREATED";

      if (isSuccessEvent) {
        const resource = event.resource || {};
        const customIdStr = resource.custom_id || resource.custom || "";
        
        let tenantData: any = null;
        if (customIdStr) {
          try {
            tenantData = JSON.parse(customIdStr);
          } catch (e) {
            const parts = customIdStr.split(",");
            if (parts.length >= 4) {
              tenantData = {
                domain: parts[0].trim(),
                businessName: parts[1].trim(),
                city: parts[2].trim(),
                phone: parts[3].trim()
              };
            }
          }
        }

        if (!tenantData || !tenantData.domain) {
          const randomId = Math.floor(1000 + Math.random() * 9000);
          tenantData = {
            domain: `mock-hvac-${randomId}.com`,
            businessName: `Mock Dev Climate #${randomId}`,
            city: "Dallas",
            phone: "(214) 555-PAYP"
          };
        }

        const domain = tenantData.domain.toLowerCase().trim();
        const docRef = doc(db, "clients", domain);

        const clientData = {
          domain,
          businessName: tenantData.businessName.trim(),
          city: tenantData.city || "Dallas",
          phone: tenantData.phone.trim(),
          isrUrl: `https://${domain}/api/revalidate`,
          isrSecret: `sec_paypal_${Math.random().toString(36).substring(2, 8)}`,
          lastUpdated: new Date().toISOString(),
          lastWeatherCopy: {
            heroTitle: `Welcome to ${tenantData.businessName} | Simulated Subscription Active`,
            heroSubtitle: `Your weather-optimized autonomous climate agent is online for ${tenantData.city}. Call dispatch at ${tenantData.phone} to lock in a premium tune-up rate.`,
            alertBanner: "🎉 SIMULATION SUBSCRIPTION PROVISIONED: Simulated PayPal subscription received and database tenant created.",
            seoHeading: `Local Heating, AC, and Ventilation in ${tenantData.city}`,
            seoArticle: `Welcome to ${tenantData.businessName}. We provide fully weather-adaptive smart heating and cooling diagnostics to protect local families from catastrophic summer heat and freezing winter sweeps. Fully licensed and insured.`,
            promotions: ["$50 Initial Dispatch Discount", "Free Multi-point Air Quality Scan"],
            cacheTags: ["homepage", "onboarding", "paypal-webhook"]
          }
        };

        // Commit tenant to core Firestore database
        await setDoc(docRef, clientData, { merge: true });

        // Record simulated idempotency lock
        await setDoc(doc(db, "paypal_transactions", String(transmissionId)), {
          processedAt: new Date().toISOString(),
          domain: domain,
          eventType: event.event_type
        });

        console.log(`[MOCK PAYPAL WEBHOOK SUCCESS] Registered client: ${domain}`);

        return res.status(200).json({
          status: "success",
          message: `Simulated tenant ${domain} successfully provisioned.`,
          client: clientData
        });
      }

      return res.status(200).json({ status: "ignored", message: "Non-provisioning simulated event received." });
    } catch (err: any) {
      console.error("[MOCK WEBHOOK ERROR] Synchronous processing exception:", err);
      return res.status(500).json({ error: "Failed to process mock PayPal webhook", message: err.message });
    }
  });
}

// Serve frontend build files in production or hook up Vite middleware in development
async function startServer() {
  console.log("🚀 [BOOT] Starting weather-adaptive autonomous HVAC backend server...");

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDir, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [BOOT] Server running and fully operational on http://0.0.0.0:${PORT}`);
  });
}

startServer();
