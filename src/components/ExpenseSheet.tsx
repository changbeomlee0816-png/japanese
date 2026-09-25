import { useRef, useState } from 'react';
import type { Category, Expense, Settings, Trip } from '../types';
import { actions } from '../store/tripStore';
import { useMe } from '../lib/me';
import { useFxRate } from '../lib/fx';
import { scanReceipt } from '../lib/receipt';
import { ClaudeError } from '../lib/claude';
import { CATEGORY, CATEGORY_ORDER } from '../lib/category';
import { formatKRW } from '../lib/fares';
import { formatDateShort, todayISO } from '../lib/time';
import { Sheet, Segmented } from './ui';
import { Icon } from './Icon';

/** 일정에서 바로 적을 때 미리 채울 값 */
export interface ExpenseDraft {
  title?: string;
  category?: Category;
  date?: string;
  itemId?: string;
  amount?: number;
}

interface Props {
  trip: Trip;
  settings: Settings;
  /** 고칠 지출 — 없으면 새로 적는다 */
  expense?: Expense | null;
  draft?: ExpenseDraft;
  onClose: () => void;
}

/**
 * 지출 적기 — 트래블월렛·트리플 가계부·Splitwise 가 공통으로 묻는 것만.
 * 얼마를, 무엇에, 누가 냈고, 누구와 나누는지. 나머지는 기본값으로 둔다.
 */
export function ExpenseSheet({ trip, settings, expense, draft, onClose }: Props) {
  // 여는 쪽이 actions.ensureMembers() 로 동행을 만들어 둔다
  const members = trip.members ?? [];
  const me = useMe(trip.id);
  const { fx } = useFxRate(trip.currency);
  const liveRate = fx?.rate ?? trip.rateToKRW;

  const tripDates = trip.days.map((d) => d.date);
  const defaultDate = tripDates.includes(todayISO()) ? todayISO() : (draft?.date ?? tripDates[0] ?? todayISO());

  const [amount, setAmount] = useState(expense ? String(expense.amount) : draft?.amount ? String(draft.amount) : '');
  const [currency, setCurrency] = useState(expense?.currency ?? trip.currency);
  const [title, setTitle] = useState(expense?.title ?? draft?.title ?? '');
  const [category, setCategory] = useState<Category>(expense?.category ?? draft?.category ?? 'food');
  const [date, setDate] = useState(expense?.date ?? draft?.date ?? defaultDate);
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? (me && members.some((m) => m.id === me) ? me : members[0]?.id ?? ''));
  const [split, setSplit] = useState<string[]>(expense?.splitAmong.length ? expense.splitAmong : members.map((m) => m.id));
  const [method, setMethod] = useState<'cash' | 'card'>(expense?.method ?? 'card');
  const [memo, setMemo] = useState(expense?.memo ?? '');
  const [itemId, setItemId] = useState(expense?.itemId ?? draft?.itemId ?? '');
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const value = Number(amount.replace(/,/g, '')) || 0;
  // 고칠 때는 처음 적을 때의 환율을 그대로 쓴다 — 정산 숫자가 바뀌지 않게
  const rate = currency === 'KRW' ? 1 : expense && expense.currency === currency ? expense.rateToKRW : liveRate;
  const dayItems = trip.days.find((d) => d.date === date)?.items ?? [];

  const toggleSplit = (id: string) => {
    setSplit((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id]));
  };

  const save = () => {
    if (value <= 0) return;
    actions.saveExpense({
      id: expense?.id,
      title: title.trim() || CATEGORY[category].label,
      amount: value,
      currency,
      rateToKRW: rate,
      category,
      date,
      paidBy,
      // 모두가 나누면 빈 배열로 둔다 — 나중에 동행이 늘어도 함께 나눈다
      splitAmong: split.length === members.length ? [] : split,
      method,
      itemId: itemId || undefined,
      memo: memo.trim() || undefined,
    });
    onClose();
  };

  const scan = async (file: File) => {
    setScanning(true);
    setScanNote(null);
    try {
      const r = await scanReceipt(file, settings, trip.currency);
      if (r.total > 0) setAmount(String(r.total));
      if (r.currency === 'KRW' || r.currency === trip.currency) setCurrency(r.currency);
      if (r.merchant) setTitle(r.merchant);
      setCategory(r.category);
      if (r.date && tripDates.includes(r.date)) setDate(r.date);
      if (r.method) setMethod(r.method);
      if (r.summary) setMemo(r.summary);
      setScanNote(r.total > 0 ? '영수증을 읽었습니다. 금액을 한 번 확인해 주세요.' : '금액을 읽지 못했습니다. 직접 적어 주세요.');
    } catch (e) {
      setScanNote(e instanceof ClaudeError ? e.message : '영수증을 읽지 못했습니다.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <Sheet open title={expense ? '지출 고치기' : '지출 적기'} onClose={onClose} confirmLabel="저장" onConfirm={save} confirmDisabled={value <= 0 || scanning}>
      {settings.anthropicApiKey && (
        <div className="section">
          <button type="button" className="btn btn--tinted btn--block" onClick={() => fileRef.current?.click()} disabled={scanning}>
            <Icon name="camera" size={17} strokeWidth={2} /> {scanning ? '영수증 읽는 중…' : '영수증 찍어서 채우기'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void scan(f); e.target.value = ''; }} />
          {scanNote && <p className="small" style={{ padding: '8px 4px 0', color: 'var(--label-2)' }}>{scanNote}</p>}
        </div>
      )}

      <div className="section">
        <div className="card exp-amount">
          <input
            className="exp-amount__input mono"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            autoFocus={!expense}
            aria-label="금액"
          />
          <div className="exp-amount__cur">
            {[trip.currency, 'KRW'].filter((c, i, a) => a.indexOf(c) === i).map((c) => (
              <button key={c} type="button" className={`taste-chip ${currency === c ? 'taste-chip--on' : ''}`} onClick={() => setCurrency(c)}>
                {c === 'KRW' ? '원' : c === 'JPY' ? '엔' : c}
              </button>
            ))}
          </div>
          {currency !== 'KRW' && value > 0 && (
            <span className="exp-amount__krw muted mono">≈ {formatKRW(value * rate)} · 1{currency === 'JPY' ? '엔' : currency} {rate.toFixed(2)}원</span>
          )}
        </div>
      </div>

      <div className="section">
        <div className="list">
          <div className="field">
            <span className="field__label">내용</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 이치란 라멘, 스이카 충전" />
          </div>
        </div>
        <div className="exp-cats">
          {CATEGORY_ORDER.map((c) => (
            <button key={c} type="button" className={`exp-cat ${category === c ? 'exp-cat--on' : ''}`} style={{ ['--cat' as string]: CATEGORY[c].color }} onClick={() => setCategory(c)}>
              <Icon name={CATEGORY[c].icon} size={17} strokeWidth={2} />
              {CATEGORY[c].label}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">낸 사람</span></div>
        <div className="member-chips">
          {members.map((m) => (
            <button key={m.id} type="button" className={`taste-chip ${paidBy === m.id ? 'taste-chip--on' : ''}`} onClick={() => setPaidBy(m.id)}>
              {m.name}{m.id === me ? ' (나)' : ''}
            </button>
          ))}
        </div>
        {members.length > 1 && (
          <>
            <div className="section__header" style={{ marginTop: 14 }}>
              <span className="section__title">함께 나눌 사람</span>
              <span className="muted tiny">{split.length === members.length ? '모두' : `${split.length}명`} · 1인 {formatKRW((value * rate) / Math.max(1, split.length))}</span>
            </div>
            <div className="member-chips">
              {members.map((m) => (
                <button key={m.id} type="button" className={`taste-chip ${split.includes(m.id) ? 'taste-chip--on' : ''}`} onClick={() => toggleSplit(m.id)}>
                  {split.includes(m.id) ? '✓ ' : ''}{m.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="section">
        <Segmented value={method} onChange={setMethod} options={[{ value: 'card', label: '카드' }, { value: 'cash', label: '현금' }]} />
        <div className="list" style={{ marginTop: 12 }}>
          <div className="field">
            <span className="field__label">날짜</span>
            <select className="select" value={date} onChange={(e) => { setDate(e.target.value); setItemId(''); }}>
              {[...new Set([...tripDates, date])].sort().map((d) => (
                <option key={d} value={d}>{formatDateShort(d)}</option>
              ))}
            </select>
          </div>
          {dayItems.length > 0 && (
            <div className="field">
              <span className="field__label">일정</span>
              <select className="select" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">연결 안 함</option>
                {dayItems.map((it) => <option key={it.id} value={it.id}>{it.startTime} {it.title}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <span className="field__label">메모</span>
            <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="선택" />
          </div>
        </div>
      </div>

      {expense && (
        <div className="section">
          <div className="list">
            <button type="button" className="row row--tappable row--danger" onClick={() => { actions.deleteExpense(expense.id); onClose(); }}>
              <span className="row__label">이 지출 지우기</span>
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
