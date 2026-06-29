import { useCallback, useEffect, useRef, useState } from 'react';
import { speakText, stopSpeaking } from '../lib/speech';
import {
  isAudioRecordingSupported,
  pickAudioMimeType,
  transcribeAudioBlob,
} from '../lib/transcribe';

interface UseLiveVoiceCallOptions {
  listenLang: string;
  speakLang: string;
  sessionLang?: string;
  sendMessage: (text: string) => Promise<{ success: boolean; reply?: string }>;
  disabled?: boolean;
  onError?: (code: string) => void;
}

/** @deprecated Use useLiveVoiceCall — kept for imports */
export type UseLivePatientCallOptions = UseLiveVoiceCallOptions;

const IS_MOBILE = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const SILENCE_MS = IS_MOBILE ? 1600 : 1200;
const MIN_SPEECH_MS = IS_MOBILE ? 500 : 700;
const MAX_RECORDING_MS = 28000;
const NO_SPEECH_TIMEOUT_MS = IS_MOBILE ? 12000 : 9000;
const SPEECH_RMS_THRESHOLD = IS_MOBILE ? 0.018 : 0.014;

function rmsFromAnalyser(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

export function useLiveVoiceCall({
  listenLang,
  speakLang,
  sessionLang = 'AR',
  sendMessage,
  disabled,
  onError,
}: UseLiveVoiceCallOptions) {
  const [isLiveCall, setIsLiveCall] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const liveRef = useRef(false);
  const busyRef = useRef(false);
  const listeningRef = useRef(false);
  const sendRef = useRef(sendMessage);
  const onErrorRef = useRef(onError);
  const listenLangRef = useRef(listenLang);
  const speakLangRef = useRef(speakLang);
  const sessionLangRef = useRef(sessionLang);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  sendRef.current = sendMessage;
  onErrorRef.current = onError;
  listenLangRef.current = listenLang;
  speakLangRef.current = speakLang;
  sessionLangRef.current = sessionLang;

  const isSupported =
    typeof window !== 'undefined' &&
    isAudioRecordingSupported() &&
    typeof window.speechSynthesis !== 'undefined';

  const clearTimers = useCallback(() => {
    if (vadFrameRef.current !== null) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    if (noSpeechTimerRef.current) {
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
    if (maxRecordingTimerRef.current) {
      clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const closeAudioContext = useCallback(() => {
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => undefined);
    }
  }, []);

  const stopRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        releaseStream();
        recorderRef.current = null;
      }
      return;
    }
    recorderRef.current = null;
    releaseStream();
  }, [releaseStream]);

  const stopCall = useCallback(() => {
    liveRef.current = false;
    setIsLiveCall(false);
    busyRef.current = false;
    setIsBusy(false);
    listeningRef.current = false;
    clearTimers();
    stopRecorder();
    closeAudioContext();
    stopSpeaking();
  }, [clearTimers, closeAudioContext, stopRecorder]);

  const finishRecording = useCallback(() => {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    clearTimers();
    stopRecorder();
  }, [clearTimers, stopRecorder]);

  const listenOnce = useCallback(async () => {
    if (!liveRef.current || disabled || busyRef.current || listeningRef.current) return;

    listeningRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!liveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        listeningRef.current = false;
        return;
      }

      streamRef.current = stream;
      const mimeType = pickAudioMimeType() || 'audio/webm';
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      const startedAt = Date.now();
      let speechStartedAt = 0;
      let silenceStartedAt = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onerror = () => {
        listeningRef.current = false;
        clearTimers();
        releaseStream();
        recorderRef.current = null;
        onErrorRef.current?.('audio-capture');
        if (liveRef.current && !busyRef.current) {
          setTimeout(() => void listenOnce(), 400);
        }
      };

      recorder.onstop = async () => {
        clearTimers();
        releaseStream();
        recorderRef.current = null;
        listeningRef.current = false;

        const elapsed = Date.now() - startedAt;
        const blob = new Blob(chunks, { type: mimeType });

        if (!liveRef.current) return;

        if (elapsed < MIN_SPEECH_MS || blob.size < 500 || speechStartedAt === 0) {
          if (liveRef.current && !busyRef.current) {
            setTimeout(() => void listenOnce(), 200);
          }
          return;
        }

        busyRef.current = true;
        setIsBusy(true);

        try {
          const transcript = await transcribeAudioBlob(
            blob,
            listenLangRef.current,
            sessionLangRef.current,
          );

          if (!transcript || !liveRef.current) return;

          const result = await sendRef.current(transcript);
          if (!liveRef.current) return;

          if (result.success && result.reply) {
            const speak = speakLangRef.current.startsWith('ar') ? 'ar-EG' : speakLangRef.current;
            await speakText(result.reply, speak);
          }
        } catch (err) {
          const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status;
          const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '';
          if (status === 503) {
            onErrorRef.current?.('transcription-unavailable');
            stopCall();
            return;
          }
          if (status === 422 || status === 400) {
            if (!errMsg.toLowerCase().includes('arabic')) {
              // Quiet retry — user may have paused or background noise only.
            }
          } else if (status !== undefined) {
            onErrorRef.current?.('transcription-failed');
          }
        } finally {
          busyRef.current = false;
          setIsBusy(false);
          if (liveRef.current) {
            setTimeout(() => void listenOnce(), 300);
          }
        }
      };

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const sampleBuffer = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;

      const monitor = () => {
        if (!listeningRef.current || !liveRef.current) return;

        const rms = rmsFromAnalyser(analyser, sampleBuffer);
        const now = Date.now();

        if (rms >= SPEECH_RMS_THRESHOLD) {
          if (!speechStartedAt) speechStartedAt = now;
          silenceStartedAt = 0;
          if (noSpeechTimerRef.current) {
            clearTimeout(noSpeechTimerRef.current);
            noSpeechTimerRef.current = null;
          }
        } else if (speechStartedAt) {
          if (!silenceStartedAt) silenceStartedAt = now;
          const speechDuration = now - speechStartedAt;
          const silenceDuration = now - silenceStartedAt;
          if (speechDuration >= MIN_SPEECH_MS && silenceDuration >= SILENCE_MS) {
            finishRecording();
            return;
          }
        }

        vadFrameRef.current = requestAnimationFrame(monitor);
      };

      noSpeechTimerRef.current = setTimeout(() => {
        if (listeningRef.current && !speechStartedAt && liveRef.current) {
          finishRecording();
        }
      }, NO_SPEECH_TIMEOUT_MS);

      maxRecordingTimerRef.current = setTimeout(() => {
        if (listeningRef.current && speechStartedAt) {
          finishRecording();
        }
      }, MAX_RECORDING_MS);

      recorder.start(120);
      vadFrameRef.current = requestAnimationFrame(monitor);
    } catch (err) {
      listeningRef.current = false;
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onErrorRef.current?.('not-allowed');
        stopCall();
        return;
      }
      onErrorRef.current?.('start-failed');
      if (liveRef.current) {
        setTimeout(() => void listenOnce(), 500);
      }
    }
  }, [disabled, finishRecording, clearTimers, releaseStream, stopCall]);

  const toggleLiveCall = useCallback(() => {
    if (!isSupported) {
      onErrorRef.current?.('not-supported');
      return;
    }
    if (isLiveCall) {
      stopCall();
      return;
    }
    liveRef.current = true;
    setIsLiveCall(true);
    void listenOnce();
  }, [isLiveCall, isSupported, listenOnce, stopCall]);

  useEffect(
    () => () => {
      liveRef.current = false;
      clearTimers();
      stopRecorder();
      closeAudioContext();
      stopSpeaking();
    },
    [clearTimers, closeAudioContext, stopRecorder],
  );

  return { isLiveCall, isBusy, isSupported, toggleLiveCall, stopCall };
}

export const useLivePatientCall = useLiveVoiceCall;
