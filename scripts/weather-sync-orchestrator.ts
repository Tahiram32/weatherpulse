import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchWeatherDataWithFallback } from "../meteorological-sync-engine";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

// 1. Parse Firebase Configuration File
let firebaseConfig: any = {};
try {
  const configPath = path.join(rootDir, "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } else {
    console.warn("⚠️ firebase-applet-config.json not found. Attempting to fall back to environment variables.");
  }
} catch (err: any) {
  console.error("⚠️ Failed to parse firebase-applet-config.json:", err.message);
}

const projectId = process.env.GCP_PROJECT_ID || firebaseConfig.projectId;
const databaseId = process.env.GCP_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "(default)";

// 2. Initialize Firebase Admin SDK for GitHub Action Context
let adminApp;
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (serviceAccountKey && serviceAccountKey.trim() !== "") {
  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId
    });
    console.log("🔒 Firebase Admin initialized with Service Account Key.");
  } catch (err: any) {
    console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY secret:", err.message);
    process.exit(1);
  }
} else {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required in GitHub runner context.");
  process.exit(1);
}

const db = getFirestore(adminApp, databaseId);

// 3. Resolve Execution Parameters
const appBaseUrl = process.env.APP_BASE_URL;
const taskWorkerSecret = process.env.TASK_WORKER_SECRET || "sec_default_task_secret";

if (!appBaseUrl) {
  console.error("❌ APP_BASE_URL environment variable is required (e.g. 'https://your-app-url.run.app').");
  process.exit(1);
}

// Ensure base URL has no trailing slash
const normalizedBaseUrl = appBaseUrl.endsWith("/") ? appBaseUrl.slice(0, -1) : appBaseUrl;

async function runOrchestrator() {
  console.log("🚀 Starting GitHub Action Multi-Tenant Weather Ingestion Orchestrator...");
  const startTime = Date.now();
  const logRefId = `sync_gh_${Date.now()}`;
  const runLogRef = db.collection("runs").doc(logRefId);

  // Helper to append a log line to our live UI tracing document
  const addLog = async (level: "info" | "success" | "warn" | "error", message: string) => {
    console.log(`[${level.toUpperCase()}] ${message}`);
    try {
      const snap = await runLogRef.get();
      if (snap.exists) {
        const runData = snap.data() as any;
        runData.logs.push({
          timestamp: new Date().toLocaleTimeString(),
          level,
          message
        });
        await runLogRef.set(runData);
      }
    } catch (err: any) {
      console.error("Failed to append Firestore trace log:", err.message);
    }
  };

  try {
    // A. Query active tenants from Firestore database
    const snapshot = await db.collection("clients").get();
    if (snapshot.empty) {
      console.log("ℹ️ No active clients registered. Exiting clean.");
      return;
    }

    const clients = snapshot.docs.map(doc => doc.data() as any);
    
    // B. Create the initial Trace Tracker document for real-time React UI polling
    const initialRunLog = {
      status: "processing",
      startedAt: new Date().toISOString(),
      completedAt: null,
      queueMode: "github-actions",
      totalClients: clients.length,
      processedClients: 0,
      successfulClients: 0,
      failedClients: 0,
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          level: "info",
          message: `Initiating GitHub-Actions Orchestration runner for ${clients.length} registered tenants.`
        }
      ]
    };
    await runLogRef.set(initialRunLog);
    console.log(`📡 Trace log registered under runId: ${logRefId}`);

    // C. Group clients by city to avoid redundant weather API consumption
    const citiesMap = new Map<string, any[]>();
    for (const client of clients) {
      const cityKey = client.city.toLowerCase().trim();
      if (!citiesMap.has(cityKey)) {
        citiesMap.set(cityKey, []);
      }
      citiesMap.get(cityKey)!.push(client);
    }

    await addLog("info", `Fetching weather context for ${citiesMap.size} distinct service zones...`);
    
    // D. Fetch weather data for each city zone
    const weatherProfiles = new Map<string, any>();
    for (const cityName of citiesMap.keys()) {
      try {
        const weather = await fetchWeatherDataWithFallback(cityName, (msg) => {
          console.log(`[WeatherService - ${cityName}] ${msg}`);
        });
        weatherProfiles.set(cityName, weather);
      } catch (weatherErr: any) {
        await addLog("error", `Could not fetch weather metrics for zone '${cityName}': ${weatherErr.message}`);
      }
    }

    // E. Filter and prepare the mutation worker queue
    const mutationQueue = clients.map(client => {
      const cityKey = client.city.toLowerCase().trim();
      const weather = weatherProfiles.get(cityKey);
      return { client, weather };
    }).filter(item => item.weather !== undefined);

    if (mutationQueue.length === 0) {
      await addLog("error", "No active tenants could be processed due to complete geocoding or meteorological ingestion blockages.");
      await runLogRef.set({
        ...initialRunLog,
        status: "failed",
        completedAt: new Date().toISOString()
      }, { merge: true });
      return;
    }

    const concurrencyLimit = Number(process.env.WEATHER_SYNC_CONCURRENCY) || 1;
    const throttleMs = Number(process.env.WEATHER_SYNC_THROTTLE_MS) || 14000;

    await addLog("info", `Prepared mutation queue. Concurrency limit: ${concurrencyLimit}, Stagger Throttle: ${throttleMs}ms. Invoking ${mutationQueue.length} isolated tenant worker endpoints...`);

    let activeCount = 0;

    // Helper to execute a single task worker endpoint
    const runTaskWorker = async (task: any, index: number) => {
      const { client, weather } = task;
      const domain = client.domain;
      await addLog("info", `[Queue ${index + 1}/${mutationQueue.length}] Launching concurrent webhook trigger for: ${domain} (City: ${client.city} | Temp: ${weather.temp}°F)`);

      try {
        const workerUrl = `${normalizedBaseUrl}/api/pipeline/task-worker`;
        const response = await fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${taskWorkerSecret}`
          },
          body: JSON.stringify({
            domain,
            weather,
            runLogRefId: logRefId
          })
        });

        if (!response.ok) {
          const bodyText = await response.text();
          throw new Error(`Worker HTTP ${response.status}: ${bodyText}`);
        }

        const resData = await response.json();
        console.log(`✅ [Worker Success] Tenant ${domain} completed successfully:`, resData);
      } catch (err: any) {
        await addLog("error", `[Worker Failed] Micro-tenant mutation failed for ${domain}: ${err.message}`);
        
        // Thread-safe update of run statistics in Firestore
        try {
          await db.runTransaction(async (transaction) => {
            const docSnap = await transaction.get(runLogRef);
            if (docSnap.exists) {
              const runData = docSnap.data() as any;
              runData.processedClients = (runData.processedClients || 0) + 1;
              runData.failedClients = (runData.failedClients || 0) + 1;
              if (runData.processedClients >= runData.totalClients) {
                runData.status = "completed";
                runData.completedAt = new Date().toISOString();
              }
              transaction.set(runLogRef, runData);
            }
          });
        } catch (updateErr: any) {
          console.error(`Failed to update run stats for ${domain}:`, updateErr.message);
        }
      }
    };

    // Sliding-Window Dispatch Queue
    // This loop executes sequentially to space out dispatches via throttleMs, avoiding timer heap bloat,
    // while strictly holding back new triggers if we are at our concurrency ceiling (preventing EMFILE / socket starvation)
    for (let i = 0; i < mutationQueue.length; i++) {
      // 1. Apply backpressure: If active worker count is at capacity, block dispatch until a slot opens
      while (activeCount >= concurrencyLimit) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // 2. Pace the dispatch: Enforce throttle delay one task at a time (at most one setTimeout in Event Loop at any moment)
      if (i > 0 && throttleMs > 0) {
        await new Promise(resolve => setTimeout(resolve, throttleMs));
      }

      const task = mutationQueue[i];
      activeCount++;

      // Dispatch asynchronously without awaiting
      runTaskWorker(task, i).finally(() => {
        activeCount--;
      });
    }

    // 3. Block main orchestrator termination until the final worker thread resolves
    while (activeCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Fetch final status to audit failures and log summarized feedback
    const finalSnap = await runLogRef.get();
    const finalData = finalSnap.exists ? finalSnap.data() : null;
    const totalFailed = finalData ? (finalData.failedClients || 0) : 0;
    
    if (totalFailed > 0) {
      await addLog("warn", `⚠️ GitHub Actions Meteorological Sync completed with ${totalFailed} client failure(s). Micro-level tenant exceptions are isolated; main orchestrator workflow completed successfully.`);
      await runLogRef.set({
        status: "completed",
        completedAt: new Date().toISOString()
      }, { merge: true });
      // Clear exit with code 0 to keep CI/CD pipelines healthy and resilient
      process.exit(0);
    } else {
      await addLog("success", `🎉 GitHub Actions Meteorological Sync Orchestration completed with 100% success in ${elapsed}s!`);
      await runLogRef.set({
        status: "completed",
        completedAt: new Date().toISOString()
      }, { merge: true });
      process.exit(0);
    }

  } catch (fatalErr: any) {
    console.error("❌ Fatal Orchestrator Error:", fatalErr.message);
    try {
      const snap = await runLogRef.get();
      if (snap.exists) {
        const runData = snap.data() as any;
        runData.status = "failed";
        runData.completedAt = new Date().toISOString();
        runData.logs.push({
          timestamp: new Date().toLocaleTimeString(),
          level: "error",
          message: `FATAL ORCHESTRATOR ERROR: ${fatalErr.message}`
        });
        await runLogRef.set(runData);
      }
    } catch (logErr: any) {
      console.error("Could not write fatal error trace:", logErr.message);
    }
    process.exit(1);
  }
}

runOrchestrator();
