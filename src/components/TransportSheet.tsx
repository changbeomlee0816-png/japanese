import { useEffect, useMemo, useState } from 'react';
import type { Day, Item, PlaceRef, Trip } from '../types';
import {
  TRANSPORT_MODES,
  estimateTransport,
  suggestTransport,
  suitsDistance,
  transportDistance,
  transportLabel,
  transportTitle,
  type TransportMode,
} from '../lib/transport';
import { actions } from '../store/tripStore';
import { addMinutes, formatDuration } from '../lib/time';
import { currencySymbol, formatMoney } from '../lib/fares';
import { Sheet } from './ui';
import { Icon, type IconName } from './Icon';
import { PlaceSearch } from './PlaceSearch';

const MODE_ICON: Record<TransportMode, IconName> = {
  flight: 'plane',
  train: 'train',
  subway: 'train',
  bus: 'bus',
  taxi: 'car',
  walk: 'walk',
  ferry: 'ferry',
};

interface Props {
  open: boolean;
  trip: Trip;
  day: Day;
  onClose: () => void;
}

/**
 * 이동을 일정 항목으로 추가한다.
 *
 * 장소끼리의 이동은 자동으로 추정해 구간으로만 보여주는데,
 * 비행기·신칸센·페리처럼 일정에 명시해야 하는 이동은 항목으로 넣어야 한다.
 * 이동수단을 고르면 소요시간·거리·요금을 계산해서 채워 준다.
 */
export function TransportSheet({ open, trip, day, onClose }: Props) {
  const places = useMemo(
    () => day.items.filter((i) => !i.transport && i.place.coord),
    [day.items],
  );

  const [from, setFrom] = useState<PlaceRef | null>(null);
  const [to, setTo] = useState<PlaceRef | null>(null);
  const [mode, setMode] = useState<TransportMode>('subway');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMin, setDurationMin] = useState(30);
  const [cost, setCost] = useState(0);
  const [touchedDuration, setTouchedDuration] = useState(false);
  const [searching, setSearching] = useState<'from' | 'to' | null>(null);

  /* 열릴 때 기본값 — 마지막 두 장소를 잇는 게 가장 흔한 경우다 */
  useEffect(() => {
    if (!open) return;
    const a = places[places.length - 2]?.place ?? places[0]?.place ?? null;
    const b = places[places.length - 1]?.place ?? null;
    setFrom(places.length >= 2 ? a : null);
    setTo(places.length >= 2 ? b : null);
    setTouchedDuration(false);
    setSearching(places.length >= 2 ? null : 'from');

    const last = day.items[day.items.length - 1];
    setStartTime(last ? addMinutes(last.startTime, last.durationMin) : '09:00');
  }, [open, places, day.items]);

  const estimate = useMemo(() => {
    if (!from?.coord || !to?.coord) return null;
    return estimateTransport(from.coord, to.coord, mode, trip.currency);
  }, [from, to, mode, trip.currency]);

  /* 출발·도착이 정해지면 거리에 맞는 수단을 먼저 골라 준다 */
  useEffect(() => {
    if (!from?.coord || !to?.coord) return;
    const straight = transportDistance(from.coord, to.coord, 'flight');
    setMode(suggestTransport(straight));
  }, [from?.coord?.lat, from?.coord?.lng, to?.coord?.lat, to?.coord?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 수단을 바꾸면 소요시간·요금을 다시 채운다 (직접 고친 뒤에는 건드리지 않는다) */
  useEffect(() => {
    if (!estimate) return;
    if (!touchedDuration) setDurationMin(estimate.durationMin);
    setCost(estimate.fare);
  }, [estimate, touchedDuration]);

  const ready = !!from?.coord && !!to?.coord && from.name !== to.name;

  const add = () => {
    if (!from?.coord || !to?.coord || !estimate) return;
    const info = {
      mode,
      from,
      to,
      distanceM: estimate.distanceM,
      manualDuration: touchedDuration,
    };
    const item: Partial<Item> & { title: string } = {
      title: transportTitle(info),
      category: 'transport',
      place: to,
      startTime,
      durationMin,
      cost,
      transport: info,
    };
    actions.addItem(day.id, item);
    onClose();
  };

  const bias = from?.coord ?? to?.coord ?? places[0]?.place.coord;

  return (
    <Sheet
      open={open}
      title="이동 추가"
      onClose={onClose}
      confirmLabel="추가"
      confirmDisabled={!ready}
      onConfirm={ready ? add : undefined}
    >
      {searching ? (
        <div className="section">
          <p className="muted small" style={{ margin: '0 4px 10px' }}>
            {searching === 'from' ? '출발' : '도착'} 지점을 찾아주세요
          </p>
          <PlaceSearch
            bias={bias}
            autoFocus
            placeholder="공항, 역, 장소 이름"
            onPick={(p) => {
              if (searching === 'from') setFrom(p);
              else setTo(p);
              setSearching(null);
            }}
          />
          <button
            type="button"
            className="btn btn--gray btn--block"
            style={{ marginTop: 14 }}
            onClick={() => setSearching(null)}
          >
            취소
          </button>
        </div>
      ) : (
        <>
          <div className="section">
            <div className="list">
              <EndpointRow
                label="출발"
                place={from}
                places={places}
                onPickExisting={setFrom}
                onSearch={() => setSearching('from')}
              />
              <EndpointRow
                label="도착"
                place={to}
                places={places}
                onPickExisting={setTo}
                onSearch={() => setSearching('to')}
              />
            </div>
            {from && to && from.name === to.name && (
              <p className="small" style={{ color: 'var(--orange)', padding: '8px 4px 0' }}>
                출발과 도착이 같습니다.
              </p>
            )}
          </div>

          <div className="section">
            <div className="section__header"><span className="section__title">이동수단</span></div>
            <div className="mode-grid">
              {TRANSPORT_MODES.map((m) => {
                const fits = estimate ? suitsDistance(m, estimate.distanceM) : true;
                return (
                  <button
                    key={m}
                    type="button"
                    className={`mode-chip${mode === m ? ' mode-chip--active' : ''}${fits ? '' : ' mode-chip--unfit'}`}
                    onClick={() => {
                      setMode(m);
                      setTouchedDuration(false);
                    }}
                  >
                    <Icon name={MODE_ICON[m]} size={19} strokeWidth={1.9} />
                    <span>{transportLabel(m)}</span>
                  </button>
                );
              })}
            </div>
            {estimate && !suitsDistance(mode, estimate.distanceM) && (
              <p className="muted tiny" style={{ padding: '8px 4px 0' }}>
                이 거리에는 잘 안 쓰는 수단입니다. 그래도 넣을 수 있어요.
              </p>
            )}
          </div>

          {estimate && (
            <div className="section">
              <div className="transport-estimate">
                <div className="transport-estimate__main">
                  <span className="muted tiny">예상 소요시간</span>
                  <strong className="mono">{formatDuration(durationMin)}</strong>
                  <span className="muted tiny">
                    {(estimate.distanceM / 1000).toFixed(estimate.distanceM < 10000 ? 1 : 0)}km
                    {estimate.overheadMin > 0 && ` · 이동 ${formatDuration(estimate.moveMin)} + 준비 ${estimate.overheadMin}분`}
                  </span>
                </div>
                {touchedDuration && (
                  <button
                    type="button"
                    className="btn btn--gray btn--sm"
                    onClick={() => {
                      setTouchedDuration(false);
                      setDurationMin(estimate.durationMin);
                    }}
                  >
                    자동 계산으로
                  </button>
                )}
              </div>

              <div className="list" style={{ marginTop: 10 }}>
                <div className="field">
                  <span className="field__label">출발 시각</span>
                  <input
                    className="input"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ textAlign: 'right' }}
                  />
                </div>
                <div className="field">
                  <span className="field__label">소요시간</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={durationMin}
                    onChange={(e) => {
                      setDurationMin(Math.max(1, Number(e.target.value) || 1));
                      setTouchedDuration(true);
                    }}
                    style={{ textAlign: 'right' }}
                  />
                  <span className="muted">분</span>
                </div>
                <div className="field">
                  <span className="field__label">요금 / 1인</span>
                  <span className="muted">{currencySymbol(trip.currency)}</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={cost || ''}
                    placeholder="0"
                    onChange={(e) => setCost(Number(e.target.value) || 0)}
                    style={{ textAlign: 'right' }}
                  />
                </div>
              </div>

              <p className="muted tiny" style={{ padding: '10px 4px 0', lineHeight: 1.6 }}>
                {estimate.fareNote ??
                  `요금은 거리 기반 추정치입니다 (${formatMoney(estimate.fare, trip.currency)}). 실제 금액을 알면 고쳐 넣으세요.`}
                {' '}도착 예정 <strong>{addMinutes(startTime, durationMin)}</strong>
              </p>
            </div>
          )}

          {places.length < 2 && !from && (
            <div className="section">
              <p className="muted small" style={{ padding: '0 4px' }}>
                이 날에 장소가 두 곳 이상 있으면 출발·도착이 자동으로 채워집니다.
                지금은 직접 찾아서 넣어주세요.
              </p>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

function EndpointRow({
  label,
  place,
  places,
  onPickExisting,
  onSearch,
}: {
  label: string;
  place: PlaceRef | null;
  places: Item[];
  onPickExisting: (p: PlaceRef) => void;
  onSearch: () => void;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {places.length > 0 ? (
        <select
          className="select"
          style={{ textAlign: 'left', flex: 1 }}
          value={places.find((i) => i.place.name === place?.name)?.id ?? ''}
          onChange={(e) => {
            const hit = places.find((i) => i.id === e.target.value);
            if (hit) onPickExisting(hit.place);
          }}
        >
          <option value="">{place ? place.name : '선택'}</option>
          {places.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </select>
      ) : (
        <span className="input muted">{place?.name ?? '아직 없음'}</span>
      )}
      <button type="button" onClick={onSearch} aria-label={`${label} 검색`}>
        <Icon name="search" size={17} strokeWidth={2.2} color="var(--blue)" />
      </button>
    </div>
  );
}
