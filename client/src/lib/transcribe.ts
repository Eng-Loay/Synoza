import api from './api';
import { fixArabicSpeechTranscript, shouldForceArabicTranscription } from './arabicSttFix';

export async function transcribeAudioBlob(blob: Blob, language: string, sessionLang = 'AR'): Promise<string> {
  const expectArabic = shouldForceArabicTranscription(sessionLang);
  const audioBase64 = await blobToBase64(blob);
  const res = await api.post<{ text: string }>('/transcribe', {
    audioBase64,
    mimeType: blob.type || 'audio/webm',
    language: expectArabic ? 'ar-EG' : language,
    forceArabic: expectArabic,
  });
  return fixArabicSpeechTranscript(res.data.text.trim(), expectArabic);
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
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function isAudioRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}
