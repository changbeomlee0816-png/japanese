import { useMemo, useState } from 'react';
import type { LatLng, Trip } from '../types';
import { actions } from '../store/tripStore';
import { parsePlanText } from '../lib/parsePlan';
import { resolveMissingPlaces, type ResolveProgress } from '../lib/resolve';
import { addMinutes, formatDateShort, formatDuration } from '../lib/time';
import { transportLabel } from '../lib/transport';
import { CATEGORY } from '../lib/category';
import { Sheet, Segmented } from './ui';
import { Icon } from './Icon';

const EXAMPLE = `9/12
07:10 ~ 09:05 인천국제공항 → 간사이 국제공항 비행기
11:00-12:30 도톤보리
14:30 오사카성 600엔
저녁 구로몬 시장

9/13
오전 9시 ~ 11시 30분 교토역
신오사카 → 교토역 신칸센
13:00~15:00 기요미즈데라
17:00 니시키 시장 (1시간)`;

interface Props {
  open: boolean;
  trip: Trip;
  bias?: LatLng;
  onClose: () => void;
  /** 가져온 첫 날짜로 화면을 옮기기 위해 알려준다 */
  onImported?: (firstDate: string) => void;
}

/** 요구사항 1 — "대충 짜서 넣으면" 구조화해 주는 입력 시트 */
export function QuickAddSheet({ open, trip, bias, onClose, onImported }: Props) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [progress, setProgress] = useState<ResolveProgress | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    return parsePlanText(text, trip.days[0]?.date);
  }, [text, trip.days]);

  const run = async () => {
    if (!preview || preview.itemCount === 0) return;
    setBusy(true);
    const imported = actions.importPlanText(text, mode);

    // 방금 넣은 항목들의 좌표를 찾아 지도/경로/비용을 채운다
    const latest = actions.exportState();
    const parsedState = JSON.parse(latest) as { trips: Trip[] };
    const updated = parsedState.trips.find((t) => t.id === trip.id) ?? trip;
    await resolveMissingPlaces(updated, bias, setProgress);
    // 시간을 안 적은 이동 줄은 좌표를 찾은 뒤에야 계산할 수 있다
    actions.completeTransportEstimates();

    setBusy(false);
    setProgress(null);
    setText('');
    if (imported.days[0]) onImported?.(imported.days[0].date);
    onClose();
  };

  return (
    <Sheet
      open={open}
      title="일정 붙여넣기"
      onClose={busy ? () => {} : onClose}
      confirmLabel={busy ? '처리 중…' : '가져오기'}
      onConfirm={run}
      confirmDisabled={busy || !preview || preview.itemCount === 0}
    >
      <div className="section">
        <div className="paste-help">
          <p>
            날짜와 시간을 대충 적어도 됩니다. <b>9/12</b> · <b>Day 1</b> · <b>1일차</b> 같은 줄을 날짜로 읽습니다.
          </p>
          <ul>
            <li>
              <code>07:10 ~ 09:05</code> 처럼 <b>시간을 범위로</b> 적으면 그 사이가 그 장소에 머무는 시간이 됩니다.
              <code>오후 2시~3시반</code> 도 됩니다.
            </li>
            <li>
              <code>인천공항 → 간사이공항 비행기</code> 처럼 <b>화살표</b>를 쓰면 이동으로 읽어
              두 곳을 각각 방문지로 세우고 그 사이를 잇습니다. 시간을 안 적으면 거리로 계산합니다.
            </li>
            <li>
              <code>10:00</code> 처럼 시각만 적으면 <code>(90분)</code> 으로 체류시간을,
              <code>2100엔</code> 으로 비용을 함께 적을 수 있습니다.
            </li>
          </ul>
        </div>
        <div className="input-box">
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            disabled={busy}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn--gray btn--sm" onClick={() => setText(EXAMPLE)} disabled={busy}>
            <Icon name="sparkles" size={14} strokeWidth={2} /> 예시 채우기
          </button>
          {text && (
            <button type="button" className="btn btn--gray btn--sm" onClick={() => setText('')} disabled={busy}>
              지우기
            </button>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">추가 방식</span></div>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'append', label: '기존 일정에 더하기' },
            { value: 'replace', label: '전체 교체' },
          ]}
        />
      </div>

      {preview && (
        <div className="section">
          <div className="section__header">
            <span className="section__title">미리보기</span>
            <span className="muted small">{preview.days.length}일 · {preview.itemCount}개 일정</span>
          </div>
          <div className="list">
            {preview.days.map((d) => (
              <div key={d.id} className="preview-day">
                <div className="preview-day__head">{formatDateShort(d.date)}</div>
                {d.items.map((it) => (
                  <div key={it.id}>
                    <div className="preview-item">
                      <span className="mono muted small">
                        {it.startTime}
                        {it.durationMin > 0 && `–${addMinutes(it.startTime, it.durationMin)}`}
                      </span>
                      <span className="preview-item__title">{it.title}</span>
                      <span className="badge" style={{ color: CATEGORY[it.category].color }}>
                        {CATEGORY[it.category].label}
                      </span>
                    </div>
                    {it.transportToNext && (
                      <div className="preview-item preview-item--link">
                        <span className="mono muted small" />
                        <span className="preview-item__title muted small">
                          ↓ {transportLabel(it.transportToNext.mode)}{' '}
                          {it.transportToNext.durationMin > 0
                            ? formatDuration(it.transportToNext.durationMin)
                            : '소요시간 자동 계산'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {preview.warnings.length > 0 && (
            <p className="muted tiny" style={{ padding: '10px 4px 0' }}>
              {preview.warnings.slice(0, 3).join(' / ')}
            </p>
          )}
        </div>
      )}

      {busy && (
        <div className="section">
          <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="spinner" />
            <div>
              <div style={{ fontSize: 15 }}>
                {progress ? `장소 찾는 중 ${progress.done}/${progress.total}` : '일정 정리 중…'}
              </div>
              {progress?.currentTitle && <div className="muted small">{progress.currentTitle}</div>}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
