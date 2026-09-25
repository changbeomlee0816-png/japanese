import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Settings } from '../types';
import {
  ENGINE_LABEL, TranslateError, translateImage, translateText,
  type Direction, type ImageResult, type TextResult,
} from '../lib/translate';
import { PHRASEBOOK, searchPhrases, type Phrase } from '../data/phrases';
import { kanaToHangul } from '../lib/kana';
import { canListen, canSpeak, listen, speak, type SpeechLang } from '../lib/speech';
import { translateActions, useTranslateStore, type SavedTranslation } from '../lib/translateStore';
import { Segmented } from './ui';
import { Icon } from './Icon';
import { ConversationOverlay } from './Conversation';

type Mode = 'text' | 'camera' | 'talk' | 'phrases';

interface Props {
  settings: Settings;
  onOpenSettings?: () => void;
}

/** 크게 보여 주기 — 점원에게 화면을 그대로 내민다 */
interface Showcase {
  ja: string;
  reading?: string;
  hangul?: string;
  ko: string;
}

/**
 * 번역 탭. 번역 앱들이 공통으로 갖춘 것을 그대로 따른다.
 *  - 텍스트: 한국어 ⇄ 일본어, 읽는 법과 한글 발음, 듣기·천천히 듣기, 크게 보여 주기, 받아쓰기
 *  - 카메라: 메뉴판·표지판을 찍으면 줄마다 번역 (메뉴면 무엇으로 만든 요리인지까지)
 *  - 회화: 인터넷 없이 쓰는 여행 문장 모음
 */
export function TranslateScreen({ settings, onOpenSettings }: Props) {
  const [mode, setMode] = useState<Mode>('text');
  const [direction, setDirection] = useState<Direction>('ko2ja');
  const [showcase, setShowcase] = useState<Showcase | null>(null);
  const hasKey = !!settings.anthropicApiKey;

  return (
    <>
      <div className="large-title">
        <h1>번역</h1>
        <p>{hasKey ? 'Claude 번역 · 사진 번역 · 회화집' : '무료 번역 · 사진 번역 · 회화집 (인터넷 없이도)'}</p>
      </div>

      <div className="section">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'text', label: '텍스트' },
            { value: 'camera', label: '카메라' },
            { value: 'talk', label: '대화' },
            { value: 'phrases', label: '회화' },
          ]}
        />
      </div>

      {mode === 'text' && (
        <TextMode settings={settings} direction={direction} onDirection={setDirection} onShow={setShowcase} onOpenSettings={onOpenSettings} />
      )}
      {mode === 'camera' && <CameraMode settings={settings} onShow={setShowcase} onOpenSettings={onOpenSettings} />}
      {mode === 'talk' && <TalkMode settings={settings} />}
      {mode === 'phrases' && <PhraseMode onShow={setShowcase} />}

      {showcase && <ShowcaseOverlay item={showcase} onClose={() => setShowcase(null)} />}
    </>
  );
}

/* ─────────────────────────── 공통 조각 ─────────────────────────── */

function SpeakButtons({ text, lang }: { text: string; lang: SpeechLang }) {
  if (!canSpeak()) return null;
  return (
    <>
      <button type="button" className="icon-btn" onClick={() => speak(text, lang)} aria-label="듣기">
        <Icon name="volume" size={19} strokeWidth={2} />
      </button>
      <button type="button" className="icon-btn icon-btn--label" onClick={() => speak(text, lang, true)} aria-label="천천히 듣기">
        천천히
      </button>
    </>
  );
}

function copy(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => {});
}

/* ─────────────────────────── 텍스트 ─────────────────────────── */

function TextMode({
  settings, direction, onDirection, onShow, onOpenSettings,
}: {
  settings: Settings;
  direction: Direction;
  onDirection: (d: Direction) => void;
  onShow: (s: Showcase) => void;
  onOpenSettings?: () => void;
}) {
  const [text, setText] = useState('');
  /** 받아쓰기가 끝났을 때 마지막으로 들은 글 — 상태 갱신 함수 안에서 번역을 시작하지 않으려고 따로 둔다 */
  const heard = useRef('');
  const [result, setResult] = useState<TextResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const stopListening = useRef<(() => void) | null>(null);
  const abort = useRef<AbortController | null>(null);
  const store = useTranslateStore();

  const fromLabel = direction === 'ko2ja' ? '한국어' : '일본어';
  const toLabel = direction === 'ko2ja' ? '일본어' : '한국어';
  const suggestions = useMemo(() => (direction === 'ko2ja' ? searchPhrases(text, 3) : []), [text, direction]);

  useEffect(() => () => { abort.current?.abort(); stopListening.current?.(); }, []);

  const run = async (input = text) => {
    if (!input.trim()) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(null);
    try {
      const r = await translateText(input, direction, settings, controller.signal);
      setResult(r);
      translateActions.remember(r);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError(e instanceof TranslateError ? e.message : '번역하지 못했습니다.');
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };

  const swap = () => {
    onDirection(direction === 'ko2ja' ? 'ja2ko' : 'ko2ja');
    // 번역문을 다시 원문으로 — 번역 앱의 ⇄ 버튼과 같다
    if (result) { setText(result.target); setResult(null); }
  };

  const toggleMic = () => {
    if (listening) { stopListening.current?.(); return; }
    setError(null);
    setListening(true);
    stopListening.current = listen(
      direction === 'ko2ja' ? 'ko-KR' : 'ja-JP',
      (t) => { heard.current = t; setText(t); },
      (err) => {
        setListening(false);
        stopListening.current = null;
        if (err && err !== 'no-speech' && err !== 'aborted') setError(err === 'not-allowed' ? '마이크 권한이 꺼져 있습니다.' : '말을 알아듣지 못했습니다.');
        else if (heard.current.trim()) void run(heard.current);
        heard.current = '';
      },
    );
  };

  const jaText = result ? (direction === 'ko2ja' ? result.target : result.source) : '';
  const koText = result ? (direction === 'ko2ja' ? result.source : result.target) : '';
  const fav = result ? translateActions.isFavorite(result) : false;

  return (
    <>
      <div className="section">
        <div className="lang-bar">
          <span className="lang-bar__lang">{fromLabel}</span>
          <button type="button" className="lang-bar__swap" onClick={swap} aria-label="언어 바꾸기">
            <Icon name="swap" size={18} strokeWidth={2} />
          </button>
          <span className="lang-bar__lang">{toLabel}</span>
        </div>

        <div className="card tr-input">
          <textarea
            className="tr-input__text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void run(); } }}
            placeholder={direction === 'ko2ja' ? '말하고 싶은 걸 한국어로 적으세요\n예) 물 좀 주세요' : '일본어를 붙여 넣으세요\n예) 本日定休日'}
            lang={direction === 'ko2ja' ? 'ko' : 'ja'}
            rows={3}
          />
          <div className="tr-input__bar">
            {canListen() && (
              <button type="button" className={`icon-btn ${listening ? 'icon-btn--live' : ''}`} onClick={toggleMic} aria-label={listening ? '받아쓰기 멈추기' : '말로 입력'}>
                <Icon name="mic" size={19} strokeWidth={2} />
              </button>
            )}
            {text && (
              <button type="button" className="icon-btn icon-btn--label" onClick={() => { setText(''); setResult(null); setError(null); }}>
                지우기
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void run()} disabled={busy || !text.trim()}>
              {busy ? '번역 중…' : '번역'}
            </button>
          </div>
        </div>

        {suggestions.length > 0 && !result && (
          <div className="tr-suggest">
            <span className="muted tiny">회화집에서</span>
            {suggestions.map((p) => (
              <button key={p.ko} type="button" className="tr-suggest__item" onClick={() => onShow({ ja: p.ja, reading: p.reading, hangul: kanaToHangul(p.reading), ko: p.ko })}>
                <b>{p.ko}</b> <span lang="ja">{p.ja}</span> <span className="tr-suggest__hangul">{kanaToHangul(p.reading)}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="small" style={{ color: 'var(--red)', padding: '10px 4px 0' }}>{error}</p>}
      </div>

      {result && (
        <div className="section">
          <div className="card tr-result">
            <div className="tr-result__head">
              <span className="muted tiny">{toLabel}</span>
              <span className="badge">{ENGINE_LABEL[result.engine]}</span>
            </div>
            <p className="tr-result__text" lang={direction === 'ko2ja' ? 'ja' : 'ko'}>{result.target}</p>
            {result.reading && direction === 'ko2ja' && <p className="tr-result__reading" lang="ja">{result.reading}</p>}
            {result.hangul && direction === 'ko2ja' && (
              <p className="tr-result__hangul"><span className="muted tiny">발음</span> {result.hangul}</p>
            )}
            {direction === 'ja2ko' && result.reading && (
              <p className="tr-result__source-reading">
                <span className="muted tiny">원문 읽기</span> <span lang="ja">{result.reading}</span>
                {result.hangul && <> · <b>{result.hangul}</b></>}
              </p>
            )}
            {result.note && <p className="tr-result__note">{result.note}</p>}

            <div className="tr-actions">
              <SpeakButtons text={jaText} lang="ja-JP" />
              <button type="button" className="icon-btn" onClick={() => copy(result.target)} aria-label="복사">
                <Icon name="copy" size={18} strokeWidth={2} />
              </button>
              <button type="button" className={`icon-btn ${fav ? 'icon-btn--on' : ''}`} onClick={() => translateActions.toggleFavorite(result)} aria-label={fav ? '저장 취소' : '저장'}>
                <Icon name="star" size={18} strokeWidth={2} />
              </button>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn--tinted btn--sm"
                onClick={() => onShow({ ja: jaText, reading: direction === 'ko2ja' ? result.reading : result.reading, hangul: result.hangul, ko: koText })}
              >
                <Icon name="expand" size={15} strokeWidth={2} /> 크게 보기
              </button>
            </div>

            {result.variants && result.variants.length > 0 && (
              <div className="tr-variants">
                {result.variants.map((v) => (
                  <div key={v.label} className="tr-variant">
                    <span className="muted tiny">{v.label}</span>
                    <p lang="ja">{v.text}</p>
                    {v.hangul && <p className="tr-result__hangul small">{v.hangul}</p>}
                    {canSpeak() && (
                      <button type="button" className="icon-btn" onClick={() => speak(v.text, 'ja-JP')} aria-label={`${v.label} 듣기`}>
                        <Icon name="volume" size={17} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {result.engine === 'free' && direction === 'ko2ja' && !result.hangul && (
            <p className="muted tiny" style={{ padding: '8px 4px 0', lineHeight: 1.6 }}>
              무료 번역은 한자 읽는 법을 알려 주지 않습니다 — <b>듣기</b>로 발음을 확인하세요.
              {onOpenSettings && <> <button type="button" className="linkish" onClick={onOpenSettings}>Claude API 키</button>를 넣으면 읽는 법·한글 발음·공손한 말까지 나옵니다.</>}
            </p>
          )}
        </div>
      )}

      <SavedList
        title="저장한 문장"
        items={store.favorites}
        onPick={(s) => onShow({ ja: s.direction === 'ko2ja' ? s.target : s.source, reading: s.reading, hangul: s.hangul, ko: s.direction === 'ko2ja' ? s.source : s.target })}
      />
      <SavedList
        title="최근 번역"
        items={store.history.slice(0, 8)}
        onPick={(s) => { onDirection(s.direction); setText(s.source); setResult({ engine: 'saved', ...s }); }}
        onClear={store.history.length ? () => translateActions.clearHistory() : undefined}
      />
    </>
  );
}

function SavedList({
  title, items, onPick, onClear,
}: {
  title: string;
  items: SavedTranslation[];
  onPick: (s: SavedTranslation) => void;
  onClear?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="section">
      <div className="section__header">
        <span className="section__title">{title}</span>
        {onClear && <button type="button" className="linkish tiny" onClick={onClear}>지우기</button>}
      </div>
      <div className="list">
        {items.map((s) => (
          <button key={s.id} type="button" className="row row--tappable tr-saved" onClick={() => onPick(s)}>
            <span className="tr-saved__body">
              <span className="tr-saved__src">{s.source}</span>
              <span className="tr-saved__dst" lang={s.direction === 'ko2ja' ? 'ja' : 'ko'}>{s.target}</span>
            </span>
            <Icon name="chevronRight" size={16} className="chevron" strokeWidth={2.2} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── 카메라 ─────────────────────────── */

function CameraMode({ settings, onShow, onOpenSettings }: { settings: Settings; onShow: (s: Showcase) => void; onOpenSettings?: () => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ImageResult | null>(null);
  const hasKey = !!settings.anthropicApiKey;

  const pick = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const { result: r, preview: p } = await translateImage(file, settings, setStatus);
      setPreview(p);
      setResult(r);
    } catch (e) {
      setError(e instanceof TranslateError ? e.message : '사진을 번역하지 못했습니다.');
    } finally {
      setStatus(null);
    }
  };

  const input = (ref: RefObject<HTMLInputElement>, capture: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      {...(capture ? { capture: 'environment' as const } : {})}
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void pick(f);
        e.target.value = '';
      }}
    />
  );

  return (
    <>
      <div className="section">
        <div className="cam-buttons">
          <button type="button" className="btn btn--primary cam-buttons__main" onClick={() => cameraRef.current?.click()} disabled={!!status}>
            <Icon name="camera" size={20} strokeWidth={2} /> 사진 찍기
          </button>
          <button type="button" className="btn btn--gray" onClick={() => albumRef.current?.click()} disabled={!!status}>
            <Icon name="image" size={18} strokeWidth={2} /> 앨범에서
          </button>
        </div>
        {input(cameraRef, true)}
        {input(albumRef, false)}
        <p className="muted tiny" style={{ padding: '10px 4px 0', lineHeight: 1.6 }}>
          메뉴판·표지판·안내문을 찍으면 줄마다 한국어로 옮깁니다.
          {hasKey
            ? ' 메뉴면 무엇으로 만든 요리인지(돼지고기·날것·매운맛)까지 알려 줍니다.'
            : ' 지금은 기기에서 글자를 읽습니다 — 가로로 인쇄된 글씨는 잘 읽지만 세로쓰기·손글씨는 약합니다.'}
          {!hasKey && onOpenSettings && (
            <> <button type="button" className="linkish" onClick={onOpenSettings}>Claude API 키</button>를 넣으면 훨씬 정확합니다.</>
          )}
        </p>
        {status && (
          <div className="card" style={{ padding: 14, marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="spinner" />
            <span className="small">{status}</span>
          </div>
        )}
        {error && <p className="small" style={{ color: 'var(--red)', padding: '10px 4px 0' }}>{error}</p>}
      </div>

      {result && (
        <div className="section">
          <div className="section__header">
            <span className="section__title">읽은 글</span>
            <span className="badge">{ENGINE_LABEL[result.engine]}</span>
          </div>
          {result.summary && <p className="cam-summary">{result.summary}</p>}
          {preview && <img className="cam-preview" src={preview} alt="찍은 사진" />}
          {result.blocks.length === 0 ? (
            <p className="muted" style={{ padding: '8px 4px' }}>일본어를 찾지 못했습니다. 글자가 크게 나오도록 가까이에서 다시 찍어 보세요.</p>
          ) : (
            <div className="list">
              {result.blocks.map((b, i) => (
                <div key={i} className="cam-block">
                  <div className="cam-block__top">
                    <span className="cam-block__ja" lang="ja">{b.ja}</span>
                    {b.price && <span className="cam-block__price mono">{b.price}</span>}
                  </div>
                  {(b.reading || b.hangul) && (
                    <div className="cam-block__reading">
                      {b.reading && <span lang="ja">{b.reading}</span>}
                      {b.hangul && <b> · {b.hangul}</b>}
                    </div>
                  )}
                  <div className="cam-block__ko">{b.ko || <span className="muted">(번역 없음)</span>}</div>
                  {b.note && <div className="cam-block__note">{b.note}</div>}
                  <div className="tr-actions tr-actions--compact">
                    {canSpeak() && (
                      <button type="button" className="icon-btn" onClick={() => speak(b.ja, 'ja-JP')} aria-label="듣기">
                        <Icon name="volume" size={17} strokeWidth={2} />
                      </button>
                    )}
                    <button type="button" className="icon-btn" onClick={() => onShow({ ja: b.ja, reading: b.reading, hangul: b.hangul, ko: b.ko })} aria-label="크게 보기">
                      <Icon name="expand" size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────── 대화 ─────────────────────────── */

function TalkMode({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="section">
      <div className="card talk-intro">
        <div className="talk-intro__art" aria-hidden="true">
          <span lang="ja">こんにちは</span>
          <span>안녕하세요</span>
        </div>
        <p className="talk-intro__text">
          휴대폰을 탁자에 놓고 마주 앉아 쓰세요. <b>위쪽 절반은 상대방</b>을 향해 뒤집혀 보이고,
          한쪽이 말하면 반대쪽에 번역이 뜨고 소리로도 읽어 줍니다.
        </p>
        <button type="button" className="btn btn--primary btn--block" onClick={() => setOpen(true)}>
          <Icon name="mic" size={18} strokeWidth={2} /> 대화 시작
        </button>
        <p className="muted tiny" style={{ marginTop: 10, lineHeight: 1.55 }}>
          {canListen() ? '말하기 버튼을 누르고 말하면 됩니다. 입력칸에 쳐도 됩니다.' : '이 브라우저는 음성 인식을 지원하지 않아 입력칸으로 주고받습니다.'}
          {settings.anthropicApiKey ? ' 번역은 Claude가 합니다.' : ' 키가 없으면 회화집·무료 번역으로 옮깁니다.'}
        </p>
      </div>
      {open && <ConversationOverlay settings={settings} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ─────────────────────────── 회화집 ─────────────────────────── */

function PhraseMode({ onShow }: { onShow: (s: Showcase) => void }) {
  const [category, setCategory] = useState(PHRASEBOOK[0].id);
  const [query, setQuery] = useState('');
  const list: Phrase[] = query.trim() ? searchPhrases(query, 20) : (PHRASEBOOK.find((c) => c.id === category)?.phrases ?? []);

  return (
    <>
      <div className="section">
        <div className="search-bar">
          <Icon name="search" size={17} strokeWidth={2.2} color="var(--label-2)" />
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="한국어로 찾기 (예: 화장실, 계산)" />
        </div>
        {!query.trim() && (
          <div className="chip-row">
            {PHRASEBOOK.map((c) => (
              <button key={c.id} type="button" className={`taste-chip ${category === c.id ? 'taste-chip--on' : ''}`} onClick={() => setCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        )}
        <p className="muted tiny" style={{ padding: '10px 4px 0' }}>인터넷 없이 됩니다. 문장을 누르면 크게 보여 줍니다.</p>
      </div>

      <div className="section">
        <div className="list">
          {list.map((p) => {
            const hangul = kanaToHangul(p.reading);
            return (
              <div key={p.ko} className="phrase">
                <button type="button" className="phrase__main" onClick={() => onShow({ ja: p.ja, reading: p.reading, hangul, ko: p.ko })}>
                  <span className="phrase__ko">{p.ko}</span>
                  <span className="phrase__ja" lang="ja">{p.ja}</span>
                  <span className="phrase__hangul">{hangul}</span>
                </button>
                {canSpeak() && (
                  <button type="button" className="icon-btn" onClick={() => speak(p.ja, 'ja-JP')} aria-label={`${p.ko} 듣기`}>
                    <Icon name="volume" size={19} strokeWidth={2} />
                  </button>
                )}
              </div>
            );
          })}
          {list.length === 0 && <p className="muted" style={{ padding: 16 }}>맞는 문장이 없습니다. 텍스트 번역을 써 보세요.</p>}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── 크게 보기 ─────────────────────────── */

function ShowcaseOverlay({ item, onClose }: { item: Showcase; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="showcase" role="dialog" aria-modal="true" aria-label="크게 보기">
      <button type="button" className="showcase__close" onClick={onClose} aria-label="닫기">
        <Icon name="close" size={22} strokeWidth={2.2} />
      </button>
      <div className="showcase__body">
        <p className="showcase__ja" lang="ja">{item.ja}</p>
        {item.reading && <p className="showcase__reading" lang="ja">{item.reading}</p>}
        {item.hangul && <p className="showcase__hangul">{item.hangul}</p>}
        <p className="showcase__ko">{item.ko}</p>
      </div>
      {canSpeak() && (
        <div className="showcase__actions">
          <button type="button" className="btn btn--primary" onClick={() => speak(item.ja, 'ja-JP')}>
            <Icon name="volume" size={18} strokeWidth={2} /> 들려주기
          </button>
          <button type="button" className="btn btn--gray" onClick={() => speak(item.ja, 'ja-JP', true)}>천천히</button>
        </div>
      )}
    </div>
  );
}
