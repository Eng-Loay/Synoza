/** Client-side STT fixes — kept in sync with server/src/services/arabicSttFix.ts */
const ARABIC_STT_FIXES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /^it'?s?\s*my\s*key\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^it'?s?\s*my\s*name\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^what'?s?\s*(your\s*)?(name|nem|aim)\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^what is your name\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^(esmak|ismak)\s*(eh|e)\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^how\s*old\s*(are\s*you|r\s*u)\??\.?$/i, replacement: 'عندك كام سنة' },
  { pattern: /^how\s*are\s*you\??\.?$/i, replacement: 'إزيك' },
];

export function fixArabicSpeechTranscript(text: string, expectArabic: boolean): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized || !expectArabic) return normalized;
  if (/[\u0600-\u06FF]/.test(normalized)) return normalized;

  for (const { pattern, replacement } of ARABIC_STT_FIXES) {
    if (pattern.test(normalized)) return replacement;
  }

  return normalized;
}

export function shouldForceArabicTranscription(sessionLang: string): boolean {
  return sessionLang !== 'EN';
}
