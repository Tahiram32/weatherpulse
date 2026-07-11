/**
 * LIVING WEBSITE AI SYSTEMS — METEOROLOGICAL SYNC ENGINE
 * Production-Grade GCP Cloud Function & Autonomous Cron Handler
 * 
 * DESIGN SPECIFICATIONS:
 * 1. Ingest: Dual-API real-time weather ingestion with zero key requirements.
 *    - Primary: Open-Meteo API (Latitude/Longitude lookup).
 *    - Secondary: US National Weather Service API (api.weather.gov) for authoritative real-time US telemetry.
 * 2. Contextualize: Scans Firestore to map active multi-tenant HVAC domains matching the atmospheric impact zones.
 * 3. Generate: Directs Gemini-3.5-Flash utilizing native schema-enforced structured JSON to rewrite homepage assets.
 * 4. Mutate: Atomically commits the generated copy back to Firestore tenants.
 * 5. Revalidate: Fires secure edge revalidation signals with jittered delays to instantly flush Cloudflare edge cache safely.
 */

import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CloudTasksClient } from "@google-cloud/tasks";

dotenv.config();

// Resolve paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase Config
let firebaseConfig: any = {};
try {
  const configPath = path.join(__dirname, "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (err: any) {
  console.error("⚠️ [CONFIG] Failed to read firebase-applet-config.json:", err.message);
}

// Initialize Firebase Admin SDK prioritizing cloud-native ADC in production
const isProduction = (process.env.NODE_ENV === "production" || !!process.env.K_SERVICE || !!process.env.K_REVISION) && !process.env.APPLET_ID;
let adminApp;

if (isProduction) {
  adminApp = getApps().length === 0 ? initializeApp({
    projectId: firebaseConfig.projectId
  }) : getApp();
} else {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey && serviceAccountKey.trim() !== "") {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      adminApp = getApps().length === 0 ? initializeApp({
        credential: cert(serviceAccount),
        projectId: firebaseConfig.projectId
      }) : getApp();
    } catch (err: any) {
      console.error(`⚠️ [INIT] Service account credential initialization failed: ${err.message}`);
      adminApp = getApps().length === 0 ? initializeApp({
        projectId: firebaseConfig.projectId
      }) : getApp();
    }
  } else {
    adminApp = getApps().length === 0 ? initializeApp({
      projectId: firebaseConfig.projectId
    }) : getApp();
  }
}

const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId || "(default)");

// Initialize Gemini SDK with User-Agent telemetry
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

// Global process-level circuit breaker tracker to coordinate rate limits across concurrent task worker threads
let globalCircuitBreakerActiveUntil = 0;

/**
 * Robust wrapper around Gemini generateContent with automatic retry on 429 / RESOURCE_EXHAUSTED errors.
 * Implements exponential backoff with random jitter and a global process-level circuit breaker
 * to avoid thundering herd retry storms when hitting API rate limits.
 */
async function generateContentWithRetry(aiClient: any, params: any, maxRetries = 5, initialDelayMs = 12000): Promise<any> {
  let attempt = 0;
  let delay = initialDelayMs;
  while (true) {
    // 1. Cooperative Check-in: Wait if the global circuit breaker has been tripped by another thread
    const now = Date.now();
    if (globalCircuitBreakerActiveUntil > now) {
      const waitMs = globalCircuitBreakerActiveUntil - now;
      console.warn(`⏳ [CIRCUIT BREAKER ENFORCED] API rate limits active. Pausing request execution for ${(waitMs / 1000).toFixed(2)}s to preserve system resources...`);
      await sleep(waitMs);
    }

    try {
      return await aiClient.models.generateContent(params);
    } catch (err: any) {
      attempt++;
      const errStr = JSON.stringify(err).toLowerCase();
      const errMsg = (err?.message || "").toLowerCase();
      const isRateLimit = 
        errMsg.includes("429") || 
        errMsg.includes("resource_exhausted") || 
        errMsg.includes("quota") ||
        errMsg.includes("rate") ||
        errStr.includes("429") ||
        errStr.includes("resource_exhausted") ||
        errStr.includes("quota") ||
        err?.statusCode === 429 ||
        err?.code === 429 ||
        err?.error?.code === 429 ||
        err?.error?.status === "RESOURCE_EXHAUSTED";
        
      if (isRateLimit) {
        // 2. Trip Global Circuit Breaker immediately for all workers to freeze outbound API calls
        const cooldownMs = 60000; // Freeze for 60s
        globalCircuitBreakerActiveUntil = Date.now() + cooldownMs;
        console.warn(`🚨 [CIRCUIT BREAKER TRIPPED] 429 Quota Exceeded. Activated global process circuit breaker for 60s!`);

        if (attempt <= maxRetries) {
          const jitter = Math.random() * 2000; // 0 to 2 seconds of random jitter
          const currentDelay = delay + jitter;
          console.warn(`⚠️ [GEMINI-RATE-LIMIT] Attempt ${attempt}/${maxRetries}. Retrying this thread in ${(currentDelay / 1000).toFixed(2)}s...`);
          await sleep(currentDelay);
          delay *= 2.0; // Exponential backoff
          continue;
        }
      }
      throw err;
    }
  }
}

// Weather Copy Schema definition
const weatherCopySchema = {
  type: Type.OBJECT,
  properties: {
    heroTitle: {
      type: Type.STRING,
      description: "Atmospherically-driven display title. Must incorporate current temperature, severe weather alerts, or thermal conditions beautifully with the HVAC brand."
    },
    heroSubtitle: {
      type: Type.STRING,
      description: "An engaging sub-headline summarizing current humidity/strain relief and pushing a clear CTA with the dispatcher phone."
    },
    alertBanner: {
      type: Type.STRING,
      description: "Critical red-alert banner copy for extreme heat (>=95°F) or severe cold (<=32°F). Empty string if weather is moderate."
    },
    seoHeading: {
      type: Type.STRING,
      description: "Educational H2 header detailing how current weather metrics (such as high humidity or subzero freeze) directly strain HVAC coils."
    },
    seoArticle: {
      type: Type.STRING,
      description: "A highly educational 120-150 word article guiding home-owners on filter maintenance, emergency services, and energy conservation."
    },
    promotions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 2 to 3 seasonal or crisis-based deals (e.g., '$49 Emergency Freeze Assessment')."
    },
    cacheTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of custom Edge cache tag invalidation targets (e.g. ['weather-update', 'homepage'])."
    }
  },
  required: ["heroTitle", "heroSubtitle", "alertBanner", "seoHeading", "seoArticle", "promotions", "cacheTags"]
};

// Helper: Stagger/Delay utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Strict Atmospheric Normalization Layer
 * Resolves API variations into a clean, unified, enterprise-standard Meteorological Profile.
 */
export interface WeatherMetrics {
  temp: number;       // Fahrenheit
  condition: string;  // Unified condition text
  humidity: number;   // % Relative Humidity (0-100)
  isExtreme: boolean; // Priority Warning Active
  source: string;     // Ingestion source
}

function normalizeWeatherData(raw: any, source: string): WeatherMetrics {
  let temp = 72;
  let humidity = 45;
  let condition = "Moderate Clear";
  let isExtreme = false;

  if (source === "WeatherAPI.com") {
    temp = raw.current?.temp_f ?? 72;
    humidity = raw.current?.humidity ?? 45;
    condition = raw.current?.condition?.text ?? "Clear";
    isExtreme = temp >= 95 || temp <= 32 || condition.toLowerCase().includes("blizzard") || condition.toLowerCase().includes("warning") || condition.toLowerCase().includes("severe");
  } else if (source === "Open-Meteo API") {
    temp = raw.current?.temperature_2m ?? 72;
    humidity = raw.current?.relative_humidity_2m ?? 45;
    const code = raw.current?.weather_code ?? 0;
    
    if (code === 0) condition = "Sunny and Clear";
    else if ([1, 2, 3].includes(code)) condition = "Partly Cloudy";
    else if ([45, 48].includes(code)) condition = "Damp Fog";
    else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) condition = "Heavy Rain & Humid";
    else if ([71, 73, 75, 77, 85, 86].includes(code)) condition = "Blizzard/Freezing Conditions";
    else if ([95, 96, 99].includes(code)) condition = "Severe Thunderstorms & Outages";
    else condition = "Clear";
    
    isExtreme = temp >= 95 || temp <= 32 || code >= 95;
  } else if (source === "US National Weather Service API") {
    temp = raw.temp ?? 72;
    condition = raw.condition ?? "Clear";
    humidity = raw.humidity ?? 45;
    isExtreme = temp >= 95 || temp <= 32 || condition.toLowerCase().includes("warning") || condition.toLowerCase().includes("severe") || condition.toLowerCase().includes("blizzard") || condition.toLowerCase().includes("freeze");
  }

  return {
    temp: Number(temp.toFixed(1)),
    condition: condition.trim(),
    humidity: Math.round(humidity),
    isExtreme,
    source
  };
}

/**
 * Fault-tolerant Meteorological Ingestion Service
 * Tries WeatherAPI (Enterprise Paid SLA), falls back to Open-Meteo, then US National Weather Service (api.weather.gov).
 * Eliminates historical averages to ensure real-time extreme thermal warnings are caught.
 */
export async function fetchWeatherDataWithFallback(cityName: string, logger: (msg: string) => void): Promise<WeatherMetrics> {
  const normalizedCity = cityName.trim().toLowerCase();
  let latitude = 36.0397; // Default Henderson, NV
  let longitude = -114.9819;

  // 1. Geocode the city name to get coordinates
  try {
    const geoController = new AbortController();
    const geoTimeout = setTimeout(() => geoController.abort(), 5000);
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, { signal: geoController.signal });
    clearTimeout(geoTimeout);

    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData.results && geoData.results.length > 0) {
        latitude = geoData.results[0].latitude;
        longitude = geoData.results[0].longitude;
        logger(`🗺️ [GEOC] Resolved '${cityName}' to Lat ${latitude.toFixed(4)}, Lon ${longitude.toFixed(4)}`);
      }
    }
  } catch (err: any) {
    logger(`⚠️ [GEOC] Primary geocoder failed: ${err.message || err}. Using baseline coordinates.`);
  }

  // 2. Try Ingestion Source 0: WeatherAPI.com (Paid Enterprise SLA)
  const weatherApiKey = process.env.WEATHER_API_KEY;
  if (weatherApiKey && weatherApiKey.trim() !== "" && weatherApiKey !== "MY_WEATHER_API_KEY") {
    try {
      logger(`🔌 [INGEST-SLA] Attempting WeatherAPI.com enterprise query for '${cityName}'...`);
      const slaController = new AbortController();
      const slaTimeout = setTimeout(() => slaController.abort(), 5000);
      const url = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${encodeURIComponent(cityName)}`;
      const res = await fetch(url, { signal: slaController.signal });
      clearTimeout(slaTimeout);

      if (res.ok) {
        const raw = await res.json();
        if (raw.current) {
          const normalized = normalizeWeatherData(raw, "WeatherAPI.com");
          logger(`✅ [INGEST-SLA] WeatherAPI.com Telemetry: ${normalized.temp}°F | ${normalized.condition} | Humidity: ${normalized.humidity}%`);
          return normalized;
        }
      } else {
        logger(`⚠️ [INGEST-SLA] WeatherAPI.com returned non-OK status: HTTP ${res.status}`);
      }
    } catch (err: any) {
      logger(`⚠️ [INGEST-SLA] WeatherAPI.com enterprise query failed: ${err.message || err}`);
    }
  } else {
    logger(`ℹ️ [INGEST-SLA] WeatherAPI.com key not set. Skipping enterprise tier.`);
  }

  // 3. Try Ingestion Source A: Open-Meteo
  try {
    logger(`🔌 [INGEST-A] Attempting Open-Meteo query for coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)})...`);
    const weatherController = new AbortController();
    const weatherTimeout = setTimeout(() => weatherController.abort(), 6000);
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&temperature_unit=fahrenheit`;
    const weatherRes = await fetch(weatherUrl, { signal: weatherController.signal });
    clearTimeout(weatherTimeout);

    if (!weatherRes.ok) throw new Error(`Open-Meteo response not OK: HTTP ${weatherRes.status}`);
    const rawWeather = await weatherRes.json();

    if (rawWeather.current) {
      const normalized = normalizeWeatherData(rawWeather, "Open-Meteo API");
      logger(`✅ [INGEST-A] Open-Meteo Telemetry: ${normalized.temp}°F | ${normalized.condition} | Humidity: ${normalized.humidity}%`);
      return normalized;
    }
  } catch (err: any) {
    logger(`⚠️ [INGEST-A] Open-Meteo query failed: ${err.message || err}.`);
  }

  // 4. Try Ingestion Source B: US National Weather Service (api.weather.gov)
  // Configured with rigid contact telemetry headers to safeguard against federal IP ban hammers
  try {
    logger(`🔌 [INGEST-B] Falling back to US National Weather Service for coords (${latitude.toFixed(4)}, ${longitude.toFixed(4)})...`);
    const pointsController = new AbortController();
    const pointsTimeout = setTimeout(() => pointsController.abort(), 6000);
    
    // NWS requires a specific, valid contact User-Agent
    const headers = { "User-Agent": "LivingWebsiteSyncEngine/1.0 (contact@livingwebsite.ai)" };
    const pointsUrl = `https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsRes = await fetch(pointsUrl, { headers, signal: pointsController.signal });
    clearTimeout(pointsTimeout);

    if (pointsRes.ok) {
      const pointsData = await pointsRes.json();
      const forecastUrl = pointsData.properties?.forecast;

      if (forecastUrl) {
        const forecastController = new AbortController();
        const forecastTimeout = setTimeout(() => forecastController.abort(), 6000);
        const forecastRes = await fetch(forecastUrl, { headers, signal: forecastController.signal });
        clearTimeout(forecastTimeout);

        if (forecastRes.ok) {
          const forecastData = await forecastRes.json();
          const periods = forecastData.properties?.periods;
          if (periods && periods.length > 0) {
            const currentPeriod = periods[0];
            const temp = currentPeriod.temperature;
            const condition = currentPeriod.shortForecast || "Clear";
            const isFahrenheit = currentPeriod.temperatureUnit === "F";
            const tempF = isFahrenheit ? temp : (temp * 9/5) + 32;

            const normalized = normalizeWeatherData({
              temp: tempF,
              condition,
              humidity: currentPeriod.relativeHumidity?.value || 35
            }, "US National Weather Service API");

            logger(`✅ [INGEST-B] US National Weather Service Telemetry: ${normalized.temp}°F | ${normalized.condition}`);
            return normalized;
          }
        }
      }
    }
  } catch (err: any) {
    logger(`⚠️ [INGEST-B] US National Weather Service fallback query failed: ${err.message || err}`);
  }

  // 5. Critical Escalation: Throw error so we do not mutate with stale averages.
  throw new Error(`Meteorological Ingestion Service completely offline. All telemetry queries failed.`);
}

/**
 * Concurrency-Controlled Task Processor (Sliding Window / Dynamic Pool)
 * Processes active tasks in parallel up to a strict concurrency limit.
 * This guarantees low execution time while preventing API rate limits.
 */
async function processTasksWithLimit<T, R>(
  items: T[],
  concurrencyLimit: number,
  taskFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      try {
        results[index] = await taskFn(item, index);
      } catch (err) {
        console.error(`Error in task worker at index ${index}:`, err);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrencyLimit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// Lazy Cloud Tasks Client initialization
let tasksClient: any = null;
function getCloudTasksClient() {
  if (!tasksClient) {
    if (process.env.GCP_PROJECT_ID && process.env.GCP_LOCATION_ID && process.env.GCP_QUEUE_ID) {
      try {
        tasksClient = new CloudTasksClient();
      } catch (err: any) {
        console.error("⚠️ [GCP-TASKS] Failed to initialize Google Cloud Tasks Client:", err.message);
      }
    }
  }
  return tasksClient;
}

/**
 * Enqueues an execution payload to GCP Cloud Tasks queue.
 */
export async function enqueueCloudTask(payload: { domain: string, weather: any, runLogRefId?: string }): Promise<string> {
  const projectId = process.env.GCP_PROJECT_ID;
  const locationId = process.env.GCP_LOCATION_ID;
  const queueId = process.env.GCP_QUEUE_ID;
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const secret = process.env.TASK_WORKER_SECRET || "sec_default_task_secret";

  const workerUrl = `${appUrl}/api/pipeline/task-worker`;

  const client = getCloudTasksClient();
  if (client && projectId && locationId && queueId) {
    const parent = client.queuePath(projectId, locationId, queueId);
    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: workerUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
    };
    const [response] = await client.createTask({ parent, task });
    return response.name || "unnamed-task";
  } else {
    throw new Error("GCP Cloud Tasks is not fully configured in environment.");
  }
}

/**
 * Simulates asynchronous queue execution in background microtask loops,
 * guaranteeing instantaneous HTTP returns and eliminating Cloud Run timeouts.
 */
function simulateAsyncTaskExecution(payload: { domain: string, weather: any, runLogRefId: string }, index: number) {
  const staggerMs = index * 14000;
  setTimeout(async () => {
    try {
      console.log(`[SIM-TASK-QUEUE] Launching background worker for ${payload.domain}...`);
      await executeSingleClientSyncTask(payload.domain, payload.weather, payload.runLogRefId);
    } catch (err: any) {
      console.error(`[SIM-TASK-QUEUE-ERROR] Background worker failed for ${payload.domain}:`, err.message);
      
      const runLogRef = db.collection("runs").doc(payload.runLogRefId);
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(runLogRef);
        if (docSnap.exists) {
          const runData = docSnap.data() as any;
          runData.processedClients = (runData.processedClients || 0) + 1;
          runData.failedClients = (runData.failedClients || 0) + 1;
          runData.logs.push({
            timestamp: new Date().toLocaleTimeString(),
            level: "error",
            message: `[Distributed Task FAIL] Background worker failed for ${payload.domain}: ${err.message}`
          });
          if (runData.processedClients >= runData.totalClients) {
            runData.status = "completed";
            runData.completedAt = new Date().toISOString();
          }
          transaction.set(runLogRef, runData);
        }
      });
    }
  }, staggerMs);
}

/**
 * Core Meteorological Execution Loop
 * Supports both distributed Cloud Tasks queue handoff and legacy synchronous sequential runs.
 */
export async function executeMeteorologicalSync(options?: { queueMode?: "simulated" | "gcp-tasks" | "monolithic" | "distributed" }) {
  let queueMode = options?.queueMode || "simulated";
  const startTime = Date.now();
  const logRefId = `sync_${Date.now()}`;
  const runLogRef = db.collection("runs").doc(logRefId);
  
  const runLog = {
    id: logRefId,
    status: "running",
    queueMode,
    startedAt: new Date().toISOString(),
    completedAt: "",
    totalClients: 0,
    processedClients: 0,
    successfulClients: 0,
    failedClients: 0,
    logs: [] as any[]
  };

  const addLog = async (level: "info" | "warn" | "error" | "success", message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    runLog.logs.push({ timestamp, level, message });
    console.log(`[SYNC-ENGINE - ${logRefId}] ${message}`);
    try {
      await runLogRef.set(runLog);
    } catch (e) {
      console.error("Failed to commit sync log:", e);
    }
  };

  // Backwards compatibility mapping for legacy 'distributed' triggers
  if (queueMode === "distributed") {
    const isCloudTasksConfigured = !!(process.env.GCP_PROJECT_ID && process.env.GCP_LOCATION_ID && process.env.GCP_QUEUE_ID);
    queueMode = isCloudTasksConfigured ? "gcp-tasks" : "simulated";
    runLog.queueMode = queueMode;
  }

  await addLog("info", `Starting High-Scale Meteorological Ingestion & Copy-mutation task in [${queueMode.toUpperCase()}] mode...`);

  try {
    // 1. Fetch Tenants
    const clientsCol = db.collection("clients");
    const snapshot = await clientsCol.get();
    
    if (snapshot.empty) {
      await addLog("warn", "No active HVAC clients registered in database. Aborting.");
      runLog.status = "completed";
      runLog.completedAt = new Date().toISOString();
      await runLogRef.set(runLog);
      return { status: "no_clients" };
    }

    const clients = snapshot.docs.map(doc => doc.data());
    runLog.totalClients = clients.length;
    await addLog("info", `Discovered ${clients.length} active tenant HVAC website(s) in system.`);

    // Group clients by city to avoid duplicate weather API queries
    const citiesMap = new Map<string, any[]>();
    for (const client of clients) {
      const cityLower = client.city.toLowerCase().trim();
      if (!citiesMap.has(cityLower)) {
        citiesMap.set(cityLower, []);
      }
      citiesMap.get(cityLower)!.push(client);
    }

    // 2. Resolve weather context for all target impact zones in parallel
    await addLog("info", `Resolving normalized weather profiles for ${citiesMap.size} distinct impact zones...`);
    const weatherProfiles = new Map<string, WeatherMetrics>();
    
    await Promise.all(
      Array.from(citiesMap.keys()).map(async (cityName) => {
        try {
          const weather = await fetchWeatherDataWithFallback(cityName, (msg) => {
            console.log(`[Weather Service - ${cityName}] ${msg}`);
          });
          weatherProfiles.set(cityName, weather);
        } catch (weatherErr: any) {
          console.error(`Failed to resolve weather profile for ${cityName}:`, weatherErr.message);
        }
      })
    );

    // Filter out clients whose weather profiles failed completely (protects state from corruption)
    const mutationQueue = clients.map(client => {
      const cityLower = client.city.toLowerCase().trim();
      const weather = weatherProfiles.get(cityLower);
      return { client, weather };
    }).filter(item => item.weather !== undefined);

    const skippedCount = clients.length - mutationQueue.length;
    if (skippedCount > 0) {
      await addLog("warn", `Skipped ${skippedCount} clients due to catastrophic ingestion failure to protect current state from corruption.`);
    }

    if (mutationQueue.length === 0) {
      throw new Error(`All target impact zone telemetry queries failed. Aborting mutation run.`);
    }

    // 3. EXECUTION DISPATCH PATH
    if (queueMode === "simulated" || queueMode === "gcp-tasks") {
      await addLog("info", `Initiating background task queue dispatching for ${mutationQueue.length} tenant(s)...`);
      
      const isCloudTasksConfigured = !!(process.env.GCP_PROJECT_ID && process.env.GCP_LOCATION_ID && process.env.GCP_QUEUE_ID);
      const useRealCloudTasks = queueMode === "gcp-tasks" && isCloudTasksConfigured;

      if (useRealCloudTasks) {
        await addLog("info", `📡 Dispatching real asynchronous tasks to GCP Cloud Tasks Queue '${process.env.GCP_QUEUE_ID}'...`);
      } else if (queueMode === "gcp-tasks") {
        await addLog("warn", `⚠️ GCP Cloud Tasks requested, but credentials are not configured in environment. Automatically falling back to High-Fidelity Local Simulation Queue.`);
      } else {
        await addLog("success", `⚡ Utilizing High-Fidelity Local Task Simulator (100% Free - no GCP setup, credentials, or billing required).`);
      }

      for (let i = 0; i < mutationQueue.length; i++) {
        const item = mutationQueue[i];
        const payload = {
          domain: item.client.domain,
          weather: item.weather,
          runLogRefId: logRefId
        };

        if (useRealCloudTasks) {
          try {
            const taskName = await enqueueCloudTask(payload);
            await addLog("info", `[Enqueued] Sent task for ${item.client.domain} to Cloud Tasks: ${taskName}`);
          } catch (taskErr: any) {
            await addLog("error", `[Enqueued Fail] Could not send task for ${item.client.domain} to Cloud Tasks: ${taskErr.message}. Falling back to local simulation thread.`);
            simulateAsyncTaskExecution(payload, i);
          }
        } else {
          simulateAsyncTaskExecution(payload, i);
        }
      }

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
      await addLog("success", `🚀 Successfully dispatched all task jobs to the ${useRealCloudTasks ? "GCP Cloud Tasks" : "Local Simulated"} queue. (Elapsed: ${elapsedSeconds}s)`);
      
      return { status: "success", runId: logRefId, elapsedSeconds, queueMode, totalTasks: mutationQueue.length };
    }

    // 4. LEGACY MONOLITHIC MONITORED LOOP (If specifically chosen)
    const CONCURRENCY_LIMIT = Number(process.env.WEATHER_SYNC_CONCURRENCY) || 1;
    const THROTTLE_MS = Number(process.env.WEATHER_SYNC_THROTTLE_MS) || 14000;
    await addLog("info", `Spawning monolithic task executor with concurrency limit of ${CONCURRENCY_LIMIT} and throttle spacing of ${THROTTLE_MS}ms...`);

    await processTasksWithLimit(mutationQueue, CONCURRENCY_LIMIT, async (task, index) => {
      const { client, weather } = task;
      const clientIndex = index + 1;
      
      if (index > 0 && THROTTLE_MS > 0) {
        await addLog("info", `Throttling to respect rate limits. Waiting ${THROTTLE_MS / 1000} seconds before next mutation...`);
        await sleep(THROTTLE_MS);
      }
      
      await addLog("info", `[Queue ${clientIndex}/${runLog.totalClients}] Processing mutations for tenant: ${client.domain} (${client.city})...`);

      try {
        await executeSingleClientSyncTask(client.domain, weather);
        await addLog("success", `[Queue ${clientIndex}/${runLog.totalClients}] Mutated and invalidated cache for: ${client.domain}`);
        runLog.processedClients++;
        runLog.successfulClients++;
      } catch (clientErr: any) {
        runLog.processedClients++;
        runLog.failedClients++;
        await addLog("error", `[Queue ${clientIndex}/${runLog.totalClients}] Failed to complete weather-mutation pipeline for client ${client.domain}: ${clientErr.message}`);
      }
    });

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    runLog.completedAt = new Date().toISOString();
    runLog.status = "completed";
    await runLogRef.set(runLog);
    
    if (runLog.failedClients > 0) {
      await addLog("warn", `⚠️ Monolithic Meteorological Sync Engine completed with ${runLog.failedClients} micro-tenant failure(s) in ${elapsedSeconds}s. Run completed successfully overall.`);
      return { status: "success", runId: logRefId, elapsedSeconds, warnings: `${runLog.failedClients} client failure(s)` };
    } else {
      await addLog("success", `🎉 Monolithic Meteorological Sync Engine completed successfully in ${elapsedSeconds}s! Dispatched updates for ${runLog.successfulClients}/${runLog.totalClients} tenants.`);
      return { status: "success", runId: logRefId, elapsedSeconds };
    }
  } catch (err: any) {
    runLog.status = "failed";
    runLog.completedAt = new Date().toISOString();
    await addLog("error", `FATAL: Meteorological Sync Engine crashed: ${err.message}`);
    await runLogRef.set(runLog);
    throw err;
  }
}

/**
 * Dead-Letter Notification & Alerting system.
 * Persists persistent exceptions into a high-visibility collection in Firestore,
 * and publishes real-time critical payloads to Slack/Discord webhook if configured.
 */
export async function createDeadLetterAlert(domain: string, error: any, runLogRefId?: string) {
  const alertPayload = {
    domain,
    runLogRefId: runLogRefId || "manual-or-individual",
    timestamp: new Date().toISOString(),
    errorMessage: error?.message || "Unknown error",
    errorStack: error?.stack || "",
    severity: "critical",
    resolved: false
  };

  try {
    // 1. Persist alert to Firestore "alerts" collection for admin tracking
    await db.collection("alerts").add(alertPayload);
    console.warn(`🚨 [ALERT LOGGED] Created Dead-Letter Alert in Firestore for domain: ${domain}`);
  } catch (dbErr: any) {
    console.error(`Failed to record Dead-Letter Alert to Firestore: ${dbErr.message}`);
  }

  // 2. Dispatch real-time notification webhook to Slack/Discord/PagerDuty if configured
  const webhookUrl = process.env.WEATHER_SYNC_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 *[CRITICAL METEOROLOGICAL ENGINE ALERT]*\n*Domain:* \`${domain}\`\n*Run ID:* \`${runLogRefId || "N/A"}\`\n*Error:* \`${alertPayload.errorMessage}\`\n*Stack Trace:* \`\`\`${alertPayload.errorStack.slice(0, 800)}\`\`\``
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      console.log(`📡 [ALERT WEBHOOK DISPATCHED] Successfully pushed real-time alert for ${domain}.`);
    } catch (whErr: any) {
      console.error(`Failed to dispatch real-time alert webhook: ${whErr.message}`);
    }
  }
}

/**
 * Processes a single tenant weather update task in complete isolation.
 * Can be called by real Cloud Tasks HTTP workers or local simulation queue.
 */
export async function executeSingleClientSyncTask(domain: string, weather: any, runLogRefId?: string) {
  try {
    const clientDocRef = db.collection("clients").doc(domain);
    const docSnap = await clientDocRef.get();
    if (!docSnap.exists) {
      throw new Error(`Client domain '${domain}' not found in database.`);
    }
    const client = docSnap.data() as any;

    let updatedCopy = null;

    if (hasRealApiKey) {
      const prompt = `
        As "The Living Website" autonomous AI Webmaster, analyze the weather in ${client.city} and mutate the landing page copy for "${client.businessName}".
        
        Current Metrics:
        - Temperature: ${weather.temp}°F
        - Humidity: ${weather.humidity}%
        - Conditions: ${weather.condition}
        - Extreme Alert Active: ${weather.isExtreme ? "YES (Priority Dispatch Alert Required)" : "NO"}
        - Feed Source: ${weather.source}
        
        Brand Details:
        - Brand Name: "${client.businessName}"
        - Service Area: ${client.city}
        - Dispatch Phone: ${client.phone}
        
        Requirements:
        1. If Extreme Weather is true, make the heroTitle and alertBanner intense and immediate (preventing AC breakdown, frozen lines, or furnace lockout).
        2. Keep promotions realistic and centered around tune-ups, filter swaps, and capacitor diagnostics.
        3. Write a high-quality educational seoArticle of exactly 120-150 words that integrates SEO keywords organically.
      `;

      const result = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: weatherCopySchema,
          temperature: 0.75,
        }
      });

      const rawText = result.text;
      if (!rawText) throw new Error("Gemini returned empty response text.");
      updatedCopy = JSON.parse(rawText.trim());
    } else {
      // Local Sandbox template builder
      const isHot = weather.temp >= 85;
      const isCold = weather.temp <= 45;

      let hTitle = `Keep Your Home Comfortable: Professional cooling by ${client.businessName}`;
      let hSub = `Same-day scheduling and emergency dispatch available in ${client.city}. Call ${client.phone} now.`;
      let alertText = "";
      let sHeading = `How Humidity Affects Your AC Performance in ${client.city}`;
      let sArticle = `As humidity levels shift, residential systems work double-duty to both cool the atmosphere and dry the indoor airflow. High moisture builds condenser friction and reduces motor efficiency. Trust local experts at ${client.businessName} to optimize your cooling flow.`;
      let promoList = ["$49 Professional Precision Tune-Up", "Free Condensate Clear with AC Tune-up"];

      if (isHot) {
        hTitle = `Scorching ${weather.temp}°F ${client.city} Heat: Same-Day Cooling dispatch from ${client.businessName}!`;
        hSub = `Beat the severe humidity and keep your house dry and ice-cold. Emergency AC repair on standby: Call ${client.phone}.`;
        alertText = `HEAT ADVISORY ACTIVE: Rapid response technicians dispatched in ${client.city} county.`;
        promoList = ["$39 Rapid Diagnostic Dispatch", "Free AC Filter Upgrade"];
      } else if (isCold) {
        hTitle = `Severe Cold Alert in ${client.city}: Keep Warm with ${client.businessName}`;
        hSub = `Failing furnace? Pipes freezing? Talk to a live HVAC technician now at ${client.phone}.`;
        alertText = `WINTER WARNING: Priority heating dispatch is active. Call for emergency support.`;
        promoList = ["$49 Furnace Safety Diagnostic", "$500 Off High-Efficiency Replacements"];
      }

      updatedCopy = {
        heroTitle: hTitle,
        heroSubtitle: hSub,
        alertBanner: alertText,
        seoHeading: sHeading,
        seoArticle: sArticle,
        promotions: promoList,
        cacheTags: ["weather-update", "homepage"]
      };
    }

    // Mutate client doc in Firestore
    await clientDocRef.update({
      lastWeatherCopy: updatedCopy,
      lastUpdated: new Date().toISOString(),
      lastTelemetry: {
        temp: weather.temp,
        condition: weather.condition,
        humidity: weather.humidity,
        source: weather.source
      }
    });

    // Revalidate edge cache
    if (client.isrUrl && client.isrSecret) {
      try {
        const isMockDomain = ["hendersonhvac.com", "desertbreeze-cooling.com", "windycityheating.com", "cascadeclimate.com"].some(
          (mockDom) => domain.toLowerCase().includes(mockDom)
        );

        if (isMockDomain) {
          await sleep(300);
        } else {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          await fetch(client.isrUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${client.isrSecret}`
            },
            body: JSON.stringify({
              tags: updatedCopy.cacheTags,
              domain
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        }
      } catch (revalErr: any) {
        console.warn(`Edge invalidation warning for ${domain}: ${revalErr.message}`);
      }
    }

    // Update Run Logs if active tracking run is supplied (thread-safe Transaction)
    if (runLogRefId) {
      const runLogRef = db.collection("runs").doc(runLogRefId);
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(runLogRef);
        if (docSnap.exists) {
          const runData = docSnap.data() as any;
          runData.processedClients = (runData.processedClients || 0) + 1;
          runData.successfulClients = (runData.successfulClients || 0) + 1;
          
          runData.logs.push({
            timestamp: new Date().toLocaleTimeString(),
            level: "success",
            message: `[Task Worker OK] Dispatched mutations successfully for: ${domain}`
          });

          if (runData.processedClients >= runData.totalClients) {
            runData.status = (runData.failedClients || 0) > 0 ? "failed" : "completed";
            runData.completedAt = new Date().toISOString();
          }
          transaction.set(runLogRef, runData);
        }
      });
    }

    return { success: true, domain };
  } catch (err: any) {
    // Fire-and-forget real-time Dead-Letter Alerting & Monitoring
    createDeadLetterAlert(domain, err, runLogRefId).catch(alertErr => {
      console.error("Failed to process dead-letter alert chain:", alertErr.message);
    });

    if (runLogRefId) {
      try {
        const runLogRef = db.collection("runs").doc(runLogRefId);
        await db.runTransaction(async (transaction) => {
          const docSnap = await transaction.get(runLogRef);
          if (docSnap.exists) {
            const runData = docSnap.data() as any;
            runData.processedClients = (runData.processedClients || 0) + 1;
            runData.failedClients = (runData.failedClients || 0) + 1;
            
            runData.logs.push({
              timestamp: new Date().toLocaleTimeString(),
              level: "error",
              message: `[Task Worker FAIL] Failed to process ${domain}: ${err.message}`
            });

            if (runData.processedClients >= runData.totalClients) {
              runData.status = "failed";
              runData.completedAt = new Date().toISOString();
            }
            transaction.set(runLogRef, runData);
          }
        });
      } catch (logErr: any) {
        console.error(`Failed to record task worker error in runs log: ${logErr.message}`);
      }
    }
    throw err;
  }
}
