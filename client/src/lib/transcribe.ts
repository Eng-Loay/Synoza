import api from './api';
import { fixArabicSpeechTranscript, isValidArabicSessionTranscript, shouldForceArabicTranscription } from './arabicSttFix';
import { withTimeout } from './withTimeout';

const TRANSCRIBE_TIMEOUT_MS = 25000;

export async function transcribeAudioBlob(blob: Blob, language: string, sessionLang = 'AR'): Promise<string> {
  const expectArabic = shouldForceArabicTranscription(sessionLang);
  const audioBase64 = await blobToBase64(blob);
  const res = await withTimeout(
    api.post<{ text: string }>('/transcribe', {
      audioBase64,
      mimeType: blob.type || 'audio/webm',
      language: expectArabic ? 'ar-EG' : language,
      forceArabic: expectArabic,
    }),
    TRANSCRIBE_TIMEOUT_MS,
    'transcription-timeout',
  );
  const text = fixArabicSpeechTranscript(res.data.text.trim(), expectArabic);
  if (!isValidArabicSessionTranscript(text, expectArabic)) {
    throw Object.assign(new Error('transcription-invalid'), { response: { status: 422, data: { error: 'Could not recognize Arabic speech' } } });
  }
  return text;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('read-failed'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('read-failed'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(blob);
  });
}

export function pickAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const candidates = isMobile
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function isAudioRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}
