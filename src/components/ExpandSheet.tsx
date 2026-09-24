import { useState } from 'react';
import type { Day, LatLng, Settings, Trip } from '../types';
import { actions } from '../store/tripStore';
import { resolveMissingPlaces } from '../lib/resolve';
import { Sheet } from './ui';
import { PreviewDays } from './PreviewDays';
import { RouteExpansionPanel, useRouteExpansion } from './RouteExpansion';

interface Props {
  open: boolean;
  trip: Trip;
  /** 펼칠 날짜들 — 하루 보기에서는 그날, 전체 보기에서는 여행 전체 */
  days: Day[];
  settings: Settings;
  bias?: LatLng;
  onClose: () => void;
}

/** 이미 넣어 둔 "교토 관광" 같은 줄을 구체적인 경로로 바꾼다 */
export function ExpandSheet({ open, trip, days, settings, bias, onClose }: Props) {
  const expansion = useRouteExpansion(open ? days : null, trip.regionId, settings);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    for (const day of expansion.days) {
      const before = days.find((d) => d.id === day.id);
      if (before && before.items !== day.items) actions.replaceDayItems(day.id, day.items);
    }
    const latest = JSON.parse(actions.exportState()) as { trips: Trip[] };
    await resolveMissingPlaces(latest.trips.find((t) => t.id === trip.id) ?? trip, bias, () => {});
    actions.completeTransportEstimates();
    setBusy(false);
    onClose();
  };

  const changed = expansion.enabled && expansion.expansions.length > 0;

  return (
    <Sheet
      open={open}
      title="구체적인 경로 추천"
      onClose={busy ? () => {} : onClose}
      confirmLabel={busy ? '넣는 중…' : '이대로 바꾸기'}
      onConfirm={apply}
      confirmDisabled={busy || expansion.busy || !changed}
    >
      {expansion.blocks.length === 0 ? (
        <div className="section">
          <p className="muted" style={{ padding: '8px 4px', lineHeight: 1.6 }}>
            펼칠 일정이 없습니다. <b>교토 관광</b>, <b>난바 쇼핑</b>, <b>자유시간</b> 처럼
            장소를 콕 집지 않은 일정이 두 시간 넘게 잡혀 있으면 그 시간대를 구체적인 장소로 채워 드립니다.
          </p>
        </div>
      ) : (
        <>
          <RouteExpansionPanel state={expansion} />
          <div className="section">
            <div className="section__header"><span className="section__title">바뀐 뒤</span></div>
            <PreviewDays days={expansion.days.filter((d) => expansion.expansions.some((e) => e.block.dayId === d.id))} highlight={expansion.added} />
          </div>
        </>
      )}
    </Sheet>
  );
}
