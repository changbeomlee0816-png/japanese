import { useMemo, useState } from 'react';
import type { ChecklistItem, Trip } from '../types';
import { actions } from '../store/tripStore';
import { regionById, findRegion } from '../data/regions';
import { CHECKLIST_GROUPS, templateFor } from '../data/checklist';
import { useMe } from '../lib/me';
import { diffDays, todayISO } from '../lib/time';
import { Sheet } from './ui';
import { Icon } from './Icon';

/** 출발까지 며칠 / 여행 며칠째 / 끝남 */
export function tripPhase(trip: Trip, today = todayISO()): { label: string; kind: 'before' | 'during' | 'after' } | null {
  const first = trip.days[0]?.date;
  const last = trip.days[trip.days.length - 1]?.date;
  if (!first || !last) return null;
  const until = diffDays(today, first);
  if (until > 0) return { label: `D-${until}`, kind: 'before' };
  if (until === 0) return { label: 'D-DAY', kind: 'during' };
  if (diffDays(today, last) >= 0) return { label: `여행 ${-until + 1}일째`, kind: 'during' };
  return { label: '여행 끝', kind: 'after' };
}

function liveItems(trip: Trip): ChecklistItem[] {
  return (trip.checklist ?? []).filter((c) => !c.deleted);
}

/** 전체 일정 화면 위쪽 — 출발까지 며칠, 준비는 얼마나 */
export function PrepCard({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const phase = tripPhase(trip);
  const items = liveItems(trip);
  const done = items.filter((c) => c.done).length;
  if (!phase || phase.kind === 'after') return null;
  const pct = items.length ? done / items.length : 0;

  return (
    <div className="section">
      <button type="button" className="card prep-card" onClick={onOpen}>
        <span className={`prep-card__dday prep-card__dday--${phase.kind}`}>{phase.label}</span>
        <span className="prep-card__body">
          <span className="prep-card__title">여행 준비</span>
          <span className="muted small">
            {items.length === 0 ? '준비물·할 일 체크리스트 만들기' : done === items.length ? '다 챙겼습니다 ✓' : `${items.length}개 중 ${done}개 챙김`}
          </span>
          {items.length > 0 && (
            <span className="budget-bar" style={{ margin: '6px 0 0' }}>
              <span className="budget-bar__fill" style={{ width: `${pct * 100}%` }} />
            </span>
          )}
        </span>
        <Icon name="chevronRight" size={16} className="chevron" strokeWidth={2.2} />
      </button>
    </div>
  );
}

export function ChecklistSheet({ trip, readOnly, onClose }: { trip: Trip; readOnly: boolean; onClose: () => void }) {
  const me = useMe(trip.id);
  const [text, setText] = useState('');
  const [group, setGroup] = useState<string>(CHECKLIST_GROUPS[0]);
  const [hideDone, setHideDone] = useState(false);
  const items = liveItems(trip);
  const name = (id?: string) => (id ? trip.members?.find((m) => m.id === id)?.name : undefined);

  const groups = useMemo(() => {
    const order = [...CHECKLIST_GROUPS, ...items.map((i) => i.group)].filter((g, i, a) => a.indexOf(g) === i);
    return order
      .map((g) => ({ group: g, items: items.filter((i) => i.group === g && (!hideDone || !i.done)) }))
      .filter((g) => g.items.length > 0);
  }, [items, hideDone]);

  const country = (trip.regionId ? regionById(trip.regionId) : findRegion(trip.destination))?.country;
  const done = items.filter((i) => i.done).length;

  const add = () => {
    if (!text.trim()) return;
    actions.setChecklist([{ text: text.trim(), group }]);
    setText('');
  };

  return (
    <Sheet open title="여행 준비" onClose={onClose} closeLabel="닫기">
      {items.length === 0 ? (
        <div className="section">
          <p className="muted" style={{ padding: '4px 4px 12px', lineHeight: 1.6 }}>
            {country === '일본' ? '일본 여행' : '해외여행'}에서 자주 빠뜨리는 것들로 목록을 만들어 드립니다.
            공유 링크로 함께 보는 동행도 같이 체크할 수 있습니다.
          </p>
          {!readOnly && (
            <button type="button" className="btn btn--primary btn--block" onClick={() => actions.setChecklist(templateFor(country))}>
              기본 목록으로 시작하기
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="section">
            <div className="prep-summary">
              <strong className="mono">{done}/{items.length}</strong>
              <span className="budget-bar" style={{ margin: 0, flex: 1 }}>
                <span className="budget-bar__fill" style={{ width: `${(done / items.length) * 100}%` }} />
              </span>
              <button type="button" className="linkish tiny" onClick={() => setHideDone((v) => !v)}>
                {hideDone ? '모두 보기' : '챙긴 것 숨기기'}
              </button>
            </div>
          </div>

          {groups.map(({ group: g, items: list }) => (
            <div className="section" key={g}>
              <div className="section__header"><span className="section__title">{g}</span></div>
              <div className="list">
                {list.map((c) => (
                  <div key={c.id} className={`check-row ${c.done ? 'check-row--done' : ''}`}>
                    <button
                      type="button"
                      className="check-row__main"
                      onClick={() => !readOnly && actions.toggleChecklist(c.id, me ?? undefined)}
                      disabled={readOnly}
                      aria-pressed={c.done}
                    >
                      <Icon name={c.done ? 'checkCircle' : 'circle'} size={22} strokeWidth={2} color={c.done ? 'var(--green)' : 'var(--label-3)'} />
                      <span className="check-row__body">
                        <span className="check-row__text">{c.text}</span>
                        {(c.note || (c.done && name(c.doneBy))) && (
                          <span className="muted tiny">
                            {c.note}{c.note && c.done && name(c.doneBy) ? ' · ' : ''}{c.done && name(c.doneBy) ? `${name(c.doneBy)} 챙김` : ''}
                          </span>
                        )}
                      </span>
                    </button>
                    {!readOnly && (
                      <button type="button" className="icon-btn icon-btn--label" onClick={() => actions.removeChecklist(c.id)} aria-label={`${c.text} 지우기`}>
                        <Icon name="close" size={15} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!readOnly && (
            <div className="section">
              <div className="section__header"><span className="section__title">더하기</span></div>
              <div className="list">
                <div className="field">
                  <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) add(); }} placeholder="예) 동전 지갑, 선물 목록" />
                  <button type="button" className="btn btn--gray btn--sm" onClick={add} disabled={!text.trim()}>추가</button>
                </div>
                <div className="field">
                  <span className="field__label">묶음</span>
                  <select className="select" value={group} onChange={(e) => setGroup(e.target.value)}>
                    {CHECKLIST_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              {!me && trip.members?.length ? (
                <p className="muted tiny" style={{ padding: '8px 4px 0' }}>비용 → 정산에서 "나로 정하기"를 해 두면 누가 챙겼는지 함께 표시됩니다.</p>
              ) : null}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
