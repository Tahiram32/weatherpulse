# API Reference

The Weatherpulse Synchronizer uses an internal module execution pattern, but exposes the following interfaces for external consumption:

## Core Interfaces

### `WeatherMetrics`
```typescript
export interface WeatherMetrics {
  temp: number;       
  condition: string;  
  humidity: number;   
  isExtreme: boolean; 
  source: string;     
  aqi?: number;
  uvIndex?: number;
  surgeMultiplier?: number;
  microClimateAlert?: string;
}
```

### `TenantClient`
```typescript
export interface TenantClient {
  domain: string;
  businessName: string;
  city: string;
  phone: string;
  isActive: boolean;
  lastTelemetry?: WeatherMetrics;
}
```
