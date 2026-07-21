# Production Deployment

Weatherpulse is built to be deployed in scalable containerized environments or Serverless platforms (e.g. Vercel, Google Cloud Run).

## Standard CI/CD (GitHub Actions)
The repository includes a `.github/workflows/weather-sync.yml` file that automates the synchronization process using cron triggers. 

### Secrets Required
You must provision the following secrets in your environment:
- `FIREBASE_SERVICE_ACCOUNT_KEY`: The JSON credential for Firestore access.
- `GEMINI_API_KEY`: The key for the AI Micro-Climate prediction models.

## Self-Hosted (Docker/Kubernetes)
*Documentation for Kubernetes manifests and Helm charts is slated for Q3. See Roadmap for details.*
