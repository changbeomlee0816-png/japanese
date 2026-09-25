import { useMemo, useState } from 'react';
import type { Expense, Settings, Trip } from '../types';
import { actions } from '../store/tripStore';
import { activeExpenses, computeBalances, expenseKRW, settleUp, settlementText, totalsByCategory } from '../lib/settle';
import { CATEGORY, CATEGORY_ORDER } from '../lib/category';
import { formatKRW, formatMoney } from '../lib/fares';
import { formatDateShort } from '../lib/time';
import { setMe, useMe } from '../lib/me';
import { ExpenseSheet, type ExpenseDraft } from './ExpenseSheet';
import { Icon } from './Icon';

interface BookProps {
  trip: Trip;
  settings: Settings;
  readOnly: boolean;
  /** 예산 탭에서 계산한 여행 전체 예상 비용(원) — 아직 모르면 null */
  estimateKRW: number | null;
}

/** 가계부 — 실제로 쓴 돈 */
export function ExpenseBook({ trip, settings, readOnly, estimateKRW }: BookProps) {
  const [editing, setEditing] = useState<{ expense: Expense | null; draft?: ExpenseDraft } | null>(null);
  const list = useMemo(() => activeExpenses(trip.expenses), [trip.expenses]);
  const total = list.reduce((n, e) => n + expenseKRW(e), 0);
  const byCat = useMemo(() => totalsByCategory(trip.expenses), [trip.expenses]);
  const maxCat = Math.max(1, ...Object.values(byCat).map((v) => v ?? 0));
  const cash = list.filter((e) => e.method === 'cash').reduce((n, e) => n + expenseKRW(e), 0);
  const name = (id: string) => trip.members?.find((m) => m.id === id)?.name ?? '?';

  const byDate = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of [...list].sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt))) {
      map.set(e.date, [...(map.get(e.date) ?? []), e]);
    }
    return [...map.entries()];
  }, [list]);

  const open = (expense: Expense | null) => {
    actions.ensureMembers();
    setEditing({ expense });
  };

  const ratio = estimateKRW && estimateKRW > 0 ? total / estimateKRW : null;

  return (
    <>
      <div className="section">
        <div className="card cost-hero">
          <span className="cost-hero__label">지금까지 쓴 돈</span>
          <strong className="cost-hero__value mono">{formatKRW(total)}</strong>
          {ratio !== null && (
            <>
              <div className="budget-bar" aria-label={`예산의 ${Math.round(ratio * 100)}%`}>
                <span className={`budget-bar__fill ${ratio > 1 ? 'budget-bar__fill--over' : ''}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
              </div>
              <span className="muted small">
                예상 {formatKRW(estimateKRW!)}의 {Math.round(ratio * 100)}%
                {ratio > 1 ? ` · ${formatKRW(total - estimateKRW!)} 넘음` : ` · ${formatKRW(estimateKRW! - total)} 남음`}
              </span>
            </>
          )}
          <div className="cost-hero__split">
            <div><span className="muted small">건수</span><strong className="mono">{list.length}</strong></div>
            <div><span className="muted small">현금</span><strong className="mono">{formatKRW(cash)}</strong></div>
            <div><span className="muted small">카드</span><strong className="mono">{formatKRW(total - cash)}</strong></div>
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="section">
          <button type="button" className="btn btn--primary btn--block" onClick={() => open(null)}>
            <Icon name="plus" size={18} strokeWidth={2.4} /> 지출 적기
          </button>
          {settings.anthropicApiKey && <p className="muted tiny" style={{ padding: '8px 4px 0' }}>영수증을 찍으면 금액·가게·날짜를 채워 줍니다.</p>}
        </div>
      )}

      {list.length > 0 && (
        <div className="section">
          <div className="section__header"><span className="section__title">항목별</span></div>
          <div className="list" style={{ padding: '6px 0' }}>
            {CATEGORY_ORDER.filter((c) => (byCat[c] ?? 0) > 0).map((c) => (
              <div className="bar-row" key={c}>
                <span className="bar-row__label">
                  <Icon name={CATEGORY[c].icon} size={16} strokeWidth={2} color={CATEGORY[c].color} /> {CATEGORY[c].label}
                </span>
                <span className="bar-row__track">
                  <span className="bar-row__fill" style={{ width: `${((byCat[c] ?? 0) / maxCat) * 100}%`, background: CATEGORY[c].color }} />
                </span>
                <span className="bar-row__value mono">{formatKRW(byCat[c] ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {byDate.map(([date, items]) => (
        <div className="section" key={date}>
          <div className="section__header">
            <span className="section__title">{formatDateShort(date)}</span>
            <span className="muted tiny mono">{formatKRW(items.reduce((n, e) => n + expenseKRW(e), 0))}</span>
          </div>
          <div className="list">
            {items.map((e) => (
              <button key={e.id} type="button" className="row row--tappable exp-row" onClick={() => !readOnly && open(e)} disabled={readOnly}>
                <span className="exp-row__icon" style={{ color: CATEGORY[e.category].color }}>
                  <Icon name={CATEGORY[e.category].icon} size={18} strokeWidth={2} />
                </span>
                <span className="exp-row__body">
                  <span className="exp-row__title">{e.title}</span>
                  <span className="muted tiny">
                    {name(e.paidBy)} 냄{e.splitAmong.length ? ` · ${e.splitAmong.map(name).join('·')} 나눔` : ''}{e.method === 'cash' ? ' · 현금' : ''}
                    {e.memo ? ` · ${e.memo}` : ''}
                  </span>
                </span>
                <span className="exp-row__amount">
                  <strong className="mono">{formatMoney(e.amount, e.currency)}</strong>
                  {e.currency !== 'KRW' && <span className="muted tiny mono">{formatKRW(expenseKRW(e))}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {list.length === 0 && (
        <div className="section">
          <p className="muted" style={{ padding: '4px', lineHeight: 1.6 }}>
            아직 적은 지출이 없습니다. 쓸 때마다 적어 두면 여행이 끝나고 누가 누구에게 얼마를 보내면 되는지 정산해 드립니다.
            공유 링크로 함께 보는 동행도 같은 가계부에 적을 수 있습니다.
          </p>
        </div>
      )}

      {editing && (
        <ExpenseSheet trip={trip} settings={settings} expense={editing.expense} draft={editing.draft} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

/** 정산 — 누가 누구에게 얼마 */
export function SettleView({ trip, readOnly }: { trip: Trip; readOnly: boolean }) {
  const me = useMe(trip.id);
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState('');
  const members = trip.members ?? [];
  const balances = useMemo(() => computeBalances(trip.expenses, members), [trip.expenses, members]);
  const transfers = useMemo(() => settleUp(balances), [balances]);
  const total = activeExpenses(trip.expenses).reduce((n, e) => n + expenseKRW(e), 0);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  if (members.length === 0) {
    return (
      <div className="section">
        <p className="muted" style={{ padding: 4, lineHeight: 1.6 }}>함께 가는 사람을 먼저 정해 주세요.</p>
        {!readOnly && (
          <button type="button" className="btn btn--primary btn--block" onClick={() => actions.ensureMembers()}>
            동행 {trip.travelers}명으로 시작하기
          </button>
        )}
      </div>
    );
  }

  const copy = async () => {
    const text = settlementText(trip.title, transfers, members, total);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('아래 문구를 복사하세요', text);
    }
  };

  return (
    <>
      <div className="section">
        <div className="section__header"><span className="section__title">보낼 돈</span><span className="muted tiny mono">총 {formatKRW(total)}</span></div>
        <div className="list">
          {transfers.length === 0 ? (
            <div className="row"><span className="row__label muted">{total > 0 ? '모두 딱 맞게 냈습니다 👍' : '적은 지출이 없습니다'}</span></div>
          ) : (
            transfers.map((t, i) => (
              <div key={i} className={`row settle-row ${t.from === me ? 'settle-row--me' : ''}`}>
                <span className="row__label">
                  <b>{name(t.from)}</b> <span className="muted">→</span> <b>{name(t.to)}</b>
                  {t.from === me && <span className="settle-row__tag">내가 보낼 돈</span>}
                  {t.to === me && <span className="settle-row__tag settle-row__tag--in">받을 돈</span>}
                </span>
                <strong className="row__value mono">{formatKRW(t.amount)}</strong>
              </div>
            ))
          )}
        </div>
        {transfers.length > 0 && (
          <button type="button" className="btn btn--tinted btn--block" style={{ marginTop: 10 }} onClick={() => void copy()}>
            <Icon name="copy" size={16} strokeWidth={2} /> {copied ? '복사했습니다 — 카톡에 붙여 넣으세요' : '정산 문구 복사'}
          </button>
        )}
        <p className="muted tiny" style={{ padding: '8px 4px 0', lineHeight: 1.55 }}>
          지출마다 적을 때의 환율로 원화로 바꿔 계산합니다. 보내는 횟수가 가장 적도록 짝을 지었습니다.
        </p>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">사람별</span></div>
        <div className="list">
          {balances.map((b) => (
            <div key={b.memberId} className="row">
              <span className="row__label">
                <b>{name(b.memberId)}</b>{b.memberId === me ? ' (나)' : ''}
                <span className="muted tiny" style={{ display: 'block' }}>낸 돈 {formatKRW(b.paid)} · 몫 {formatKRW(b.share)}</span>
              </span>
              <strong className={`row__value mono ${b.net > 0 ? 'amount-in' : b.net < 0 ? 'amount-out' : ''}`}>
                {b.net > 0 ? '+' : b.net < 0 ? '−' : ''}{formatKRW(Math.abs(b.net))}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">동행</span></div>
        <div className="list">
          {members.map((m) => (
            <div key={m.id} className="field">
              <input
                className="input"
                value={m.name}
                disabled={readOnly}
                onChange={(e) => actions.renameMember(m.id, e.target.value)}
                aria-label="이름"
              />
              <button type="button" className={`taste-chip ${me === m.id ? 'taste-chip--on' : ''}`} onClick={() => setMe(trip.id, m.id)}>
                {me === m.id ? '이게 나' : '나로 정하기'}
              </button>
            </div>
          ))}
          {!readOnly && (
            <div className="field">
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="동행 추가 (이름)" />
              <button type="button" className="btn btn--gray btn--sm" disabled={!newName.trim()} onClick={() => { actions.addMember(newName.trim()); setNewName(''); }}>
                추가
              </button>
            </div>
          )}
        </div>
        <p className="muted tiny" style={{ padding: '8px 4px 0', lineHeight: 1.55 }}>
          "나로 정하기"는 이 기기에만 기억합니다 — 지출을 적을 때 낸 사람 기본값이 됩니다.
          나중에 추가한 동행은 "모두"로 나눈 지출에 함께 들어갑니다. 빠져야 하는 지출은 고쳐서 나눌 사람을 골라 주세요.
        </p>
      </div>
    </>
  );
}
