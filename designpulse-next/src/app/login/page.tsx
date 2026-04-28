"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import { Loader2, Building2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();

  const handleProcoreLogin = () => {
    setLoading(true);
    setError(null);
    
    const clientId = process.env.NEXT_PUBLIC_PROCORE_CLIENT_ID;
    
    if (!clientId) {
      setError('Procore Client ID is missing. Please check your configuration.');
      setLoading(false);
      return;
    }

    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/procore/callback`);
    window.location.href = `https://login.procore.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-sky-500">
          <Building2 size={48} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          Sign in to Design Pulse
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Use your Supabase email and password to access the pre-construction engine.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleProcoreLogin}
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 mb-6 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#F26522] hover:bg-[#d6571a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F26522] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign in with Procore'}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                Or continue with email
              </span>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-shadow"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-shadow"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
