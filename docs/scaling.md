# Scaling Strategies

Weatherpulse is built from the ground up for high-throughput scaling without hitting API rate limits.

## Background Polling Loop
To avoid being banned by third-party weather providers (like Open-Meteo), Weatherpulse uses a custom `p-limit` sliding window concurrency orchestrator. 

## Threshold Triggers
Telemetry is parsed in memory and only written to Firestore if it deviates beyond a defined threshold (e.g. AQI spikes > 50, Temperature drifts > 5°F). This reduces database write costs by up to 94%.

## Future Enterprise Scaling (Q3)
- Migration from GitHub Actions cron to Google Cloud Tasks for infinite worker pool expansion.
- Kubernetes deployment manifests for dedicated micro-services.
