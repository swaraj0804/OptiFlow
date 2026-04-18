import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = mode === 'signin' 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else if (mode === 'signup') {
      setMessage({ type: 'success', text: 'Check your email for the confirmation link.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 selection:bg-accent-blue/30 relative overflow-hidden">
      {/* Atmospheric Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent-blue/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent-red/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5" 
             style={{ backgroundImage: 'radial-gradient(circle at center, var(--color-accent-blue) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-blue/10 border border-accent-blue/20 rounded-none mb-2">
            <ShieldCheck className="w-6 h-6 text-accent-blue" />
          </div>
          <h1 className="text-[20px] font-mono font-bold tracking-[4px] text-white uppercase">
            Access_Control
          </h1>
          <p className="text-[10px] font-mono text-text-secondary uppercase tracking-widest leading-relaxed">
            Identity verification required to access <br /> 
            <span className="text-accent-blue">Signal.Core // Autonomous_Gate</span>
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 bg-surface/30 border border-border p-8 backdrop-blur-sm">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono text-text-secondary uppercase tracking-widest flex items-center gap-2">
                <Mail className="w-3 h-3" /> User_Identifier
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg border border-border px-3 py-2 text-[12px] font-mono text-white focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 outline-none transition-all placeholder:text-white/10"
                placeholder="admin@signal.core"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-mono text-text-secondary uppercase tracking-widest flex items-center gap-2">
                <Lock className="w-3 h-3" /> Security_Key
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg border border-border px-3 py-2 text-[12px] font-mono text-white focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 outline-none transition-all placeholder:text-white/10"
                placeholder="••••••••"
              />
            </div>
          </div>

          {message && (
            <div className={cn(
              "p-3 border text-[10px] font-mono uppercase tracking-tight",
              message.type === 'error' ? "bg-accent-red/5 border-accent-red/20 text-accent-red" : "bg-accent-green/5 border-accent-green/20 text-accent-green"
            )}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-blue hover:bg-accent-blue/90 disabled:opacity-50 text-bg text-[11px] font-mono font-bold uppercase tracking-[2px] py-3 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {mode === 'signin' ? 'Verify_Identity' : 'Request_Access'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-[9px] font-mono text-text-secondary uppercase tracking-widest hover:text-white transition-colors"
            >
              {mode === 'signin' ? '[ Switch_to_Sign_Up ]' : '[ Switch_to_Sign_In ]'}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center gap-6 opacity-20">
          <div className="h-px w-12 bg-white" />
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <div className="h-px w-12 bg-white" />
        </div>
      </div>
    </div>
  );
}
