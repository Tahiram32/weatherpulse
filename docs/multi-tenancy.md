# Multi-Tenancy Engine

Weatherpulse securely handles client data through strict logical separation at the database level.

## Domain-Based Routing
Every tenant is keyed uniquely in Firestore via their `domain`. This prevents cross-tenant data leakage and enables O(1) query lookups when synchronizing telemetry for thousands of websites simultaneously.

## Data Isolation
- **Tenant Client Records**: Secured in the `clients` collection. Only accessible via authenticated admin dashboards or the internal webhook orchestrator.
- **Frontend Hydration**: External sites only receive their specific `lastTelemetry` snapshot when hydrating the server-side UI.
