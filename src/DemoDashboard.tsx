import React, { useState, useEffect } from 'react';
import { CloudLightning, Wind, AlertTriangle, Activity, Map as MapIcon, Truck, Leaf, HardHat, TrendingUp, Bell, Search, Settings, ShieldAlert, Zap, ThermometerSun } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  industry: string;
  location: string;
  status: 'Healthy' | 'Warning' | 'Critical';
  temp: number;
  aqi: number;
  surge: number;
  icon: React.ReactNode;
}

export default function DemoDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tenants, setTenants] = useState<Tenant[]>([
    { id: '1', name: 'Global Logistics Inc.', industry: 'Logistics', location: 'Las Vegas', status: 'Healthy', temp: 98, aqi: 42, surge: 1.0, icon: <Truck className="w-5 h-5" /> },
    { id: '2', name: 'AgriCorp Farms', industry: 'Agriculture', location: 'Omaha', status: 'Healthy', temp: 75, aqi: 28, surge: 1.0, icon: <Leaf className="w-5 h-5" /> },
    { id: '3', name: 'Secure Transport', industry: 'Transit', location: 'Chicago', status: 'Healthy', temp: 68, aqi: 35, surge: 1.0, icon: <HardHat className="w-5 h-5" /> },
    { id: '4', name: 'Omni Solutions', industry: 'Events', location: 'Atlanta', status: 'Warning', temp: 88, aqi: 65, surge: 1.1, icon: <Activity className="w-5 h-5" /> },
  ]);
  const [systemAlert, setSystemAlert] = useState<{ active: boolean; message: string; type: string } | null>(null);
  const [chartData, setChartData] = useState<number[]>(Array(12).fill(20));

  // Simulation Loop
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const simInterval = setInterval(() => {
      // Fluctuate chart data
      setChartData(prev => {
        const newData = [...prev.slice(1), Math.floor(Math.random() * 80) + 20];
        return newData;
      });

      // Randomly trigger a storm
      if (Math.random() > 0.85 && !systemAlert?.active) {
        setSystemAlert({
          active: true,
          message: "Incoming Severe Micro-Cell Detected",
          type: "CRITICAL"
        });
        
        setTenants(prev => prev.map(t => {
          if (t.location === 'Las Vegas' || t.location === 'Atlanta') {
            return { ...t, status: 'Critical', surge: 1.5, temp: t.temp - 10, aqi: t.aqi + 40 };
          }
          return t;
        }));

        setTimeout(() => {
          setSystemAlert(null);
          setTenants(prev => prev.map(t => ({ ...t, status: 'Healthy', surge: 1.0, aqi: Math.max(20, t.aqi - 40), temp: t.temp + 10 })));
        }, 8000);
      } else if (!systemAlert?.active) {
        // Minor fluctuations
        setTenants(prev => prev.map(t => ({
          ...t,
          temp: Math.max(40, Math.min(115, t.temp + (Math.random() > 0.5 ? 1 : -1))),
          aqi: Math.max(10, Math.min(150, t.aqi + (Math.random() > 0.5 ? 2 : -2)))
        })));
      }
    }, 2500);

    return () => {
      clearInterval(timer);
      clearInterval(simInterval);
    };
  }, [systemAlert]);

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      {/* Ambient background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <CloudLightning className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Weatherpulse</h1>
          <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20">LIVE DEMO</span>
        </div>
        
        <div className="flex-1 max-w-md mx-8 relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search tenants, regions, or alerts..." 
            className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-400 hidden sm:block">{currentTime.toLocaleTimeString()} EST</div>
          <button className="relative p-2 rounded-full hover:bg-white/5 transition-colors">
            <Bell className="w-5 h-5" />
            {systemAlert && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
            {systemAlert && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 border border-white/20" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Sidebar - Tenants */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-cyan-400" /> Active Tenants
            </h2>
            <span className="text-xs font-medium text-slate-400">{tenants.length} Managed</span>
          </div>

          <div className="flex flex-col gap-3">
            {tenants.map(tenant => (
              <div 
                key={tenant.id} 
                className={`p-4 rounded-xl border bg-black/40 backdrop-blur-md transition-all duration-500 ${
                  tenant.status === 'Critical' 
                    ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' 
                    : tenant.status === 'Warning'
                      ? 'border-amber-500/30'
                      : 'border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      tenant.status === 'Critical' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-slate-300'
                    }`}>
                      {tenant.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{tenant.name}</h3>
                      <p className="text-xs text-slate-400">{tenant.location} • {tenant.industry}</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${
                    tenant.surge > 1.0 ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-cyan-500/10 text-cyan-400'
                  }`}>
                    <Zap className="w-3 h-3" />
                    {tenant.surge.toFixed(1)}x Surge
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1 flex items-center gap-1">
                      <ThermometerSun className="w-3 h-3" /> Temp
                    </div>
                    <div className="text-lg font-mono text-white transition-all">{tenant.temp}°F</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1 flex items-center gap-1">
                      <Wind className="w-3 h-3" /> AQI
                    </div>
                    <div className={`text-lg font-mono transition-all ${tenant.aqi > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {tenant.aqi}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Alert Banner */}
          {systemAlert && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-4 fade-in duration-300 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">
                  <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-red-400">{systemAlert.message}</h3>
                  <p className="text-sm text-red-400/80">AI Radar has activated emergency surge multiplier algorithms for affected client zones.</p>
                </div>
              </div>
            </div>
          )}

          {/* Map / Radar Visualization Mock */}
          <div className="h-[300px] rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden relative group">
            {/* Mock map background pattern */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Radar sweep */}
                <div className="w-64 h-64 border border-cyan-500/30 rounded-full flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full border border-cyan-500/10 scale-150" />
                  <div className="absolute inset-0 rounded-full border border-cyan-500/5 scale-50" />
                  <div className="w-1/2 h-1/2 bg-gradient-to-tl from-cyan-500/0 to-cyan-500/20 absolute top-0 right-0 origin-bottom-left rounded-tr-full animate-spin [animation-duration:3s]" />
                  
                  {/* Pings */}
                  {systemAlert && (
                    <div className="absolute top-10 left-10 w-4 h-4">
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                      <span className="absolute inset-1 rounded-full bg-red-500" />
                    </div>
                  )}
                  
                  <div className="absolute bottom-20 right-16 w-3 h-3">
                    <span className="absolute inset-0 rounded-full bg-cyan-500 animate-ping opacity-75 [animation-duration:2s]" />
                    <span className="absolute inset-0.5 rounded-full bg-cyan-400" />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute top-4 left-4 flex gap-2">
              <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Live AI Radar
              </div>
            </div>
          </div>

          {/* System Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* API Ingestion Chart */}
            <div className="p-5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" /> Ingestion Rate
                  </h3>
                  <p className="text-xs text-slate-500">Events processed per second</p>
                </div>
                <div className="text-2xl font-mono text-white">
                  {(chartData[chartData.length-1] * 14.2).toFixed(0)} <span className="text-sm text-slate-500">req/s</span>
                </div>
              </div>
              
              <div className="h-32 flex items-end justify-between gap-1">
                {chartData.map((val, i) => (
                  <div key={i} className="w-full bg-white/5 rounded-t-sm relative group overflow-hidden" style={{ height: '100%' }}>
                    <div 
                      className={`absolute bottom-0 w-full transition-all duration-500 rounded-t-sm ${
                        systemAlert && i > 8 ? 'bg-gradient-to-t from-red-600 to-red-400' : 'bg-gradient-to-t from-cyan-600 to-cyan-400'
                      }`}
                      style={{ height: `${val}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md flex flex-col justify-center">
                <div className="text-slate-400 text-xs font-semibold uppercase mb-2">Total Tenants</div>
                <div className="text-3xl font-light text-white">{tenants.length}</div>
                <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> 100% Online
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md flex flex-col justify-center">
                <div className="text-slate-400 text-xs font-semibold uppercase mb-2">Events Analyzed</div>
                <div className="text-3xl font-light text-white">{(currentTime.getTime() % 1000000).toLocaleString().slice(0, 3)}M</div>
                <div className="mt-2 text-xs text-purple-400 flex items-center gap-1">
                  Powered by Gemini
                </div>
              </div>
              <div className="col-span-2 p-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-transparent backdrop-blur-md">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <CloudLightning className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">Weatherpulse Sync Engine</div>
                    <div className="text-sm text-slate-400 mt-1 leading-relaxed">
                      This is a simulated demo of the Weatherpulse platform. All data shown is generated locally in the browser to demonstrate the UI capabilities without requiring backend Firebase credentials.
                    </div>
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
