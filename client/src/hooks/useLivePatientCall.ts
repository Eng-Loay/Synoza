import { useCallback, useEffect, useRef, useState } from 'react';
import { speakText, stopSpeaking } from '../lib/speech';
import {
  abortActiveSpeechRecognition,
  acquireMicrophoneStream,
  claimSpeechRecognition,
  getSpeechRecognitionCtor,
  isIgnorableSpeechError,
  releaseMicrophoneStream,
  releaseSpeechRecognition,
  transcriptFromEvent,
  waitForSpeechRecognition,
  type SpeechRecognitionLike,
} from '../lib/speechRecognition';

interface UseLivePatientCallOptions {
  lang: string;
  sendMessage: (text: string) => Promise<{ success: boolean; reply?: string }>;
  disabled?: boolean;
  onError?: (code: string) => void;
}

export function useLivePatientCall({ lang, sendMessage, disabled, onError }: UseLivePatientCallOptions) {
  const [isLiveCall, setIsLiveCall] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const liveRef = useRef(false);
  const busyRef = useRef(false);
  const listeningRef = useRef(false);
  const sendRef = useRef(sendMessage);
  const onErrorRef = useRef(onError);

  sendRef.current = sendMessage;
  onErrorRef.current = onError;

  const isSupported =
    typeof window !== 'undefined' &&
    !!getSpeechRecognitionCtor() &&
    typeof window.speechSynthesis !== 'undefined';

  const stopCall = useCallback(() => {
    liveRef.current = false;
    setIsLiveCall(false);
    busyRef.current = false;
    setIsBusy(false);
    listeningRef.current = false;

    const recognition = recognitionRef.current;
    if (recognition) {
      releaseSpeechRecognition(recognition);
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    abortActiveSpeechRecognition();
    stopSpeaking();
    releaseMicrophoneStream();
  }, []);

  const listenOnce = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !liveRef.current || disabled || busyRef.current || listeningRef.current) return;

    listeningRef.current = true;

    try {
      abortActiveSpeechRecognition();
      recognitionRef.current?.abort();
      await waitForSpeechRecognition();

      const permission = await acquireMicrophoneStream();
      if (permission === 'denied') {
        onErrorRef.current?.('not-allowed');
        stopCall();
        return;
      }
      if (!liveRef.current) return;

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = async (event) => {
        const transcript = transcriptFromEvent(event);
        if (!transcript || !liveRef.current || busyRef.current) return;

        // Wait for the final result before sending.
        const last = event.results[event.results.length - 1];
        if (last && !last.isFinal) return;

        busyRef.current = true;
        setIsBusy(true);
        listeningRef.current = false;

        try {
          recognition.stop();
        } catch {
          recognition.abort();
        }

        const result = await sendRef.current(transcript);
        if (!liveRef.current) {
          busyRef.current = false;
          setIsBusy(false);
          return;
        }

        if (result.success && result.reply) {
          await speakText(result.reply, lang);
        }

        busyRef.current = false;
        setIsBusy(false);
        if (liveRef.current) void listenOnce();
      };

      recognition.onerror = (event) => {
        listeningRef.current = false;
        releaseSpeechRecognition(recognition);
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }

        if (event.error === 'not-allowed') {
          onErrorRef.current?.('not-allowed');
          stopCall();
          return;
        }

        if (!isIgnorableSpeechError(event.error)) {
          onErrorRef.current?.(event.error);
        }

        busyRef.current = false;
        setIsBusy(false);
        if (liveRef.current) {
          setTimeout(() => void listenOnce(), 600);
        }
      };

      recognition.onend = () => {
        listeningRef.current = false;
        releaseSpeechRecognition(recognition);
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        if (liveRef.current && !busyRef.current) {
          setTimeout(() => void listenOnce(), 400);
        }
      };

      recognitionRef.current = recognition;
      claimSpeechRecognition(recognition);
      recognition.start();
    } catch {
      listeningRef.current = false;
      onErrorRef.current?.('start-failed');
      if (liveRef.current) {
        setTimeout(() => void listenOnce(), 800);
      }
    }
  }, [disabled, lang, stopCall]);

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
      const recognition = recognitionRef.current;
      if (recognition) {
        releaseSpeechRecognition(recognition);
        try {
          recognition.abort();
        } catch {
          // ignore
        }
      }
      stopSpeaking();
    },
    [],
  );

  return { isLiveCall, isBusy, isSupported, toggleLiveCall, stopCall };
}
