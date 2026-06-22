import OpenAI, { toFile } from 'openai';

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function whisperLanguage(lang: string): string | undefined {
  const code = lang.toLowerCase();
  if (code.startsWith('ar')) return 'ar';
  if (code.startsWith('en')) return 'en';
  return undefined;
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  mimeType: string,
  language: string,
): Promise<string> {
  if (buffer.length < 200) {
    throw new Error('recording-too-short');
  }

  const client = getOpenAIClient();
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  if (!client || provider === 'mock') {
    throw new Error('transcription-unavailable');
  }

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
    language: whisperLanguage(language),
  });

  return result.text.trim();
}
