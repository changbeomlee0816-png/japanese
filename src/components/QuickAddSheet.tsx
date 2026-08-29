import { useMemo, useState } from 'react';
import type { LatLng, Trip } from '../types';
import { actions } from '../store/tripStore';
import { parsePlanText } from '../lib/parsePlan';
import { resolveMissingPlaces, type ResolveProgress } from '../lib/resolve';
import { formatDateShort } from '../lib/time';
import { CATEGORY } from '../lib/category';
import { Sheet, Segmented } from './ui';
import { Icon } from './Icon';

const EXAMPLE = `9/12
10:00 나리타공항 도착
12:30 아사쿠사 센소지 (90분)
14:30 도쿄 스카이트리 2100엔
저녁 시부야 이자카야

9/13
9:30 메이지 신궁
11:00 하라주쿠 다케시타 거리 [1시간]
점심 이치란 라멘
15:00 팀랩 플래닛 3800엔
19:00 신주쿠 오모이데요코초`;

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
        <p className="muted small" style={{ margin: '0 4px 12px' }}>
          날짜와 시간을 대충 적어도 됩니다. <strong>9/12</strong>, <strong>Day 1</strong>, <strong>1일차</strong> 같은 줄을
          날짜로, <strong>10:00</strong>·<strong>오후 2시</strong>·<strong>점심</strong>을 시간으로 읽습니다.
          <strong> (90분)</strong>은 체류시간, <strong>2100엔</strong>은 비용으로 잡습니다.
        </p>
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
                  <div key={it.id} className="preview-item">
                    <span className="mono muted small">{it.startTime}</span>
                    <span className="preview-item__title">{it.title}</span>
                    <span className="badge" style={{ color: CATEGORY[it.category].color }}>
                      {CATEGORY[it.category].label}
                    </span>
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
