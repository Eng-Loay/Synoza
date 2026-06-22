export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

let activeRecognition: SpeechRecognitionLike | null = null;
let sharedMicStream: MediaStream | null = null;

export function abortActiveSpeechRecognition() {
  const current = activeRecognition;
  activeRecognition = null;
  if (!current) return;
  try {
    current.abort();
  } catch {
    // Browser may already be idle.
  }
}

export function claimSpeechRecognition(recognition: SpeechRecognitionLike) {
  if (activeRecognition && activeRecognition !== recognition) {
    try {
      activeRecognition.abort();
    } catch {
      // ignore
    }
  }
  activeRecognition = recognition;
}

export function releaseSpeechRecognition(recognition: SpeechRecognitionLike) {
  if (activeRecognition === recognition) {
    activeRecognition = null;
  }
}

export function waitForSpeechRecognition(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Keep the mic stream open while listening — stopping tracks too early breaks recognition on many devices. */
export async function acquireMicrophoneStream(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (sharedMicStream?.active) return 'granted';
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';

  try {
    sharedMicStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    return 'granted';
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
    return 'unavailable';
  }
}

export function releaseMicrophoneStream() {
  sharedMicStream?.getTracks().forEach((track) => track.stop());
  sharedMicStream = null;
}

/** @deprecated Use acquireMicrophoneStream — kept for compatibility */
export async function ensureMicrophonePermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  return acquireMicrophoneStream();
}

export function isIgnorableSpeechError(code: string) {
  return code === 'aborted' || code === 'no-speech';
}

/** Rebuild the full transcript from every result chunk (most reliable across browsers). */
export function transcriptFromEvent(event: SpeechRecognitionEventLike): string {
  let text = '';
  for (let i = 0; i < event.results.length; i++) {
    text += event.results[i]?.[0]?.transcript ?? '';
  }
  return text.trim();
}
