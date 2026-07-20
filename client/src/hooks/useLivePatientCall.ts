import { useCallback, useEffect, useRef, useState } from 'react';
import { markBrowserSttRuntimeFailure, shouldUseBrowserStt, startBrowserStt, type BrowserSttSession } from '../lib/browserStt';
import { primeSpeechOutput, speakText, stopSpeaking } from '../lib/speech';
import { abortActiveSpeechRecognition, releaseMicrophoneStream, waitForSpeechRecognition } from '../lib/speechRecognition';
import {
  getMicConstraints,
  IS_MOBILE,
  minLiveCallBlobBytes,
  recorderTimesliceMs,
  unlockMobileAudio,
} from '../lib/mobileAudio';
import {
  isAudioRecordingSupported,
  pickAudioMimeType,
  transcribeAudioBlob,
} from '../lib/transcribe';
import { postTextTurn, postVoiceTurn, type VoiceTurnMeta, type VoiceTurnResponse } from '../lib/voiceTurn';
import { withTimeout } from '../lib/withTimeout';

interface UseLiveVoiceCallOptions {
  listenLang: string;
  speakLang: string;
  sessionLang?: string;
  sendMessage: (text: string) => Promise<{ success: boolean; reply?: string }>;
  voiceTurn?: {
    sessionId: string;
    getRequestMeta: () => VoiceTurnMeta;
    onTurn?: (result: VoiceTurnResponse) => void;
  };
  /** When false, patient/examiner replies appear in chat only (no TTS). */
  speakReplies?: boolean;
  disabled?: boolean;
  onError?: (code: string) => void;
}

/** @deprecated Use useLiveVoiceCall — kept for imports */
export type UseLivePatientCallOptions = UseLiveVoiceCallOptions;

const SILENCE_MS = IS_MOBILE ? 1100 : 650;
const MIN_SPEECH_MS = IS_MOBILE ? 450 : 380;
const MAX_RECORDING_MS = 12000;
const NO_SPEECH_TIMEOUT_MS = IS_MOBILE ? 9000 : 6000;
const SPEECH_RMS_THRESHOLD = IS_MOBILE ? 0.004 : 0.011;
const POST_TURN_LISTEN_DELAY_MS = IS_MOBILE ? 450 : 60;
const BROWSER_STT_RESTART_DELAY_MS = IS_MOBILE ? 350 : 80;
const TURN_TIMEOUT_MS = IS_MOBILE ? 30000 : 22000;
const BUSY_WATCHDOG_MS = IS_MOBILE ? 38000 : 28000;

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
  voiceTurn,
  speakReplies = true,
  disabled,
  onError,
}: UseLiveVoiceCallOptions) {
  const [isLiveCall, setIsLiveCall] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const liveRef = useRef(false);
  const busyRef = useRef(false);
  const speakingRef = useRef(false);
  const listeningRef = useRef(false);
  const busyWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenOnceRef = useRef<() => void>(() => undefined);
  const sendRef = useRef(sendMessage);
  const voiceTurnRef = useRef(voiceTurn);
  const onErrorRef = useRef(onError);
  const speakRepliesRef = useRef(speakReplies);
  const listenLangRef = useRef(listenLang);
  const speakLangRef = useRef(speakLang);
  const sessionLangRef = useRef(sessionLang);
  const streamRef = useRef<MediaStream | null>(null);
  const browserSttRef = useRef<BrowserSttSession | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStartedAtRef = useRef(0);
  const mimeTypeRef = useRef('audio/webm');

  sendRef.current = sendMessage;
  voiceTurnRef.current = voiceTurn;
  onErrorRef.current = onError;
  speakRepliesRef.current = speakReplies;
  listenLangRef.current = listenLang;
  speakLangRef.current = speakLang;
  sessionLangRef.current = sessionLang;

  const setListening = useCallback((active: boolean) => {
    listeningRef.current = active;
    setIsMicListening(active);
  }, []);

  const setSpeaking = useCallback((active: boolean) => {
    speakingRef.current = active;
    setIsSpeaking(active);
  }, []);

  const isSupported =
    typeof window !== 'undefined' && (shouldUseBrowserStt() || isAudioRecordingSupported());

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

  const clearBusyWatchdog = useCallback(() => {
    if (busyWatchdogRef.current) {
      clearTimeout(busyWatchdogRef.current);
      busyWatchdogRef.current = null;
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
        recorderRef.current = null;
      }
      return;
    }
    recorderRef.current = null;
  }, []);

  const scheduleListen = useCallback((delayMs = POST_TURN_LISTEN_DELAY_MS) => {
    if (!liveRef.current || busyRef.current || speakingRef.current || listeningRef.current) return;
    setTimeout(() => {
      if (liveRef.current && !busyRef.current && !speakingRef.current && !listeningRef.current) {
        void listenOnceRef.current();
      }
    }, delayMs);
  }, []);

  const endBusy = useCallback(() => {
    busyRef.current = false;
    setIsBusy(false);
    clearBusyWatchdog();
    scheduleListen();
  }, [clearBusyWatchdog, scheduleListen]);

  const startBusy = useCallback(() => {
    busyRef.current = true;
    setIsBusy(true);
    clearBusyWatchdog();
    busyWatchdogRef.current = setTimeout(() => {
      if (!busyRef.current || !liveRef.current) return;
      busyRef.current = false;
      setIsBusy(false);
      onErrorRef.current?.('network');
      scheduleListen(200);
    }, BUSY_WATCHDOG_MS);
  }, [clearBusyWatchdog, scheduleListen]);

  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current?.active) return streamRef.current;

    // Only drop the shared browser-STT mic when recognition is idle.
    // Forcing a release mid-recognition causes live-call / mic races on mobile.
    releaseMicrophoneStream(false);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: getMicConstraints(),
    });
    streamRef.current = stream;
    return stream;
  }, []);

  const playReply = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !liveRef.current) return;

      if (!speakRepliesRef.current) {
        scheduleListen(POST_TURN_LISTEN_DELAY_MS);
        return;
      }

      const speak = speakLangRef.current.startsWith('ar') ? 'ar-EG' : speakLangRef.current;
      speakingRef.current = true;
      setSpeaking(true);
      try {
        await speakText(trimmed, speak);
      } catch {
        // Ignore playback errors — text is already in chat.
      } finally {
        speakingRef.current = false;
        setSpeaking(false);
        scheduleListen(POST_TURN_LISTEN_DELAY_MS);
      }
    },
    [scheduleListen, setSpeaking],
  );

  const stopCall = useCallback(() => {
    liveRef.current = false;
    setIsLiveCall(false);
    busyRef.current = false;
    speakingRef.current = false;
    setIsBusy(false);
    setListening(false);
    setSpeaking(false);
    speechStartedAtRef.current = 0;
    browserSttRef.current?.abort();
    browserSttRef.current = null;
    abortActiveSpeechRecognition();
    // Keep shared mic stream during live call turns; force-release only when call ends.
    releaseMicrophoneStream(true);
    clearTimers();
    clearBusyWatchdog();
    stopRecorder();
    closeAudioContext();
    releaseStream();
    stopSpeaking();
  }, [clearBusyWatchdog, clearTimers, closeAudioContext, releaseStream, stopRecorder]);

  const finishRecording = useCallback(() => {
    if (!listeningRef.current) return;
    setListening(false);
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.requestData();
      } catch {
        // Some browsers don't support requestData.
      }
      stopRecorder();
      return;
    }
    stopRecorder();
  }, [clearTimers, stopRecorder]);

  const processTextTurn = useCallback(
    async (transcript: string) => {
      const turn = voiceTurnRef.current;

      if (turn) {
        const result = await withTimeout(
          postTextTurn(turn.sessionId, transcript, turn.getRequestMeta()),
          TURN_TIMEOUT_MS,
          'turn-timeout',
        );
        turn.onTurn?.(result);
        void playReply(result.replyMessage.content);
        return !!result.transcript?.trim();
      }

      if (!transcript?.trim() || !liveRef.current) return false;

      const result = await sendRef.current(transcript);
      if (!liveRef.current) return false;

      if (result.success && result.reply?.trim()) {
        void playReply(result.reply);
      }

      return true;
    },
    [playReply],
  );

  const processTurn = useCallback(
    async (blob: Blob) => {
      const speak = speakLangRef.current.startsWith('ar') ? 'ar-EG' : speakLangRef.current;
      const turn = voiceTurnRef.current;

      if (turn) {
        const result = await withTimeout(
          postVoiceTurn(
            turn.sessionId,
            blob,
            listenLangRef.current,
            sessionLangRef.current,
            turn.getRequestMeta(),
          ),
          TURN_TIMEOUT_MS,
          'turn-timeout',
        );
        turn.onTurn?.(result);
        void playReply(result.replyMessage.content);
        return !!result.transcript?.trim();
      }

      const transcript = await withTimeout(
        transcribeAudioBlob(blob, listenLangRef.current, sessionLangRef.current),
        TURN_TIMEOUT_MS,
        'turn-timeout',
      );

      if (!transcript?.trim() || !liveRef.current) return false;

      const result = await sendRef.current(transcript);
      if (!liveRef.current) return false;

      if (result.success && result.reply?.trim()) {
        void playReply(result.reply);
      }

      return true;
    },
    [playReply],
  );

  const listenOnceWithBrowser = useCallback(async () => {
    if (!liveRef.current || disabled || busyRef.current || speakingRef.current || listeningRef.current) {
      return;
    }

    if (IS_MOBILE) {
      await waitForSpeechRecognition(BROWSER_STT_RESTART_DELAY_MS);
    }

    // Do not yank an active shared mic; browser STT claims recognition ownership itself.
    releaseMicrophoneStream(false);
    listeningRef.current = true;
    setIsMicListening(true);

    const session = await startBrowserStt({
      lang: listenLangRef.current,
      sessionLang: sessionLangRef.current,
      liveCall: true,
      onResult: (transcript) => {
        browserSttRef.current = null;
        setListening(false);
        if (!liveRef.current) return;

        startBusy();
        void (async () => {
          try {
            await processTextTurn(transcript);
          } catch (err) {
            const code = err instanceof Error ? err.message : '';
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 503 || code === 'turn-timeout') {
              onErrorRef.current?.(status === 503 ? 'transcription-unavailable' : 'network');
              if (status === 503) stopCall();
            } else if (status !== 422 && status !== 400 && (status !== undefined || code === 'turn-timeout')) {
              onErrorRef.current?.('transcription-failed');
            }
          } finally {
            endBusy();
          }
        })();
      },
      onError: (code) => {
        browserSttRef.current = null;
        setListening(false);
        if (!liveRef.current) return;

        if (code === 'no-speech' || code === 'transcription-invalid') {
          scheduleListen(IS_MOBILE ? 400 : 150);
          return;
        }
        if (code === 'not-allowed') {
          onErrorRef.current?.('not-allowed');
          stopCall();
          return;
        }
        if (code === 'not-supported') {
          onErrorRef.current?.('not-supported');
          stopCall();
          return;
        }
        if ((code === 'network' || code === 'start-failed') && isAudioRecordingSupported()) {
          // Web Speech API failed — continue the call on the recorder +
          // server transcription path (next listenOnce picks it up).
          markBrowserSttRuntimeFailure();
          scheduleListen(150);
          return;
        }
        scheduleListen(IS_MOBILE ? 700 : 300);
      },
    });

    if (!session) {
      setListening(false);
      if (liveRef.current) scheduleListen(300);
      return;
    }

    browserSttRef.current = session;
  }, [disabled, endBusy, processTextTurn, scheduleListen, setListening, startBusy, stopCall]);

  const listenOnce = useCallback(async () => {
    if (shouldUseBrowserStt()) {
      await listenOnceWithBrowser();
      return;
    }

    if (!liveRef.current || disabled || busyRef.current || speakingRef.current || listeningRef.current) {
      return;
    }

    listeningRef.current = true;
    setIsMicListening(true);
    speechStartedAtRef.current = 0;

    try {
      const stream = await ensureStream();
      if (!stream || !liveRef.current) {
        setListening(false);
        return;
      }

      mimeTypeRef.current = pickAudioMimeType() || (IS_MOBILE ? 'audio/mp4' : 'audio/webm');
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
      recorderRef.current = recorder;

      const startedAt = Date.now();
      let silenceStartedAt = 0;
      let peakRms = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onerror = () => {
        setListening(false);
        clearTimers();
        recorderRef.current = null;
        onErrorRef.current?.('audio-capture');
        scheduleListen(300);
      };

      recorder.onstop = async () => {
        clearTimers();
        recorderRef.current = null;
        setListening(false);

        const elapsed = Date.now() - startedAt;
        const blob = new Blob(chunks, { type: mimeTypeRef.current });

        if (!liveRef.current) return;

        if (elapsed < MIN_SPEECH_MS || blob.size < minLiveCallBlobBytes() || speechStartedAtRef.current === 0) {
          scheduleListen(150);
          return;
        }

        startBusy();

        try {
          await processTurn(blob);
        } catch (err) {
          const code = err instanceof Error ? err.message : '';
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 503 || code === 'turn-timeout') {
            onErrorRef.current?.(status === 503 ? 'transcription-unavailable' : 'network');
            if (status === 503) {
              stopCall();
              return;
            }
          } else if (status === 422 || status === 400) {
            // Quiet retry after unclear audio.
          } else if (status !== undefined || code === 'turn-timeout') {
            onErrorRef.current?.('transcription-failed');
          }
        } finally {
          endBusy();
        }
      };

      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = AudioCtx ? new AudioCtx() : null;
      }
      const audioContext = audioContextRef.current;
      if (!audioContext) {
        setListening(false);
        onErrorRef.current?.('audio-capture');
        scheduleListen(300);
        return;
      }
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
          if (!speechStartedAtRef.current) speechStartedAtRef.current = now;
          peakRms = Math.max(peakRms, rms);
          silenceStartedAt = 0;
          if (noSpeechTimerRef.current) {
            clearTimeout(noSpeechTimerRef.current);
            noSpeechTimerRef.current = null;
          }
        } else if (speechStartedAtRef.current) {
          if (!silenceStartedAt) silenceStartedAt = now;
          const speechDuration = now - speechStartedAtRef.current;
          const silenceDuration = now - silenceStartedAt;
          const quietEnough = peakRms > 0 && rms < peakRms * 0.25;
          if (
            speechDuration >= MIN_SPEECH_MS &&
            silenceDuration >= SILENCE_MS &&
            quietEnough
          ) {
            finishRecording();
            return;
          }
        }

        vadFrameRef.current = requestAnimationFrame(monitor);
      };

      noSpeechTimerRef.current = setTimeout(() => {
        if (listeningRef.current && !speechStartedAtRef.current && liveRef.current) {
          finishRecording();
        }
      }, NO_SPEECH_TIMEOUT_MS);

      maxRecordingTimerRef.current = setTimeout(() => {
        if (listeningRef.current && speechStartedAtRef.current) {
          finishRecording();
        }
      }, MAX_RECORDING_MS);

      recorder.start(recorderTimesliceMs());
      vadFrameRef.current = requestAnimationFrame(monitor);
    } catch (err) {
      setListening(false);
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onErrorRef.current?.('not-allowed');
        stopCall();
        return;
      }
      onErrorRef.current?.('start-failed');
      scheduleListen(400);
    }
  }, [
    disabled,
    ensureStream,
    finishRecording,
    clearTimers,
    stopCall,
    processTurn,
    startBusy,
    endBusy,
    scheduleListen,
    setListening,
    listenOnceWithBrowser,
  ]);

  listenOnceRef.current = () => {
    void listenOnce();
  };

  const toggleLiveCall = useCallback(() => {
    if (!isSupported) {
      onErrorRef.current?.('not-supported');
      return;
    }
    if (isLiveCall) {
      stopCall();
      return;
    }
    if (speakRepliesRef.current) {
      primeSpeechOutput();
    }
    void unlockMobileAudio();
    liveRef.current = true;
    setIsLiveCall(true);
    void listenOnce();
  }, [isLiveCall, isSupported, listenOnce, stopCall]);

  useEffect(
    () => () => {
      liveRef.current = false;
      clearTimers();
      clearBusyWatchdog();
      browserSttRef.current?.abort();
      browserSttRef.current = null;
      abortActiveSpeechRecognition();
      releaseMicrophoneStream(true);
      stopRecorder();
      closeAudioContext();
      releaseStream();
      stopSpeaking();
    },
    [clearBusyWatchdog, clearTimers, closeAudioContext, releaseStream, stopRecorder],
  );

  return { isLiveCall, isBusy, isMicListening, isSpeaking, isSupported, toggleLiveCall, stopCall };
}

export const useLivePatientCall = useLiveVoiceCall;
