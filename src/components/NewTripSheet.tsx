import { useState } from 'react';
import { REGIONS, type Region } from '../data/regions';
import { actions } from '../store/tripStore';
import { todayISO, addDaysISO, formatDateShort } from '../lib/time';
import { Sheet } from './ui';
import { Icon } from './Icon';

/**
 * 새 여행 만들기.
 *
 * 도시 이름을 타이핑하는 대신 카드에서 고른다. 지역을 고르면
 * 통화·환율·지도 중심·둘러보기 목록이 한 번에 정해진다.
 */
/** 도시 카드 그리드 — 새 여행과 여행지 변경에서 함께 쓴다 */
export function RegionGrid({ onPick, query }: { onPick: (r: Region) => void; query: string }) {
  const q = query.trim();
  const shown = q
    ? REGIONS.filter(
        (r) =>
          r.name.includes(q) ||
          r.blurb.includes(q) ||
          r.aliases.some((a) => a.toLowerCase().includes(q.toLowerCase())),
      )
    : REGIONS;

  if (shown.length === 0) {
    return (
      <p className="muted small" style={{ padding: '20px 4px', textAlign: 'center' }}>
        찾는 도시가 없네요. 일단 비슷한 곳을 고른 뒤 일정에서 장소를 직접 검색해도 됩니다.
      </p>
    );
  }

  return (
    <div className="region-grid">
      {shown.map((r) => (
        <button
          key={r.id}
          type="button"
          className="region-card"
          style={{ '--hue': r.hue } as React.CSSProperties}
          onClick={() => onPick(r)}
        >
          <span className="region-card__glow" aria-hidden />
          <span className="region-card__name">{r.name}</span>
          <span className="region-card__blurb">{r.blurb}</span>
          <span className="region-card__meta">보통 {r.suggestedDays}일</span>
        </button>
      ))}
    </div>
  );
}

export function NewTripSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [region, setRegion] = useState<Region | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [dayCount, setDayCount] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [query, setQuery] = useState('');

  const reset = () => {
    setRegion(null);
    setQuery('');
    setDayCount(3);
  };

  return (
    <Sheet
      open={open}
      title={region ? `${region.name} 여행` : '어디로 가세요?'}
      onClose={() => {
        reset();
        onClose();
      }}
      confirmLabel="만들기"
      confirmDisabled={!region}
      onConfirm={
        region
          ? () => {
              actions.createTrip({ regionId: region.id, startDate, dayCount, travelers });
              reset();
              onClose();
            }
          : undefined
      }
    >
      {!region ? (
        <>
          <div className="section">
            <div className="search-bar">
              <Icon name="search" size={17} strokeWidth={2.2} color="var(--label-2)" />
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="도시 이름으로 찾기"
              />
            </div>
          </div>

          <div className="section">
            <RegionGrid
              query={query}
              onPick={(r) => {
                setRegion(r);
                setDayCount(r.suggestedDays);
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="section">
            <button type="button" className="picked-region" style={{ '--hue': region.hue } as React.CSSProperties} onClick={() => setRegion(null)}>
              <span className="picked-region__dot" aria-hidden />
              <span>
                <strong>{region.name}</strong>
                <em className="muted small">{region.blurb}</em>
              </span>
              <span className="small" style={{ color: 'var(--blue)' }}>변경</span>
            </button>
          </div>

          <div className="section">
            <div className="section__header"><span className="section__title">며칠 가세요?</span></div>
            <div className="daycount-row">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`daycount${dayCount === n ? ' daycount--active' : ''}`}
                  onClick={() => setDayCount(n)}
                >
                  {n}일
                </button>
              ))}
            </div>
            <div className="list" style={{ marginTop: 10 }}>
              <div className="field">
                <span className="field__label">출발일</span>
                <input
                  className="input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div className="field">
                <span className="field__label">인원</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={travelers}
                  onChange={(e) => setTravelers(Math.max(1, Number(e.target.value) || 1))}
                  style={{ textAlign: 'right' }}
                />
                <span className="muted">명</span>
              </div>
            </div>
            <p className="muted small" style={{ padding: '10px 4px 0' }}>
              {formatDateShort(startDate)} — {formatDateShort(addDaysISO(startDate, dayCount - 1))} · {region.currency}
            </p>
          </div>

          {region.nearby && region.nearby.length > 0 && (
            <div className="section">
              <div className="section__header"><span className="section__title">같이 가기 좋은 곳</span></div>
              <p className="muted small" style={{ padding: '0 4px' }}>
                {region.nearby
                  .map((id) => REGIONS.find((r) => r.id === id)?.name)
                  .filter(Boolean)
                  .join(' · ')}
                {' — 여행을 만든 뒤 둘러보기에서 이 지역 장소도 담을 수 있어요.'}
              </p>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
