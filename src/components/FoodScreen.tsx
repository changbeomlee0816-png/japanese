import { useEffect, useMemo, useState } from 'react';
import type { Item, Restaurant, Settings, Trip } from '../types';
import { nearbyRestaurants, mapsLoaded } from '../lib/maps';
import { haversine } from '../lib/geo';
import { CATEGORY } from '../lib/category';
import { EmptyState, Segmented } from './ui';
import { Icon } from './Icon';

interface Props {
  trip: Trip;
  settings: Settings;
  dayIndex: number;
  /** 일정 탭에서 "주변 맛집"을 눌러 넘어온 기준 장소 */
  anchorItemId?: string;
  onAnchorChange: (id: string) => void;
}

type SortKey = 'local' | 'rating' | 'distance';

const RADII = [500, 900, 1500, 3000];

export function FoodScreen({ trip, settings, dayIndex, anchorItemId, onAnchorChange }: Props) {
  const day = trip.days[dayIndex];
  const candidates = useMemo(() => (day?.items ?? []).filter((i) => i.place.coord), [day]);

  const anchor: Item | undefined =
    candidates.find((i) => i.id === anchorItemId) ??
    candidates.find((i) => i.category === 'food') ??
    candidates[0];

  const [radius, setRadius] = useState(900);
  const [sort, setSort] = useState<SortKey>('local');
  const [onlyLocal, setOnlyLocal] = useState(true);
  const [list, setList] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!anchor?.place.coord) {
      setList([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    nearbyRestaurants(anchor.place.coord, radius)
      .then((r) => {
        if (!cancelled) setList(r);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anchor?.place.coord?.lat, anchor?.place.coord?.lng, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const center = anchor?.place.coord;
    let out = [...list];
    if (onlyLocal) out = out.filter((r) => r.localScore >= settings.minLocalScore);
    out.sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating;
      if (sort === 'distance' && center) return haversine(center, a.coord) - haversine(center, b.coord);
      return b.localScore - a.localScore;
    });
    return out;
  }, [list, onlyLocal, sort, settings.minLocalScore, anchor?.place.coord]);

  if (!day || candidates.length === 0) {
    return (
      <>
        <div className="large-title">
          <h1>맛집</h1>
          <p>일정 근처의 현지인 추천 식당</p>
        </div>
        <EmptyState
          icon="food"
          title="기준이 될 장소가 없어요"
          body={'일정에 위치를 지정하면\n그 주변 맛집을 찾아드립니다.'}
        />
      </>
    );
  }

  return (
    <>
      <div className="large-title">
        <h1>맛집</h1>
        <p>{anchor ? `${anchor.place.name} 주변 ${radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}` : '기준 장소를 선택하세요'}</p>
      </div>

      <div className="chip-row">
        {candidates.map((item, i) => {
          const meta = CATEGORY[item.category];
          return (
            <button
              key={item.id}
              type="button"
              className={`chip${anchor?.id === item.id ? ' chip--active' : ''}`}
              onClick={() => onAnchorChange(item.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name={meta.icon} size={14} strokeWidth={2} />
                {item.title.length > 10 ? `${item.title.slice(0, 10)}…` : item.title}
              </span>
              <small>{item.startTime} · {i + 1}번째</small>
            </button>
          );
        })}
      </div>

      <div className="section">
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: 'local', label: '현지인 순' },
            { value: 'rating', label: '평점 순' },
            { value: 'distance', label: '거리 순' },
          ]}
        />
        <div className="filter-row">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              className={`btn btn--sm ${radius === r ? 'btn--tinted' : 'btn--gray'}`}
              onClick={() => setRadius(r)}
            >
              {r >= 1000 ? `${r / 1000}km` : `${r}m`}
            </button>
          ))}
          <span className="spacer" />
          <button
            type="button"
            className={`btn btn--sm ${onlyLocal ? 'btn--tinted' : 'btn--gray'}`}
            onClick={() => setOnlyLocal((v) => !v)}
          >
            <Icon name="star" size={13} strokeWidth={2} /> 현지인 {settings.minLocalScore}+
          </button>
        </div>
      </div>

      {!mapsLoaded() && (
        <div className="section">
          <div className="notice">
            <Icon name="info" size={17} strokeWidth={2} color="var(--label-2)" />
            <span className="small">
              내장 큐레이션 목록입니다(참고용). 구글맵 키를 넣으면 실제 주변 식당을 평점·리뷰와 함께 불러옵니다.
            </span>
          </div>
        </div>
      )}

      <div className="section">
        {loading && (
          <div className="notice">
            <span className="spinner" /> <span className="small">주변 식당을 찾는 중…</span>
          </div>
        )}
        {error && <div className="notice"><span className="small">불러오지 못했습니다: {error}</span></div>}

        {!loading && shown.length === 0 && (
          <EmptyState
            icon="search"
            title="조건에 맞는 곳이 없어요"
            body="반경을 넓히거나 현지인 필터를 꺼 보세요."
          />
        )}

        <div className="food-list">
          {shown.map((r) => (
            <RestaurantCard
              key={r.id}
              r={r}
              distanceM={anchor?.place.coord ? haversine(anchor.place.coord, r.coord) : null}
            />
          ))}
        </div>
      </div>

      <div className="section">
        <p className="muted tiny" style={{ padding: '0 4px' }}>
          &lsquo;현지인 지수&rsquo;는 평점·리뷰 수·가격대로 계산한 추정 지표입니다. 실제 분위기는 다를 수 있어요.
        </p>
      </div>
    </>
  );
}

function RestaurantCard({ r, distanceM }: { r: Restaurant; distanceM: number | null }) {
  const price = '₩'.repeat(Math.max(1, Math.min(4, r.priceLevel)));
  return (
    <article className="food">
      <div className="food__head">
        <h3 className="food__name">{r.name}</h3>
        <span className={`badge ${r.localScore >= 80 ? 'badge--green' : r.localScore >= 65 ? 'badge--blue' : ''}`}>
          현지인 {r.localScore}
        </span>
      </div>

      <div className="food__meta">
        <span className="badge">{r.genre}</span>
        {r.rating > 0 && (
          <span className="badge">
            <Icon name="star" size={11} strokeWidth={2.4} /> {r.rating.toFixed(1)}
            {r.reviewCount > 0 && <span className="muted"> ({r.reviewCount.toLocaleString('ko-KR')})</span>}
          </span>
        )}
        <span className="badge">{price}</span>
        {distanceM !== null && (
          <span className="badge">{distanceM < 1000 ? `${Math.round(distanceM)}m` : `${(distanceM / 1000).toFixed(1)}km`}</span>
        )}
      </div>

      {r.note && <p className="food__note">{r.note}</p>}
      {r.openHint && <p className="food__hours muted tiny">영업시간 {r.openHint}</p>}

      <div className="food__actions">
        <a
          className="btn btn--tinted btn--sm"
          href={r.mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${r.coord.lat},${r.coord.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="map" size={14} strokeWidth={2} /> 지도에서 보기
        </a>
        <a
          className="btn btn--gray btn--sm"
          href={`https://www.google.com/maps/dir/?api=1&destination=${r.coord.lat},${r.coord.lng}&travelmode=walking`}
          target="_blank"
          rel="noreferrer"
        >
          길찾기
        </a>
        {r.source === 'local' && <span className="badge">내장 데이터</span>}
      </div>
    </article>
  );
}
