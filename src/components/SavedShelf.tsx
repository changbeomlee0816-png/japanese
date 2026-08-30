import { useState } from 'react';
import type { Trip } from '../types';
import { CATEGORY } from '../lib/category';
import { actions } from '../store/tripStore';
import { formatDateShort, formatDuration } from '../lib/time';
import { Icon } from './Icon';

/**
 * 가고 싶은 곳 — 날짜를 아직 안 정한 후보 장소들.
 *
 * 둘러보다 눈에 띄면 일단 담아두고, 나중에 날짜에 배치한다.
 * 일정을 짤 때 "일단 후보를 모으고 나중에 배열하는" 실제 흐름에 맞춘 것이다.
 */
export function SavedShelf({ trip, dayIndex, onExplore }: { trip: Trip; dayIndex: number; onExplore: () => void }) {
  const saved = trip.saved ?? [];
  const [placing, setPlacing] = useState<string | null>(null);

  if (saved.length === 0) return null;

  return (
    <div className="section">
      <div className="section__header">
        <span className="section__title">가고 싶은 곳 {saved.length}</span>
        <button type="button" className="section__action" onClick={onExplore}>더 둘러보기</button>
      </div>

      <div className="saved-list">
        {saved.map((item) => {
          const meta = CATEGORY[item.category];
          const isPlacing = placing === item.id;
          return (
            <div key={item.id} className={`saved${isPlacing ? ' saved--placing' : ''}`}>
              <div className="saved__row">
                <span className="saved__dot" style={{ background: meta.color }} />
                <span className="saved__body">
                  <strong>{item.title}</strong>
                  <span className="muted tiny">
                    {meta.label} · {formatDuration(item.durationMin)}
                    {item.place.address ? ` · ${item.place.address}` : ''}
                  </span>
                </span>
                {!isPlacing && (
                  <>
                    <button type="button" className="btn btn--tinted btn--sm" onClick={() => setPlacing(item.id)}>
                      날짜 정하기
                    </button>
                    <button type="button" onClick={() => actions.removeSaved(item.id)} aria-label="빼기">
                      <Icon name="close" size={16} strokeWidth={2.4} color="var(--label-3)" />
                    </button>
                  </>
                )}
              </div>

              {isPlacing && (
                <div className="saved__days">
                  {trip.days.map((d, i) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`btn btn--sm ${i === dayIndex ? 'btn--primary' : 'btn--gray'}`}
                      onClick={() => {
                        actions.placeSaved(item.id, d.id);
                        setPlacing(null);
                      }}
                    >
                      Day {i + 1}
                      <span style={{ fontWeight: 400, opacity: 0.7 }}> {formatDateShort(d.date)}</span>
                    </button>
                  ))}
                  <button type="button" className="btn btn--gray btn--sm" onClick={() => setPlacing(null)}>
                    취소
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
