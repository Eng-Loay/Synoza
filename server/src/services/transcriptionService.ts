import OpenAI, { toFile } from 'openai';
import { fixArabicSpeechTranscript, transcriptionNeedsArabicFix } from './arabicSttFix.js';

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

const ARABIC_WHISPER_PROMPT =
  'محادثة طبية OSCE بالعامية المصرية. السلام عليكم دكتور. اسمك إيه. عندك كام سنة. إزيك. إيه اللي جابك. متجوز. مصري.';

const ENGLISH_WHISPER_PROMPT = 'OSCE medical interview. Hello doctor. What is your name? How old are you?';

export function resolveWhisperLanguage(language: string, forceArabic?: boolean): 'ar' | 'en' {
  if (forceArabic) return 'ar';
  const code = language.toLowerCase();
  if (code.startsWith('ar')) return 'ar';
  if (code.startsWith('en')) return 'en';
  return 'ar';
}

function transcriptionLooksWrong(text: string, expected: 'ar' | 'en'): boolean {
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  if (expected === 'ar') return latin >= 4 && arabic === 0;
  return arabic >= 6 && latin === 0;
}

async function runWhisper(
  client: OpenAI,
  buffer: Buffer,
  mimeType: string,
  whisperLang: 'ar' | 'en',
): Promise<string> {
  const ext = mimeType.includes('mp4')
    ? 'm4a'
    : mimeType.includes('ogg')
      ? 'ogg'
      : mimeType.includes('wav')
        ? 'wav'
        : 'webm';

  const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

  const result = await client.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
    language: whisperLang,
    prompt: whisperLang === 'ar' ? ARABIC_WHISPER_PROMPT : ENGLISH_WHISPER_PROMPT,
    temperature: 0,
  });

  return result.text.trim();
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  mimeType: string,
  language: string,
  forceArabic?: boolean,
): Promise<string> {
  if (buffer.length < 200) {
    throw new Error('recording-too-short');
  }

  const client = getOpenAIClient();
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  if (!client || provider === 'mock') {
    throw new Error('transcription-unavailable');
  }

  const whisperLang = resolveWhisperLanguage(language, forceArabic);
  const expectArabic = whisperLang === 'ar';
  let text = await runWhisper(client, buffer, mimeType, whisperLang);

  if (transcriptionLooksWrong(text, whisperLang)) {
    text = await runWhisper(client, buffer, mimeType, whisperLang);
  }

  text = fixArabicSpeechTranscript(text, expectArabic);

  if (transcriptionNeedsArabicFix(text, expectArabic)) {
    throw new Error('transcription-not-arabic');
  }

  return text;
}
