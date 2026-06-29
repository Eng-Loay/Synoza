const EGYPTIAN_VOICE_HINT =
  /egypt|egyptian|ar-eg|cairo|مصر|google.*arabic|microsoft.*arabic|natural.*arabic/i;

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined') return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (lang.startsWith('ar')) {
    return (
      voices.find((v) => EGYPTIAN_VOICE_HINT.test(`${v.lang} ${v.name}`)) ||
      voices.find((v) => v.lang.toLowerCase() === 'ar-eg') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('ar')) ||
      undefined
    );
  }
  return (
    voices.find((v) => v.lang.startsWith('en') && /US|Google US|Microsoft.*English/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    undefined
  );
}

function applyVoice(utterance: SpeechSynthesisUtterance, lang: string) {
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.lang = lang.startsWith('ar') ? 'ar-EG' : 'en-US';
  utterance.rate = lang.startsWith('ar') ? 1.08 : 1.05;
  utterance.pitch = lang.startsWith('ar') ? 1.02 : 1;
}

function primeSpeechSynthesis() {
  const synth = window.speechSynthesis;
  synth.cancel();
  if (typeof synth.resume === 'function') synth.resume();
}

export function speakText(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text.trim()) {
      resolve();
      return;
    }

    primeSpeechSynthesis();
    const utterance = new SpeechSynthesisUtterance(text.trim());

    const start = () => {
      applyVoice(utterance, lang);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length) {
      start();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', start, { once: true });
      start();
    }
  });
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}
