import type { Day, Leg } from '../types';
import type { LiveState } from '../store/useLive';
import { actions } from '../store/tripStore';
import { formatDuration, formatRelative } from '../lib/time';
import { MODE_LABEL } from '../lib/fares';
import { Icon } from './Icon';

interface Props {
  day: Day;
  live: LiveState;
  legs: Array<Leg | null>;
  autoShift: boolean;
}

/**
 * 요구사항 5 — 지금 시각 기준으로 일정이 어디까지 왔는지, 다음에 뭘 해야 하는지 보여준다.
 * 밀린 만큼 이후 일정을 한 번에 미는 버튼도 여기 있다.
 */
export function LiveBanner({ day, live, legs, autoShift }: Props) {
  if (!live.isToday || day.items.length === 0) return null;

  const current = live.currentIndex !== null ? live.states[live.currentIndex] : null;
  const next = live.nextIndex !== null ? live.states[live.nextIndex] : null;
  const leg = live.nextIndex !== null && live.nextIndex > 0 ? legs[live.nextIndex - 1] : null;

  const hasOverdue = live.states.some((s) => s.status === 'overdue' || s.status === 'missed');
  const allDone = live.states.every((s) => s.item.done) || (!current && !next && !hasOverdue);

  if (allDone) {
    return (
      <div className="live live--calm">
        <div className="live__row">
          <span className="live__pulse live__pulse--calm" />
          <div className="live__text">
            <strong>오늘 일정 끝</strong>
            <span className="muted small">수고했어요. 내일 일정을 미리 확인해 보세요.</span>
          </div>
        </div>
      </div>
    );
  }

  const urgent = live.departureDue;

  return (
    <div className={`live${urgent ? ' live--urgent' : ''}`}>
      {current && (
        <div className="live__row">
          <span className="live__pulse" />
          <div className="live__text">
            <span className="live__eyebrow">지금</span>
            <strong>{current.item.title}</strong>
            <span className="muted small">
              {current.item.startTime} 시작 · {formatDuration(Math.max(0, (current.plannedEnd.getTime() - live.now.getTime()) / 60000))} 남음
            </span>
          </div>
          {!current.item.done && (
            <button
              type="button"
              className="btn btn--tinted btn--sm"
              onClick={() => actions.checkOut(day.id, current.item.id)}
            >
              완료
            </button>
          )}
        </div>
      )}

      {!current && !next && hasOverdue && (
        <div className="live__row">
          <span className="live__icon live__icon--warn">
            <Icon name="clock" size={19} strokeWidth={2} />
          </span>
          <div className="live__text">
            <span className="live__eyebrow">확인 필요</span>
            <strong>계획 시각이 지난 일정이 남아 있어요</strong>
            <span className="muted small">끝난 일정은 왼쪽 동그라미를 눌러 완료로 표시하세요.</span>
          </div>
        </div>
      )}

      {current && next && <div className="live__divider" />}

      {next && (
        <div className="live__row">
          <span className="live__icon">
            <Icon name={urgent ? 'bell' : 'clock'} size={19} strokeWidth={2} />
          </span>
          <div className="live__text">
            <span className="live__eyebrow">{urgent ? '지금 출발' : '다음'}</span>
            <strong>
              {next.item.startTime} {next.item.title}
            </strong>
            <span className="muted small">
              {live.msToNext !== null && formatRelative(live.msToNext)}
              {leg && ` · ${MODE_LABEL[leg.mode]} ${formatDuration(leg.durationMin)}`}
            </span>
          </div>
        </div>
      )}

      {live.runningLateMin > 0 && (current || next) && (
        <>
          <div className="live__divider" />
          <div className="live__row">
            <span className="live__icon live__icon--warn">
              <Icon name="warning" size={19} strokeWidth={2} />
            </span>
            <div className="live__text">
              <strong>{formatDuration(live.runningLateMin)} 밀렸어요</strong>
              <span className="muted small">
                {autoShift ? '남은 일정을 한 번에 미룰 수 있어요' : '설정에서 자동 조정을 켜면 알아서 밀어줍니다'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn--tinted btn--sm"
              onClick={() => {
                const target = live.states.find((s) => s.status === 'overdue' && !s.item.done);
                const delta = Math.round(live.runningLateMin / 5) * 5;
                if (target && delta > 0) actions.shiftFrom(day.id, target.item.id, delta);
              }}
            >
              일정 조정
            </button>
          </div>
        </>
      )}
    </div>
  );
}
