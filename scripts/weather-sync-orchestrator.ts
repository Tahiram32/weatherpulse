import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchWeatherDataWithFallback } from "../meteorological-sync-engine";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: "https://3c1f0ea8bc5863a12af537980c760142@o4511737188581376.ingest.us.sentry.io/4511737209421826",
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

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
    const serviceAccount = JSON.parse(serviceAccountKey.trim());
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    adminApp = getApps().length === 0 ? initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId
    }) : getApps()[0];
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
const appBaseUrl = process.env.APP_BASE_URL || process.env.APP_URL;
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

    // E. Prepare the mutation queue incorporating Delta-Trigger and state optimization
    const mutationQueue: any[] = [];
    let skippedCount = 0;

    for (const client of clients) {
      const cityKey = client.city.toLowerCase().trim();
      const weather = weatherProfiles.get(cityKey);
      if (!weather) continue;

      const lastTelemetry = client.lastTelemetry;
      const lastWeatherCopy = client.lastWeatherCopy;

      let shouldMutate = true;
      let skipReason = "";

      if (lastTelemetry && lastWeatherCopy) {
        const lastTemp = lastTelemetry.temp ?? 0;
        const lastIsExtreme = !!lastTelemetry.isExtreme;
        const currentTemp = weather.temp;
        const currentIsExtreme = !!weather.isExtreme;

        const tempDiff = Math.abs(currentTemp - lastTemp);
        const extremeChanged = currentIsExtreme !== lastIsExtreme;

        // Calculate hours elapsed since the last successful LLM mutation
        let hoursSinceLastMutation = 24; // Default to 24 to force run if timestamp is missing
        if (client.lastUpdated) {
          const lastUpdatedTime = new Date(client.lastUpdated).getTime();
          hoursSinceLastMutation = (Date.now() - lastUpdatedTime) / (1000 * 60 * 60);
        }

        const isTtlExpired = hoursSinceLastMutation >= 24;

        // Trigger mutation if delta temperature >= 10F OR extreme weather status shifts OR 24h TTL has expired
        if (tempDiff < 10 && !extremeChanged && !isTtlExpired) {
          shouldMutate = false;
          skipReason = `Temp shift (${tempDiff.toFixed(1)}°F) < 10°F, Extreme status unchanged, and last mutation was only ${hoursSinceLastMutation.toFixed(1)} hours ago (24h TTL active).`;
        }
      }

      if (shouldMutate) {
        mutationQueue.push({ client, weather });
      } else {
        skippedCount++;
        // Log immediately as skipped in the run logs to preserve resources
        try {
          await db.runTransaction(async (transaction) => {
            const docSnap = await transaction.get(runLogRef);
            if (docSnap.exists) {
              const runData = docSnap.data() as any;
              runData.processedClients = (runData.processedClients || 0) + 1;
              runData.successfulClients = (runData.successfulClients || 0) + 1;
              if (!runData.logs) runData.logs = [];
              runData.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                level: "info",
                message: `[Orchestrator Delta Skip] Skipped ${client.domain}: ${skipReason} Saved Gemini API & Edge Cache costs.`
              });
              if (runData.processedClients >= runData.totalClients) {
                runData.status = (runData.failedClients || 0) > 0 ? "failed" : "completed";
                runData.completedAt = new Date().toISOString();
              }
              transaction.set(runLogRef, runData);
            }
          });
        } catch (skipErr: any) {
          console.error(`Failed to log skipped client ${client.domain}:`, skipErr.message);
        }
      }
    }

    if (mutationQueue.length === 0) {
      await addLog("info", `All ${clients.length} tenants matched current meteorological profiles. Complete Delta-Trigger avoidance achieved: zero workers spawned.`);
      await runLogRef.set({
        ...initialRunLog,
        status: "completed",
        processedClients: clients.length,
        successfulClients: clients.length,
        completedAt: new Date().toISOString()
      }, { merge: true });
      return;
    }

    const concurrencyLimit = Number(process.env.WEATHER_SYNC_CONCURRENCY) || 1;
    const throttleMs = Number(process.env.WEATHER_SYNC_THROTTLE_MS) || 14000;

    await addLog("info", `Prepared mutation queue. Concurrency limit: ${concurrencyLimit}, Stagger Throttle: ${throttleMs}ms. Invoking ${mutationQueue.length} isolated tenant worker endpoints (Skipped ${skippedCount} idle zones)...`);

    let activeCount = 0;
    let orchestratorPausedUntil = 0;
    let lastDispatchTime = 0;
    const maxAttempts = 3;

    // Convert mutationQueue to dynamic task items
    const tasksToProcess = mutationQueue.map((item, index) => ({
      ...item,
      index,
      attempts: 0
    }));

    const recordTaskFailure = async (domain: string, message: string) => {
      try {
        await db.runTransaction(async (transaction) => {
          const docSnap = await transaction.get(runLogRef);
          if (docSnap.exists) {
            const runData = docSnap.data() as any;
            runData.processedClients = (runData.processedClients || 0) + 1;
            runData.failedClients = (runData.failedClients || 0) + 1;
            
            if (!runData.logs) runData.logs = [];
            runData.logs.push({
              timestamp: new Date().toLocaleTimeString(),
              level: "error",
              message: `[Orchestrator Permanent FAIL] Failed to process ${domain}: ${message}`
            });

            if (runData.processedClients >= runData.totalClients) {
              runData.status = (runData.failedClients || 0) > 0 ? "failed" : "completed";
              runData.completedAt = new Date().toISOString();
            }
            transaction.set(runLogRef, runData);
          }
        });
      } catch (updateErr: any) {
        console.error(`Failed to update run stats for ${domain}:`, updateErr.message);
      }
    };

    const dispatchNext = async () => {
      // 1. If the orchestrator is paused due to an active circuit breaker state, do not dequeue
      const now = Date.now();
      if (orchestratorPausedUntil > now) {
        return;
      }

      // 2. Enforce concurrency limit and stop if queue is empty
      if (activeCount >= concurrencyLimit || tasksToProcess.length === 0) {
        return;
      }

      // 3. Respect stagger throttle delay between dispatches
      const timeSinceLastDispatch = now - lastDispatchTime;
      if (timeSinceLastDispatch < throttleMs) {
        return;
      }

      // Dequeue next task
      const task = tasksToProcess.shift();
      if (!task) return;

      activeCount++;
      lastDispatchTime = Date.now();

      const { client, weather, index } = task;
      const domain = client.domain;

      await addLog("info", `[Orchestrator Dispatch] Launching worker trigger for: ${domain} (Attempt ${task.attempts + 1}/${maxAttempts})`);

      // Spawn asynchronously (non-blocking thread execution)
      (async () => {
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

          if (response.status === 429) {
            const bodyText = await response.text();
            throw { isRateLimit: true, message: `HTTP 429 rate limit returned by worker: ${bodyText}` };
          }

          if (!response.ok) {
            const bodyText = await response.text();
            throw new Error(`Worker HTTP ${response.status}: ${bodyText}`);
          }

          const resData = await response.json();
          console.log(`✅ [Worker Success] Tenant ${domain} completed successfully:`, resData);
        } catch (err: any) {
          if (err?.isRateLimit) {
            const cooldownSeconds = 60;
            orchestratorPausedUntil = Date.now() + (cooldownSeconds * 1000);
            await addLog("warn", `🚨 [ORCHESTRATOR CIRCUIT BREAKER TRIPPED] Worker for ${domain} reported Gemini rate-limit. Pausing all launches for ${cooldownSeconds}s...`);

            if (task.attempts < maxAttempts - 1) {
              task.attempts++;
              // Put back at the beginning of the queue to retry immediately when cooldown expires
              tasksToProcess.unshift(task);
              await addLog("info", `🔄 [RE-QUEUED] Re-enqueuing task for ${domain} for post-cooldown retry.`);
            } else {
              await addLog("error", `❌ [ABANDONED] Max retries (${maxAttempts}) exceeded for rate-limited domain: ${domain}`);
              await recordTaskFailure(domain, `Max rate-limiting retries reached: ${err.message}`);
            }
          } else {
            // Permanent non-429 error (e.g. invalid client data, geocode issue). Do not retry.
            await addLog("error", `[Worker Permanent Failed] Micro-tenant mutation failed for ${domain}: ${err.message}`);
            await recordTaskFailure(domain, err.message);
          }
        } finally {
          activeCount--;
          triggerDispatch();
        }
      })();

      // Recurse/check next slot
      triggerDispatch();
    };

    const triggerDispatch = () => {
      setTimeout(dispatchNext, 50);
    };

    // Drive the scheduling engine
    while (tasksToProcess.length > 0 || activeCount > 0) {
      triggerDispatch();
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
