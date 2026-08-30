import { useMemo, useState } from 'react';
import type { Day, Leg, Trip } from '../types';
import { optimizeDay } from '../lib/optimize';
import { diagnoseDay } from '../lib/diagnose';
import { actions } from '../store/tripStore';
import { formatDuration } from '../lib/time';
import { weatherEmoji, weatherLabel, isWet, type DayWeather } from '../lib/weather';
import { Icon } from './Icon';

interface Props {
  trip: Trip;
  day: Day;
  legs: Array<Leg | null>;
  weather?: DayWeather;
  readOnly?: boolean;
}

/**
 * 하루 일정 점검 카드.
 *
 * 동선을 줄일 수 있는지, 무리한 곳은 없는지, 날씨는 어떤지를 한 자리에 모았다.
 * 짜고 나서야 알게 되는 문제를 미리 보여주는 것이 목적이다.
 */
export function DayInsights({ trip, day, legs, weather, readOnly }: Props) {
  const [applied, setApplied] = useState(false);

  const opt = useMemo(() => optimizeDay(day), [day]);
  const diag = useMemo(() => diagnoseDay(day, legs), [day, legs]);

  const wet = weather ? isWet(weather.code, weather.rainPct) : false;
  const outdoorCount = day.items.filter((i) => i.category === 'sight' || i.category === 'activity').length;

  const canOptimize = !readOnly && opt.savedM > 300;
  const nothingToSay = !canOptimize && diag.issues.length === 0 && !weather;
  if (day.items.length === 0 || nothingToSay) return null;

  return (
    <div className="section">
      <div className="insights">
        {weather && (
          <div className="insight insight--weather">
            <span className="insight__emoji" aria-hidden>{weatherEmoji(weather.code)}</span>
            <div className="insight__body">
              <strong>
                {weatherLabel(weather.code)} {weather.maxC}° / {weather.minC}°
              </strong>
              <span className="muted small">
                강수 확률 {weather.rainPct}%
                {wet && outdoorCount > 0 ? ` · 야외 일정이 ${outdoorCount}곳이에요. 우산을 챙기세요` : ''}
              </span>
            </div>
          </div>
        )}

        {canOptimize && (
          <div className="insight insight--optimize">
            <span className="insight__icon" style={{ color: 'var(--blue)' }}>
              <Icon name="sparkles" size={18} strokeWidth={2} />
            </span>
            <div className="insight__body">
              <strong>순서를 바꾸면 {(opt.savedM / 1000).toFixed(1)}km 줄어요</strong>
              <span className="muted small">
                {(opt.beforeM / 1000).toFixed(1)}km → {(opt.afterM / 1000).toFixed(1)}km
                {opt.anchoredCount > 0 ? ` · 공항·숙소·고정한 일정 ${opt.anchoredCount}곳은 그대로 둡니다` : ''}
              </span>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                actions.applyOptimizedOrder(day.id);
                setApplied(true);
                window.setTimeout(() => setApplied(false), 2500);
              }}
            >
              {applied ? '적용됨' : '정리하기'}
            </button>
          </div>
        )}

        {diag.issues.map((issue, i) => (
          <div key={i} className={`insight insight--${issue.level}`}>
            <span className="insight__icon">
              <Icon name={issue.level === 'warn' ? 'warning' : 'info'} size={18} strokeWidth={2} />
            </span>
            <div className="insight__body">
              <span className="small">{issue.text}</span>
            </div>
          </div>
        ))}

        <div className="insight insight--stat">
          <div className="insight__body">
            <span className="muted tiny">
              하루 길이 {formatDuration(diag.spanMin)} · 이동 {(diag.distanceM / 1000).toFixed(1)}km ·{' '}
              {formatDuration(diag.travelMin)} · {day.items.length}곳
              {trip.travelers > 1 ? ` · ${trip.travelers}인` : ''}
            </span>
          </div>
        </div>
      </div>
      <p className="muted tiny" style={{ padding: '8px 4px 0' }}>
        영업시간은 일반적인 기준이라 계절·요일에 따라 다를 수 있습니다. 방문 전 확인하세요.
      </p>
    </div>
  );
}
