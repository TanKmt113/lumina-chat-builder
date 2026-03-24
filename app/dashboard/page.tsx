'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Plus, Bot, Settings, Trash2, ExternalLink, LogOut, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Chatbot {
  id: string;
  name: string;
  botName: string;
  primaryColor: string;
  createdAt: any;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push('/');
      } else {
        setUser(u);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'chatbots'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bots = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chatbot));
      setChatbots(bots.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });

    return () => unsubscribe();
  }, [user]);

  const createChatbot = async () => {
    if (!user) return;
    setIsCreating(true);
    alert(1);
    console.log('Chatbot created with ID:');
    
    try {
      const docRef = await addDoc(collection(db, 'chatbots'), {
        name: 'My New Chatbot',
        botName: 'AI Assistant',
        userId: user.uid,
        primaryColor: '#10b981',
        welcomeMessage: 'Hello! How can I help you today?',
        systemPrompt: 'You are a helpful customer support assistant.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('Chatbot created with ID:', docRef);
      
      // router.push(`/builder/${docRef.id}`);
    } catch (error: any) {
      alert(2)
      console.error('Failed to create chatbot:', error);
      alert('Creation failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsCreating(false);
    }
  };

  const deleteChatbot = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chatbot?')) return;
    try {
      await deleteDoc(doc(db, 'chatbots', id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Bot className="w-5 h-5" />
            </div>
            Lumina Chat
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500 hidden sm:inline">{user?.email}</span>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Chatbots</h1>
            <p className="text-neutral-500">Manage and customize your AI assistants.</p>
          </div>
          <button 
            onClick={createChatbot}
            disabled={isCreating}
            className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            New Chatbot
          </button>
        </div>

        {chatbots.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-neutral-200 rounded-3xl p-12 text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-neutral-400">
              <Bot className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">No chatbots yet</h3>
            <p className="text-neutral-500 mb-8">Create your first AI assistant to get started.</p>
            <button 
              onClick={createChatbot}
              className="px-6 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-semibold hover:bg-neutral-200 transition-all"
            >
              Create First Bot
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {chatbots.map((bot) => (
                <motion.div
                  key={bot.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => router.push(`/builder/${bot.id}`)}
                  className="group bg-white border border-neutral-200 rounded-3xl p-6 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div 
                    className="absolute top-0 left-0 w-full h-1" 
                    style={{ backgroundColor: bot.primaryColor }}
                  />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                      style={{ backgroundColor: bot.primaryColor }}
                    >
                      <Bot className="w-6 h-6" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => deleteChatbot(bot.id, e)}
                        className="p-2 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold mb-1 group-hover:text-emerald-600 transition-colors">{bot.name}</h3>
                  <p className="text-sm text-neutral-500 mb-6">Bot Name: {bot.botName}</p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-50">
                    <span className="text-xs text-neutral-400">
                      {bot.createdAt?.toDate().toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-600">
                      Edit <Settings className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
