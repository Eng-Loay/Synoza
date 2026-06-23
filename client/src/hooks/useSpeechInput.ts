import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isAudioRecordingSupported,
  pickAudioMimeType,
  transcribeAudioBlob,
} from '../lib/transcribe';

interface UseSpeechInputOptions {
  lang: string;
  sessionLang?: string;
  onInterim?: (text: string) => void;
  onComplete?: (text: string) => void;
  onError?: (code: string) => void;
}

export function useSpeechInput({ lang, sessionLang = 'AR', onInterim, onComplete, onError }: UseSpeechInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef('audio/webm');
  const startedAtRef = useRef(0);
  const onInterimRef = useRef(onInterim);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const langRef = useRef(lang);
  const sessionLangRef = useRef(sessionLang);

  onInterimRef.current = onInterim;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  langRef.current = lang;
  sessionLangRef.current = sessionLang;

  const isSupported = isAudioRecordingSupported();

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        releaseStream();
        setIsListening(false);
      }
      return;
    }
    releaseStream();
    setIsListening(false);
  }, [releaseStream]);

  const startListening = useCallback(async () => {
    if (isListening || isProcessing) return;

    if (!isSupported) {
      onErrorRef.current?.('not-supported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickAudioMimeType();
      mimeTypeRef.current = mimeType || 'audio/webm';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        releaseStream();
        setIsListening(false);
        onErrorRef.current?.('audio-capture');
      };

      recorder.onstop = async () => {
        setIsListening(false);
        releaseStream();
        mediaRecorderRef.current = null;

        const elapsed = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        chunksRef.current = [];

        if (elapsed < 700 || blob.size < 500) {
          onErrorRef.current?.('no-speech');
          return;
        }

        setIsProcessing(true);
        onInterimRef.current?.('…');

        try {
          const text = await transcribeAudioBlob(blob, langRef.current, sessionLangRef.current);
          if (text) {
            onCompleteRef.current?.(text);
          } else {
            onErrorRef.current?.('no-speech');
          }
        } catch (err) {
          const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status;
          const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '';
          if (status === 422 || status === 400) {
            onErrorRef.current?.(errMsg.toLowerCase().includes('arabic') ? 'micArabicFailed' : 'no-speech');
          } else if (status === 503) {
            onErrorRef.current?.('transcription-unavailable');
          } else {
            onErrorRef.current?.('transcription-failed');
          }
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start(150);
      setIsListening(true);
    } catch (err) {
      releaseStream();
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onErrorRef.current?.('not-allowed');
      } else {
        onErrorRef.current?.('audio-capture');
      }
    }
  }, [isListening, isProcessing, isSupported, releaseStream]);

  const toggleListening = useCallback(() => {
    if (isProcessing) return;
    if (isListening) stopRecording();
    else void startListening();
  }, [isListening, isProcessing, startListening, stopRecording]);

  useEffect(
    () => () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      releaseStream();
    },
    [releaseStream],
  );

  return {
    isListening,
    isProcessing,
    isSupported,
    toggleListening,
    stopListening: stopRecording,
    startListening,
  };
};
