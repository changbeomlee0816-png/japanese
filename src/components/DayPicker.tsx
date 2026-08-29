import type { Trip } from '../types';
import { formatDateShort, todayISO } from '../lib/time';
import { Icon } from './Icon';
import { actions } from '../store/tripStore';

interface Props {
  trip: Trip;
  index: number;
  onChange: (i: number) => void;
  allowAdd?: boolean;
}

/** 가로 스크롤 날짜 선택 칩 */
export function DayPicker({ trip, index, onChange, allowAdd = true }: Props) {
  const today = todayISO();
  return (
    <div className="chip-row">
      {trip.days.map((d, i) => (
        <button
          key={d.id}
          type="button"
          className={`chip${i === index ? ' chip--active' : ''}`}
          onClick={() => onChange(i)}
        >
          <span>Day {i + 1}</span>
          <small>
            {formatDateShort(d.date)}
            {d.date === today ? ' · 오늘' : ''}
          </small>
        </button>
      ))}
      {allowAdd && (
        <button
          type="button"
          className="chip"
          onClick={() => {
            actions.addDay();
            onChange(trip.days.length);
          }}
          aria-label="날짜 추가"
        >
          <Icon name="plus" size={18} strokeWidth={2.4} />
          <small>추가</small>
        </button>
      )}
    </div>
  );
}
