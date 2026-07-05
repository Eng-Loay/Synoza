/** Client-side STT fixes — kept in sync with server/src/services/arabicSttFix.ts */
const ARABIC_STT_FIXES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /^it'?s?\s*my\s*key\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^it'?s?\s*my\s*name\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^what'?s?\s*(your\s*)?(name|nem|aim)\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^what is your name\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^(esmak|ismak)\s*(eh|e)\??\.?$/i, replacement: 'اسمك إيه' },
  { pattern: /^how\s*old\s*(are\s*you|r\s*u)\??\.?$/i, replacement: 'عندك كام سنة' },
  { pattern: /^how\s*are\s*you\??\.?$/i, replacement: 'إزيك' },
  { pattern: /^how\s*are\s*u\??\.?$/i, replacement: 'إزيك' },
  { pattern: /^(هيلو|هالو|حيلو|هلو)\s*(يا\s*)?(دكتور)?\.?$/i, replacement: 'أهلاً دكتور' },
  { pattern: /^الف\s*سلام[ةه]\.?$/i, replacement: 'الف مليون سلامة' },
];

export function containsWrongScriptForArabic(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/.test(text);
}

export function looksLikeSttHallucination(text: string): boolean {
  const normalized = text.trim();
  if (!normalized || normalized.length < 2) return true;
  if (containsWrongScriptForArabic(normalized)) return true;
  if (/شكرا?\s*(للمشاركة|على المشاهدة|لمشاهدتك|للاستماع)/i.test(normalized)) return true;
  if (
    /اشترك(وا|و|ي)?\s*(في|فى)\s*(ال)?قناة|لا\s*تنس(وا|و|ي)?\s*(ال)?اشتراك|فعل(وا|و|ي)?\s*زر\s*(ال)?جرس|subscribe\s*(to\s*)?(the\s*)?channel/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/nancy|conker|نانسي|كونكر/i.test(normalized)) return true;
  return false;
}

export function transcriptionNeedsArabicFix(text: string, expectArabic: boolean): boolean {
  if (!expectArabic) return false;
  const normalized = text.trim();
  if (!normalized) return true;
  if (containsWrongScriptForArabic(normalized)) return true;
  if (/[\u0600-\u06FF]/.test(normalized)) return false;
  return /[a-zA-Z]/.test(normalized);
}

export function isValidArabicSessionTranscript(text: string, expectArabic: boolean): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (!expectArabic) return true;
  if (looksLikeSttHallucination(normalized)) return false;
  if (transcriptionNeedsArabicFix(normalized, true)) return false;
  return /[\u0600-\u06FF]/.test(normalized);
}

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
