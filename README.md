# Weatherpulse Sync Engine

Weatherpulse is a multi-tenant application that synchronizes weather data for a fleet of clients. 

It queries local weather conditions and dispatches background tasks to update client dashboards based on severe weather fluctuations.

## Features
- **Multi-Tenant Architecture**: Safely isolates data across independent clients.
- **Asynchronous Dispatcher**: Polling-based background jobs with rate limiting.
- **Sentry Integration**: Error tracking and performance monitoring.

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

## 🤝 Contributing
Contributions are welcome! Please read `CONTRIBUTING.md` for guidelines on setting up the dev environment, running tests, and submitting pull requests.

This project follows the Contributor Covenant Code of Conduct.

## 📄 License
This project is licensed under the MIT License — see the LICENSE file for details.

## ❤️ Sponsor This Project
Weatherpulse is free, open-source software maintained in spare time. Sponsorship directly funds:

- 🛠️ New features — AI Micro-Climate radar, smarter analysis, and deeper integrations
- 🐛 Bug fixes and maintenance to keep the enterprise tool reliable
- 📖 Documentation and examples to help more teams adopt it
- 🌍 Community support — answering issues, reviewing PRs, and growing the ecosystem

If this tool saves your team from a breaking release, consider supporting its development:

→ [Sponsor @Tahiram32 on GitHub](https://github.com/sponsors/Tahiram32)

Every contribution — no matter the size — helps keep this project alive and moving forward. Thank you! 🙏
