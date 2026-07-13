import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Loader2, XCircle } from 'lucide-react';

export default function CancelArticles() {
  const { domain } = useParams<{ domain: string }>();
  // Instead of useSearchParams which requires react-router-dom v6 (we assume it is), 
  // we can also just use URLSearchParams natively to be safe if not imported.
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'idle' | 'canceling' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleCancel = async () => {
    if (!token) {
      setStatus('error');
      setErrorMessage("No cancellation token found in URL.");
      return;
    }
    
    setStatus('canceling');
    try {
      const res = await fetch(`/api/clients/${domain}/articles/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel articles');
      }
      
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden p-8 text-center">
        
        {status === 'idle' && (
          <>
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Cancel SEO Articles?</h1>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Are you sure you want to cancel the deployment of the pending SEO articles for <strong>{domain}</strong>? This action cannot be undone.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleCancel}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-sm"
              >
                Yes, Cancel Deployment
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
              >
                Keep Articles (Do Nothing)
              </button>
            </div>
          </>
        )}

        {status === 'canceling' && (
          <div className="py-12">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-medium text-slate-900">Canceling deployment...</h2>
            <p className="text-slate-500 mt-2">Please wait.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Deployment Cancelled</h1>
            <p className="text-slate-600 mb-8 leading-relaxed">
              The pending SEO articles have been successfully cancelled and will not be published to your website.
            </p>
            <button 
              onClick={() => window.location.href = '/'}
              className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors"
            >
              Return Home
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-8">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Cancellation Failed</h1>
            <p className="text-slate-600 mb-8 p-4 bg-slate-50 rounded-lg text-sm border border-slate-100">
              {errorMessage}
            </p>
            <button 
              onClick={() => setStatus('idle')}
              className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
