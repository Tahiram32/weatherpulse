import React, { useState, useEffect } from 'react';
import { CloudLightning, Search, Bell, Settings, LayoutDashboard, Users, Map as MapIcon, ShieldAlert, FileText, ChevronDown, ChevronLeft, ChevronRight, Zap, MoreVertical } from 'lucide-react';

export default function DemoDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#13151A] flex items-center justify-center p-8 font-sans">
      {/* Outer wrapper for glow effect */}
      <div className="relative w-full max-w-7xl h-[850px]">
        {/* Glow behind the window */}
        <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 rounded-3xl blur-2xl pointer-events-none" />
        
        {/* Main Window */}
        <div className="relative w-full h-full bg-[#1A1D24] rounded-2xl shadow-2xl border border-white/5 flex overflow-hidden">
          
          {/* Sidebar */}
          <div className="w-64 bg-[#1A1D24] border-r border-white/5 flex flex-col z-20">
            {/* Logo */}
            <div className="h-20 flex items-center px-6 gap-3">
              <div className="text-cyan-400">
                <CloudLightning className="w-8 h-8" />
              </div>
              <span className="text-xl font-semibold text-white tracking-wide">Weatherpulse</span>
            </div>

            {/* Nav */}
            <div className="px-4 py-6">
              <div className="text-xs text-slate-500 mb-4 px-3">Navigation Menu</div>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="font-medium">Dashboard</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 transition-colors">
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Clients</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 transition-colors">
                  <MapIcon className="w-5 h-5" />
                  <span className="font-medium">Map View</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 transition-colors">
                  <ShieldAlert className="w-5 h-5" />
                  <span className="font-medium">Alerts</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 transition-colors">
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Reports</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 transition-colors">
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Settings</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col bg-[#161920] z-10 relative">
            
            {/* Header */}
            <div className="h-20 flex items-center justify-between px-8 border-b border-white/5 bg-[#1A1D24]">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-full bg-[#161920] border border-white/5 rounded-full py-2 pl-10 pr-4 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="flex items-center gap-6">
                <button className="relative text-slate-400 hover:text-white">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Patel" alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm text-slate-300 font-medium">A. Patel</span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </div>
                <button className="text-slate-400 hover:text-white">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="flex-1 p-8 overflow-y-auto">
              
              {/* Top Row: Titles & Regional Metrics */}
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-2xl font-semibold text-white inline-block mr-3">Operations Dashboard</h1>
                  <span className="text-slate-400 text-sm">| May 21, 2024 - 14:35 EST</span>
                </div>
                <div className="flex items-center gap-3 bg-[#1A1D24] rounded-full px-4 py-1.5 border border-white/5 shadow-inner">
                  <span className="text-sm text-slate-300">Live Regional Metrics</span>
                  <div className="flex items-center gap-1.5 bg-[#161920] px-2 py-1 rounded-full border border-white/5">
                    <span className="text-xs text-slate-400">Status</span>
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                </div>
              </div>

              {/* Metrics Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-[#1A1D24] p-4 rounded-xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="text-slate-300 font-medium mb-1 relative z-10">New York</div>
                  <div className="text-sm text-slate-400 relative z-10">AQI: <span className="text-yellow-500">65 Moderate - Yellow</span></div>
                </div>
                <div className="bg-[#1A1D24] p-4 rounded-xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="text-slate-300 font-medium mb-1 relative z-10">Atlanta</div>
                  <div className="text-sm text-slate-400 relative z-10">UV Index: <span className="text-orange-500">8 High - Orange</span></div>
                </div>
                <div className="bg-[#1A1D24] p-4 rounded-xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="text-slate-300 font-medium mb-1 relative z-10">Chicago</div>
                  <div className="text-sm text-slate-400 relative z-10">AQI: <span className="text-green-500">32 Good - Green</span></div>
                </div>
                <div className="bg-[#1A1D24] p-4 rounded-xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="text-slate-300 font-medium mb-1 relative z-10">Dallas</div>
                  <div className="text-sm text-slate-400 relative z-10">UV Index: <span className="text-orange-500">8 High</span></div>
                </div>
              </div>

              {/* Main 3-Column Layout */}
              <div className="grid grid-cols-12 gap-6 h-[480px]">
                
                {/* Active Client Tenants */}
                <div className="col-span-3 bg-[#1A1D24] rounded-2xl border border-white/5 p-4 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-slate-300 font-medium">Active Client Tenants</h2>
                    <MoreVertical className="w-4 h-4 text-slate-500" />
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    {/* Tenant Card */}
                    <div className="bg-[#161920] p-4 rounded-xl border border-cyan-500/30 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
                      <div className="absolute -left-10 -top-10 w-24 h-24 bg-cyan-500/20 blur-xl rounded-full" />
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <span className="text-white font-medium">Global Logistics Inc.</span>
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex justify-between items-center relative z-10">
                        <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs border border-green-500/20">Active</span>
                        <span className="text-red-400 text-xs font-medium">14 Alerts</span>
                      </div>
                    </div>
                    {/* Tenant Card */}
                    <div className="bg-[#161920] p-4 rounded-xl border border-cyan-500/30 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
                      <div className="absolute -left-10 -top-10 w-24 h-24 bg-cyan-500/10 blur-xl rounded-full" />
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <span className="text-white font-medium">Alpha Trucking</span>
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex justify-between items-center relative z-10">
                        <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs border border-green-500/20">Active</span>
                        <span className="text-red-400 text-xs font-medium">8 Alerts</span>
                      </div>
                    </div>
                    {/* Tenant Card */}
                    <div className="bg-[#161920] p-4 rounded-xl border border-yellow-500/30 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500" />
                      <div className="absolute -left-10 -top-10 w-24 h-24 bg-yellow-500/10 blur-xl rounded-full" />
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <span className="text-white font-medium">Omni Solutions</span>
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex justify-between items-center relative z-10">
                    <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs border border-yellow-500/20">Warning</span>
                    <span className="text-red-400 text-xs font-medium">3 Alerts</span>
                  </div>
                </div>
                {/* Tenant Card */}
                <div className="bg-[#161920] p-4 rounded-xl border border-cyan-500/30 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <span className="text-white font-medium">Secure Transport</span>
                    <MoreVertical className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex justify-between items-center relative z-10">
                    <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs border border-green-500/20">Active</span>
                    <span className="text-red-400 text-xs font-medium">1 Alert</span>
                  </div>
                </div>
              </div>
              
              {/* Pagination / Controls */}
              <div className="flex items-center justify-between mt-4">
                <button className="w-8 h-8 rounded-lg bg-[#161920] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-4 py-1.5 rounded-full bg-[#161920] border border-white/5 text-xs text-slate-400">
                  Scollable
                </div>
                <button className="w-8 h-8 rounded-lg bg-[#161920] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
                </div>

                {/* Active Weather Map */}
                <div className="col-span-5 bg-[#1A1D24] rounded-2xl border border-white/5 relative overflow-hidden flex flex-col p-2">
                  <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
                    <h2 className="text-white font-medium drop-shadow-md">Active Weather Map</h2>
                  </div>
                  <div className="absolute top-4 right-6 z-10 flex items-center gap-2">
                    <button className="px-3 py-1 rounded-full bg-white/10 backdrop-blur text-xs text-slate-200 border border-white/20 flex items-center gap-2">
                      Glow <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    </button>
                    <button className="w-6 h-6 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-slate-200">
                      <span className="text-[10px]">•••</span>
                    </button>
                  </div>

                  <div className="w-full h-full rounded-xl overflow-hidden relative">
                     <iframe 
                        width="100%" 
                        height="100%" 
                        src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=%C2%B0F&metricWind=mph&zoom=5&overlay=radar&product=radar&level=surface&lat=36.00&lon=-80.00&message=true" 
                        frameBorder="0"
                        className="absolute inset-0 grayscale-[0.3] contrast-[1.2] scale-105"
                        title="Live Weather Map"
                      ></iframe>
                  </div>
                  
                  {/* Map Controls */}
                  <div className="absolute left-6 top-16 z-10 flex flex-col gap-1 bg-[#1A1D24]/80 backdrop-blur rounded-lg border border-white/10 overflow-hidden">
                    <button className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white border-b border-white/10">+</button>
                    <button className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white">−</button>
                  </div>
                  
                  <div className="absolute right-6 top-16 z-10 flex flex-col gap-2">
                     <button className="w-8 h-8 rounded-lg bg-[#1A1D24]/80 backdrop-blur border border-white/10 flex items-center justify-center text-slate-300 hover:text-white">
                        <MapIcon className="w-4 h-4" />
                     </button>
                     <button className="w-8 h-8 rounded-lg bg-[#1A1D24]/80 backdrop-blur border border-white/10 flex items-center justify-center text-slate-300 hover:text-white">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                     </button>
                  </div>
                </div>

                {/* ALERTS PANEL */}
                <div className="col-span-4 bg-[#1A1D24] rounded-2xl border border-red-500/30 p-6 flex flex-col relative overflow-hidden shadow-[inset_0_0_60px_rgba(239,68,68,0.05)]">
                  {/* Background Glows */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                  
                  <div className="flex justify-between items-center mb-6 relative z-10">
                    <span className="text-xs text-red-400 tracking-wider font-semibold">ALERTS PANEL</span>
                    <button className="text-slate-500 hover:text-white text-lg leading-none">×</button>
                  </div>

                  <div className="text-center relative z-10 flex-1 flex flex-col">
                    <h2 className="text-[1.3rem] font-bold text-white mb-2 leading-tight">
                      <span className="text-cyan-400">Exteme Weather</span><br/>
                      Detected: <span className="text-red-500">1.5x<br/>Surge Pricing</span><br/>
                      Activated
                    </h2>
                    
                    <div className="flex-1 flex flex-col items-center justify-center py-4">
                      {/* Weather Icon (Cloud with Lightning) */}
                      <div className="relative mb-4">
                        <CloudLightning className="w-16 h-16 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" strokeWidth={1.5} />
                        <Zap className="absolute bottom-1 right-2 w-8 h-8 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse" />
                      </div>
                      <div className="text-slate-300 font-mono tracking-widest">14:32:01</div>
                    </div>
                    
                    <div className="text-left text-sm space-y-1 mt-2">
                      <div className="text-slate-300"><span className="text-slate-500">Region:</span> SE USA</div>
                      <div className="text-slate-300"><span className="text-slate-500">Event:</span> Severe Thunderstorms</div>
                      <div className="text-slate-300"><span className="text-slate-500">Surge:</span> Applied to 3 Clients</div>
                    </div>
                  </div>
                  
                  {/* Critical Weather Feed */}
                  <div className="mt-6 pt-4 border-t border-white/10 relative z-10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-white">Critical Weather Feed</span>
                      <ChevronDown className="w-4 h-4 text-slate-500 rotate-180" />
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      WeatherWeather Detected:<br/>
                      Event: Severe Thuneration<br/>
                      SE USA, Event: Severe Thunderstorms & Surge Applied to 3 Cllents.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
