import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../types';
import { TranslateError, translateText } from '../lib/translate';
import { canListen, canSpeak, listen, speak, stopSpeaking } from '../lib/speech';
import { Icon } from './Icon';

type Side = 'me' | 'them';

interface Message {
  id: number;
  from: Side;
  ko: string;
  ja: string;
  pending?: boolean;
  error?: string;
}

/**
 * 대화 모드 — 휴대폰을 탁자에 놓고 마주 앉아 쓴다.
 * 위쪽 절반은 뒤집어서 상대(일본어)가 읽고, 아래쪽은 내가(한국어) 읽는다.
 * 한쪽이 말하면 반대쪽 화면에 번역이 뜨고 소리로도 읽어 준다.
 */
export function ConversationOverlay({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [listening, setListening] = useState<Side | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const stop = useRef<(() => void) | null>(null);
  const heard = useRef('');
  const nextId = useRef(1);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; stop.current?.(); stopSpeaking(); };
  }, []);

  const send = async (from: Side, text: string) => {
    const source = text.trim();
    if (!source) return;
    const id = nextId.current++;
    setMessages((m) => [...m, { id, from, ko: from === 'me' ? source : '', ja: from === 'them' ? source : '', pending: true }]);
    try {
      const r = await translateText(source, from === 'me' ? 'ko2ja' : 'ja2ko', settings);
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, ko: from === 'me' ? source : r.target, ja: from === 'them' ? source : r.target, pending: false } : x)));
      // 들을 사람의 언어로 읽어 준다
      if (autoSpeak) speak(r.target, from === 'me' ? 'ja-JP' : 'ko-KR');
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, pending: false, error: e instanceof TranslateError ? e.message : '번역하지 못했습니다.' } : x)));
    }
  };

  const mic = (side: Side) => {
    if (listening) { stop.current?.(); return; }
    stopSpeaking();
    heard.current = '';
    setListening(side);
    stop.current = listen(
      side === 'me' ? 'ko-KR' : 'ja-JP',
      (t) => { heard.current = t; },
      () => {
        setListening(null);
        stop.current = null;
        const said = heard.current;
        heard.current = '';
        if (said.trim()) void send(side, said);
      },
    );
  };

  return (
    <div className="convo" role="dialog" aria-modal="true" aria-label="대화 모드">
      <Pane side="them" messages={messages} listening={listening} onMic={mic} onSend={send} />
      <div className="convo__bar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="대화 끝내기">
          <Icon name="close" size={20} strokeWidth={2.2} />
        </button>
        <span className="convo__hint small">위는 상대 · 아래는 나</span>
        <button type="button" className={`icon-btn ${autoSpeak ? '' : 'icon-btn--label'}`} onClick={() => setAutoSpeak((v) => !v)} aria-pressed={autoSpeak} aria-label="번역 읽어 주기">
          <Icon name="volume" size={19} strokeWidth={2} />
          <span className="tiny">{autoSpeak ? '켬' : '끔'}</span>
        </button>
      </div>
      <Pane side="me" messages={messages} listening={listening} onMic={mic} onSend={send} />
    </div>
  );
}

const COPY: Record<Side, { lang: 'ko' | 'ja'; empty: string; mic: string; listening: string; input: string; send: string }> = {
  me: { lang: 'ko', empty: '마이크를 누르고 한국어로 말하세요', mic: '말하기', listening: '듣고 있어요…', input: '한국어로 입력', send: '보내기' },
  them: { lang: 'ja', empty: 'マイクを押して日本語で話してください', mic: '話す', listening: '聞いています…', input: '日本語で入力', send: '送信' },
};

function Pane({
  side, messages, listening, onMic, onSend,
}: {
  side: Side;
  messages: Message[];
  listening: Side | null;
  onMic: (s: Side) => void;
  onSend: (s: Side, text: string) => void;
}) {
  const [typing, setTyping] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const copy = COPY[side];
  const text = (m: Message) => (side === 'me' ? m.ko : m.ja);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, messages[messages.length - 1]?.pending]);

  return (
    <div className={`convo__pane convo__pane--${side}`} lang={copy.lang}>
      <div className="convo__messages">
        {messages.length === 0 && <p className="convo__empty">{copy.empty}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`convo__msg ${m.from === side ? 'convo__msg--own' : 'convo__msg--other'}`}>
            {m.error && m.from !== side ? (
              <span className="muted">{side === 'me' ? m.error : '…'}</span>
            ) : m.pending && m.from !== side ? (
              <span className="muted">…</span>
            ) : (
              <>
                <span>{text(m)}</span>
                {m.from !== side && canSpeak() && (
                  <button type="button" className="icon-btn" onClick={() => speak(text(m), side === 'me' ? 'ko-KR' : 'ja-JP')} aria-label="다시 듣기">
                    <Icon name="volume" size={15} strokeWidth={2} />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="convo__controls">
        {canListen() ? (
          <button type="button" className={`convo__mic ${listening === side ? 'convo__mic--live' : ''}`} onClick={() => onMic(side)} disabled={!!listening && listening !== side}>
            <Icon name="mic" size={24} strokeWidth={2} />
            <span>{listening === side ? copy.listening : copy.mic}</span>
          </button>
        ) : null}
        <form className="convo__type" onSubmit={(e) => { e.preventDefault(); onSend(side, typing); setTyping(''); }}>
          <input className="input" value={typing} onChange={(e) => setTyping(e.target.value)} placeholder={copy.input} />
          <button type="submit" className="btn btn--gray btn--sm" disabled={!typing.trim()}>{copy.send}</button>
        </form>
      </div>
    </div>
  );
}
