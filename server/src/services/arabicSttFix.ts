/** Correct common Whisper mis-hearings of Egyptian Arabic OSCE phrases. */
const ARABIC_STT_FIXES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /^it'?s?\s*my\s*key\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^it'?s?\s*my\s*name\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^it'?s?\s*mike\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^what'?s?\s*(your\s*)?(name|nem|aim)\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^what is your name\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^(your\s*)?name\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^(esmak|ismak|ismik|esmik)\s*(eh|e|a)\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^how\s*old\s*(are\s*you|r\s*u)\??\.?$/i, replacement: 'عندك كام سنة' },
  { pattern: /^how\s*are\s*you\??\.?$/i, replacement: 'إزيك' },
  { pattern: /^how\s*are\s*u\??\.?$/i, replacement: 'إزيك' },
  { pattern: /^where\s*are\s*you\s*from\??\.?$/i, replacement: 'منين' },
  { pattern: /^are\s*you\s*egyptian\??\.?$/i, replacement: 'مصري' },
  { pattern: /^are\s*you\s*married\??\.?$/i, replacement: 'متجوز' },
  { pattern: /^hello\s*doctor\.?$/i, replacement: 'السلام عليكم دكتور' },
  { pattern: /^good\s*(morning|evening)\??\.?$/i, replacement: 'صباح الخير دكتور' },
  { pattern: /^what\s*(brought|brings)\s*you\??\.?$/i, replacement: 'إيه اللي جابك' },
  { pattern: /^what'?s?\s*wrong\??\.?$/i, replacement: 'إيه اللي جابك' },
  { pattern: /^tell\s*me\s*about\s*your\s*problem\.?$/i, replacement: 'إيه اللي جابك' },
  { pattern: /^(enta|inti)\s*masry\??\.?$/i, replacement: 'مصري' },
  { pattern: /^mtgwz\??\.?$/i, replacement: 'متجوز' },
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

export function transcriptionNeedsArabicFix(text: string, expectArabic: boolean): boolean {
  if (!expectArabic) return false;
  const normalized = text.trim();
  if (!normalized) return false;
  if (/[\u0600-\u06FF]/.test(normalized)) return false;
  return /[a-zA-Z]/.test(normalized);
}
