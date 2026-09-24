import type { Day } from '../types';
import { addMinutes, formatDateShort, formatDuration } from '../lib/time';
import { transportLabel } from '../lib/transport';
import { CATEGORY } from '../lib/category';

/**
 * 가져오기 전 미리보기 목록 — 붙여넣기·엑셀·경로 펼치기가 함께 쓴다.
 * highlight 에 든 항목은 앱이 새로 채워 넣은 곳이라 표시를 달아 준다.
 */
export function PreviewDays({ days, highlight }: { days: Day[]; highlight?: Set<string> }) {
  return (
    <div className="list">
      {days.map((d) => (
        <div key={d.id} className="preview-day">
          <div className="preview-day__head">{formatDateShort(d.date)}{d.title ? ` · ${d.title}` : ''}</div>
          {d.items.map((it) => (
            <div key={it.id}>
              <div className={`preview-item ${highlight?.has(it.id) ? 'preview-item--added' : ''}`}>
                <span className="mono muted small">
                  {it.startTime}
                  {it.durationMin > 0 && `–${addMinutes(it.startTime, it.durationMin)}`}
                </span>
                <span className="preview-item__title">
                  {highlight?.has(it.id) && <span className="preview-item__mark" aria-label="추천">✦ </span>}
                  {it.title}
                </span>
                <span className="badge" style={{ color: CATEGORY[it.category].color }}>
                  {CATEGORY[it.category].label}
                </span>
              </div>
              {it.transportToNext && (
                <div className="preview-item preview-item--link">
                  <span className="mono muted small" />
                  <span className="preview-item__title muted small">
                    ↓ {it.transportToNext.autoMode ? '이동수단 거리로 자동 선택' : transportLabel(it.transportToNext.mode)}{' '}
                    {it.transportToNext.durationMin > 0
                      ? formatDuration(it.transportToNext.durationMin)
                      : '· 소요시간 자동 계산'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
