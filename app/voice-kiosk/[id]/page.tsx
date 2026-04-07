'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Volume2, Bot, Info, RefreshCw, X, ArrowLeft } from 'lucide-react';
import { useVoiceChat, VoiceChatStatus } from '@/hooks/use-voice-chat';
import Link from 'next/link';

export default function VoiceKioskPage() {
  const params = useParams();
  const id = params?.id as string;
  const [chatbot, setChatbot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscripts, setShowTranscripts] = useState(false);

  const [conversationId, setConversationId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let cid = localStorage.getItem(`kiosk_cid_${id}`);
      if (!cid) {
        // Fallback for crypto.randomUUID
        cid = (typeof crypto !== 'undefined' && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem(`kiosk_cid_${id}`, cid);
      }
      setConversationId(cid);
    }
  }, [id]);

  const {
    status,
    transcripts,
    isRecording,
    connect,
    startRecording,
    stopRecording,
    warmup,
  } = useVoiceChat(conversationId, {
    onError: (err) => setError(err),
  });

  useEffect(() => {
    const fetchConfig = async () => {
      if (!id) return;
      console.log('Fetching config for chatbot:', id);
      try {
        const docSnap = await getDoc(doc(db, 'chatbots', id));
        if (docSnap.exists()) {
          console.log('Config loaded:', docSnap.data());
          setChatbot(docSnap.data());
        } else {
          console.error('Chatbot not found in Firestore:', id);
          setError('Kiosk configuration not found');
        }
      } catch (err) {
        console.error('Failed to fetch config:', err);
        setError('Failed to load kiosk configuration');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [id]);

  // Handle interaction to start AudioContext (browser requirement)
  const handleStart = async () => {
    console.log('Tap to Wake clicked, starting connection...');
    await warmup();
    connect();
  };

  const getStatusText = (s: VoiceChatStatus) => {
    switch (s) {
      case 'idle': return 'Tap to Start';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Ready';
      case 'listening': return 'I am listening...';
      case 'thinking': return 'Thinking...';
      case 'speaking': return 'Speaking...';
      case 'error': return 'An error occurred';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-6 font-sans">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full mb-4"
        />
        <p className="text-neutral-400 font-medium">Initializing Kiosk...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-6 font-sans text-center">
        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mb-6">
          <X className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Error</h1>
        <p className="text-neutral-400 mb-8 max-w-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Retry
        </button>
      </div>
    );
  }

  const lastTranscript = transcripts.length > 0 ? transcripts[transcripts.length - 1] : null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans overflow-hidden relative selection:bg-emerald-500/30">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center border border-white/10 shadow-lg overflow-hidden">
                {chatbot?.logoUrl ? (
                  <img src={chatbot.logoUrl} alt={chatbot.botName} className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-6 h-6 text-emerald-400" />
                )}
             </div>
             <div>
                <h2 className="font-bold text-lg leading-tight">{chatbot?.botName || 'AI Assistant'}</h2>
                <div className="flex items-center gap-1.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${status !== 'idle' ? 'bg-emerald-400' : 'bg-neutral-500'} animate-pulse`} />
                   <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">
                     {status === 'idle' ? 'Offline' : 'Live Kiosk'}
                   </span>
                </div>
             </div>
          </div>
        </div>

        <button 
          onClick={() => setShowTranscripts(!showTranscripts)}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md transition-all active:scale-95"
        >
          <Info className="w-5 h-5 opacity-60" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        
        {/* The Orb */}
        <div className="relative mb-16">
          <AnimatePresence>
            {(status === 'listening' || status === 'speaking' || status === 'thinking') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 -m-8"
              >
                <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping" />
                <div className="absolute inset-0 bg-emerald-500/5 rounded-full animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            animate={
              status === 'listening' ? { scale: [1, 1.1, 1] } :
              status === 'speaking' ? { scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] } :
              status === 'thinking' ? { rotate: 360 } :
              {}
            }
            transition={
              status === 'thinking' ? { repeat: Infinity, duration: 4, ease: "linear" } :
              { repeat: Infinity, duration: 2, ease: "easeInOut" }
            }
            className={`w-48 h-48 sm:w-64 sm:h-64 rounded-full flex items-center justify-center relative overflow-hidden group 
              ${status === 'idle' ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-900 border-white/10'} border-2 shadow-2xl backdrop-blur-sm shadow-emerald-500/20`}
          >
             <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
             
             {status === 'idle' ? (
                <button 
                  onClick={handleStart}
                  className="w-full h-full flex flex-col items-center justify-center gap-4 hover:bg-white/5 transition-colors"
                >
                  <Volume2 className="w-12 h-12 text-white/40 mb-2" />
                  <span className="text-xl font-bold tracking-tight">Tap to Wake</span>
                </button>
             ) : (
                <div className="flex items-center justify-center">
                  {status === 'thinking' ? (
                    <Bot className="w-20 h-20 text-emerald-400 group-hover:scale-110 transition-transform duration-500" />
                  ) : status === 'speaking' ? (
                    <div className="flex items-center gap-1 h-12">
                      {[1,2,3,4,5].map(i => (
                        <motion.div
                          key={i}
                          animate={{ height: [12, 32, 16, 48, 12] }}
                          transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }}
                          className="w-2 bg-emerald-400 rounded-full"
                        />
                      ))}
                    </div>
                  ) : (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                       <Mic className="w-20 h-20 text-emerald-400" />
                    </motion.div>
                  )}
                </div>
             )}
          </motion.div>
        </div>

        {/* Status Indicator */}
        <div className="text-center mb-12">
          <motion.h1 
            key={status}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-black tracking-tight mb-3"
          >
            {status === 'idle' ? 'Ready to talk?' : getStatusText(status)}
          </motion.h1>
          <p className="text-neutral-500 font-medium">
             {status === 'listening' ? 'Speak clearly into your microphone' : 
              status === 'speaking' ? 'Listening to your response' : 
              status === 'connected' ? 'Interact using your voice' : 'Tap the button below'}
          </p>
        </div>

        {/* Live Transcript Bubble */}
        <AnimatePresence>
          {lastTranscript && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className={`max-w-2xl w-full p-8 rounded-[2.5rem] border backdrop-blur-2xl transition-colors duration-500
                ${lastTranscript.role === 'user' 
                  ? 'bg-white/5 border-white/10' 
                  : 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_20px_50px_-15px_rgba(16,185,129,0.2)]'
                }`}
            >
              <div className="flex items-start gap-4 mb-4 opacity-50">
                {lastTranscript.role === 'user' ? <Mic className="w-4 h-4 mt-1" /> : <Bot className="w-4 h-4 mt-1" />}
                <span className="text-[10px] uppercase tracking-[0.2em] font-black">
                  {lastTranscript.role === 'user' ? 'Transcript' : 'AI Response'}
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-medium leading-relaxed leading-snug tracking-tight">
                {lastTranscript.text}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mic Controls (Float Footer) */}
      <footer className="absolute bottom-0 left-0 right-0 p-12 flex justify-center z-20">
        {status !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-6 p-4 rounded-full bg-white/5 border border-white/10 backdrop-blur-3xl shadow-2xl"
          >
            <button 
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 select-none touch-none
                ${isRecording 
                  ? 'bg-red-500 shadow-red-500/50' 
                  : 'bg-emerald-500 shadow-emerald-500/50 hover:bg-emerald-400'
                }`}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
            <div className="pr-6">
              <p className="font-bold text-sm leading-tight">{isRecording ? 'Listening...' : 'Hold to Speak'}</p>
              <p className="text-xs opacity-50 font-medium">Release to send</p>
            </div>
          </motion.div>
        )}
      </footer>

      {/* Full Transcripts Overlay */}
      <AnimatePresence>
        {showTranscripts && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute inset-y-0 right-0 w-full sm:w-[400px] bg-neutral-900/95 backdrop-blur-3xl border-l border-white/10 z-50 p-8 flex flex-col shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-2xl font-black">Conversation</h3>
               <button onClick={() => setShowTranscripts(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
              {transcripts.map((t, i) => (
                <div key={i} className={`flex flex-col ${t.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm max-w-[85%] 
                    ${t.role === 'user' ? 'bg-emerald-500 text-black font-bold' : 'bg-white/10 border border-white/10'}`}>
                    {t.text}
                  </div>
                  <span className="text-[10px] mt-1.5 opacity-30 font-bold uppercase tracking-widest px-1">
                    {t.role === 'user' ? 'You' : chatbot?.botName || 'AI'}
                  </span>
                </div>
              ))}
              {transcripts.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                   <Bot className="w-12 h-12 mb-4" />
                   <p className="font-medium">No conversation history yet</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
