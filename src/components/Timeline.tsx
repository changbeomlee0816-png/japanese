import { useState } from 'react';
import type { Day, Item, Leg, TravelMode } from '../types';
import type { LiveItemState } from '../store/useLive';
import { CATEGORY } from '../lib/category';
import { formatDuration, addMinutes } from '../lib/time';
import { formatMoney, MODE_LABEL } from '../lib/fares';
import { Icon, type IconName } from './Icon';
import { actions } from '../store/tripStore';

const MODE_ICON: Record<TravelMode, IconName> = {
  WALKING: 'walk',
  TRANSIT: 'train',
  DRIVING: 'car',
  BICYCLING: 'bike',
};

const MODES: TravelMode[] = ['WALKING', 'TRANSIT', 'DRIVING'];

/* ------------------------------------------------------------------ *
 * 하나의 방문지
 * ------------------------------------------------------------------ */

interface StopProps {
  item: Item;
  index: number;
  dayId: string;
  currency: string;
  live?: LiveItemState;
  isLiveDay: boolean;
  onEdit: () => void;
  onFindPlace: () => void;
  onShowFood: () => void;
  dragProps: React.HTMLAttributes<HTMLElement>;
}

function Stop({ item, index, dayId, currency, live, isLiveDay, onEdit, onFindPlace, onShowFood, dragProps }: StopProps) {
  const meta = CATEGORY[item.category];
  const status = live?.status ?? 'upcoming';
  const showLive = isLiveDay && !item.done;

  const stateClass =
    item.done ? 'stop--done'
      : showLive && status === 'current' ? 'stop--current'
        : showLive && status === 'overdue' ? 'stop--overdue'
          : showLive && status === 'missed' ? 'stop--missed'
            : '';

  return (
    <article className={`stop ${stateClass}`} {...dragProps}>
      <div className="stop__rail">
        <div className="stop__time mono">{item.startTime}</div>
        <button
          type="button"
          className="stop__dot"
          style={{ '--dot': meta.color } as React.CSSProperties}
          onClick={() => actions.setDone(dayId, item.id, !item.done)}
          aria-label={item.done ? '완료 취소' : '완료 표시'}
          title={item.done ? '완료 취소' : '완료 표시'}
        >
          {item.done ? <Icon name="check" size={13} strokeWidth={3} /> : <span className="stop__dot-inner" />}
        </button>
        <div className="stop__stem" />
      </div>

      <div className="stop__card">
        <button type="button" className="stop__main" onClick={onEdit}>
          <div className="stop__head">
            <span className="stop__index">{index + 1}</span>
            <h3 className="stop__title">{item.title}</h3>
            <Icon name="chevronRight" size={15} className="chevron" strokeWidth={2.2} />
          </div>

          <div className="stop__meta">
            <span className="badge" style={{ color: meta.color, background: 'var(--fill)' }}>
              <Icon name={meta.icon} size={12} strokeWidth={2} />
              {meta.label}
            </span>
            <span className="badge">{formatDuration(item.durationMin)}</span>
            {item.cost > 0 && <span className="badge">{formatMoney(item.cost, currency)}</span>}
            {showLive && status === 'current' && <span className="badge badge--green">진행 중</span>}
            {showLive && status === 'overdue' && <span className="badge badge--orange">시간 지남</span>}
            {live?.delayMin != null && live.delayMin !== 0 && (
              <span className={`badge ${live.delayMin > 0 ? 'badge--orange' : 'badge--blue'}`}>
                {live.delayMin > 0 ? `${live.delayMin}분 지연` : `${-live.delayMin}분 빠름`}
              </span>
            )}
          </div>

          {item.place.coord ? (
            item.place.address && <p className="stop__addr">{item.place.address}</p>
          ) : (
            <p className="stop__addr stop__addr--missing">위치 미확인 — 탭해서 장소를 찾아주세요</p>
          )}

          {item.notes && <p className="stop__notes">{item.notes}</p>}

          {showLive && status === 'current' && (
            <div className="stop__progress" aria-hidden>
              <span style={{ width: `${Math.round((live?.progress ?? 0) * 100)}%` }} />
            </div>
          )}
        </button>

        <div className="stop__actions">
          {!item.place.coord && (
            <button type="button" className="btn btn--tinted btn--sm" onClick={onFindPlace}>
              <Icon name="search" size={14} strokeWidth={2} /> 위치 찾기
            </button>
          )}
          <button type="button" className="btn btn--gray btn--sm" onClick={onShowFood}>
            <Icon name="food" size={14} strokeWidth={2} /> 주변 맛집
          </button>
          {isLiveDay && !item.done && (
            <button
              type="button"
              className="btn btn--gray btn--sm"
              onClick={() => actions.checkIn(dayId, item.id)}
              title="지금 도착했다고 기록"
            >
              <Icon name="play" size={13} strokeWidth={2} /> 도착
            </button>
          )}
          <span className="spacer" />
          <span className="stop__grip" aria-hidden>
            <Icon name="drag" size={18} strokeWidth={2.4} color="var(--label-3)" />
          </span>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 * 두 방문지 사이의 이동
 * ------------------------------------------------------------------ */

function LegBlock({
  leg,
  currency,
  dayId,
  fromItem,
  gapMin,
}: {
  leg: Leg | null;
  currency: string;
  dayId: string;
  fromItem: Item;
  gapMin: number;
}) {
  const [open, setOpen] = useState(false);

  if (!leg) {
    return (
      <div className="leg leg--unknown">
        <div className="leg__rail"><span className="leg__line" /></div>
        <div className="leg__body">
          <Icon name="info" size={16} strokeWidth={2} color="var(--label-3)" />
          <span className="muted small">양쪽 위치를 모두 지정하면 경로와 요금을 계산합니다</span>
        </div>
      </div>
    );
  }

  const tight = gapMin < leg.durationMin;
  const arrival = addMinutes(fromItem.startTime, fromItem.durationMin + leg.durationMin);

  return (
    <div className={`leg${tight ? ' leg--tight' : ''}`}>
      <div className="leg__rail"><span className="leg__line" /></div>
      <div className="leg__content">
        <button type="button" className="leg__body" onClick={() => setOpen((v) => !v)}>
          <span className="leg__icon"><Icon name={MODE_ICON[leg.mode]} size={17} strokeWidth={1.9} /></span>
          <span className="leg__text">
            <strong>
              {MODE_LABEL[leg.mode]} {formatDuration(leg.durationMin)}
            </strong>
            <span className="muted small">
              {(leg.distanceM / 1000).toFixed(1)}km · {leg.fare > 0 ? formatMoney(leg.fare, currency) : '무료'}
              {leg.source === 'estimate' ? ' · 추정' : ''}
            </span>
          </span>
          {tight && <span className="badge badge--red">{leg.durationMin - gapMin}분 부족</span>}
          <Icon name="chevronDown" size={15} strokeWidth={2.2} className={`chevron leg__caret${open ? ' leg__caret--open' : ''}`} />
        </button>

        {open && (
          <div className="leg__detail">
            <div className="leg__modes">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`leg__mode${leg.mode === m ? ' leg__mode--active' : ''}`}
                  onClick={() => actions.setItemMode(dayId, fromItem.id, m)}
                >
                  <Icon name={MODE_ICON[m]} size={15} strokeWidth={2} />
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>

            {leg.summary && <p className="leg__summary">{leg.summary}</p>}

            {leg.steps && leg.steps.length > 0 && (
              <ol className="leg__steps">
                {leg.steps.map((s, i) => (
                  <li key={i}>
                    <Icon name={MODE_ICON[s.mode]} size={14} strokeWidth={2} color="var(--label-2)" />
                    <span>
                      {s.line && <strong>{s.line} </strong>}
                      {s.instruction}
                      {s.departureStop && s.arrivalStop && (
                        <em className="muted"> · {s.departureStop} → {s.arrivalStop}</em>
                      )}
                    </span>
                    <span className="muted mono tiny">{s.durationMin}분</span>
                  </li>
                ))}
              </ol>
            )}

            <p className="leg__note muted tiny">
              {leg.source === 'google'
                ? '구글 지도 경로 기준 · 요금은 구간에 따라 추정치일 수 있습니다'
                : '직선거리 기반 추정 — 설정에서 구글맵 키를 넣으면 실제 노선으로 바뀝니다'}
              {' · '}도착 예정 {arrival}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 타임라인 전체
 * ------------------------------------------------------------------ */

interface TimelineProps {
  day: Day;
  legs: Array<Leg | null>;
  currency: string;
  liveStates: LiveItemState[];
  isLiveDay: boolean;
  onEditItem: (item: Item) => void;
  onFindPlace: (item: Item) => void;
  onShowFood: (item: Item) => void;
}

export function Timeline({ day, legs, currency, liveStates, isLiveDay, onEditItem, onFindPlace, onShowFood }: TimelineProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <div className="timeline">
      {day.items.map((item, i) => {
        const next = day.items[i + 1];
        const gapMin = next
          ? toMin(next.startTime) - (toMin(item.startTime) + item.durationMin)
          : 0;

        return (
          <div key={item.id} className={overIndex === i && dragIndex !== null && dragIndex !== i ? 'drop-target' : undefined}>
            <Stop
              item={item}
              index={i}
              dayId={day.id}
              currency={currency}
              live={liveStates[i]}
              isLiveDay={isLiveDay}
              onEdit={() => onEditItem(item)}
              onFindPlace={() => onFindPlace(item)}
              onShowFood={() => onShowFood(item)}
              dragProps={{
                draggable: true,
                onDragStart: () => setDragIndex(i),
                onDragEnd: () => {
                  setDragIndex(null);
                  setOverIndex(null);
                },
                onDragOver: (e) => {
                  e.preventDefault();
                  setOverIndex(i);
                },
                onDrop: (e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== i) actions.reorderItem(day.id, dragIndex, i);
                  setDragIndex(null);
                  setOverIndex(null);
                },
              }}
            />
            {next && (
              <LegBlock
                leg={legs[i] ?? null}
                currency={currency}
                dayId={day.id}
                fromItem={item}
                gapMin={gapMin}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
