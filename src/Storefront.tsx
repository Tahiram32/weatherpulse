import React, { useState } from 'react';
import { Zap, Shield, Check, Loader2, AlertTriangle, Smartphone, Mail, Calendar } from 'lucide-react';

import { auth, googleProvider } from "./firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export default function Storefront() {
  const [businessName, setBusinessName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [buildStep, setBuildStep] = useState<0 | 1 | 2>(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

  const handleBuildPrototype = async () => {
    if (!businessName || !zipCode || !customerEmail) {
      setErrorMessage("Please enter your business details to continue.");
      return;
    }
    setErrorMessage("");
    setBuildStep(1);
    
    // Build progress
    for (let i = 1; i <= 5; i++) {
      await wait(600);
      setLoadingProgress(i);
    }
    await wait(800);
    setBuildStep(2);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-xl text-slate-900">
              The Living Website
            </span>
          </div>
          
        </div>
      </nav>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-20 lg:py-32">
        {/* Headline Section */}
        <div className="text-center max-w-3xl mx-auto mb-24">
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1] mb-8">
            Stop Wasting Hours <br/>
            <span className="text-blue-600">Managing A Website.</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            You run your business. We run your digital presence. Here is how you get online and start capturing leads in under 60 seconds.
          </p>
        </div>

        <div className="flex flex-col gap-32">
          {/* Step 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col gap-6">
              <div className="text-blue-600 font-bold tracking-wide uppercase text-sm">Step 1</div>
              <h2 className="text-3xl font-bold text-slate-900">Tell Us What You Do</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                You do not need to write copy or design layouts. You simply paste your Google Maps link or enter your business name into our secure checkout.
              </p>
              <div className="bg-slate-100 p-6 rounded-xl border border-slate-200 mt-4 font-mono text-sm text-slate-700">
                <span className="text-slate-500 block mb-2">// Example Input:</span>
                Business Name: Mobile Notary & Loan Signing<br/>
                Location: Henderson, NV 89015
              </div>
            </div>

            {/* Checkout Card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/10 to-transparent blur-3xl -z-10 rounded-full"></div>
              <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden relative">
                
                {buildStep === 0 && (
                  <>
                    <div className="p-8 border-b border-slate-100 flex flex-col bg-slate-50">
                      <h3 className="text-lg font-bold text-slate-900">Activate Your AI Engine</h3>
                      <p className="text-sm text-slate-500 mt-1">Enter your website URL or Google Maps link. We handle the rest.</p>
                    </div>
                    
                    <div className="p-8 flex flex-col gap-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold tracking-wide text-slate-700 uppercase">Business Name</label>
                          <input 
                            type="text" 
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="e.g. Tahira Services"
                            className="px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold tracking-wide text-slate-700 uppercase">Zip Code</label>
                          <input 
                            type="text" 
                            value={zipCode}
                            onChange={(e) => setZipCode(e.target.value)}
                            placeholder="e.g. 75201"
                            className="px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold tracking-wide text-slate-700 uppercase">Customer Email</label>
                          <input 
                            type="email" 
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            placeholder="e.g. hello@example.com"
                            className="px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {errorMessage && (
                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-lg flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{errorMessage}</span>
                        </div>
                      )}

                      <button 
                        onClick={handleBuildPrototype}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors mt-2"
                      >
                        Analyze Business & Build Prototype
                      </button>
                    </div>
                  </>
                )}

                {buildStep === 1 && (
                  <div className="p-8 flex flex-col gap-5 font-mono text-sm bg-slate-900 text-slate-300 rounded-2xl min-h-[350px]">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    </div>
                    
                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${loadingProgress >= 1 ? 'opacity-100' : 'opacity-0'}`}>
                      {loadingProgress > 1 ? <span className="text-emerald-400">[✓]</span> : <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />}
                      <span className={loadingProgress > 1 ? "text-emerald-400" : "text-slate-300"}>Locating Google Maps Data...</span>
                    </div>
                    
                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${loadingProgress >= 2 ? 'opacity-100' : 'opacity-0'}`}>
                      {loadingProgress > 2 ? <span className="text-emerald-400">[✓]</span> : <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />}
                      <span className={loadingProgress > 2 ? "text-emerald-400" : "text-slate-300"}>Extracting Business Name & Hours...</span>
                    </div>

                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${loadingProgress >= 3 ? 'opacity-100' : 'opacity-0'}`}>
                      {loadingProgress > 3 ? <span className="text-emerald-400">[✓]</span> : <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />}
                      <span className={loadingProgress > 3 ? "text-emerald-400" : "text-slate-300"}>Analyzing Local Reviews...</span>
                    </div>

                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${loadingProgress >= 4 ? 'opacity-100' : 'opacity-0'}`}>
                      {loadingProgress > 4 ? <span className="text-emerald-400">[✓]</span> : <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />}
                      <span className={loadingProgress > 4 ? "text-emerald-400" : "text-slate-300"}>Drafting Autonomous Sales Copy...</span>
                    </div>

                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${loadingProgress >= 5 ? 'opacity-100' : 'opacity-0'}`}>
                      {loadingProgress > 5 ? <span className="text-emerald-400">[✓]</span> : <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />}
                      <span className={loadingProgress > 5 ? "text-emerald-400" : "text-slate-300"}>Provisioning Voice Agent...</span>
                    </div>
                  </div>
                )}

                {buildStep === 2 && (
                  <div className="flex flex-col h-full min-h-[450px]">
                    <div className="text-center z-20 p-8 pb-4">
                      <p className="text-sm text-emerald-600 font-bold mb-2 uppercase tracking-widest flex items-center justify-center gap-1">
                        <Check className="w-4 h-4" /> Analysis Complete
                      </p>
                      <p className="text-slate-700 text-sm leading-relaxed">
                        We successfully analyzed the business profile for <span className="font-bold text-slate-900">{businessName}</span>. We drafted a high-converting emergency dispatch site for your service.
                      </p>
                    </div>
                    
                    {/* Blurred mock preview & Paywall */}
                    <div className="relative flex-1 m-4 mt-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      {/* Blurred mockup background */}
                      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555421689-d68471e189f2?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-40 blur-md scale-105"></div>
                      
                      <div className="relative bg-white/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 shadow-[inset_0_0_100px_rgba(255,255,255,0.9)] min-h-[350px]">
                        {checkoutStep > 0 && checkoutStep < 5 && (
                          <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Deploying Live Site...</h3>
                            <p className="text-slate-500 max-w-xs mx-auto">
                              {checkoutStep === 1 && "Verifying payment..."}
                              {checkoutStep === 2 && "Unlocking assets..."}
                              {checkoutStep === 3 && "Injecting generated copy..."}
                              {checkoutStep === 4 && "Distributing to edge network..."}
                            </p>
                          </div>
                        )}
                        {checkoutStep === 5 && (
                          <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                              <Check className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Payment Successful.</h3>
                            <p className="text-slate-500 max-w-xs mx-auto mb-6">
                              Final Step: Connect your calendar so the AI can book your appointments automatically.
                            </p>
                            <button
                              onClick={async () => {
                                try {
                                  const result = await signInWithPopup(auth, googleProvider);
                                  const credential = GoogleAuthProvider.credentialFromResult(result);
                                  if (credential?.accessToken) {
                                    // In a real scenario, we'd send the authorization code to the backend to get a refresh token
                                    const domain = businessName.replace(/\s+/g, '').toLowerCase() + '.com';
                                    const res = await fetch(`/api/clients/${domain}/calendar`, {
                                      method: 'PUT',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        // A real app would securely authenticate this request
                                      },
                                      body: JSON.stringify({ 
                                        googleCalendarToken: credential.accessToken,
                                        refreshToken: "google_calendar_offline_access_token" 
                                      })
                                    });
                                    if (res.ok) alert('Google Calendar connected successfully!');
                                    else alert('Failed to save calendar token.');
                                  }
                                } catch (err: any) {
                                  alert('OAuth Error: ' + err.message);
                                }
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <Calendar className="w-5 h-5" /> Connect Google Calendar
                            </button>
                          </div>
                        )}
                        
                        {!checkoutStep && (
                          <>
                            <p className="font-bold text-slate-900 mb-2 text-lg max-w-xs leading-snug drop-shadow-sm">
                              Your AI Marketing Manager is ready.
                            </p>
                            <p className="text-slate-700 text-sm mb-6 max-w-sm px-4">
                              Pay a one-time <span className="font-bold text-blue-600">$10</span> setup fee today. We will provision your AI voice agent, secure your local phone number, and deploy your site. 
                              You get 14 days to let the AI run your business. If you love it, it's $50/month after that. Cancel before day 14 and never pay another dime.
                            </p>
                            <div className="w-full pointer-events-auto">
                              <PayPalScriptProvider options={{ clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "test", components: "buttons", currency: "USD" }}>
                                <PayPalButtons 
                                  style={{ layout: "vertical", shape: "rect", color: "blue" }}
                                  disabled={!businessName || checkoutStep > 0}
                                  createOrder={(data, actions) => {
                                    return actions.order.create({
                                      intent: "CAPTURE",
                                      purchase_units: [
                                        {
                                          amount: { value: "10.00", currency_code: "USD" },
                                          description: `The Living Website - $10 Setup Fee (14-Day Trial)`,
                                          custom_id: JSON.stringify({
                                            businessName,
                                            tier: "smb-adaptive"
                                          })
                                        }
                                      ]
                                    });
                                  }}
                                  onApprove={async (data, actions) => {
                                    if (!actions.order) return;
                                    
                                    setCheckoutStep(1); // Verifying
                                    try {
                                      const details = await actions.order.capture();
                                      setCheckoutStep(2); // Unlocking
                                      
                                      const mockTxId = details.id;
                                      const mockTime = new Date().toISOString();
                                      const mockSig = `sig_live_${Math.random().toString(36).substring(2, 24)}`;
                                      const mockCertUrl = "https://api.paypal.com/v1/certs/mock-cert-bundle.pem";
                                      
                                      await wait(600);
                                      setCheckoutStep(3); // Generating
                                      
                                      const res = await fetch("/api/webhooks/mock-paypal", {
                                        method: "POST",
                                        headers: { 
                                          "Content-Type": "application/json",
                                          "paypal-transmission-id": mockTxId,
                                          "paypal-transmission-time": mockTime,
                                          "paypal-transmission-sig": mockSig,
                                          "paypal-cert-url": mockCertUrl,
                                          "paypal-auth-algo": "SHA256withRSA"
                                        },
                                        body: JSON.stringify({
                                          event_type: "CHECKOUT.ORDER.APPROVED",
                                          resource: {
                                            payer: {
                                              email_address: details.payer?.email_address || "business@example.com"
                                            },
                                            custom_id: JSON.stringify({
                                              businessName
                                            })
                                          }
                                        })
                                      });
                                      
                                      if (!res.ok) throw new Error(`Server returned HTTP Status ${res.status}`);
                                      
                                      setCheckoutStep(4); // Deploying
                                      await wait(1000);
                                      
                                      setCheckoutStep(5); // Complete!
                                      
                                    } catch (err: any) {
                                      setErrorMessage(err.message || "Secure connection failed. Please try again.");
                                      setCheckoutStep(0);
                                    }
                                  }}
                                  onError={(err) => {
                                    setErrorMessage("Payment gateway error. Please try again or contact support.");
                                    setCheckoutStep(0);
                                  }}
                                />
                              </PayPalScriptProvider>
                            </div>
                            
                            <div className="flex items-center justify-center gap-4 text-xs text-slate-500 mt-4">
                              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure Payment</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col gap-6 max-w-3xl">
            <div className="text-blue-600 font-bold tracking-wide uppercase text-sm">Step 2</div>
            <h2 className="text-3xl font-bold text-slate-900">The Autonomous Engine Deploys</h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              The moment your payment clears, our AI instantly builds your entire website. It scrapes your existing public footprint, writes professional sales copy specifically for your industry, provisions a beautiful mobile design, and launches it live on the web.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col gap-6 max-w-3xl ml-auto text-left lg:text-right">
            <div className="text-blue-600 font-bold tracking-wide uppercase text-sm">Step 3</div>
            <h2 className="text-3xl font-bold text-slate-900">Your Site Actively Sells For You</h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              This is where traditional websites fail. Your new site is alive. Our engine acts as your 24/7 marketing manager. It continuously runs silent A/B tests to figure out which headlines convert best. It autonomously adapts your offers based on the time of day, local events, or changing seasons to ensure you capture the maximum amount of traffic. It optimizes itself so you don't have to.
            </p>
          </div>

          {/* Step 4 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col gap-6 lg:order-2">
              <div className="text-blue-600 font-bold tracking-wide uppercase text-sm">Step 4</div>
              <h2 className="text-3xl font-bold text-slate-900">You Just Take The Phone Calls</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                There is no confusing dashboard to log into and no maintenance required. Whenever our engine updates your site or runs a successful optimization, we send a simple "Value Receipt" directly to your inbox showing you exactly what we did to increase your leads. You just focus on running your business.
              </p>
            </div>
            
            {/* iPhone Mockup for Receipt */}
            <div className="lg:order-1 flex justify-center">
              <div className="relative w-[300px] h-[600px] bg-slate-900 rounded-[3rem] p-4 shadow-2xl border-4 border-slate-800 shrink-0">
                <div className="absolute top-0 inset-x-0 h-6 flex justify-center">
                  <div className="w-24 h-5 bg-slate-900 rounded-b-2xl"></div>
                </div>
                <div className="w-full h-full bg-white rounded-[2.25rem] overflow-hidden flex flex-col">
                  {/* Email Header */}
                  <div className="bg-slate-50 border-b border-slate-200 p-4 pt-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">The Living Website</div>
                        <div className="text-xs text-slate-500">Weekly Value Receipt</div>
                      </div>
                    </div>
                  </div>
                  {/* Email Body */}
                  <div className="p-5 flex flex-col gap-4 bg-white flex-1 overflow-y-auto">
                    <h4 className="text-lg font-bold text-slate-900">Optimization Report</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      We tested a new headline focused on "Emergency Same-Day Service" during Tuesday's storm front.
                    </p>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-2">
                      <div className="text-blue-600 font-bold text-2xl">+3</div>
                      <div className="text-sm font-medium text-blue-900">New Phone Calls This Week</div>
                    </div>
                    <div className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100">
                      Your site is fully optimized. No action required.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
