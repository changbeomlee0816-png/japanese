import type { Trip } from '../types';
import { CATEGORY } from '../lib/category';
import { formatDateShort, formatDuration, todayISO } from '../lib/time';
import { formatMoney } from '../lib/fares';
import { actions } from '../store/tripStore';
import { Icon } from './Icon';
import { weatherEmoji, type DayWeather } from '../lib/weather';

interface Props {
  trip: Trip;
  weather?: Map<string, DayWeather>;
  onOpenDay: (index: number) => void;
  onExplore: () => void;
  readOnly?: boolean;
}

/**
 * 전체 일정을 한 화면에 펼쳐 보여준다.
 *
 * 하루씩만 보면 여행 전체 윤곽이 안 잡힌다는 문제 때문에 만들었다.
 * 날짜별로 몇 곳을 도는지, 비어 있는 날은 어디인지가 바로 보인다.
 */
export function TripOverview({ trip, weather, onOpenDay, onExplore, readOnly }: Props) {
  const today = todayISO();

  return (
    <div className="section">
      <div className="overview">
        {trip.days.map((day, i) => {
          const spend = day.items.reduce((n, it) => n + it.cost, 0);
          const minutes = day.items.reduce((n, it) => n + it.durationMin, 0);
          const isToday = day.date === today;
          const w = weather?.get(day.date);
          const empty = day.items.length === 0;

          return (
            <button
              key={day.id}
              type="button"
              className={`ovday${isToday ? ' ovday--today' : ''}${empty ? ' ovday--empty' : ''}`}
              onClick={() => onOpenDay(i)}
            >
              <div className="ovday__head">
                <span className="ovday__num">Day {i + 1}</span>
                <span className="ovday__date">{formatDateShort(day.date)}</span>
                {isToday && <span className="badge badge--green">오늘</span>}
                <span className="spacer" />
                {w && (
                  <span className="ovday__weather" title={`최고 ${w.maxC}° 최저 ${w.minC}° · 강수 ${w.rainPct}%`}>
                    {weatherEmoji(w.code)} {w.maxC}°
                  </span>
                )}
                <Icon name="chevronRight" size={15} strokeWidth={2.2} className="chevron" />
              </div>

              {day.title && <p className="ovday__subtitle">{day.title}</p>}

              {empty ? (
                <p className="ovday__blank">아직 비어 있어요 — 눌러서 채우기</p>
              ) : (
                <>
                  <ol className="ovday__items">
                    {day.items.map((item) => (
                      <li key={item.id}>
                        <span className="ovday__dot" style={{ background: CATEGORY[item.category].color }} />
                        <span className="ovday__time mono">{item.startTime}</span>
                        <span className="ovday__name">{item.title}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="ovday__foot">
                    <span>{day.items.length}곳</span>
                    <span>·</span>
                    <span>{formatDuration(minutes)}</span>
                    {spend > 0 && (
                      <>
                        <span>·</span>
                        <span>{formatMoney(spend, trip.currency)}</span>
                      </>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}

        {!readOnly && (
          <div className="overview__actions">
            <button type="button" className="btn btn--tinted btn--block" onClick={onExplore}>
              <Icon name="sparkles" size={16} strokeWidth={2} /> {trip.destination || '여행지'} 둘러보기
            </button>
            <button type="button" className="btn btn--gray btn--block" onClick={() => actions.addDay()}>
              <Icon name="plus" size={16} strokeWidth={2.4} /> 날짜 추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
