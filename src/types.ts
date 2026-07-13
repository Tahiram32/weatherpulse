/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WeatherCopy {
  heroTitle: string;
  heroSubtitle: string;
  alertBanner: string;
  seoHeading: string;
  seoArticle: string;
  promotions: string[];
  cacheTags: string[];
}

export interface HVACClient {
  domain: string; // Document ID (e.g. 'hendersonhvac.com')
  businessName: string;
  city: string;
  phone: string;
  isrUrl?: string;
  isrSecret?: string;
  createdAt?: string;
  vertical?: string; // e.g. "Roofing", "HVAC", "Plumbing", "Solar", "Pool Maintenance"
  trigger_type?: string; // e.g. "Meteorological_Anomalies", "Thermal_Thresholds", "Precipitation_Spikes", "Storm_Surges"
  primary_triggers?: string[]; // e.g. ["wind_speed > 35", "hail_probability > 50"]
  emergencyCopyFocus?: string; // e.g. "Emergency tarping and hail damage repairs"
  themeColor?: string; // e.g. "blue", "emerald", "amber", "red", "cyan", "slate", "purple", "orange"
  icon?: string; // e.g. "wind", "droplets", "thermometer", "sun", "snowflake", "shield", "home", "wrench"
  lastUpdated?: string;
  syndicateEnabled?: boolean;
  lastWeatherCopy?: WeatherCopy;
  lastTelemetry?: {
    temp: number;
    condition: string;
    humidity: number;
    wind_speed?: number;
    precipitation?: number;
    hail_probability?: number;
    isExtreme: boolean;
    isTriggerFired?: boolean;
    source?: string;
  };
}

export interface WeatherMetrics {
  temp: number;
  condition: string;
  humidity: number;
  isExtreme: boolean;
  advice: string;
}

export interface PipelineLog {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export interface PipelineRun {
  id: string;
  status: "idle" | "running" | "completed" | "failed";
  city: string;
  startedAt: string;
  completedAt?: string;
  totalClients: number;
  processedClients: number;
  successfulClients: number;
  failedClients: number;
  logs: PipelineLog[];
}
