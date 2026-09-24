import { useEffect, useMemo, useState } from 'react';
import type { Day, Settings } from '../types';
import {
  applyExpansions, expandLocally, expandWithClaude, findBroadBlocks,
  type BroadBlock, type Expansion,
} from '../lib/expandPlan';
import { ClaudeError } from '../lib/claude';
import { fromMinutes } from '../lib/time';
import { Switch } from './ui';
import { Icon } from './Icon';

export interface RouteExpansionState {
  blocks: BroadBlock[];
  expansions: Expansion[];
  /** 펼친 결과가 반영된 날짜들 (끄면 원본) */
  days: Day[];
  /** 새로 채워 넣은 항목 id — 미리보기에서 표시한다 */
  added: Set<string>;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  engine: 'local' | 'claude';
  busy: boolean;
  note: string | null;
  hasKey: boolean;
  askClaude: () => Promise<void>;
  reshuffle: () => void;
}

/**
 * 가져올 날짜들에서 포괄적인 일정을 찾아 구체적인 경로로 펼친다.
 *
 * 내장 사전으로는 곧바로(무료·오프라인) 펼치고, Claude 는 사용자가 누를 때만 부른다 —
 * 붙여넣기 미리보기는 글자를 칠 때마다 다시 계산되므로 자동으로 부르면 요금이 새어 나간다.
 */
export function useRouteExpansion(days: Day[] | null, tripRegionId: string | undefined, settings: Settings): RouteExpansionState {
  const [enabled, setEnabled] = useState(true);
  const [seed, setSeed] = useState(0);
  const [claude, setClaude] = useState<{ source: Day[]; expansions: Expansion[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const base = days ?? [];
  const blocks = useMemo(() => findBroadBlocks(base, tripRegionId), [base, tripRegionId]);
  const local = useMemo(() => expandLocally(base, blocks, seed), [base, blocks, seed]);

  // 원본이 바뀌면 Claude 결과는 버린다
  const claudeValid = claude && claude.source === base ? claude.expansions : null;
  useEffect(() => { setNote(null); }, [base]);

  const expansions = claudeValid ?? local;
  const expanded = useMemo(() => (enabled ? applyExpansions(base, expansions) : base), [enabled, base, expansions]);
  const added = useMemo(() => {
    const before = new Set(base.flatMap((d) => d.items.map((it) => it.id)));
    return new Set(expanded.flatMap((d) => d.items.map((it) => it.id)).filter((id) => !before.has(id)));
  }, [base, expanded]);

  const askClaude = async () => {
    if (!settings.anthropicApiKey || blocks.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await expandWithClaude(base, blocks, { apiKey: settings.anthropicApiKey, model: settings.aiModel });
      setClaude({ source: base, expansions: result });
      setEnabled(true);
    } catch (e) {
      setNote(`${e instanceof ClaudeError ? e.message : 'Claude를 부르지 못했습니다.'} 내장 사전으로 펼친 결과를 그대로 씁니다.`);
    } finally {
      setBusy(false);
    }
  };

  return {
    blocks,
    expansions,
    days: expanded,
    added,
    enabled,
    setEnabled,
    engine: claudeValid ? 'claude' : 'local',
    busy,
    note,
    hasKey: !!settings.anthropicApiKey,
    askClaude,
    reshuffle: () => { setClaude(null); setSeed((n) => n + 1); },
  };
}

/** 미리보기 위에 붙는 안내 — 무엇을 어떻게 펼쳤는지 */
export function RouteExpansionPanel({ state }: { state: RouteExpansionState }) {
  const { blocks, expansions, enabled } = state;
  if (blocks.length === 0) return null;
  const done = new Set(expansions.map((e) => e.block.itemId));
  const missing = blocks.filter((b) => !done.has(b.itemId));

  return (
    <div className="section">
      <div className="section__header">
        <span className="section__title">구체적인 경로 추천</span>
        <span className="muted tiny">{state.engine === 'claude' ? 'Claude' : '내장 사전'}</span>
      </div>
      <div className="card expand-card">
        <div className="expand-card__head">
          <Icon name="sparkles" size={18} strokeWidth={2} color="var(--blue)" />
          <span className="expand-card__title">
            포괄적인 일정 {blocks.length}개{expansions.length > 0 ? ` 중 ${expansions.length}개를 구체적인 장소로 펼쳤습니다` : '를 찾았습니다'}
          </span>
          <Switch checked={enabled} onChange={state.setEnabled} label="펼치기" />
        </div>
        {expansions.map((e) => (
          <div key={e.block.itemId} className="expand-row">
            <div className="expand-row__from">
              {e.block.item.title}{' '}
              <span className="muted">{fromMinutes(e.block.start)}~{fromMinutes(e.block.end)}</span>
            </div>
            <div className="expand-row__to">→ {e.items.map((it) => it.title).join(' → ')}</div>
          </div>
        ))}
        {missing.map((b) => (
          <div key={b.itemId} className="expand-row expand-row--missing">
            <div className="expand-row__from">
              {b.item.title} <span className="muted">{fromMinutes(b.start)}~{fromMinutes(b.end)}</span>
            </div>
            <div className="expand-row__to muted">
              {b.regionId ? '이 시간대에 넣을 곳을 못 찾았습니다' : '내장 사전에 없는 지역 — Claude로 펼칠 수 있습니다'}
            </div>
          </div>
        ))}
        <div className="expand-card__actions">
          <button type="button" className="btn btn--gray btn--sm" onClick={state.reshuffle} disabled={state.busy}>
            다르게 펼치기
          </button>
          {state.hasKey && (
            <button type="button" className="btn btn--tinted btn--sm" onClick={() => void state.askClaude()} disabled={state.busy}>
              <Icon name="sparkles" size={14} strokeWidth={2} />
              {state.busy ? 'Claude가 짜는 중…' : 'Claude로 펼치기'}
            </button>
          )}
        </div>
        {state.note && <p className="small" style={{ color: 'var(--orange)', padding: '8px 2px 0', lineHeight: 1.5 }}>{state.note}</p>}
        {!state.hasKey && missing.some((b) => !b.regionId) && (
          <p className="muted tiny" style={{ padding: '8px 2px 0' }}>설정에 Claude API 키를 넣으면 어느 지역이든 펼칠 수 있습니다.</p>
        )}
      </div>
    </div>
  );
}
