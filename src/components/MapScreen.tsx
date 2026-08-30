import { useMemo, useState } from 'react';
import type { Item, Settings, Trip } from '../types';
import { useLegs } from '../store/useLegs';
import { MapView } from './MapView';
import { DayPicker } from './DayPicker';
import { EmptyState } from './ui';
import { Icon } from './Icon';
import { CATEGORY } from '../lib/category';
import { formatDateKo, formatDuration } from '../lib/time';
import { formatMoney, MODE_LABEL } from '../lib/fares';

interface Props {
  trip: Trip;
  settings: Settings;
  dayIndex: number;
  onDayChange: (i: number) => void;
  onShowFood: (item: Item) => void;
}

/** 하루 동선 전체를 구글 지도 길찾기로 여는 링크 */
function directionsUrl(items: Item[], mode: string): string | null {
  const pts = items.filter((i) => i.place.coord).map((i) => `${i.place.coord!.lat},${i.place.coord!.lng}`);
  if (pts.length < 2) return null;
  const origin = pts[0];
  const destination = pts[pts.length - 1];
  const waypoints = pts.slice(1, -1).slice(0, 9); // 구글 링크 제한 고려
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: mode.toLowerCase(),
  });
  if (waypoints.length) params.set('waypoints', waypoints.join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function MapScreen({ trip, settings, dayIndex, onDayChange, onShowFood }: Props) {
  const day = trip.days[dayIndex];
  const { legs } = useLegs(day, trip.currency, !!settings.googleMapsApiKey);
  const [active, setActive] = useState<string | undefined>(undefined);

  const summary = useMemo(() => {
    const distance = legs.reduce((n, l) => n + (l?.distanceM ?? 0), 0);
    const minutes = legs.reduce((n, l) => n + (l?.durationMin ?? 0), 0);
    const fare = legs.reduce((n, l) => n + (l?.fare ?? 0), 0);
    return { distance, minutes, fare };
  }, [legs]);

  if (!day) return <EmptyState icon="map" title="날짜가 없습니다" body="일정 탭에서 날짜를 먼저 추가해 주세요." />;

  const mainMode = legs.find((l) => l?.mode === 'TRANSIT') ? 'transit' : 'walking';
  const url = directionsUrl(day.items, mainMode);
  const positioned = day.items.filter((i) => i.place.coord);

  return (
    <>
      <div className="large-title">
        <h1>지도</h1>
        <p>{formatDateKo(day.date)} · 방문지 {positioned.length}곳</p>
      </div>

      <DayPicker trip={trip} index={dayIndex} onChange={onDayChange} allowAdd={false} />

      <div className="section">
        <div className="card">
          <MapView day={day} legs={legs} activeItemId={active} onSelect={(i) => setActive(i.id)} height={400} />
          <div className="map-summary">
            <div className="stat">
              <span className="stat__value mono">{(summary.distance / 1000).toFixed(1)}km</span>
              <span className="stat__label">총 이동거리</span>
            </div>
            <div className="stat">
              <span className="stat__value mono">{formatDuration(summary.minutes)}</span>
              <span className="stat__label">이동 시간</span>
            </div>
            <div className="stat">
              <span className="stat__value mono">{formatMoney(summary.fare, trip.currency)}</span>
              <span className="stat__label">교통비 / 1인</span>
            </div>
          </div>
        </div>

        {url && (
          <a className="btn btn--primary btn--block" href={url} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
            <Icon name="map" size={17} strokeWidth={2} /> 구글 지도에서 오늘 동선 열기
          </a>
        )}
        <p className="muted tiny" style={{ padding: '8px 4px 0' }}>
          구글 지도 앱에서 실제 환승 시각과 실시간 교통 상황을 확인할 수 있습니다.
        </p>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">동선</span></div>
        <div className="list">
          {positioned.length === 0 && (
            <div className="row"><span className="row__label muted">위치가 지정된 일정이 없습니다</span></div>
          )}
          {day.items.map((item, i) => {
            const leg = legs[i];
            if (!item.place.coord) return null;
            if (item.transport) {
              return (
                <div key={item.id} className="row route-leg">
                  <span className="route-leg__line" />
                  <span className="row__label muted small">
                    {item.title} · {formatDuration(item.durationMin)}
                  </span>
                </div>
              );
            }
            const meta = CATEGORY[item.category];
            return (
              <div key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`row row--tappable${active === item.id ? ' row--active' : ''}`}
                  onClick={() => setActive(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setActive(item.id);
                  }}
                >
                  <span className="route-num" style={{ background: meta.color }}>{i + 1}</span>
                  <span className="row__label">
                    <strong>{item.title}</strong>
                    <span className="muted small" style={{ display: 'block' }}>
                      {item.startTime} · {meta.label}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn--gray btn--sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowFood(item);
                    }}
                  >
                    맛집
                  </button>
                </div>
                {leg && day.items[i + 1]?.place.coord && (
                  <div className="row route-leg">
                    <span className="route-leg__line" />
                    <span className="row__label muted small">
                      {MODE_LABEL[leg.mode]} {formatDuration(leg.durationMin)} · {(leg.distanceM / 1000).toFixed(1)}km ·{' '}
                      {leg.fare > 0 ? formatMoney(leg.fare, trip.currency) : '무료'}
                      {leg.summary ? ` · ${leg.summary}` : ''}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
