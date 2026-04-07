'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { base64ToPcm16, float32ToPcm16, arrayBufferToBase64 } from '@/lib/audio-utils';

export type VoiceChatStatus = 'idle' | 'connecting' | 'connected' | 'listening' | 'thinking' | 'speaking' | 'error';

interface VoiceChatMetadata {
  provider_llm?: string;
  provider_storage?: string;
  provider_embedding?: string;
  collection_name?: string;
}

interface UseVoiceChatOptions {
  onTranscript?: (type: 'input' | 'output', text: string) => void;
  onStatusChange?: (status: VoiceChatStatus) => void;
  onError?: (error: string) => void;
  metadata?: VoiceChatMetadata;
  apiUrl?: string;
}

export function useVoiceChat(conversationId: string, options: UseVoiceChatOptions = {}) {
  const [status, setStatus] = useState<VoiceChatStatus>('idle');
  const [transcripts, setTranscripts] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pendingChunksRef = useRef<Float32Array[]>([]);
  const pendingSamplesCountRef = useRef(0);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateStatus = useCallback((newStatus: VoiceChatStatus) => {
    setStatus(newStatus);
    options.onStatusChange?.(newStatus);
  }, [options]);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    if (!conversationId) {
      console.warn('No conversationId provided to useVoiceChat');
      return;
    }

    updateStatus('connecting');
    
    // Use the API URL from options (WebSocket) or fallback to default
    let baseUrl = options.apiUrl || 'wss://devaibigdata.foxai.com.vn:5620/query/v1/agents/voice-kiosk';
    
    // Ensure the URL has the conversation_id
    let wsUrl = baseUrl.includes('?') 
      ? `${baseUrl}&conversation_id=${encodeURIComponent(conversationId)}`
      : `${baseUrl}?conversation_id=${encodeURIComponent(conversationId)}`;
    
    if (options.metadata) {
      if (options.metadata.provider_llm) wsUrl += `&provider_llm=${encodeURIComponent(options.metadata.provider_llm)}`;
      if (options.metadata.provider_storage) wsUrl += `&provider_storage=${encodeURIComponent(options.metadata.provider_storage)}`;
      if (options.metadata.provider_embedding) wsUrl += `&provider_embedding=${encodeURIComponent(options.metadata.provider_embedding)}`;
      if (options.metadata.collection_name) wsUrl += `&collection_name=${encodeURIComponent(options.metadata.collection_name)}`;
    }

    console.log('Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Voice WebSocket connected');
      updateStatus('connected');
    };

    ws.onmessage = async (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', event.data);
        return;
      }

      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: message.timestamp }));
          break;
        
        case 'audio':
          const pcm16 = base64ToPcm16(message.data);
          const float32 = new Float32Array(pcm16.length);
          for (let i = 0; i < pcm16.length; i++) {
            float32[i] = pcm16[i] / 32768.0;
          }
          queuePlayback(float32);
          break;

        case 'input_transcript':
          options.onTranscript?.('input', message.data);
          setTranscripts(prev => [...prev, { role: 'user', text: message.data }]);
          break;

        case 'output_transcript':
          options.onTranscript?.('output', message.data);
          setTranscripts(prev => [...prev, { role: 'bot', text: message.data }]);
          break;

        case 'turn_complete':
          // Flush any remaining small fragments immediately
          flushPendingChunks();
          
          // Wait for playback to finish before going back to 'connected'
          if (!isPlayingRef.current) {
            updateStatus('connected');
          }
          break;

        case 'error':
          console.error('Voice Server Error:', message.data);
          options.onError?.(message.data);
          updateStatus('error');
          break;
      }
    };

    ws.onclose = (event) => {
      console.log('Voice WebSocket closed:', event.code, event.reason);
      updateStatus('idle');
    };

    ws.onerror = (err: Event) => {
      console.error('Voice WebSocket Error Details:', {
        type: err.type,
        readyState: ws.readyState,
        url: ws.url,
      });
      options.onError?.(`Failed to connect to voice server. URL: ${ws.url}`);
      updateStatus('error');
    };
  }, [conversationId, options, updateStatus]);

  const mergeChunks = (chunks: Float32Array[], totalLength: number) => {
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  };

  const flushPendingChunks = useCallback(async () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (pendingChunksRef.current.length > 0) {
      const merged = mergeChunks(pendingChunksRef.current, pendingSamplesCountRef.current);
      playbackQueueRef.current.push(merged);
      pendingChunksRef.current = [];
      pendingSamplesCountRef.current = 0;
      
      await processQueuePlayback();
    }
  }, [status]);

  const queuePlayback = async (audioData: Float32Array) => {
    pendingChunksRef.current.push(audioData);
    pendingSamplesCountRef.current += audioData.length;
    
    // Threshold: 2400 samples = 100ms at 24kHz
    if (pendingSamplesCountRef.current >= 2400) {
      flushPendingChunks();
    } else {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        flushPendingChunks();
      }, 150);
    }

    // Process queue proactively whenever new data arrives
    if (playbackQueueRef.current.length >= 1) {
      await processQueuePlayback();
    }
  };

  const processQueuePlayback = async () => {
    if (playbackQueueRef.current.length === 0) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    isPlayingRef.current = true;
    updateStatus('speaking');

    // Schedule ALL available chunks in the queue
    while (playbackQueueRef.current.length > 0) {
      const chunk = playbackQueueRef.current.shift()!;
      const buffer = ctx.createBuffer(1, chunk.length, 24000);
      buffer.getChannelData(0).set(chunk);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      // If the scheduled end of previous chunk is in the past, reset the anchor to now + small delay
      const anchorResetDelay = 0.05; // 50ms buffer
      let startTime = Math.max(now + anchorResetDelay, nextStartTimeRef.current);
      
      source.start(startTime);
      nextStartTimeRef.current = startTime + buffer.duration;
      scheduledSourcesRef.current.push(source);

      source.onended = () => {
        scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
        if (scheduledSourcesRef.current.length === 0 && playbackQueueRef.current.length === 0) {
          isPlayingRef.current = false;
          // Only return to 'connected' if we're not waiting for more data
          if (status === 'speaking') {
            updateStatus('connected');
          }
        }
      };
    }
  };

  const startRecording = async () => {
    console.log('Voice session: startRecording triggered');
    try {
      // Interruption logic: Clear playback queue and stop active audio
      playbackQueueRef.current = [];
      isPlayingRef.current = false;
      scheduledSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      scheduledSourcesRef.current = [];
      nextStartTimeRef.current = 0;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        let resampledData: Float32Array;
        if (ctx.sampleRate !== 16000) {
          const ratio = ctx.sampleRate / 16000;
          const newLength = Math.round(inputData.length / ratio);
          resampledData = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            resampledData[i] = inputData[Math.round(i * ratio)];
          }
        } else {
          resampledData = inputData;
        }

        const pcm16 = float32ToPcm16(resampledData);
        if (pcm16.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Log occasionally to confirm sending data
          if (Math.random() < 0.01) console.log('Sending audio data chunk...');
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            data: arrayBufferToBase64(pcm16.buffer as ArrayBuffer)
          }));
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      
      setIsRecording(true);
      updateStatus('listening');
    } catch (err) {
      console.error('Failed to start recording:', err);
      options.onError?.('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_audio_stream' }));
    }
    
    setIsRecording(false);
    updateStatus('thinking');
  };

  const disconnect = useCallback(() => {
    stopRecording();
    
    // Clear playback
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    scheduledSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    scheduledSourcesRef.current = [];
    nextStartTimeRef.current = 0;

    wsRef.current?.close();
    wsRef.current = null;
    updateStatus('idle');
  }, [stopRecording, updateStatus]);

  const warmup = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    console.log('AudioContext initialized and resumed:', ctx.state);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const sendText = (text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', data: text }));
    }
  };

  return {
    status,
    transcripts,
    isRecording,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    warmup,
    sendText,
  };
}
