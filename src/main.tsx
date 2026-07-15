import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import * as Sentry from "@sentry/react";
import AdminDashboard from './AdminDashboard.tsx';
import Storefront from './Storefront.tsx';
import CancelArticles from './CancelArticles.tsx';
import './index.css';

Sentry.init({
  dsn: "https://3c1f0ea8bc5863a12af537980c760142@o4511737188581376.ingest.us.sentry.io/4511737209421826",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path="/internal-fleet-admin" element={<AdminDashboard />} />
        <Route path="/cancel-articles/:domain" element={<CancelArticles />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
