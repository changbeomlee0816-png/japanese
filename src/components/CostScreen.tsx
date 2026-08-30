import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, Day, Settings, Trip } from '../types';
import { useLegs } from '../store/useLegs';
import { actions } from '../store/tripStore';
import { CATEGORY, CATEGORY_ORDER } from '../lib/category';
import { currencySymbol, formatKRW, formatMoney, DEFAULT_RATE_TO_KRW } from '../lib/fares';
import { formatDateShort, formatDuration } from '../lib/time';
import { Icon } from './Icon';

interface Props {
  trip: Trip;
  settings: Settings;
  readOnly?: boolean;
}

interface DayTotals {
  transit: number;
  spend: number;
  minutes: number;
  byCategory: Partial<Record<Category, number>>;
}

const ZERO: DayTotals = { transit: 0, spend: 0, minutes: 0, byCategory: {} };

export function CostScreen({ trip, settings, readOnly = false }: Props) {
  const [totals, setTotals] = useState<Record<string, DayTotals>>({});

  const report = useCallback((dayId: string, next: DayTotals) => {
    setTotals((prev) => {
      const cur = prev[dayId];
      if (cur && cur.transit === next.transit && cur.spend === next.spend && cur.minutes === next.minutes) return prev;
      return { ...prev, [dayId]: next };
    });
  }, []);

  const grand = useMemo(() => {
    const acc: DayTotals = { transit: 0, spend: 0, minutes: 0, byCategory: {} };
    for (const day of trip.days) {
      const t = totals[day.id] ?? ZERO;
      acc.transit += t.transit;
      acc.spend += t.spend;
      acc.minutes += t.minutes;
      for (const [k, v] of Object.entries(t.byCategory)) {
        acc.byCategory[k as Category] = (acc.byCategory[k as Category] ?? 0) + (v ?? 0);
      }
    }
    return acc;
  }, [totals, trip.days]);

  const perPerson = grand.transit + grand.spend;
  const groupTotal = perPerson * trip.travelers;
  const maxCat = Math.max(1, ...Object.values(grand.byCategory).map((v) => v ?? 0), grand.transit);

  return (
    <>
      <div className="large-title">
        <h1>비용</h1>
        <p>{trip.title} · {trip.days.length}일 · {trip.travelers}인</p>
      </div>

      <div className="section">
        <div className="card cost-hero">
          <span className="cost-hero__label">1인 예상 총액</span>
          <strong className="cost-hero__value mono">{formatMoney(perPerson, trip.currency)}</strong>
          <span className="cost-hero__krw mono">{formatKRW(perPerson * trip.rateToKRW)}</span>
          <div className="cost-hero__split">
            <div>
              <span className="muted small">교통</span>
              <strong className="mono">{formatMoney(grand.transit, trip.currency)}</strong>
            </div>
            <div>
              <span className="muted small">현장 지출</span>
              <strong className="mono">{formatMoney(grand.spend, trip.currency)}</strong>
            </div>
            <div>
              <span className="muted small">{trip.travelers}인 합계</span>
              <strong className="mono">{formatMoney(groupTotal, trip.currency)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">항목별</span></div>
        <div className="list" style={{ padding: '6px 0' }}>
          <div className="bar-row">
            <span className="bar-row__label">
              <Icon name="train" size={16} strokeWidth={2} color="var(--teal)" /> 교통비
            </span>
            <span className="bar-row__track">
              <span className="bar-row__fill" style={{ width: `${(grand.transit / maxCat) * 100}%`, background: 'var(--teal)' }} />
            </span>
            <span className="bar-row__value mono">{formatMoney(grand.transit, trip.currency)}</span>
          </div>
          {CATEGORY_ORDER.filter((c) => (grand.byCategory[c] ?? 0) > 0).map((c) => {
            const meta = CATEGORY[c];
            const value = grand.byCategory[c] ?? 0;
            return (
              <div className="bar-row" key={c}>
                <span className="bar-row__label">
                  <Icon name={meta.icon} size={16} strokeWidth={2} color={meta.color} /> {meta.label}
                </span>
                <span className="bar-row__track">
                  <span className="bar-row__fill" style={{ width: `${(value / maxCat) * 100}%`, background: meta.color }} />
                </span>
                <span className="bar-row__value mono">{formatMoney(value, trip.currency)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">날짜별</span></div>
        <div className="list">
          {trip.days.map((day, i) => (
            <DayCostRow
              key={day.id}
              day={day}
              index={i}
              trip={trip}
              enabled={!!settings.googleMapsApiKey}
              onTotals={report}
            />
          ))}
        </div>
      </div>

      {!readOnly && (
      <div className="section">
        <div className="section__header"><span className="section__title">환율 · 인원</span></div>
        <div className="list">
          <div className="field">
            <span className="field__label">통화</span>
            <select
              className="select"
              value={trip.currency}
              onChange={(e) => {
                const cur = e.target.value;
                actions.updateTrip({ currency: cur, rateToKRW: DEFAULT_RATE_TO_KRW[cur] ?? trip.rateToKRW });
              }}
            >
              {Object.keys(DEFAULT_RATE_TO_KRW).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="field__label">1{currencySymbol(trip.currency)} =</span>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={trip.rateToKRW}
              onChange={(e) => actions.updateTrip({ rateToKRW: Number(e.target.value) || 0 })}
              style={{ textAlign: 'right' }}
            />
            <span className="muted">원</span>
          </div>
          <div className="field">
            <span className="field__label">인원</span>
            <input
              className="input"
              type="number"
              min="1"
              value={trip.travelers}
              onChange={(e) => actions.updateTrip({ travelers: Math.max(1, Number(e.target.value) || 1) })}
              style={{ textAlign: 'right' }}
            />
            <span className="muted">명</span>
          </div>
        </div>
        <p className="muted tiny" style={{ padding: '10px 4px 0' }}>
          교통비는 거리·이동수단 기반 추정치이고, 구글 지도가 실제 운임을 제공하는 구간에서는 그 값을 씁니다.
          숙박·항공권처럼 일정에 없는 비용은 포함되지 않습니다.
        </p>
      </div>
      )}

      {readOnly && (
        <div className="section">
          <p className="muted tiny" style={{ padding: '0 4px' }}>
            교통비는 거리·이동수단 기반 추정치입니다. 숙박·항공권처럼 일정에 없는 비용은 포함되지 않습니다.
          </p>
        </div>
      )}
    </>
  );
}

function DayCostRow({
  day,
  index,
  trip,
  enabled,
  onTotals,
}: {
  day: Day;
  index: number;
  trip: Trip;
  enabled: boolean;
  onTotals: (dayId: string, t: DayTotals) => void;
}) {
  const { legs } = useLegs(day, trip.currency, enabled);

  const totals = useMemo<DayTotals>(() => {
    const byCategory: Partial<Record<Category, number>> = {};
    let spend = 0;
    let minutes = 0;
    let explicitTransit = 0;
    for (const item of day.items) {
      minutes += item.durationMin;
      if (item.transport) {
        // 비행기·신칸센처럼 직접 넣은 이동은 교통비로 센다
        explicitTransit += item.cost;
        continue;
      }
      spend += item.cost;
      byCategory[item.category] = (byCategory[item.category] ?? 0) + item.cost;
    }
    const transit = legs.reduce((n, l) => n + (l?.fare ?? 0), 0) + explicitTransit;
    minutes += legs.reduce((n, l) => n + (l?.durationMin ?? 0), 0);
    return { transit, spend, minutes, byCategory };
  }, [day, legs]);

  useEffect(() => {
    onTotals(day.id, totals);
  }, [day.id, totals, onTotals]);

  const sum = totals.transit + totals.spend;

  return (
    <div className="row">
      <span className="row__label">
        <strong>Day {index + 1}</strong>
        <span className="muted small" style={{ display: 'block' }}>
          {formatDateShort(day.date)} · {day.items.length}곳 · {formatDuration(totals.minutes)}
        </span>
      </span>
      <span className="row__value" style={{ textAlign: 'right' }}>
        <strong className="mono">{formatMoney(sum, trip.currency)}</strong>
        <span className="muted tiny mono" style={{ display: 'block' }}>{formatKRW(sum * trip.rateToKRW)}</span>
      </span>
    </div>
  );
}
