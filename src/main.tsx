import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminDashboard from './AdminDashboard.tsx';
import Storefront from './Storefront.tsx';
import CancelArticles from './CancelArticles.tsx';
import './index.css';

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
