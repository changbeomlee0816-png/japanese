import { useMemo, useState } from 'react';
import type { Category, Trip } from '../types';
import { REGIONS, findRegion, regionById } from '../data/regions';
import { spotsForRegion, type PoiEntry } from '../data/poi';
import { CATEGORY } from '../lib/category';
import { actions } from '../store/tripStore';
import { formatDateShort, formatDuration } from '../lib/time';
import { Sheet, Segmented } from './ui';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  trip: Trip;
  /** 지금 보고 있는 날짜 — "이 날에 넣기"의 기본값 */
  dayIndex: number;
  onClose: () => void;
}

const FILTERS: Array<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'sight', label: '볼거리' },
  { value: 'food', label: '먹거리' },
  { value: 'shopping', label: '쇼핑' },
  { value: 'activity', label: '액티비티' },
];

/**
 * 둘러보기 — 지역의 추천 장소를 훑어보며 담는다.
 *
 * 장소 이름을 미리 알아야 검색할 수 있던 흐름을 대신한다.
 * 담으면 "가고 싶은 곳"으로 들어가고, 날짜를 정해 배치하거나 곧바로 오늘 날짜에 넣을 수 있다.
 */
export function ExploreSheet({ open, trip, dayIndex, onClose }: Props) {
  const homeRegion = trip.regionId ?? findRegion(trip.destination)?.id ?? 'tokyo';
  const [regionId, setRegionId] = useState(homeRegion);
  const [filter, setFilter] = useState<Category | 'all'>('all');

  const region = regionById(regionId);
  const spots = useMemo(() => spotsForRegion(regionId), [regionId]);
  const shown = filter === 'all' ? spots : spots.filter((s) => s.category === filter);

  const savedNames = new Set((trip.saved ?? []).map((i) => i.title));
  const plannedNames = new Set(trip.days.flatMap((d) => d.items.map((i) => i.title)));

  /** 이 지역과 주변 지역을 함께 보여준다 */
  const regionChoices = useMemo(() => {
    const home = regionById(homeRegion);
    const ids = [homeRegion, ...(home?.nearby ?? [])];
    const rest = REGIONS.filter((r) => !ids.includes(r.id)).map((r) => r.id);
    return [...ids, ...rest].map((id) => regionById(id)).filter((r): r is NonNullable<typeof r> => !!r);
  }, [homeRegion]);

  return (
    <Sheet open={open} title="둘러보기" onClose={onClose}>
      <div className="chip-row">
        {regionChoices.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`chip${r.id === regionId ? ' chip--active' : ''}`}
            onClick={() => setRegionId(r.id)}
          >
            <span>{r.name}</span>
            <small>{r.id === homeRegion ? '이번 여행' : `${r.suggestedDays}일 코스`}</small>
          </button>
        ))}
      </div>

      <div className="section">
        <Segmented value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      {region && (
        <div className="section">
          <p className="muted small" style={{ padding: '0 4px', margin: 0 }}>
            {region.blurb}
          </p>
        </div>
      )}

      <div className="section">
        <div className="spot-list">
          {shown.map((spot) => (
            <SpotCard
              key={spot.name}
              spot={spot}
              trip={trip}
              dayIndex={dayIndex}
              saved={savedNames.has(spot.name)}
              planned={plannedNames.has(spot.name)}
            />
          ))}
        </div>
        {shown.length === 0 && (
          <p className="muted small" style={{ padding: '24px 4px', textAlign: 'center' }}>
            이 분류에는 추천할 곳이 아직 없어요. 다른 분류를 눌러보세요.
          </p>
        )}
      </div>

      <div className="section">
        <p className="muted tiny" style={{ padding: '0 4px', lineHeight: 1.6 }}>
          내장 추천 목록입니다. 여기 없는 곳은 일정 화면의 <strong>+</strong> 버튼에서 이름으로 검색해
          추가할 수 있습니다. 구글맵 키를 넣으면 전 세계 장소를 검색합니다.
        </p>
      </div>
    </Sheet>
  );
}

function SpotCard({
  spot,
  trip,
  dayIndex,
  saved,
  planned,
}: {
  spot: PoiEntry;
  trip: Trip;
  dayIndex: number;
  saved: boolean;
  planned: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const meta = CATEGORY[spot.category ?? 'sight'];

  return (
    <article className={`spot${planned ? ' spot--planned' : ''}`}>
      <div className="spot__head">
        <span className="spot__icon" style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}>
          <Icon name={meta.icon} size={18} strokeWidth={2} />
        </span>
        <div className="spot__title">
          <h3>{spot.name}</h3>
          <span className="muted tiny">
            {meta.label}
            {spot.stayMin ? ` · 보통 ${formatDuration(spot.stayMin)}` : ''}
            {spot.top ? ' · 대표 명소' : ''}
          </span>
        </div>
      </div>

      {spot.blurb && <p className="spot__blurb">{spot.blurb}</p>}

      {spot.tags && spot.tags.length > 0 && (
        <div className="spot__tags">
          {spot.tags.map((t) => (
            <span key={t} className="badge">{t}</span>
          ))}
        </div>
      )}

      {picking ? (
        <div className="spot__days">
          <span className="muted tiny">어느 날에 넣을까요?</span>
          <div className="spot__daybtns">
            {trip.days.map((d, i) => (
              <button
                key={d.id}
                type="button"
                className={`btn btn--sm ${i === dayIndex ? 'btn--primary' : 'btn--gray'}`}
                onClick={() => {
                  actions.addSpotToDay(d.id, spot);
                  setPicking(false);
                }}
              >
                Day {i + 1}
                <span className="muted" style={{ fontWeight: 400 }}> {formatDateShort(d.date)}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--gray btn--sm" onClick={() => setPicking(false)}>
            취소
          </button>
        </div>
      ) : (
        <div className="spot__actions">
          {planned ? (
            <span className="badge badge--green">
              <Icon name="check" size={12} strokeWidth={3} /> 일정에 있음
            </span>
          ) : (
            <>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setPicking(true)}>
                <Icon name="calendar" size={14} strokeWidth={2} /> 날짜에 넣기
              </button>
              <button
                type="button"
                className={`btn btn--sm ${saved ? 'btn--gray' : 'btn--tinted'}`}
                onClick={() => (saved ? actions.removeSaved((trip.saved ?? []).find((i) => i.title === spot.name)!.id) : actions.saveSpot(spot))}
              >
                <Icon name={saved ? 'check' : 'plus'} size={14} strokeWidth={2.4} />
                {saved ? '담김' : '담기'}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
