'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, MessageSquare, Loader2, User, Mic, MicOff, Volume2 } from 'lucide-react';
import { useVoiceChat } from '@/hooks/use-voice-chat';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'bot';
  text: string;
}

export default function ChatPreview({ chatbot }: { chatbot: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const clientIdRef = useRef<string | null>(null);

  const {
    status: voiceStatus,
    isRecording,
    connect: connectVoice,
    disconnect: disconnectVoice,
    startRecording,
    stopRecording,
    warmup,
    sendText,
  } = useVoiceChat(conversationId, {
    onTranscript: (role, text) => {
      const roleMapped = role === 'input' ? 'user' : 'bot';
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === roleMapped) {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            ...lastMsg,
            text: lastMsg.text + (lastMsg.text.endsWith(' ') || text.startsWith(' ') ? '' : ' ') + text
          };
          return newMessages;
        }
        return [...prev, { role: roleMapped, text }];
      });
    },
    metadata: {
      provider_llm: chatbot.providerLlm,
      provider_storage: chatbot.providerStorage,
      provider_embedding: chatbot.providerEmbedding,
      collection_name: chatbot.collectionName,
    }
  });

  const toggleVoice = async () => {
    if (voiceStatus === 'idle' || voiceStatus === 'error') {
      await warmup();
      connectVoice();
    } else if (voiceStatus === 'connected') {
      startRecording();
    } else if (voiceStatus === 'listening') {
      stopRecording();
    } else {
      // speaking, thinking, etc.
      disconnectVoice();
    }
  };

  useEffect(() => {
    if (!conversationId) {
      setConversationId(crypto.randomUUID());
    }
    const storedClientId = window.localStorage.getItem('foxai_client_id');
    if (storedClientId) {
      clientIdRef.current = storedClientId;
    } else {
      const newClientId = crypto.randomUUID();
      clientIdRef.current = newClientId;
      window.localStorage.setItem('foxai_client_id', newClientId);
    }

    if (chatbot.welcomeMessage) {
      setMessages([{ role: 'bot', text: chatbot.welcomeMessage }]);
    }
  }, [chatbot.welcomeMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);

    if (voiceStatus !== 'idle') {
      sendText(userMsg);
      return;
    }

    setIsTyping(true);

    try {
      const apiUrl = chatbot.apiUrl || 'https://devaibigdata.foxai.com.vn:5720/query/v1/agents/public/chat/public/stream';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*'
        },
        body: JSON.stringify({
          message: userMsg,
          client_id: clientIdRef.current,
          conversation_id: conversationId,
          provider_llm: chatbot.providerLlm || "gemini",
          provider_storage: chatbot.providerStorage || "qdrant",
          provider_embedding: chatbot.providerEmbedding || "gemini",
          collection_name: chatbot.collectionName || "LVB_Customer_Support"
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botText = '';
      let buffer = '';
      let isFirstChunk = true;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; 
        
        let newChunkText = '';
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Ignore SSE comments (like ": keepalive"), events, etc.
          if (trimmedLine.startsWith(':') || trimmedLine.startsWith('event:') || trimmedLine.startsWith('id:') || trimmedLine.startsWith('retry:')) {
            continue;
          }

          if (trimmedLine.startsWith('data:')) {
            const dataStr = trimmedLine.slice(5).trim();
            if (dataStr === '[DONE]' || dataStr.toLowerCase() === 'keepalive') continue;
            try {
              const data = JSON.parse(dataStr);
              const textChunk = data.content || data.text || data.message || data.data || '';
              const valueToAdd = typeof textChunk === 'string' ? textChunk : JSON.stringify(textChunk);
              if (valueToAdd && valueToAdd.trim().toLowerCase() !== 'keepalive') {
                newChunkText += valueToAdd;
              }
            } catch {
              newChunkText += dataStr;
            }
          } else if (trimmedLine !== '') {
            if (trimmedLine.toLowerCase() !== 'keepalive') {
              newChunkText += trimmedLine;
            }
          }
        }

        if (newChunkText) {
          botText += newChunkText;
          if (isFirstChunk) {
            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'bot', text: botText }]);
            isFirstChunk = false;
          } else {
            setMessages(prev => {
              const newMessages = [...prev];
              if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'bot') {
                newMessages[newMessages.length - 1].text = botText;
              }
              return newMessages;
            });
          }
        }
      }
      
      if (isFirstChunk) {
        setIsTyping(false);
        setMessages(prev => [...prev, { role: 'bot', text: '' }]);
      }
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'bot' && lastMsg.text === '') {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = "Sorry, I'm having trouble connecting right now.";
          return newMessages;
        }
        return [...prev, { role: 'bot', text: "Sorry, I'm having trouble connecting right now." }];
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(5px)' }}
            transition={{ type: "spring", stiffness: 250, damping: 25 }}
            className="w-[400px] h-[600px] bg-white/95 backdrop-blur-2xl text-sm rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-neutral-200/50 flex flex-col overflow-hidden mb-6"
          >
            {/* Header */}
            <div className="p-4 flex justify-between items-center text-white relative overflow-hidden">
              <div className="absolute inset-0" style={{ backgroundColor: Object.keys(chatbot).length > 0 ? chatbot.primaryColor : '#000' }}></div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-black/25 backdrop-blur-sm"></div>

              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)] overflow-hidden">
                  {chatbot.logoUrl ? (
                    <img src={chatbot.logoUrl} alt={chatbot.botName} className="w-full h-full object-cover" />
                  ) : (
                    <Bot className="w-7 h-7 text-white drop-shadow-md" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-[16px] leading-tight text-white drop-shadow-sm tracking-wide">{chatbot.botName}</h3>
                  <div className="flex items-center gap-1.5 mt-1 opacity-95">
                     <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                     <span className="text-[10px] uppercase tracking-widest font-bold text-white/90 drop-shadow-sm">Online</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-all relative z-10 hover:rotate-90 duration-300"
              >
                <X className="w-5 h-5 drop-shadow-sm" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50 scroll-smooth pb-8"
            >
              {messages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'bot' && (
                    <div className="w-8 h-8 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center mr-2.5 mt-auto mb-1 flex-shrink-0 overflow-hidden">
                      {chatbot.logoUrl ? (
                        <img src={chatbot.logoUrl} alt="Bot" className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-4.5 h-4.5" style={{ color: chatbot.primaryColor }} />
                      )}
                    </div>
                  )}
                  <div 
                    className={`max-w-[78%] p-3.5 px-4 text-[14.5px] leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-neutral-900 text-white rounded-[1.2rem] rounded-tr-[4px] shadow-[0_4px_14px_rgba(0,0,0,0.08)]' 
                        : 'bg-white text-neutral-800 border-neutral-200/60 rounded-[1.2rem] rounded-tl-[4px] ring-1 ring-inset ring-neutral-100/50'
                    }`}
                  >
                    <ReactMarkdown
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1 marker:text-neutral-500" {...props} />,
                        a: ({node, ...props}) => <a className="text-blue-500 font-semibold hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                        code: ({node, inline, className, children, ...props}: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline ? (
                            <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-xl overflow-x-auto text-[13px] my-3 border border-neutral-800 shadow-inner">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code className="bg-neutral-200/60 text-pink-600 px-1.5 py-0.5 rounded-md text-[13.5px] font-mono" {...props}>
                              {children}
                            </code>
                          );
                        },
                        h1: ({node, ...props}) => <h1 className="text-[17px] font-bold mb-2 mt-4" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-[16px] font-bold mb-2 mt-3" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-[15px] font-bold mb-2 mt-3" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-neutral-900" {...props} />,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center mr-2.5 mt-auto mb-1 flex-shrink-0 overflow-hidden">
                    {chatbot.logoUrl ? (
                      <img src={chatbot.logoUrl} alt="Bot" className="w-full h-full object-cover" />
                    ) : (
                      <Bot className="w-4.5 h-4.5" style={{ color: chatbot.primaryColor }} />
                    )}
                  </div>
                  <div className="bg-white ring-1 ring-inset ring-neutral-100/50 px-4 py-3.5 rounded-[1.2rem] rounded-tl-[4px] shadow-sm flex items-center gap-1.5 h-[46px]">
                    <motion.div animate={{ y: [-3, 3, -3], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: chatbot.primaryColor }} />
                    <motion.div animate={{ y: [-3, 3, -3], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.15 }} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: chatbot.primaryColor }} />
                    <motion.div animate={{ y: [-3, 3, -3], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.3 }} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: chatbot.primaryColor }} />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white/90 backdrop-blur-md border-t border-neutral-100">
              <div className="flex gap-2.5 items-center">
                <div className="flex-1 relative group">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={voiceStatus !== 'idle' ? "Listening via Voice..." : (chatbot.inputPlaceholder || "Ask me anything...")}
                    disabled={voiceStatus !== 'idle'}
                    className="w-full px-4 py-3.5 rounded-2xl bg-neutral-100/60 border border-neutral-200/50 outline-none text-[14.5px] font-medium placeholder:text-neutral-400 group-hover:bg-neutral-100 transition-colors focus:bg-white focus:ring-2 focus:border-transparent target-ring-color disabled:opacity-50"
                  />
                  <style dangerouslySetInnerHTML={{__html: `.target-ring-color:focus { --tw-ring-color: ${chatbot.primaryColor}; --tw-ring-opacity: 0.25; }`}} />
                </div>

                {/* Voice Button */}
                <button 
                  onClick={toggleVoice}
                  className={`p-3.5 rounded-2xl transition-all flex items-center justify-center min-w-[50px] min-h-[50px] relative overflow-hidden
                    ${voiceStatus !== 'idle' ? 'text-white' : 'text-neutral-400 bg-neutral-100 hover:bg-neutral-200'}
                  `}
                  style={voiceStatus !== 'idle' ? { backgroundColor: chatbot.primaryColor } : {}}
                >
                  <AnimatePresence mode="wait">
                    {voiceStatus === 'idle' ? (
                      <motion.div key="mic-off" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Mic className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <motion.div key="mic-on" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="relative z-10">
                        {isRecording ? <MicOff className="w-5 h-5 animate-pulse" /> : <Volume2 className="w-5 h-5" />}
                        {isRecording && (
                          <motion.div 
                            layoutId="voice-ping"
                            className="absolute inset-0 rounded-full bg-white/20 -m-2 animate-ping"
                          />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>

                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping || voiceStatus !== 'idle'}
                  className="p-3.5 rounded-2xl text-white transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:scale-105 active:scale-95 flex items-center justify-center min-w-[50px] min-h-[50px]"
                  style={{ backgroundColor: chatbot.primaryColor }}
                >
                  {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                </button>
              </div>
              <p className="text-[10px] text-center text-neutral-400 mt-3.5 font-medium tracking-wide">
                ⚡ Powered by <span className="font-semibold text-neutral-500">FoxAI Chat</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.4)] flex items-center justify-center text-white relative group border border-white/20"
        style={{ backgroundColor: chatbot.primaryColor }}
      >
        {/* Tooltip */}
        {!isOpen && (
          <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-xl translate-x-2 group-hover:translate-x-0 hidden sm:block">
            {chatbot.tooltipText || `Chat with ${chatbot.botName || "us"} ✨`}
            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-neutral-900 rotate-45 rounded-sm"></div>
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/15 to-transparent pointer-events-none"></div>
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ opacity: 0, rotate: -90, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 90, scale: 0.5 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
              <X className="w-7 h-7 drop-shadow-md" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ opacity: 0, rotate: 90, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: -90, scale: 0.5 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="w-full h-full flex items-center justify-center">
              {chatbot.logoUrl ? (
                <img src={chatbot.logoUrl} alt="Chat" className="w-full h-full object-cover rounded-full shadow-md" />
              ) : (
                <MessageSquare className="w-7 h-7 drop-shadow-md fill-current" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Unread indicator */}
        {!isOpen && (
          <div className="absolute top-0 right-0 transform xl:translate-x-1/4 xl:-translate-y-1/4">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
            </span>
          </div>
        )}
      </motion.button>
    </div>
  );
}
