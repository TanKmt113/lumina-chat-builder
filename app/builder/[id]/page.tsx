'use client';

import { useState, useEffect, use } from 'react';
import { auth, db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  Bot, 
  Palette, 
  MessageSquare, 
  Brain, 
  Code, 
  Eye, 
  Check, 
  Loader2,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ChatPreview from '@/components/ChatPreview';
import EmbedCode from '@/components/EmbedCode';

interface Chatbot {
  id: string;
  name: string;
  botName: string;
  primaryColor: string;
  welcomeMessage: string;
  systemPrompt: string;
  userId: string;
  logoUrl?: string;
  inputPlaceholder?: string;
  apiUrl?: string;
  providerLlm?: string;
  providerStorage?: string;
  providerEmbedding?: string;
  collectionName?: string;
  tooltipText?: string;
}

export default function BuilderPage() {
  const params = useParams();
  const id = params?.id as string;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [activeTab, setActiveTab] = useState<'appearance' | 'behavior' | 'embed'>('appearance');
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (!u) router.push('/');
      else setUser(u);
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!user || !id) return;

    const unsubscribe = onSnapshot(doc(db, 'chatbots', id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Chatbot;
        if (data.userId !== user.uid) {
          router.push('/dashboard');
          return;
        }
        setChatbot({ ...data, id: snapshot.id });
        setLoading(false);
      } else {
        router.push('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [user, id, router]);

  const updateChatbot = async (updates: Partial<Chatbot>) => {
    if (!chatbot) return;
    setChatbot({ ...chatbot, ...updates });
    setSaved(false);
  };

  const saveChanges = async () => {
    if (!chatbot || !id) return;
    setSaving(true);
    try {
      const updatePayload: Record<string, any> = {
        name: chatbot.name,
        botName: chatbot.botName,
        primaryColor: chatbot.primaryColor,
        updatedAt: serverTimestamp(),
      };

      if (chatbot.welcomeMessage !== undefined) updatePayload.welcomeMessage = chatbot.welcomeMessage;
      if (chatbot.systemPrompt !== undefined) updatePayload.systemPrompt = chatbot.systemPrompt;
      if (chatbot.logoUrl !== undefined) updatePayload.logoUrl = chatbot.logoUrl;
      if (chatbot.inputPlaceholder !== undefined) updatePayload.inputPlaceholder = chatbot.inputPlaceholder;
      if (chatbot.apiUrl !== undefined) updatePayload.apiUrl = chatbot.apiUrl;
      if (chatbot.providerLlm !== undefined) updatePayload.providerLlm = chatbot.providerLlm;
      if (chatbot.providerStorage !== undefined) updatePayload.providerStorage = chatbot.providerStorage;
      if (chatbot.providerEmbedding !== undefined) updatePayload.providerEmbedding = chatbot.providerEmbedding;
      if (chatbot.collectionName !== undefined) updatePayload.collectionName = chatbot.collectionName;
      if (chatbot.tooltipText !== undefined) updatePayload.tooltipText = chatbot.tooltipText;

      await updateDoc(doc(db, 'chatbots', id), updatePayload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      console.error('Save failed:', error);
      alert('Save failed: ' + (error?.message || 'Unknown Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `logos/${id}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateChatbot({ logoUrl: url });
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading || !chatbot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 font-sans flex flex-col">
      {/* Builder Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-neutral-200" />
            <div>
              <input 
                type="text" 
                value={chatbot.name}
                onChange={(e) => updateChatbot({ name: e.target.value })}
                className="text-lg font-bold bg-transparent border-none focus:ring-0 p-0 w-full"
              />
              <p className="text-xs text-neutral-400">ID: {chatbot.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={saveChanges}
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                saved ? 'bg-emerald-500 text-white' : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-20 bg-white border-r border-neutral-200 flex flex-col items-center py-8 gap-6">
          <button 
            onClick={() => setActiveTab('appearance')}
            className={`p-3 rounded-2xl transition-all ${activeTab === 'appearance' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-neutral-400 hover:bg-neutral-50'}`}
            title="Appearance"
          >
            <Palette className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('behavior')}
            className={`p-3 rounded-2xl transition-all ${activeTab === 'behavior' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-neutral-400 hover:bg-neutral-50'}`}
            title="AI Behavior"
          >
            <Brain className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('embed')}
            className={`p-3 rounded-2xl transition-all ${activeTab === 'embed' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-neutral-400 hover:bg-neutral-50'}`}
            title="Embed Code"
          >
            <Code className="w-6 h-6" />
          </button>
        </aside>

        {/* Editor Panel */}
        <div className="w-full max-w-md bg-white border-r border-neutral-200 overflow-y-auto">
          <div className="p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'appearance' && (
                <motion.div 
                  key="appearance"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <Palette className="w-5 h-5 text-emerald-600" />
                      Appearance
                    </h2>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">Bot Name</label>
                        <input 
                          type="text" 
                          value={chatbot.botName}
                          onChange={(e) => updateChatbot({ botName: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                          placeholder="e.g. FoxAI Assistant"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">Bot Logo</label>
                        <div className="flex gap-4 items-end">
                          <div className="w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
                            {chatbot.logoUrl ? (
                              <img src={chatbot.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                              <Bot className="w-8 h-8 text-neutral-400" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <input 
                              type="text" 
                              value={chatbot.logoUrl || ''}
                              onChange={(e) => updateChatbot({ logoUrl: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 transition-all outline-none"
                              placeholder="Paste logo URL here..."
                            />
                            {/* Temporarily hidden upload functionality
                            <label className="block">
                              <span className="sr-only">Choose logo file</span>
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                              />
                            </label>
                            */}
                          </div>
                        </div>
                        {/* {uploading && <p className="text-[10px] text-emerald-600 animate-pulse">Uploading...</p>} */}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">Primary Color</label>
                        <div className="flex gap-3">
                          <input 
                            type="color" 
                            value={chatbot.primaryColor}
                            onChange={(e) => updateChatbot({ primaryColor: e.target.value })}
                            className="w-12 h-12 rounded-xl border-none p-0 cursor-pointer overflow-hidden"
                          />
                          <input 
                            type="text" 
                            value={chatbot.primaryColor}
                            onChange={(e) => updateChatbot({ primaryColor: e.target.value })}
                            className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none font-mono text-sm uppercase"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">Welcome Message</label>
                        <textarea 
                          value={chatbot.welcomeMessage}
                          onChange={(e) => updateChatbot({ welcomeMessage: e.target.value })}
                          rows={4}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none resize-none"
                          placeholder="The first message your users see..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">Input Placeholder</label>
                        <input 
                          type="text" 
                          value={chatbot.inputPlaceholder || ''}
                          onChange={(e) => updateChatbot({ inputPlaceholder: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                          placeholder="Ask me anything..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">Tooltip Text</label>
                        <input 
                          type="text" 
                          value={chatbot.tooltipText || ''}
                          onChange={(e) => updateChatbot({ tooltipText: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                          placeholder="Chat with us ✨"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'behavior' && (
                <motion.div 
                  key="behavior"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-emerald-600" />
                      AI Behavior
                    </h2>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">System Prompt</label>
                        <p className="text-xs text-neutral-400 mb-2">Define your bot&apos;s personality and knowledge base.</p>
                        <textarea 
                          value={chatbot.systemPrompt}
                          onChange={(e) => updateChatbot({ systemPrompt: e.target.value })}
                          rows={12}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none resize-none font-mono text-sm"
                          placeholder="You are a helpful assistant for a SaaS company called FoxAI..."
                        />
                      </div>
                      
                      <div className="space-y-4 pt-6 border-t border-neutral-100">
                        <h3 className="font-semibold text-neutral-800">API Configuration</h3>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-neutral-700">API Stream URL</label>
                          <input 
                            type="text" 
                            value={chatbot.apiUrl || ''}
                            onChange={(e) => updateChatbot({ apiUrl: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none text-sm"
                            placeholder="https://devaibigdata.foxai.com.vn:5720/query/v1/agents/public/chat/public/stream"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-neutral-700">Provider LLM</label>
                            <input 
                              type="text" 
                              value={chatbot.providerLlm || ''}
                              onChange={(e) => updateChatbot({ providerLlm: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 transition-all outline-none text-sm"
                              placeholder="gemini"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-neutral-700">Provider Storage</label>
                            <input 
                              type="text" 
                              value={chatbot.providerStorage || ''}
                              onChange={(e) => updateChatbot({ providerStorage: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 transition-all outline-none text-sm"
                              placeholder="qdrant"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-neutral-700">Provider Embedding</label>
                            <input 
                              type="text" 
                              value={chatbot.providerEmbedding || ''}
                              onChange={(e) => updateChatbot({ providerEmbedding: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 transition-all outline-none text-sm"
                              placeholder="gemini"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-neutral-700">Collection Name</label>
                            <input 
                              type="text" 
                              value={chatbot.collectionName || ''}
                              onChange={(e) => updateChatbot({ collectionName: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-emerald-500 transition-all outline-none text-sm"
                              placeholder="LVB_Customer_Support"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'embed' && (
                <motion.div 
                  key="embed"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <Code className="w-5 h-5 text-emerald-600" />
                      Embed Code
                    </h2>
                    <EmbedCode chatbotId={chatbot.id} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 bg-neutral-100 flex flex-col items-center justify-center p-12 relative overflow-hidden">
          <div className="absolute top-8 left-8 flex items-center gap-2 text-neutral-400 text-sm font-medium">
            <Eye className="w-4 h-4" />
            Live Preview
          </div>
          
          {/* Mock Website Background */}
          <div className=" mt-2 w-full max-w-4xl bg-white rounded-3xl shadow-2xl shadow-neutral-200/50 h-full overflow-hidden border border-neutral-200 flex flex-col">
            <div className="h-12 border-b border-neutral-100 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-100" />
              <div className="w-3 h-3 rounded-full bg-amber-100" />
              <div className="w-3 h-3 rounded-full bg-emerald-100" />
              <div className="ml-4 h-6 flex-1 bg-neutral-50 rounded-lg" />
            </div>
            <div className="flex-1 p-12 space-y-8">
              <div className="h-8 w-1/3 bg-neutral-50 rounded-xl" />
              <div className="space-y-4">
                <div className="h-4 w-full bg-neutral-50 rounded-lg" />
                <div className="h-4 w-full bg-neutral-50 rounded-lg" />
                <div className="h-4 w-2/3 bg-neutral-50 rounded-lg" />
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="aspect-video bg-neutral-50 rounded-2xl" />
                <div className="aspect-video bg-neutral-50 rounded-2xl" />
                <div className="aspect-video bg-neutral-50 rounded-2xl" />
              </div>
            </div>
          </div>

          {/* Chatbot Widget Preview */}
          <div className="absolute bottom-12 right-12">
            <ChatPreview chatbot={chatbot} />
          </div>
        </div>
      </div>
    </div>
  );
}
