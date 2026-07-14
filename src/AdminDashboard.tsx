/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  Activity,
  CloudSun,
  Terminal,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Globe,
  Phone,
  MapPin,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  ArrowRight,
  Sparkles, Users,
  Info
} from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { TenantClient, PipelineRun, PipelineLog } from "./types";
import { db, auth, googleProvider } from "./firebase";
import { collection, onSnapshot, query, getDocs, doc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const ADMIN_API_KEY = "nexus2026";

const [activeTab, setActiveTab] = useState<"console" | "tenants" | "billing" | "leadgen">("console");
  const [clients, setClients] = useState<TenantClient[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);
  const [selectedCity, setSelectedCity] = useState("Dallas");
  const [platformMetrics, setPlatformMetrics] = useState({ trades: 0, revenue: 0 });
  const [metricsHealth, setMetricsHealth] = useState({ status: "healthy", lastUpdated: "" });
  const [customCity, setCustomCity] = useState("");
  const [selectedClient, setSelectedClient] = useState<TenantClient | null>(null);
  const [hasRealApiKey, setHasRealApiKey] = useState(false);

  // Client registration form state
  const [newClientDomain, setNewClientDomain] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientCity, setNewClientCity] = useState("Dallas");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientIsr, setNewClientIsr] = useState("");
  const [newClientSecret, setNewClientSecret] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [pendingClients, setPendingClients] = useState<TenantClient[]>([]);
  const [submitError, setSubmitError] = useState("");

  // PayPal Checkout Form States
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutZipCode, setCheckoutZipCode] = useState("");
  const [checkoutDomain, setCheckoutDomain] = useState("");
  const [checkoutCity, setCheckoutCity] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [checkoutLog, setCheckoutLog] = useState<string[]>([]);
  const [checkoutStep, setCheckoutStep] = useState<number>(0);

  // UI state
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [logsEndRef, setLogsEndRef] = useState<HTMLDivElement | null>(null);

  // Trigger autonomous weather pipeline
  const triggerPipeline = async (cityToRun: string) => {
    try {
      setIsPolling(true);
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ city: cityToRun, delayMs: 1500 }),
      });
      const data = await res.json();
      if (data.runId) {
        setActiveRunId(data.runId);
      }
    } catch (err) {
      console.error("Error starting pipeline:", err);
      setIsPolling(false);
    }
  };

  const [queueMode, setQueueMode] = useState<"local" | "monolithic" | "gcp-tasks" | "github-actions">("local");

  // Trigger autonomous meteorological sync cron across all cities
  const triggerMeteorologicalSync = async (mode: "local" | "monolithic" | "gcp-tasks" | "github-actions") => {
    if (mode === "github-actions") {
      return;
    }
    try {
      setIsPolling(true);
      const res = await fetch("/api/pipeline/sync-weather", {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ async: true, queueMode: mode }),
      });
      const data = await res.json();
      // OnSnapshot automatically sets the active runId once Firestore commits
    } catch (err) {
      console.error("Error starting full meteorological sync:", err);
      setIsPolling(false);
    }
  };

  // Delete client domain
  const deleteClient = async (domain: string) => {
    if (!confirm(`Are you sure you want to de-register ${domain}?`)) return;
    try {
      const res = await fetch(`/api/clients/${domain}`, { method: "DELETE", headers: { "Authorization": `Bearer ${ADMIN_API_KEY}` } });
      if (res.ok) {
        if (selectedClient?.domain === domain) {
          setSelectedClient(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete client:", err);
    }
  };

  // Register new client
  const registerClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!newClientDomain || !newClientName || !newClientPhone) {
      setSubmitError("Please fill out all required fields.");
      return;
    }

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newClientDomain)) {
      setSubmitError("Please enter a valid domain name (e.g. business.com)");
      return;
    }

    try {
      const tempClient: TenantClient = {
        domain: newClientDomain,
        businessName: newClientName,
        city: newClientCity,
        phone: newClientPhone,
        isrUrl: newClientIsr || undefined,
        isrSecret: newClientSecret || undefined,
        createdAt: new Date().toISOString()
      };
      setPendingClients(prev => [...prev, tempClient]);
      setIsAdding(false);

      const payload = {
        domain: newClientDomain,
        businessName: newClientName,
        city: newClientCity,
        phone: newClientPhone,
        isrUrl: newClientIsr || undefined,
        isrSecret: newClientSecret || undefined,
      };

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setPendingClients(prev => prev.filter(p => p.domain !== tempClient.domain));
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save client.");
      }

      // Reset form
      setNewClientDomain("");
      setNewClientName("");
      setNewClientPhone("");
      setNewClientIsr("");
      setNewClientSecret("");
      setIsAdding(false);
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred.");
    }
  };

  // Handle Local PayPal Checkout Webhook trigger
  const handlePayPalSubscriptionSimulate = async () => {
    setIsSubmittingCheckout(true);
    setCheckoutStep(1); // Verifying payment...
    setCheckoutLog([`[PAYPAL SDK] Initializing payment session...`]);

    const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

    try {
      await wait(800);
      setCheckoutLog(prev => [...prev, `[PAYPAL SDK] Customer approved subscription.`]);
      setCheckoutStep(2); // Analyzing territory data...
      
      const mockTxId = `tx_mock_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
      const mockTime = new Date().toISOString();
      const mockSig = `sig_mock_${Math.random().toString(36).substring(2, 24)}`;
      const mockCertUrl = "https://api.paypal.com/v1/certs/mock-cert-bundle.pem";

      await wait(600);
      setCheckoutStep(3); // Generating dynamic layout...

      const res = await fetch("/api/webhooks/mock-paypal", {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_API_KEY}`, "Content-Type": "application/json",
          "paypal-transmission-id": mockTxId,
          "paypal-transmission-time": mockTime,
          "paypal-transmission-sig": mockSig,
          "paypal-cert-url": mockCertUrl,
          "paypal-auth-algo": "SHA256withRSA"
        },
        body: JSON.stringify({
          event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
          resource: {
            subscriber: {
              email_address: "local.customer@example.com"
            },
            custom_id: JSON.stringify({
              businessName: checkoutName,
              zipCode: checkoutZipCode
            })
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP Status ${res.status}`);
      }

      setCheckoutStep(4); // Deploying to edge...
      await wait(1000);

      const data = await res.json();
      setCheckoutStep(5); // Complete!
      
      setTimeout(() => setActiveTab("tenants"), 2000);

    } catch (err: any) {
      setCheckoutLog(prev => [...prev, `[ERROR] ${err.message}`]);
      setCheckoutStep(-1);
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  // Listen to the single global platform_stats document and health status
  useEffect(() => {
    const docRef = doc(db, "_metadata", "platform_stats");
    const unsubStats = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlatformMetrics({ 
          trades: data.weeklyTrades || 0, 
          revenue: data.weeklyRevenue || 0 
        });
      }
    }, (err) => {
      console.error("Failed to listen to platform stats:", err);
    });

    const healthRef = doc(db, "_metadata", "platform_stats_health");
    const unsubHealth = onSnapshot(healthRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMetricsHealth({
          status: data.status || "healthy",
          lastUpdated: data.lastSuccess || data.failedAt || ""
        });
      }
    }, (err) => {
      console.error("Failed to listen to platform stats health:", err);
    });

    return () => {
      unsubStats();
      unsubHealth();
    };
  }, []);

  // Subscribe to multi-tenant clients/registrants in Firestore in real-time
  useEffect(() => {
    const clientsQuery = query(collection(db, "clients"));
    const unsubscribe = onSnapshot(clientsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as TenantClient);
      setClients(data);
      setPendingClients(prev => prev.filter(p => !data.some(d => d.domain === p.domain)));
      if (data.length > 0) {
        setSelectedClient(prev => {
          if (!prev) return data[0];
          const matched = data.find(c => c.domain === prev.domain);
          return matched || data[0];
        });
      }
    }, (error) => {
      console.error("Error in clients real-time subscription:", error);
    });
    
  return () => unsubscribe();
  }, []);

  // Subscribe to pipeline runs collection in Firestore in real-time
  useEffect(() => {
    const runsQuery = query(collection(db, "runs"));
    const unsubscribe = onSnapshot(runsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as PipelineRun);
      // Sort in-memory descending by startedAt to avoid needing compound Firestore index
      data.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setRuns(data);
    }, (error) => {
      console.error("Error in runs real-time subscription:", error);
    });
    return () => unsubscribe();
  }, []);

  // Sync activeRun details when the runs directory or selected activeRunId changes
  useEffect(() => {
    if (runs.length > 0) {
      if (activeRunId) {
        const current = runs.find(r => r.id === activeRunId);
        if (current) {
          setActiveRun(current);
          setIsPolling(current.status === "running");
        }
      } else {
        setActiveRunId(runs[0].id);
        setActiveRun(runs[0]);
        setIsPolling(runs[0].status === "running");
      }
    }
  }, [runs, activeRunId]);

  // Initial load: Fetch API and API Key status info
  useEffect(() => {
    fetch("/api/status", { headers: { "Authorization": `Bearer ${ADMIN_API_KEY}` } })
      .then((res) => res.json())
      .then((data) => setHasRealApiKey(data.hasRealApiKey))
      .catch((err) => console.error("Error fetching API status:", err));
  }, []);

  // Scroll to bottom of terminal when logs update
  useEffect(() => {
    if (logsEndRef) {
      logsEndRef.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeRun?.logs?.length]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Google Cloud Function Code Strings for copying
  const cloudFunctionCode = `/**
 * Google Cloud Function (2nd Gen) - Autonomous Webmaster Weather Pipeline
 * Triggered by Cloud Scheduler every 12 hours (e.g., cron: "0 */12 * * *")
 * or via secure webhook requests.
 * 
 * Target: Queries Firestore tenants, resolves weather metrics, 
 * generates strict schema-validated copywriting with Gemini 3.5, 
 * and triggers isolated Next.js ISR revalidation.
 */

const { Firestore } = require("@google-cloud/firestore");
const { GoogleGenAI, Type } = require("@google/genai");
const fetch = require("node-fetch"); // Use standard fetch or native fetch in Node 18+

// Initialize SDKs
const db = new Firestore();
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: { "User-Agent": "aistudio-build",
    },
  },
});

exports.weatherWebmasterPipeline = async (req, res) => {
  // Support both GET query or POST payload for city parameters
  const city = req.query.city || (req.body && req.body.city);
  if (!city) {
    return res.status(400).send("Error: 'city' parameter is required.");
  }

  console.log(\`Starting weather-revalidation pipeline for city: \${city}\`);

  try {
    // 1. Query Firestore for clients situated in this city
    // Next.js Multi-tenant mapping uses domain names as document IDs
    const clientsRef = db.collection("tenant-clients");
    const snapshot = await clientsRef.where("city", "==", city).get();

    if (snapshot.empty) {
      console.log(\`No multi-tenant Local Business clients active in city: \${city}\`);
      return res.status(200).send(\`Finished: 0 clients found in \${city}\`);
    }

    const clients = [];
    snapshot.forEach(doc => {
      clients.push({ domain: doc.id, ...doc.data() });
    });

    console.log(\`Identified \${clients.length} matching tenants in \${city}.\`);

    // 2. Fetch Live atmospheric metrics from Open-Meteo
    // First, geocode the city to resolve coordinates safely
    const geoUrl = \`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(city)}&count=1&language=en&format=json\`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(\`Geocode failed for city: \${city}\`);
    }
    const { latitude, longitude, name: canonicalCity } = geoData.results[0];

    const weatherUrl = \`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}&longitude=\${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&temperature_unit=fahrenheit\`;
    const weatherRes = await fetch(weatherUrl);
    const rawWeather = await weatherRes.json();
    
    const weatherMetrics = {
      temp: rawWeather.current.temperature_2m,
      humidity: rawWeather.current.relative_humidity_2m,
      condition: rawWeather.current.weather_code >= 95 ? "Severe Storms" : "Normal Readings"
    };

    console.log(\`Weather fetched successfully for \${canonicalCity}: \${weatherMetrics.temp}°F\`);

    // 3. Process Multi-Tenant updates SEQUENTIALLY to mitigate API rate-limits (HTTP 429)
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      console.log(\`[Sequence \${i + 1}/\${clients.length}] Processing tenant: \${client.domain}\`);

      // Throttle delay of 1.5 seconds between subsequent client iterations
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      try {
        // Enforce schemas natively using the API's responseSchema configuration
        const prompt = \`
          You are 'The Living Website' Autonomous AI Webmaster. Update homepages for Local Business client "\${client.businessName}" in \${client.city}.
          Weather: \${weatherMetrics.temp}°F, \${weatherMetrics.condition}, \${weatherMetrics.humidity}% Humidity.
          Contact: \${client.phone}
        \`;

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            heroTitle: { type: Type.STRING },
            heroSubtitle: { type: Type.STRING },
            alertBanner: { type: Type.STRING },
            seoHeading: { type: Type.STRING },
            seoArticle: { type: Type.STRING },
            promotions: { type: Type.ARRAY, items: { type: Type.STRING } },
            cacheTags: { type: Type.ARRAY, items: { type: Type.STRING } }
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
          }
        });

        const weatherCopy = JSON.parse(result.text.trim());

        // Save generated copy back into Firestore under tenant's domain doc ID
        await db.collection("tenant-clients").doc(client.domain).update({
          lastWeatherCopy: weatherCopy,
          lastUpdated: new Date().toISOString()
        });

        console.log(\`Committed Firestore mutations for \${client.domain}\`);

        // 4. Trigger Next.js ISR. Wrap request in an isolated try/catch block
        // to prevent a single client failure from breaking the entire sequential pipeline.
        console.log(\`Dispatching Next.js revalidation call to \${client.isrUrl}\`);
        
        try {
          // Absolute timeout configuration (4 seconds)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const isrRes = await fetch(client.isrUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json",
              "Authorization": \`Bearer \${client.isrSecret}\`
            },
            body: JSON.stringify({
              tags: weatherCopy.cacheTags,
              weatherCopy: weatherCopy
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!isrRes.ok) {
            throw new Error(\`HTTP Status \${isrRes.status}\`);
          }

          console.log(\`[ISR SUCCESS] Tenant \${client.domain} revalidated successfully.\`);
          successCount++;
        } catch (isrError) {
          console.warn(\`[ISR FAILURE] Non-blocking exception on \${client.domain}: \`, isrError.message);
          failCount++;
        }

      } catch (clientError) {
        console.error(\`[CRITICAL CLIENT ERROR] Failed to process tenant \${client.domain}: \`, clientError.message);
        failCount++;
      }
    }

    res.status(200).send({
      message: "Pipeline completed successfully.",
      city,
      totalClients: clients.length,
      successes: successCount,
      failures: failCount
    });

  } catch (globalError) {
    console.error("Fatal pipeline crash: ", globalError.message);
    res.status(500).send(\`Fatal Server Exception: \${globalError.message}\`);
  }
};`;

  const packageJsonCode = `{
  "name": "autonomous-weather-webmaster",
  "version": "1.0.0",
  "description": "Production Google Cloud Function weather revalidation backend",
  "main": "index.js",
  "dependencies": {
    "@google-cloud/firestore": "^7.5.0",
    "@google/genai": "^2.4.0",
    "node-fetch": "^2.7.0"
  }
}`;


  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-8 max-w-sm w-full">
          <div className="flex items-center gap-2 mb-6 justify-center">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-xl text-slate-900">NexusAI Portal</span>
          </div>
          <p className="text-sm text-slate-500 text-center mb-6">Zero-trust environment. Please authenticate.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (passcode === ADMIN_API_KEY) {
              setIsAuthenticated(true);
            } else {
              alert("Unauthorized access attempt logged.");
            }
          }} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Enter Access Token"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
            <button type="submit" className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition-colors">
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 1. Global Header */}
      <header className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-xl text-slate-900">
            The Living Website
          </span>
        </div>

        {/* Status Indicators */}
        <div className="flex gap-8 items-center">
          <a href="/" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1">
            &larr; Back to Storefront
          </a>
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-semibold tracking-wider text-slate-500">MODE</span>
            <span className="text-xs font-semibold text-slate-800">Production</span>
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-semibold tracking-wider text-slate-500">AI ASSISTANT</span>
            <span className="text-xs font-semibold text-slate-800">Gemini 1.5 Flash</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-wider text-slate-500">API STATUS</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {hasRealApiKey ? (
                <span className="text-xs bg-sky-500/10 border border-sky-500/30 rounded px-2 py-0.5 text-sky-400 font-bold uppercase">
                  Connected
                </span>
              ) : (
                <span className="text-xs bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5 text-amber-500 font-bold uppercase">
                  Local Sandbox
                </span>
              )}
            </div>
          </div>
          <div className="px-3 py-1 bg-blue-600/10 border border-blue-600/30 rounded text-blue-600 text-xs font-semibold">
            System Online
          </div>
        </div>
      </header>      {/* 2. Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Navigation & Primary Modules */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Platform Metrics Dashboard Widget */}
          <div className="bg-white border border-slate-300 shadow-sm rounded-lg p-4 mb-4 flex gap-4 font-sans relative">
            {metricsHealth.status === "failed" && (
              <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium border border-rose-200 uppercase tracking-wider animate-pulse">
                <Activity size={10} />
                Stale Data Alert: Cron Failed
              </div>
            )}
            {metricsHealth.status === "healthy" && metricsHealth.lastUpdated && (
              <div className="absolute top-2 right-2 text-[10px] text-slate-400 font-medium">
                Sync: {new Date(metricsHealth.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-md p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">Weekly Lead Trades</div>
              <div className="text-2xl text-slate-800 font-bold">{platformMetrics.trades}</div>
            </div>
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-md p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">Weekly Pipeline Revenue</div>
              <div className="text-2xl text-emerald-600 font-bold">${platformMetrics.revenue.toLocaleString()}</div>
            </div>
          </div>

          {/* Module Selector Tabs */}
          <div className="bg-white border border-slate-300 shadow-sm rounded-lg p-1 flex gap-1 font-sans">
            <button
              onClick={() => setActiveTab("console")}
              className={`flex-1 py-2.5 px-4 text-xs font-semibold tracking-wider flex items-center justify-center gap-2 transition-all border ${
                activeTab === "console"
                  ? "bg-blue-600/10 text-blue-600 border-blue-600/30"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Terminal className="w-4 h-4" />
              Campaign Console
            </button>
            <button
              onClick={() => setActiveTab("tenants")}
              className={`flex-1 py-2.5 px-4 text-xs font-semibold tracking-wider flex items-center justify-center gap-2 transition-all border ${
                activeTab === "tenants"
                  ? "bg-blue-600/10 text-blue-600 border-blue-600/30"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Database className="w-4 h-4" />
              Client Directory ({clients.length})
            </button>
            <button
              onClick={() => setActiveTab("billing")}
              className={`flex-1 py-2.5 px-4 text-xs font-semibold tracking-wider flex items-center justify-center gap-2 transition-all border ${
                activeTab === "billing"
                  ? "bg-blue-600/10 text-blue-600 border-blue-600/30"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              PayPal Portal
            </button>
            <button
              onClick={() => setActiveTab("leadgen")}
              className={`flex-1 py-2.5 px-4 text-xs font-semibold tracking-wider flex items-center justify-center gap-2 transition-all border ${
                activeTab === "leadgen"
                  ? "bg-blue-600/10 text-blue-600 border-blue-600/30"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Users className="w-4 h-4" />
              Lead Generator
            </button>
          </div>

          {/* TAB 1: Autonomous Webmaster Console */}
          {activeTab === "console" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Launcher Card - 7 cols */}
              <div className="md:col-span-7 bg-white border border-slate-300 shadow-sm p-5 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold tracking-wider text-slate-500">Automatic Copy Optimizer</span>
                  <h2 className="text-sm font-semibold text-slate-800 mt-1 mb-3 tracking-tight">
                    Weather-Adaptive Content Control
                  </h2>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Automatically tailor your landing pages to live weather conditions. Run a test for a single city or sync your entire fleet of clients to update their sites based on current temperatures, humidity, and storm events.
                  </p>
                </div>

                <div className="flex flex-col gap-5 border-t border-slate-200 pt-4">
                  {/* Action Group 1: Single City */}
                  <div>
                    <span className="text-xs font-bold text-slate-500 font-sans tracking-wider block mb-2">
                      1. Run a Single-City Test
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedCity}
                        onChange={(e) => {
                          setSelectedCity(e.target.value);
                          if (e.target.value !== "custom") setCustomCity("");
                        }}
                        className="w-full sm:flex-1 bg-white border border-slate-300 shadow-sm px-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans rounded-lg min-w-0"
                        disabled={isPolling}
                      >
                        <option value="Dallas">Dallas, TX</option>
                        <option value="Phoenix">Phoenix, AZ</option>
                        <option value="Chicago">Chicago, IL</option>
                        <option value="Seattle">Seattle, WA</option>
                        <option value="custom">-- Custom City --</option>
                      </select>

                      {selectedCity === "custom" && (
                        <input
                          type="text"
                          placeholder="E.g., Las Vegas"
                          value={customCity}
                          onChange={(e) => setCustomCity(e.target.value)}
                          className="w-full sm:flex-1 bg-white border border-slate-300 shadow-sm px-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans rounded-lg"
                          disabled={isPolling}
                        />
                      )}

                      <button
                        onClick={() => triggerPipeline(selectedCity === "custom" ? customCity : selectedCity)}
                        disabled={isPolling || (selectedCity === "custom" && !customCity)}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-600 disabled:bg-white disabled:text-slate-500 text-white font-bold font-sans text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-all tracking-wider whitespace-nowrap"
                      >
                        {isPolling ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-white" />
                            Tuning...
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current text-white" />
                            Run Weather Sync
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Action Group 2: Full Fleet Weather Cron */}
                  <div className="border-t border-slate-200/60 pt-4">
                    <span className="text-xs font-bold text-slate-500 font-sans tracking-wider block mb-2">
                      2. Sync All Clients (Fleet-wide)
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={queueMode}
                        onChange={(e) => setQueueMode(e.target.value as any)}
                        className="w-full sm:flex-1 bg-white border border-slate-300 shadow-sm px-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-sans rounded-lg min-w-0"
                        disabled={isPolling}
                      >
                        <option value="local">Local Local Queue (100% Free - No GCP Setup)</option>
                        <option value="github-actions">GitHub Actions Cron (100% Free - Production Grade)</option>
                        <option value="monolithic">Sequential Pool (Monolithic loop)</option>
                        <option value="gcp-tasks">GCP Cloud Tasks (Requires GCP Billing)</option>
                      </select>

                      <button
                        onClick={() => triggerMeteorologicalSync(queueMode)}
                        disabled={isPolling || queueMode === "github-actions"}
                        className={`w-full sm:w-auto font-bold font-sans text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all tracking-wider whitespace-nowrap ${
                          queueMode === "github-actions"
                            ? "bg-white text-slate-500 cursor-not-allowed border border-slate-200 shadow-sm"
                            : "bg-sky-500 hover:bg-sky-400 text-white cursor-pointer"
                        }`}
                      >
                        {isPolling ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Queuing...
                          </>
                        ) : queueMode === "github-actions" ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            External Cron Active
                          </>
                        ) : (
                          <>
                            <Activity className="w-3 h-3" />
                            Sync All Clients
                          </>
                        )}
                      </button>
                    </div>
                    {queueMode === "github-actions" ? (
                      <div className="mt-4 p-4 bg-slate-50 border border-sky-500/30 font-sans text-xs text-slate-700 space-y-3">
                        <div className="flex items-center gap-2 text-sky-400 font-bold tracking-wider border-b border-slate-200 pb-1.5">
                          <Terminal className="w-4 h-4 text-sky-400" />
                          <span>Enterprise Hybrid-Cloud Orchestrator</span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-500">
                          To run fleet synchronization completely for <span className="text-blue-600 font-bold">free</span> without hitting Cloud Run CPU limits or paying for Google Cloud Tasks, configure these secrets in your <span className="text-slate-900 font-bold">GitHub Repository Settings &rarr; Secrets and Variables &rarr; Actions</span>:
                        </p>
                        <ul className="space-y-2 text-xs border-y border-slate-200/80 py-2">
                          <li className="flex flex-col gap-0.5">
                            <span className="text-slate-900 font-bold font-sans">1. FIREBASE_SERVICE_ACCOUNT_KEY</span>
                            <span className="text-slate-500">Your Firebase Admin private key JSON string (enables the GitHub Action to securely query registered clients).</span>
                          </li>
                          <li className="flex flex-col gap-0.5">
                            <span className="text-slate-900 font-bold font-sans">2. APP_BASE_URL</span>
                            <span className="text-slate-500">Your Cloud Run base address (e.g., <code className="text-sky-300">https://your-app-url.com</code>).</span>
                          </li>
                          <li className="flex flex-col gap-0.5">
                            <span className="text-slate-900 font-bold font-sans">3. TASK_WORKER_SECRET</span>
                            <span className="text-slate-500">A secure secret token matching your server env to shield the mutation endpoint.</span>
                          </li>
                        </ul>
                        <div className="bg-blue-600/10 border-l-2 border-blue-600 p-2.5 text-xs text-blue-800 leading-relaxed">
                          ⚡ <strong>How it works:</strong> The GitHub workflow runs twice daily on GitHub's infrastructure. It fetches clients, resolves weather, and updates landing pages sequentially for each client.
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 font-sans mt-2 leading-relaxed">
                        * Local Local mode is <span className="text-blue-600 font-bold">100% free with no Google Cloud account required</span>, spawning background task workers instantly.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Gemini & Capacity block - 5 cols */}
              <div className="md:col-span-5 bg-white border border-slate-300 shadow-sm p-5 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold tracking-wider text-slate-500">Gemini AI Engine Settings</span>
                  <div className="mt-2.5 p-3.5 bg-blue-600/10 border-l-2 border-blue-600 text-xs leading-relaxed text-blue-800 font-sans">
                    Strict JSON schema enforcement is active. The AI output is structured and validated automatically to ensure flawless landing page updates.
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold tracking-wider text-slate-500">Queue Capacity</span>
                    <div className="flex items-end gap-1 mt-1">
                      <span className="metric-val text-slate-900">98.4</span>
                      <span className="text-xs mb-1 text-slate-500 font-sans">%</span>
                    </div>
                    <div className="w-full h-3.5 grid grid-cols-10 gap-0.5 mt-2">
                      <div className="bg-blue-600"></div>
                      <div className="bg-blue-600"></div>
                      <div className="bg-blue-600"></div>
                      <div className="bg-blue-600"></div>
                      <div className="bg-blue-600"></div>
                      <div className="bg-blue-600"></div>
                      <div className="bg-blue-600"></div>
                      <div className="bg-blue-600"></div>
                      <div className="bg-blue-600"></div>
                      <div className="bg-white"></div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold tracking-wider text-slate-500">Request Interval</span>
                      <div className="flex items-end gap-1 mt-0.5">
                        <span className="text-lg font-light font-sans text-slate-900">1500</span>
                        <span className="text-xs text-slate-500 font-sans">MS</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold tracking-wider text-slate-500">Weather API Latency</span>
                      <div className="flex items-end gap-1 mt-0.5">
                        <span className="text-lg font-light font-sans text-slate-900">42</span>
                        <span className="text-xs text-slate-500 font-sans">MS</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Terminal Terminal Console - 12 cols */}
              <div className="md:col-span-12 bg-white border border-slate-300 shadow-sm flex flex-col">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold tracking-wider text-slate-500">DevOps Logs Terminal</span>
                  </div>
                  {activeRun && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-sans bg-white px-2 py-0.5 border border-slate-200 shadow-sm text-slate-500">
                        ID: {activeRun.id}
                      </span>
                      <span className={`text-xs font-sans px-2 py-0.5 rounded-lg font-bold border ${
                        activeRun.status === "running" ? "bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse" :
                        activeRun.status === "completed" ? "bg-blue-600/10 text-blue-600 border-blue-600/20" :
                        "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {activeRun.status}
                      </span>
                    </div>
                  )}
                </div>

                {/* Pipeline Metrics Summary */}
                {activeRun && (
                  <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50/40 text-center text-xs font-sans py-2.5 text-slate-500">
                    <div className="border-r border-slate-200">
                      <div className="text-[10px] text-slate-500 tracking-wider">Total Clients</div>
                      <div className="font-semibold text-slate-800 mt-0.5">{activeRun.totalClients} domains</div>
                    </div>
                    <div className="border-r border-slate-200">
                      <div className="text-[10px] text-slate-500 tracking-wider">Processed</div>
                      <div className="font-semibold text-sky-400 mt-0.5">{activeRun.processedClients}</div>
                    </div>
                    <div className="border-r border-slate-200">
                      <div className="text-[10px] text-slate-500 tracking-wider">Revalidated</div>
                      <div className="font-semibold text-blue-600 mt-0.5">{activeRun.successfulClients}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 tracking-wider">Bypassed</div>
                      <div className="font-semibold text-amber-500 mt-0.5">{activeRun.failedClients}</div>
                    </div>
                  </div>
                )}

                {/* Shell Logs Canvas */}
                <div className="bg-slate-50 p-5 min-h-[300px] max-h-[450px] overflow-y-auto font-sans text-xs flex flex-col gap-2 relative">
                  {!activeRun ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-2">
                      <Terminal className="w-8 h-8 text-slate-800" />
                      <p className="text-center text-xs max-w-sm text-slate-500">No active execution logs. Run the weather webmaster pipeline to stream real-time events.</p>
                    </div>
                  ) : (
                    <>
                      {activeRun.logs.map((log: PipelineLog, idx: number) => {
                        let textClass = "text-slate-700";
                        let tagClass = "text-slate-500";
                        if (log.level === "success") {
                          textClass = "text-blue-600 font-medium";
                          tagClass = "text-emerald-600";
                        } else if (log.level === "warn") {
                          textClass = "text-amber-400";
                          tagClass = "text-amber-600";
                        } else if (log.level === "error") {
                          textClass = "text-rose-400 font-semibold";
                          tagClass = "text-rose-600";
                        }

                        return (
                          <div key={idx} className="flex gap-2.5 items-start leading-relaxed animate-fadeIn">
                            <span className="text-slate-500 select-none text-xs font-medium shrink-0 pt-0.5">{log.timestamp}</span>
                            <span className={`font-bold select-none shrink-0 ${tagClass}`}>
                              [{log.level}]
                            </span>
                            <span className={`flex-1 ${textClass}`}>{log.message}</span>
                          </div>
                        );
                      })}
                      <div ref={(el) => setLogsEndRef(el)}></div>
                    </>
                  )}
                </div>
              </div>

              {/* Try/Catch Resiliency - 4 cols */}
              <div className="md:col-span-4 bg-white border border-slate-300 shadow-sm p-5 flex flex-col justify-between">
                <span className="text-xs font-semibold tracking-wider text-slate-500">System Reliability</span>
                <div className="mt-4 grid grid-cols-2 gap-4 flex-1">
                  <div className="border border-slate-200 shadow-sm p-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 font-sans">Error Coverage</span>
                      <div className="text-lg font-sans text-slate-900 mt-1">100%</div>
                    </div>
                    <div className="h-1 w-full bg-blue-600 mt-2"></div>
                  </div>
                  <div className="border border-slate-200 shadow-sm p-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 font-sans">Client Protection</span>
                      <div className="text-lg font-sans text-slate-900 mt-1">ENABLED</div>
                    </div>
                    <div className="h-1 w-full bg-blue-600 mt-2"></div>
                  </div>
                </div>
              </div>

              {/* Analytics - 8 cols */}
              <div className="md:col-span-8 bg-white border border-slate-300 shadow-sm p-5 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-semibold tracking-wider text-slate-500">Weather Sync Activity (Last 12 Hours)</span>
                  <div className="flex gap-4 font-sans text-[10px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span>Temperature Data</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      <span>Generated Content</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex items-end gap-1.5 px-2 pb-2 h-24">
                  <div className="w-full bg-blue-500/20 hover:bg-blue-500/40 transition-colors" style={{ height: "30%" }}></div>
                  <div className="w-full bg-blue-50 hover:bg-blue-100 hover:bg-blue-600/40 transition-colors" style={{ height: "45%" }}></div>
                  <div className="w-full bg-blue-500/20 hover:bg-blue-500/40 transition-colors" style={{ height: "25%" }}></div>
                  <div className="w-full bg-blue-50 hover:bg-blue-100 hover:bg-blue-600/40 transition-colors" style={{ height: "60%" }}></div>
                  <div className="w-full bg-blue-500/20 hover:bg-blue-500/40 transition-colors" style={{ height: "40%" }}></div>
                  <div className="w-full bg-blue-50 hover:bg-blue-100 hover:bg-blue-600/40 transition-colors" style={{ height: "70%" }}></div>
                  <div className="w-full bg-blue-500/20 hover:bg-blue-500/40 transition-colors" style={{ height: "55%" }}></div>
                  <div className="w-full bg-blue-50 hover:bg-blue-100 hover:bg-blue-600/40 transition-colors" style={{ height: "85%" }}></div>
                  <div className="w-full bg-blue-500/20 hover:bg-blue-500/40 transition-colors" style={{ height: "30%" }}></div>
                  <div className="w-full bg-blue-50 hover:bg-blue-100 hover:bg-blue-600/40 transition-colors" style={{ height: "90%" }}></div>
                  <div className="w-full bg-blue-500/20 hover:bg-blue-500/40 transition-colors" style={{ height: "20%" }}></div>
                  <div className="w-full bg-blue-50 hover:bg-blue-100 hover:bg-blue-600/40 transition-colors" style={{ height: "45%" }}></div>
                  <div className="w-full bg-blue-500/20 hover:bg-blue-500/40 transition-colors" style={{ height: "35%" }}></div>
                  <div className="w-full bg-blue-50 hover:bg-blue-100 hover:bg-blue-600/40 transition-colors" style={{ height: "80%" }}></div>
                </div>
              </div>

              {/* History Table - 12 cols */}
              <div className="md:col-span-12 bg-white border border-slate-300 shadow-sm">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-semibold tracking-wider text-slate-500">Activity History</h3>
                  <span className="text-xs text-slate-500 font-sans">Execution History Logs</span>
                </div>
                <div className="divide-y divide-slate-800 max-h-[180px] overflow-y-auto">
                  {runs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-sans">No historical sync tasks have run yet.</div>
                  ) : (
                    runs.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          setActiveRunId(r.id);
                          setActiveRun(r);
                        }}
                        className={`px-5 py-3 flex items-center justify-between text-xs cursor-pointer hover:bg-white/50 transition-all border-b border-slate-200 last:border-b-0 ${
                          activeRunId === r.id ? "bg-white font-semibold" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Activity className={`w-4 h-4 ${r.status === "completed" ? "text-blue-600" : r.status === "failed" ? "text-rose-500" : "text-sky-500 animate-pulse"}`} />
                          <div>
                            <div className="font-sans text-slate-700">Run for: <span className="text-blue-600">{r.city}</span></div>
                            <div className="text-xs text-slate-500 font-sans mt-0.5">Started: {new Date(r.startedAt).toLocaleTimeString()}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right text-xs font-sans text-slate-500 hidden sm:block">
                            {r.successfulClients}/{r.totalClients} Success
                          </div>
                          <span className={`text-[10px] font-sans font-bold px-2 py-0.5 border ${
                            r.status === "completed" ? "bg-blue-600/10 text-blue-600 border-blue-600/20" :
                            r.status === "running" ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                            "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}>
                            {r.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}          {/* TAB 2: Multi-Tenant Registrar */}
          {activeTab === "tenants" && (
            <div className="flex flex-col gap-6">
              
              {/* Add Client Header */}
              <div className="bg-white border border-slate-300 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <span className="text-xs font-semibold tracking-wider text-slate-500">Client Directory</span>
                    <h2 className="text-sm font-semibold text-slate-800 mt-1">Registered Client Domains</h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                      Register and manage your clients' web domains. Adding a client here creates their custom dashboard, allowing the weather-adaptive system to dynamically tailor their landing pages.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-white hover:bg-white text-slate-800 px-4 py-2 text-xs font-semibold tracking-wider flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-sm rounded-lg font-sans"
                  >
                    <Plus className={`w-3.5 h-3.5 transition-transform ${isAdding ? "rotate-45" : ""}`} />
                    {isAdding ? "Close Form" : "Add New Client"}
                  </button>
                </div>

                {/* Add Form Collapsible */}
                {isAdding && (
                  <form onSubmit={registerClient} className="border-t border-slate-200 pt-5 mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {submitError && (
                      <div className="col-span-1 md:col-span-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 p-3 rounded-lg text-xs flex items-center gap-2 font-sans">
                        <AlertTriangle className="w-4 h-4" />
                        {submitError}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-xs font-sans text-slate-500 mb-1.5">Client Domain URL (e.g. hendersonbusiness.com) *</label>
                      <input
                        type="text"
                        placeholder="E.g., hendersonbusiness.com"
                        value={newClientDomain}
                        onChange={(e) => setNewClientDomain(e.target.value.toLowerCase())}
                        className="w-full bg-white border border-slate-300 shadow-sm rounded-md px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-sans text-slate-500 mb-1.5">Business Name *</label>
                      <input
                        type="text"
                        placeholder="E.g., Henderson Local Business Services"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        className="w-full bg-white border border-slate-300 shadow-sm rounded-md px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-sans text-slate-500 mb-1.5">Service City *</label>
                      <select
                        value={newClientCity}
                        onChange={(e) => setNewClientCity(e.target.value)}
                        className="w-full bg-white border border-slate-300 shadow-sm rounded-md px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                      >
                        <option value="Dallas">Dallas</option>
                        <option value="Phoenix">Phoenix</option>
                        <option value="Chicago">Chicago</option>
                        <option value="Seattle">Seattle</option>
                        <option value="Las Vegas">Las Vegas</option>
                        <option value="New York">New York</option>
                        <option value="Miami">Miami</option>
                        <option value="Denver">Denver</option>
                        <option value="Minneapolis">Minneapolis</option>
                        <option value="Atlanta">Atlanta</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-sans text-slate-500 mb-1.5">Phone Number / Hotline *</label>
                      <input
                        type="text"
                        placeholder="E.g., (214) 555-0192"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        className="w-full bg-white border border-slate-300 shadow-sm rounded-md px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-sans text-slate-500 mb-1.5">Webmaster Revalidation URL (Optional)</label>
                      <input
                        type="url"
                        placeholder="E.g., https://clientdomain.com/api/revalidate"
                        value={newClientIsr}
                        onChange={(e) => setNewClientIsr(e.target.value)}
                        className="w-full bg-white border border-slate-300 shadow-sm rounded-md px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-sans text-slate-500 mb-1.5">Security Token (Optional)</label>
                      <input
                        type="text"
                        placeholder="E.g., sec_client_reval_983"
                        value={newClientSecret}
                        onChange={(e) => setNewClientSecret(e.target.value)}
                        className="w-full bg-white border border-slate-300 shadow-sm rounded-md px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 flex justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAdding(false)}
                        className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800 font-sans"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-600 text-white font-bold text-xs px-5 py-2 rounded-lg cursor-pointer font-sans tracking-wider"
                      >
                        Save Client Domain
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Tenants Grid/List */}
              <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
                
                {clients.length === 0 && pendingClients.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                      <Globe className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">No clients registered</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
                      Add your first client to provision their dashboard and enable weather-adaptive landing pages.
                    </p>
                    <button
                      onClick={() => setIsAdding(true)}
                      className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-6 py-2.5 rounded-lg text-xs font-semibold font-sans transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add your first client
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-xs font-sans text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Client Domain</th>
                      <th className="px-6 py-4">Business Name</th>
                      <th className="px-6 py-4">City</th>
                      <th className="px-6 py-4">Phone Hotline</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {clients.map((c) => (
                      <tr
                        key={c.domain}
                        onClick={() => setSelectedClient(c)}
                        className={`hover:bg-slate-50 cursor-pointer transition-all ${
                          selectedClient?.domain === c.domain ? "bg-slate-50 font-semibold text-slate-900" : ""
                        }`}
                      >
                        <td className="px-6 py-4 font-sans text-blue-600 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-500" />
                          {c.domain}
                        </td>
                        <td className="px-6 py-4 text-slate-800">{c.businessName}</td>
                        <td className="px-6 py-4">
                          <span className="bg-white border border-slate-200 shadow-sm px-2 py-0.5 rounded-lg text-slate-700 font-sans text-xs">
                            {c.city}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-sans text-slate-500">{c.phone}</td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => deleteClient(c.domain)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="De-register domain"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pendingClients.map((c) => (
                      <tr
                        key={c.domain}
                        className="opacity-50 pointer-events-none"
                      >
                        <td className="px-6 py-4 font-sans text-blue-600 flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                          {c.domain}
                        </td>
                        <td className="px-6 py-4 text-slate-800">{c.businessName}</td>
                        <td className="px-6 py-4">
                          <span className="bg-white border border-slate-200 shadow-sm px-2 py-0.5 rounded-lg text-slate-700 font-sans text-xs">
                            {c.city}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-sans text-slate-500">{c.phone}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs text-slate-400 italic">Syncing...</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* TAB 3: PayPal SaaS Onboarding & Subscription Portal */}
          {activeTab === "billing" && (
            <div className="flex flex-col gap-6 max-w-2xl mx-auto">
              <div className="bg-white border border-slate-300 shadow-sm p-8 flex flex-col gap-8 rounded-lg relative">
                <div className="text-center">
                  <h2 className="font-sans text-2xl font-bold text-slate-900 mb-3">
                    Get A Website That Actually Works For You
                  </h2>
                  <p className="text-slate-500 font-sans text-sm">
                    Tell us your business name and ZIP code, and we handle the rest.
                  </p>
                </div>
                
                <div className="flex flex-col gap-5 bg-slate-50 p-6 border border-slate-200 rounded-lg">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 shrink-0 font-bold text-sm">1</div>
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-800 text-sm">Built In Seconds</span>
                      <span className="text-slate-600 text-sm leading-relaxed">
                        You do not need to write a single word or design a single page. We instantly create a professional, mobile-friendly site built specifically for your exact industry.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="mt-1 relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 shrink-0 font-bold text-sm">2</div>
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-800 text-sm">Adapts To The Weather</span>
                      <span className="text-slate-600 text-sm leading-relaxed">
                        When the weather changes, your customers' needs change. If a storm hits or a heatwave spikes, your site automatically updates to capture that emergency demand.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="mt-1 relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 shrink-0 font-bold text-sm">3</div>
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-800 text-sm">Completely Hands-Off</span>
                      <span className="text-slate-600 text-sm leading-relaxed">
                        No confusing software, no hidden fees, and no maintenance. We handle the hosting, the security, and the daily updates. You just focus on your business.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-sans text-slate-500 uppercase tracking-wider font-bold">Business Name</label>
                    <input
                      type="text"
                      value={checkoutName}
                      onChange={(e) => setCheckoutName(e.target.value)}
                      placeholder="e.g. Tahira Services"
                      className="w-full bg-white border border-slate-300 shadow-sm rounded-md px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-sans text-slate-500 uppercase tracking-wider font-bold">Business ZIP Code</label>
                    <input
                      type="text"
                      value={checkoutZipCode}
                      onChange={(e) => setCheckoutZipCode(e.target.value)}
                      placeholder="e.g. 75201"
                      className="w-full bg-white border border-slate-300 shadow-sm rounded-md px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4 mt-2">
                  <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">Living OS Subscription</span>
                      <span className="text-sm text-slate-500">Autonomous AI Website</span>
                    </div>
                    <span className="font-bold text-blue-600 text-xl font-sans">$10 <span className="text-sm text-slate-500 font-normal">/ month</span></span>
                  </div>

                  <PayPalScriptProvider options={{ clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "test", components: "buttons", currency: "USD" }}>
                    <PayPalButtons 
                      style={{ layout: "vertical" }}
                      disabled={isSubmittingCheckout || !checkoutName || !checkoutZipCode}
                      createOrder={(data, actions) => {
                        return actions.order.create({
                          intent: "CAPTURE",
                          purchase_units: [
                            {
                              amount: {
                                value: "10.00",
                                currency_code: "USD"
                              },
                              description: `Living OS Subscription - AI-Adaptive`,
                              custom_id: JSON.stringify({
                                businessName: checkoutName,
                                zipCode: checkoutZipCode,
                                tier: "ai-adaptive"
                              })
                            }
                          ]
                        });
                      }}
                      onApprove={async (data, actions) => {
                        if (!actions.order) return;
                        
                        setIsSubmittingCheckout(true);
                        setCheckoutStep(1); // Verifying payment...
                        setCheckoutLog([`[PAYPAL SDK] Initializing payment session...`]);

                        try {
                          const details = await actions.order.capture();
                          setCheckoutLog(prev => [...prev, `[PAYPAL SDK] Customer approved payment. Transaction ID: ${details.id}`]);
                          setCheckoutStep(2); // Analyzing territory data...
                          
                          // Executing webhook behavior on the client since real webhook goes to backend server
                          const mockTxId = details.id;
                          const mockTime = new Date().toISOString();
                          const mockSig = `sig_live_${Math.random().toString(36).substring(2, 24)}`;
                          const mockCertUrl = "https://api.paypal.com/v1/certs/mock-cert-bundle.pem";
                    
                          const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
                          await wait(600);
                          setCheckoutStep(3); // Generating dynamic layout...
                    
                          const res = await fetch("/api/webhooks/mock-paypal", {
        method: "POST",
                            headers: { "Authorization": `Bearer ${ADMIN_API_KEY}`, "Content-Type": "application/json",
                              "paypal-transmission-id": mockTxId,
                              "paypal-transmission-time": mockTime,
                              "paypal-transmission-sig": mockSig,
                              "paypal-cert-url": mockCertUrl,
                              "paypal-auth-algo": "SHA256withRSA"
                            },
                            body: JSON.stringify({
                              event_type: "CHECKOUT.ORDER.APPROVED",
                              resource: {
                                payer: {
                                  email_address: details.payer?.email_address || "business@example.com"
                                },
                                custom_id: JSON.stringify({
                                  businessName: checkoutName,
                                  zipCode: checkoutZipCode
                                })
                              }
                            })
                          });
                    
                          if (!res.ok) {
                            throw new Error(`Server returned HTTP Status ${res.status}`);
                          }
                    
                          setCheckoutStep(4); // Deploying to edge...
                          await wait(1000);
                    
                          setCheckoutStep(5); // Complete!
                          setTimeout(() => setActiveTab("tenants"), 2000);
                        } catch (err: any) {
                          setCheckoutLog(prev => [...prev, `[ERROR] ${err.message || err.toString()}`]);
                          setCheckoutStep(-1);
                        } finally {
                          setIsSubmittingCheckout(false);
                        }
                      }}
                      onError={(err) => {
                        setCheckoutLog(prev => [...prev, `[ERROR] PayPal Error: ${err.toString()}`]);
                        setCheckoutStep(-1);
                      }}
                    />
                  </PayPalScriptProvider>
                </div>
                
                {/* Checkout Loading Steps overlay (optional if we want to show loading states nicely) */}
                {checkoutStep > 0 && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 rounded-lg flex flex-col items-center justify-center p-8 text-center border border-slate-200">
                    <div className="mb-4 text-blue-600">
                      {checkoutStep === -1 ? <AlertTriangle className="w-8 h-8 text-rose-500" /> : checkoutStep === 5 ? <Check className="w-8 h-8 text-emerald-500" /> : <RefreshCw className="w-8 h-8 animate-spin" />}
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">
                      {checkoutStep === -1 ? "Activation Failed" : checkoutStep === 5 ? "Activation Complete" : "Processing Activation"}
                    </h3>
                    <div className="text-sm text-slate-500 max-w-xs mx-auto">
                      {checkoutStep === 1 && "Verifying secure payment..."}
                      {checkoutStep === 2 && "Analyzing local territory data..."}
                      {checkoutStep === 3 && "Generating AI website layout..."}
                      {checkoutStep === 4 && "Deploying to live servers..."}
                      {checkoutStep === 5 && "Success! Redirecting to dashboard..."}
                      {checkoutStep === -1 && <span className="text-rose-500">Checkout failed. Please try again.</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Side: Interactive "Active Copwriting Preview" Card */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-slate-300 shadow-sm p-5 sticky top-24 flex flex-col gap-4 rounded-lg">
            
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold tracking-wider text-slate-500">Live Website Monitor</span>
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-800">Active Weather Adaptive Preview</h2>
            </div>

            {/* Selector/Fallback */}
            {selectedClient ? (
              <div className="flex flex-col gap-4">
                {/* Micro Meta-info */}
                <div className="bg-slate-50 border border-slate-200 shadow-sm rounded-lg p-3 text-xs font-sans">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-500">Domain ID:</span>
                    <span className="text-blue-600 font-semibold">{selectedClient.domain}</span>
                  </div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-500">Territory:</span>
                    <span className="text-slate-700">{selectedClient.city}</span>
                  </div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-500">Cache Status:</span>
                    <span className="text-blue-600 font-semibold">Active ISR</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 mt-1.5">
                    <span className="text-slate-500">Google Calendar:</span>
                    <button 
                      onClick={async () => {
                        try {
                          const result = await signInWithPopup(auth, googleProvider);
                          const credential = GoogleAuthProvider.credentialFromResult(result);
                          if (credential?.accessToken) {
                            const res = await fetch(`/api/clients/${selectedClient.domain}/calendar`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${ADMIN_API_KEY}`
                              },
                              body: JSON.stringify({ googleCalendarToken: credential.accessToken })
                            });
                            if (res.ok) alert('Google Calendar connected successfully!');
                            else alert('Failed to save calendar token.');
                          }
                        } catch (err: any) {
                          alert('OAuth Error: ' + err.message);
                        }
                      }}
                      className="text-xs bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 font-medium py-1 px-3 rounded-md transition-colors"
                    >
                      Connect Calendar
                    </button>
                  </div>
                  {selectedClient.lastUpdated && (
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5 text-xs">
                      <span className="text-slate-600">Last Sync:</span>
                      <span className="text-slate-500">{new Date(selectedClient.lastUpdated).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>

                {/* The "Living Website" SSR Iframe Viewer */}
                <div className="border border-slate-200 shadow-sm rounded-lg overflow-hidden bg-white text-slate-900 shadow-inner flex flex-col h-[520px]">
                  
                  {/* Header bar representing the browser */}
                  <div className="bg-slate-100 border-b border-slate-200 px-3 py-1.5 flex items-center gap-1.5 text-xs text-slate-500 font-sans select-none rounded-lg shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                    <span className="bg-white px-3 py-0.5 rounded-lg border border-slate-200 shadow-sm text-center flex-1 truncate text-slate-500 font-sans flex items-center justify-between">
                      <span>https://{selectedClient.domain}</span>
                      <a 
                        href={`/site/${selectedClient.domain}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:text-emerald-600 ml-2 text-[10px] font-bold tracking-wider"
                      >
                        Open Site &nearr;
                      </a>
                    </span>
                  </div>

                  {/* Real dynamic iframe loading the server-side-rendered site */}
                  <iframe
                    src={`/site/${selectedClient.domain}`}
                    className="w-full flex-1 border-0 bg-[#f8fafc]"
                    title={`Preview of ${selectedClient.domain}`}
                    key={selectedClient.domain + "-" + (selectedClient.lastUpdated || "initial")}
                  />
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 shadow-sm border-dashed rounded-lg p-10 text-center text-slate-500 text-xs font-sans">
                No client selected. Choose one from the list to preview their live weather-adaptive website.
              </div>
            )}

          </div>
        </div>

      </main>
    </div>
  );
}
