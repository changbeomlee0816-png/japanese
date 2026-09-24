/**
 * 소리 내어 읽기(TTS)와 받아쓰기(음성 인식) — 브라우저에 들어 있는 기능만 쓴다.
 * 아이폰 Safari·안드로이드 Chrome 모두 일본어 목소리를 기본으로 갖고 있다. 키도 인터넷도 필요 없다.
 */

export type SpeechLang = 'ja-JP' | 'ko-KR';

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.slice(0, 2);
  // 기기에 설치된 목소리 중 그 언어의 기본 목소리 → 아무 목소리
  return (
    voices.find((v) => v.lang.replace('_', '-') === lang && v.localService) ??
    voices.find((v) => v.lang.replace('_', '-') === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  );
}

/** 읽어 준다. slow 면 천천히 — 따라 말하기 좋게 */
export function speak(text: string, lang: SpeechLang, slow = false): void {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  u.rate = slow ? 0.6 : 0.95;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/* ─────────────────────────── 받아쓰기 ─────────────────────────── */

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function recognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return !!recognitionCtor();
}

/**
 * 말하면 받아 적는다. 말하는 동안 onText 로 중간 결과가 계속 들어오고, 끝나면 onEnd.
 * 돌려주는 함수를 부르면 멈춘다.
 */
export function listen(lang: SpeechLang, onText: (text: string, final: boolean) => void, onEnd: (error?: string) => void): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    onEnd('unsupported');
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  let failed: string | undefined;
  rec.onresult = (e) => {
    let text = '';
    let final = false;
    for (let i = 0; i < e.results.length; i += 1) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) final = true;
    }
    onText(text, final);
  };
  rec.onerror = (e) => { failed = e.error; };
  rec.onend = () => onEnd(failed);
  try {
    rec.start();
  } catch {
    onEnd('start-failed');
  }
  return () => rec.stop();
}
