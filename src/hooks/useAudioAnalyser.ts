'use client';

import { useEffect, useRef, useCallback } from 'react';

// ============================================================================
// useAudioAnalyser — Connects Web Audio API to any playing audio/video element
//
// Queries the DOM for a playing <audio> or <video> element, connects it to
// an AnalyserNode, and returns a function to read frequency data each frame.
// Falls back gracefully (silent flat array) when nothing is playing.
// ============================================================================

const FFT_SIZE = 256;
const SILENT = new Uint8Array(FFT_SIZE / 2);

export interface AudioAnalyserHandle {
  getFrequencyData: () => Uint8Array;
  isConnected: () => boolean;
}

export function useAudioAnalyser(): AudioAnalyserHandle {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedElementRef = useRef<HTMLMediaElement | null>(null);
  const freqDataRef = useRef<Uint8Array>(SILENT);
  const connectedRef = useRef(false);

  // Try to find and connect to a currently playing media element
  const tryConnect = useCallback(() => {
    // Already connected to a playing element
    if (connectedElementRef.current && !connectedElementRef.current.paused) return;

    // Find a playing audio or video element
    const elements = document.querySelectorAll<HTMLMediaElement>('audio, video');
    let target: HTMLMediaElement | null = null;
    for (const el of elements) {
      if (!el.paused && !el.muted && el.readyState >= 2) {
        target = el;
        break;
      }
    }

    if (!target) {
      // Nothing playing — disconnect if we were connected
      if (connectedRef.current) {
        sourceRef.current?.disconnect();
        connectedRef.current = false;
        connectedElementRef.current = null;
      }
      return;
    }

    // Same element, already connected
    if (target === connectedElementRef.current && connectedRef.current) return;

    try {
      // Create AudioContext on first use (requires user gesture — but by the time
      // audio is playing, the user has already gestured)
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = FFT_SIZE;
        analyserRef.current.smoothingTimeConstant = 0.8;
        freqDataRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.connect(audioCtxRef.current.destination);
      }

      // Disconnect previous source
      sourceRef.current?.disconnect();

      // Connect new element
      const source = audioCtxRef.current.createMediaElementSource(target);
      source.connect(analyserRef.current!);
      sourceRef.current = source;
      connectedElementRef.current = target;
      connectedRef.current = true;
    } catch {
      // createMediaElementSource throws if element already has a source node
      // In that case, just stay disconnected — no audio reactivity
      connectedRef.current = false;
    }
  }, []);

  // Poll for playing elements every 2 seconds
  useEffect(() => {
    const interval = setInterval(tryConnect, 2000);
    tryConnect(); // Try immediately
    return () => {
      clearInterval(interval);
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      audioCtxRef.current?.close();
    };
  }, [tryConnect]);

  const getFrequencyData = useCallback((): Uint8Array => {
    tryConnect();
    if (!connectedRef.current || !analyserRef.current) return SILENT;
    analyserRef.current.getByteFrequencyData(freqDataRef.current);
    return freqDataRef.current;
  }, [tryConnect]);

  const isConnected = useCallback(() => connectedRef.current, []);

  return { getFrequencyData, isConnected };
}
