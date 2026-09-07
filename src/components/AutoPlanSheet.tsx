import { useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng, Settings, Trip } from '../types';
import { actions } from '../store/tripStore';
import {
  INTEREST_LABEL, PACE_LABEL, buildLocalPlan, draftItemCount, enrichDraft, readBrief,
  type Interest, type Pace, type PlanBrief, type PlanDraft,
} from '../lib/autoPlan';
import { AiPlanError, buildAiPlan } from '../lib/aiPlan';
import { resolveMissingPlaces, type ResolveProgress } from '../lib/resolve';
import { formatDateShort, formatDuration } from '../lib/time';
import { CATEGORY } from '../lib/category';
import { Row, Sheet, Segmented, Stepper } from './ui';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  trip: Trip;
  settings: Settings;
  bias?: LatLng;
  onClose: () => void;
  onImported?: (firstDate: string) => void;
  onOpenSettings?: () => void;
}

const EXAMPLE = `오사카 2박3일, 둘이서 맛집 위주로 느긋하게.
도톤보리랑 오사카성은 꼭 가고 싶고, 유니버설은 빼줘.
야경 볼 수 있는 곳 하나쯤 있으면 좋겠어.`;

const INTERESTS: Interest[] = [
  'food', 'cafe', 'shopping', 'nature', 'history', 'night', 'view', 'kids', 'photo', 'market', 'onsen', 'activity',
];

/**
 * 메모 한 줄로 일정을 통째로 짜 주는 화면.
 *
 * 엔진이 둘이다. Claude 키가 있으면 Claude 가 짜고, 없거나 실패하면
 * 내장 장소 사전으로 짜는 규칙 엔진이 대신 짠다. 어느 쪽이 짰는지는 결과에 표시한다.
 */
export function AutoPlanSheet({ open, trip, settings, bias, onClose, onImported, onOpenSettings }: Props) {
  const [memo, setMemo] = useState('');
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [brief, setBrief] = useState<PlanBrief | null>(null);
  const [mode, setMode] = useState<'append' | 'replace'>('replace');
  const [busy, setBusy] = useState<'thinking' | 'placing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [progress, setProgress] = useState<ResolveProgress | null>(null);
  const [seed, setSeed] = useState(0);

  /** 메모에서 읽어낸 조건을 사용자가 직접 고칠 수 있게 해 둔다 */
  const [days, setDays] = useState(0);
  const [travelers, setTravelers] = useState(0);
  const [pace, setPace] = useState<Pace | null>(null);
  const [picked, setPicked] = useState<Interest[] | null>(null);

  const abort = useRef<AbortController | null>(null);
  const hasKey = !!settings.anthropicApiKey;

  const read = useMemo(
    () => readBrief(memo, { regionId: trip.regionId, days: trip.days.length, travelers: trip.travelers }),
    [memo, trip.regionId, trip.days.length, trip.travelers],
  );

  // 메모를 고치면 읽어낸 조건도 따라 바뀐다 — 사용자가 손댄 값은 그대로 둔다
  const effective: PlanBrief = {
    ...read,
    days: days || read.days,
    travelers: travelers || read.travelers,
    pace: pace ?? read.pace,
    interests: picked ?? read.interests,
  };

  useEffect(() => {
    if (!open) return;
    return () => abort.current?.abort();
  }, [open]);

  const reset = () => {
    abort.current?.abort();
    setMemo(''); setDraft(null); setBrief(null); setError(null); setNote(null);
    setBusy(null); setProgress(null); setSeed(0);
    setDays(0); setTravelers(0); setPace(null); setPicked(null);
  };

  const generate = async (nextSeed = seed) => {
    setError(null);
    setNote(null);
    setBusy('thinking');
    const startDate = trip.days[0]?.date ?? new Date().toISOString().slice(0, 10);
    const target = effective;
    setBrief(target);

    if (hasKey) {
      const controller = new AbortController();
      abort.current = controller;
      try {
        const result = await buildAiPlan(target, startDate, {
          apiKey: settings.anthropicApiKey,
          model: settings.aiModel,
          signal: controller.signal,
        });
        setDraft(enrichDraft(result));
        setBusy(null);
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') { setBusy(null); return; }
        const reason = e instanceof AiPlanError ? e.message : 'Claude를 부르지 못했습니다.';
        setNote(`${reason} 내장 장소 사전으로 대신 짰습니다.`);
      }
    }

    setDraft(enrichDraft(buildLocalPlan(target, startDate, nextSeed)));
    setBusy(null);
  };

  const regenerate = () => {
    const next = seed + 1;
    setSeed(next);
    void generate(next);
  };

  const apply = async () => {
    if (!draft) return;
    setBusy('placing');
    const days = actions.importDraft(draft, mode);

    // 이름만 있는 상태라 좌표를 찾아야 지도·경로·비용이 산다
    const latest = JSON.parse(actions.exportState()) as { trips: Trip[] };
    const updated = latest.trips.find((t) => t.id === trip.id) ?? trip;
    await resolveMissingPlaces(updated, bias, setProgress);

    setBusy(null);
    if (days[0]) onImported?.(days[0].date);
    reset();
    onClose();
  };

  const toggleInterest = (interest: Interest) => {
    const current = picked ?? read.interests;
    setPicked(current.includes(interest) ? current.filter((i) => i !== interest) : [...current, interest]);
  };

  const itemCount = draft ? draftItemCount(draft) : 0;

  return (
    <Sheet
      open={open}
      title="AI로 일정 짜기"
      onClose={busy ? () => {} : () => { reset(); onClose(); }}
      confirmLabel={busy === 'placing' ? '넣는 중…' : '일정에 넣기'}
      onConfirm={apply}
      confirmDisabled={!!busy || itemCount === 0}
    >
      <div className="section">
        <div className="section__header"><span className="section__title">1. 어떤 여행인지 적기</span></div>
        <div className="input-box">
          <textarea
            className="textarea"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            disabled={!!busy}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--gray btn--sm" onClick={() => setMemo(EXAMPLE)} disabled={!!busy}>
            <Icon name="sparkles" size={14} strokeWidth={2} /> 예시 채우기
          </button>
          {memo && (
            <button type="button" className="btn btn--gray btn--sm" onClick={() => setMemo('')} disabled={!!busy}>
              지우기
            </button>
          )}
        </div>
        <p className="muted tiny" style={{ padding: '10px 4px 0', lineHeight: 1.6 }}>
          어디를·며칠·누구와·무엇을 좋아하는지 편하게 적으면 됩니다.
          꼭 가고 싶은 곳과 빼고 싶은 곳도 적어주세요.
        </p>
      </div>

      <div className="section">
        <div className="section__header">
          <span className="section__title">2. 읽어낸 조건</span>
          <span className="muted tiny">{effective.regionName}</span>
        </div>
        <div className="list">
          <Row label="며칠" value={`${effective.days}일`}>
            <Stepper value={effective.days} min={1} max={14} onChange={setDays} />
          </Row>
          <Row label="몇 명" value={`${effective.travelers}명`}>
            <Stepper value={effective.travelers} min={1} max={20} onChange={setTravelers} />
          </Row>
        </div>
        <div style={{ marginTop: 12 }}>
          <Segmented
            value={effective.pace}
            onChange={(v) => setPace(v)}
            options={(['relaxed', 'normal', 'packed'] as Pace[]).map((p) => ({ value: p, label: PACE_LABEL[p] }))}
          />
        </div>
        <div className="taste-grid">
          {INTERESTS.map((interest) => (
            <button
              key={interest}
              type="button"
              className={`taste-chip ${effective.interests.includes(interest) ? 'taste-chip--on' : ''}`}
              onClick={() => toggleInterest(interest)}
              disabled={!!busy}
            >
              {INTEREST_LABEL[interest]}
            </button>
          ))}
        </div>
        {effective.mustVisit.length > 0 && (
          <p className="muted tiny" style={{ padding: '10px 4px 0' }}>꼭 갈 곳: {effective.mustVisit.join(', ')}</p>
        )}
        {effective.avoid.length > 0 && (
          <p className="muted tiny" style={{ padding: '4px 4px 0' }}>뺄 곳: {effective.avoid.join(', ')}</p>
        )}
      </div>

      <div className="section">
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => void generate()}
          disabled={!!busy}
        >
          <Icon name="sparkles" size={16} strokeWidth={2} />
          {busy === 'thinking' ? (hasKey ? 'Claude가 짜는 중…' : '짜는 중…') : draft ? '다시 짜기' : '일정 짜기'}
        </button>
        <p className="muted tiny" style={{ padding: '10px 4px 0', lineHeight: 1.6 }}>
          {hasKey ? (
            <>Claude가 짭니다. 실패하면 내장 장소 사전으로 대신 짭니다.</>
          ) : (
            <>
              지금은 <b>내장 장소 사전</b>으로 짭니다 — 키도 인터넷도 필요 없습니다.
              {onOpenSettings && (
                <>
                  {' '}설정에서 <button type="button" className="linkish" onClick={onOpenSettings}>Claude API 키</button>를
                  넣으면 메모를 훨씬 잘 읽고 추천도 붙습니다.
                </>
              )}
            </>
          )}
        </p>
        {error && <p className="small" style={{ color: 'var(--red)', padding: '8px 4px 0' }}>{error}</p>}
        {note && <p className="small" style={{ color: 'var(--orange)', padding: '8px 4px 0', lineHeight: 1.6 }}>{note}</p>}
        {busy === 'placing' && progress && (
          <p className="muted tiny" style={{ padding: '8px 4px 0' }}>
            위치 찾는 중… {progress.done}/{progress.total}
          </p>
        )}
      </div>

      {draft && (
        <>
          <div className="section">
            <div className="section__header">
              <span className="section__title">3. 이렇게 짰습니다</span>
              <span className="muted tiny">{draft.engine === 'claude' ? 'Claude' : '내장 사전'}</span>
            </div>
            <p className="draft-summary">{draft.summary}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" className="btn btn--gray btn--sm" onClick={regenerate} disabled={!!busy}>
                <Icon name="sparkles" size={14} strokeWidth={2} /> 다르게 짜보기
              </button>
            </div>
          </div>

          {draft.tips.length > 0 && (
            <div className="section">
              <div className="section__header"><span className="section__title">알아두면 좋은 것</span></div>
              <ul className="paste-help" style={{ paddingLeft: 16 }}>
                {draft.tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            </div>
          )}

          <div className="section">
            <div className="section__header">
              <span className="section__title">미리보기</span>
              <span className="muted tiny">{draft.days.length}일 · {itemCount}곳</span>
            </div>
            <div className="list">
              {draft.days.map((day) => (
                <div key={day.date} className="preview-day">
                  <div className="preview-day__head">
                    {formatDateShort(day.date)}{day.title ? ` · ${day.title}` : ''}
                  </div>
                  {day.items.map((item, i) => (
                    <div key={`${day.date}-${i}`} className="draft-item">
                      <span className="draft-item__time">{item.startTime}</span>
                      <span className="draft-item__body">
                        <span className="draft-item__title">{item.title}</span>
                        <span className="muted tiny">
                          {CATEGORY[item.category].label} · {formatDuration(item.durationMin)}
                          {item.cost > 0 ? ` · ${item.cost.toLocaleString()}` : ''}
                        </span>
                        {item.notes && <span className="draft-item__note">{item.notes}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section__header"><span className="section__title">넣는 방식</span></div>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'replace', label: '전체 교체' },
                { value: 'append', label: '기존 일정에 더하기' },
              ]}
            />
            <p className="muted tiny" style={{ padding: '10px 4px 0' }}>
              넣은 뒤에도 모든 항목을 그대로 고칠 수 있습니다. {brief?.regionName} 기준으로 좌표를 찾아 붙입니다.
            </p>
          </div>
        </>
      )}
    </Sheet>
  );
}
