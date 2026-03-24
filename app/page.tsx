'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Bot, Sparkles, Code, Layout, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) router.push('/dashboard');
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error('Auth failed:', error);
      setAuthError(error.message || 'Authentication failed');
    }
  };

  if (loading) return null;

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-8 border border-emerald-100"
        >
          <Sparkles className="w-4 h-4" />
          Powered by Gemini AI
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-6xl md:text-7xl font-bold tracking-tight mb-8 max-w-4xl"
        >
          Build your own <span className="text-emerald-600">AI Chatbot</span> in minutes.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-neutral-500 mb-12 max-w-2xl leading-relaxed"
        >
          Customize the look, feel, and personality of your AI assistant. 
          Embed it on your website with a single line of code.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100"
        >
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <input 
                type="email" 
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
              />
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
              />
            </div>
            {authError && (
              <div className="text-red-500 text-sm text-left">{authError}</div>
            )}
            <button 
              type="submit"
              className="w-full py-4 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all shadow-lg flex justify-center items-center gap-2"
            >
              {isLogin ? 'Sign In' : 'Create Account'}
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="text-sm text-neutral-500 mt-4">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)} 
                className="text-emerald-600 font-medium hover:text-emerald-700"
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </div>
          </form>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-neutral-200">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Layout className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Visual Builder</h3>
            <p className="text-neutral-500">Customize colors, names, and welcome messages to match your brand perfectly.</p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Smart AI</h3>
            <p className="text-neutral-500">Powered by Google Gemini. Give your bot a personality with custom system prompts.</p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Code className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Easy Embed</h3>
            <p className="text-neutral-500">Copy a single script tag and paste it into your HTML. Works with any platform.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
