# Meteorological Weather Sync Engine

Meteorological Weather Sync Engine is a multi-tenant application that autonomously orchestrates and syncs real-time extreme meteorological data for a fleet of isolated clients. 

It queries weather conditions for various geographical zones and dispatches asynchronous tasks (via Firebase and custom worker endpoints) to update client dashboards based on severe weather fluctuations.

## Features
- **Multi-Tenant Architecture**: Safely isolates and syncs weather data across various independent clients.
- **Asynchronous Dispatcher**: Efficient polling-based concurrency engine that respects rate limits without starving the event loop.
- **Sentry Integrated**: Full observability into backend event-loops, background workers, and frontend UI errors.

## Quickstart

**Prerequisites:** Node.js v20+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Setup environment variables:
   Configure your environment variables (Firebase, Gemini API, Weather API keys) based on `.env.example`.
3. Start the application locally:
   ```bash
   npm run dev
   ```

## Sentry Telemetry 👁️

This project utilizes Sentry for full-stack observability:
- **Backend Orchestrator**: Uses `@sentry/node` and `@sentry/profiling-node` to trace execution time, CPU spikes, and ensure the background worker pool never encounters event-loop starvation.
- **Frontend**: Uses `@sentry/react` to capture client-side dashboard anomalies and session replays.
