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
    let wsUrl = `wss://devaibigdata.foxai.com.vn:5620/query/v1/agents/voice-kiosk?conversation_id=${encodeURIComponent(conversationId)}`;
    
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
          updateStatus('connected');
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

  const queuePlayback = (audioData: Float32Array) => {
    playbackQueueRef.current.push(audioData);
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  };

  const playNextInQueue = async () => {
    if (playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      updateStatus('connected');
      return;
    }

    isPlayingRef.current = true;
    updateStatus('speaking');

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const chunk = playbackQueueRef.current.shift()!;
    const buffer = ctx.createBuffer(1, chunk.length, 24000);
    buffer.getChannelData(0).set(chunk);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      playNextInQueue();
    };
    source.start();
  };

  const startRecording = async () => {
    console.log('Voice session: startRecording triggered');
    try {
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
        if (wsRef.current?.readyState === WebSocket.OPEN) {
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

  return {
    status,
    transcripts,
    isRecording,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    warmup,
  };
}
