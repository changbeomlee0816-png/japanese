import { useEffect, useMemo, useState } from 'react';
import type { Item, LatLng, Settings, Trip } from '../types';
import { actions } from '../store/tripStore';
import { useLegs } from '../store/useLegs';
import { computeLive, useDepartureNotification, useNow } from '../store/useLive';
import { formatDateKo, formatDuration, diffDays } from '../lib/time';
import { formatKRW, formatMoney } from '../lib/fares';
import { mapsLoaded } from '../lib/maps';
import { resolveMissingPlaces } from '../lib/resolve';
import { Timeline } from './Timeline';
import { LiveBanner } from './LiveBanner';
import { DayPicker } from './DayPicker';
import { ItemEditSheet } from './ItemEditSheet';
import { QuickAddSheet } from './QuickAddSheet';
import { EmptyState, Row, Segmented, Sheet } from './ui';
import { ExploreSheet } from './ExploreSheet';
import { TripOverview } from './TripOverview';
import { SavedShelf } from './SavedShelf';
import { DayInsights } from './DayInsights';
import { TransportSheet } from './TransportSheet';
import { SheetImportSheet } from './SheetImportSheet';
import { useWeather } from '../lib/weather';
import { Icon } from './Icon';

interface Props {
  trip: Trip;
  settings: Settings;
  dayIndex: number;
  onDayChange: (i: number) => void;
  bias?: LatLng;
  onShowFood: (item: Item) => void;
  onPrint: () => void;
  /** 공유 링크를 보기만 하는 사람 — 편집 UI를 숨긴다 */
  readOnly?: boolean;
}

export function PlanScreen({ trip, settings, dayIndex, onDayChange, bias, onShowFood, onPrint, readOnly = false }: Props) {
  const day = trip.days[dayIndex];
  const now = useNow(1000);
  const { legs, loading, liveCount } = useLegs(day, trip.currency, !!settings.googleMapsApiKey);
  const live = useMemo(() => computeLive(day, legs, now, settings.departureAlertMin), [day, legs, now, settings.departureAlertMin]);
  useDepartureNotification(live, day, settings);

  const [editing, setEditing] = useState<{ item: Item | null; focusPlace?: boolean } | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [explore, setExplore] = useState(false);
  const [transport, setTransport] = useState(false);
  const [sheetImport, setSheetImport] = useState(false);
  /** 전체 윤곽을 먼저 보고 하루를 파고드는 흐름 */
  const [view, setView] = useState<'overview' | 'day'>('overview');
  const [dayMenu, setDayMenu] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  /** 붙여넣기 직후 이동할 날짜 — 스토어가 갱신된 뒤에야 인덱스를 알 수 있다 */
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingDate) return;
    const idx = trip.days.findIndex((d) => d.date === pendingDate);
    if (idx >= 0) {
      onDayChange(idx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setPendingDate(null);
  }, [pendingDate, trip.days, onDayChange]);

  /** 여행 기간 날씨 — 예보 범위 밖 날짜는 그냥 빠진다 */
  const weather = useWeather(bias, trip.days.map((d) => d.date));

  const totals = useMemo(() => {
    if (!day) return { spend: 0, transit: 0, minutes: 0, missing: 0 };
    const spend = day.items.reduce((n, i) => n + i.cost, 0);
    const transit = legs.reduce((n, l) => n + (l?.fare ?? 0), 0);
    const minutes =
      day.items.reduce((n, i) => n + i.durationMin, 0) + legs.reduce((n, l) => n + (l?.durationMin ?? 0), 0);
    const missing = day.items.filter((i) => !i.place.coord).length;
    return { spend, transit, minutes, missing };
  }, [day, legs]);

  if (!day) {
    return (
      <EmptyState
        icon="calendar"
        title="날짜가 없습니다"
        body="이 여행에 날짜를 추가해 일정을 만들어 보세요."
        action={
          <button className="btn btn--primary" type="button" onClick={() => actions.addDay()}>
            날짜 추가
          </button>
        }
      />
    );
  }

  const dayNumber = dayIndex + 1;
  const tripLength = trip.days.length;

  const runResolve = async () => {
    setResolving('위치를 찾는 중…');
    const count = await resolveMissingPlaces(trip, bias, (p) =>
      setResolving(`위치 찾는 중 ${p.done}/${p.total} · ${p.currentTitle}`),
    );
    actions.completeTransportEstimates();
    setResolving(null);
    if (count === 0) alert('찾지 못했습니다. 항목을 눌러 장소를 직접 검색해 주세요.');
  };

  return (
    <>
      <div className="large-title">
        <h1>{trip.title}</h1>
        <p>
          {trip.destination} · {tripLength}일 · {trip.travelers}인
          {trip.days[0] && ` · ${formatDateKo(trip.days[0].date)}부터`}
        </p>
      </div>

      <div className="section">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'overview', label: '전체 일정' },
            { value: 'day', label: '하루씩 보기' },
          ]}
        />
      </div>

      {view === 'overview' ? (
        <>
          <TripOverview
            trip={trip}
            weather={weather}
            readOnly={readOnly}
            onExplore={() => setExplore(true)}
            onOpenDay={(i) => {
              onDayChange(i);
              setView('day');
            }}
          />
          {!readOnly && <SavedShelf trip={trip} dayIndex={dayIndex} onExplore={() => setExplore(true)} />}
          {!readOnly && (
            <div className="section">
              <div className="list">
                <Row label="메모한 일정 붙여넣기" icon="sparkles" accent onClick={() => setQuickAdd(true)} />
                <Row label="엑셀로 한 번에 넣기" icon="list" accent onClick={() => setSheetImport(true)} />
                <Row label="PDF로 내보내기" icon="printer" accent onClick={onPrint} />
              </div>
            </div>
          )}
          {readOnly && (
            <div className="section">
              <div className="list">
                <Row label="PDF로 내보내기" icon="printer" accent onClick={onPrint} />
              </div>
            </div>
          )}
        </>
      ) : (
      <>
      <DayPicker trip={trip} index={dayIndex} onChange={onDayChange} allowAdd={!readOnly} />

      <div className="section">
        <div className="day-head">
          <div>
            <h2 className="day-head__title">
              Day {dayNumber} <span className="muted">/ {tripLength}</span>
            </h2>
            <p className="muted small">
              {formatDateKo(day.date)}
              {day.title ? ` · ${day.title}` : ''}
            </p>
          </div>
          {!readOnly && (
            <button type="button" className="btn btn--gray btn--sm" onClick={() => setDayMenu(true)}>
              <Icon name="gear" size={15} strokeWidth={2} /> 이 날
            </button>
          )}
        </div>

        <div className="stat-row">
          <div className="stat">
            <span className="stat__value mono">{formatDuration(totals.minutes)}</span>
            <span className="stat__label">일정 + 이동</span>
          </div>
          <div className="stat">
            <span className="stat__value mono">{formatMoney(totals.transit, trip.currency)}</span>
            <span className="stat__label">교통비 / 1인</span>
          </div>
          <div className="stat">
            <span className="stat__value mono">{formatMoney(totals.spend, trip.currency)}</span>
            <span className="stat__label">현장 지출</span>
          </div>
        </div>

        {(loading || totals.missing > 0 || (!mapsLoaded() && day.items.length > 0)) && (
          <div className="notice">
            {loading && (
              <>
                <span className="spinner" />
                <span className="small">구글 지도에서 실제 경로를 가져오는 중… ({liveCount}/{Math.max(0, day.items.length - 1)})</span>
              </>
            )}
            {!loading && totals.missing > 0 && (
              <>
                <Icon name="warning" size={17} strokeWidth={2} color="var(--orange)" />
                <span className="small">위치가 없는 일정 {totals.missing}개 — 경로와 비용이 빠집니다</span>
                {!readOnly && (
                  <button type="button" className="btn btn--tinted btn--sm" onClick={runResolve}>
                    자동으로 찾기
                  </button>
                )}
              </>
            )}
            {!loading && totals.missing === 0 && !mapsLoaded() && (
              <>
                <Icon name="info" size={17} strokeWidth={2} color="var(--label-2)" />
                <span className="small">지금은 거리 기반 추정치입니다. 설정에서 구글맵 키를 넣어보세요.</span>
              </>
            )}
          </div>
        )}

        {resolving && (
          <div className="notice">
            <span className="spinner" />
            <span className="small">{resolving}</span>
          </div>
        )}
      </div>

      <LiveBanner day={day} live={live} legs={legs} autoShift={settings.autoShift} />

      <DayInsights trip={trip} day={day} legs={legs} weather={weather.get(day.date)} readOnly={readOnly} />

      <div className="section">
        {day.items.length === 0 ? (
          <EmptyState
            icon="plan"
            title="이 날은 아직 비어 있어요"
            body={
              readOnly
                ? '이 날짜에는 아직 등록된 일정이 없습니다.'
                : '이 지역을 둘러보며 담거나,\n메모해 둔 일정을 그대로 붙여넣으세요.'
            }
            action={
              readOnly ? undefined : (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn--primary" type="button" onClick={() => setExplore(true)}>
                    둘러보고 담기
                  </button>
                  <button className="btn btn--tinted" type="button" onClick={() => setEditing({ item: null })}>
                    직접 추가
                  </button>
                  <button className="btn btn--gray" type="button" onClick={() => setTransport(true)}>
                    이동 추가
                  </button>
                  <button className="btn btn--gray" type="button" onClick={() => setQuickAdd(true)}>
                    붙여넣기
                  </button>
                  <button className="btn btn--gray" type="button" onClick={() => setSheetImport(true)}>
                    엑셀
                  </button>
                </div>
              )
            }
          />
        ) : (
          <Timeline
            day={day}
            legs={legs}
            currency={trip.currency}
            liveStates={live.states}
            isLiveDay={live.isToday}
            onEditItem={(item) => setEditing({ item })}
            onFindPlace={(item) => setEditing({ item, focusPlace: true })}
            onShowFood={onShowFood}
            readOnly={readOnly}
          />
        )}
      </div>

      {!readOnly && <SavedShelf trip={trip} dayIndex={dayIndex} onExplore={() => setExplore(true)} />}

      {day.items.length > 0 && (
        <div className="section">
          <div className="list">
            {!readOnly && <Row label="이동 추가 (비행기 · 신칸센 등)" icon="plane" accent onClick={() => setTransport(true)} />}
            {!readOnly && <Row label="이 지역 둘러보기" icon="sparkles" accent onClick={() => setExplore(true)} />}
            {!readOnly && <Row label="메모한 일정 붙여넣기" icon="plan" accent onClick={() => setQuickAdd(true)} />}
            {!readOnly && <Row label="엑셀로 한 번에 넣기" icon="list" accent onClick={() => setSheetImport(true)} />}
            <Row label="PDF로 내보내기" icon="printer" accent onClick={onPrint} />
          </div>
        </div>
      )}
      </>
      )}

      {!readOnly && view === 'day' && (
        <button className="fab" type="button" onClick={() => setEditing({ item: null })} aria-label="일정 추가">
          <Icon name="plus" size={26} strokeWidth={2.4} />
        </button>
      )}

      {editing && (
        <ItemEditSheet
          open
          trip={trip}
          day={day}
          item={editing.item}
          bias={bias}
          focusPlace={editing.focusPlace}
          onClose={() => setEditing(null)}
        />
      )}

      <SheetImportSheet
        open={sheetImport}
        trip={trip}
        bias={bias}
        onClose={() => setSheetImport(false)}
        onImported={setPendingDate}
      />

      <TransportSheet open={transport} trip={trip} day={day} onClose={() => setTransport(false)} />

      <ExploreSheet open={explore} trip={trip} dayIndex={dayIndex} onClose={() => setExplore(false)} />

      <QuickAddSheet
        open={quickAdd}
        trip={trip}
        bias={bias}
        onClose={() => setQuickAdd(false)}
        onImported={setPendingDate}
      />

      <Sheet open={dayMenu} title={`Day ${dayNumber} 설정`} onClose={() => setDayMenu(false)}>
        <div className="section">
          <div className="list">
            <div className="field">
              <span className="field__label">날짜</span>
              <input
                className="input"
                type="date"
                value={day.date}
                onChange={(e) => actions.updateDay(day.id, { date: e.target.value })}
                style={{ textAlign: 'right' }}
              />
            </div>
            <div className="field">
              <span className="field__label">부제목</span>
              <input
                className="input"
                value={day.title ?? ''}
                placeholder="예: 아사쿠사 · 스카이트리"
                onChange={(e) => actions.updateDay(day.id, { title: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section__header"><span className="section__title">일정 시간 조정</span></div>
          <div className="shift-row">
            {[-60, -30, -15, 15, 30, 60].map((m) => (
              <button key={m} type="button" className="btn btn--gray btn--sm" onClick={() => actions.shiftDay(day.id, m)}>
                {m > 0 ? `+${m}분` : `${m}분`}
              </button>
            ))}
          </div>
          <p className="muted tiny" style={{ padding: '8px 4px 0' }}>
            이 날의 모든 일정을 통째로 앞뒤로 옮깁니다.
          </p>
        </div>

        <div className="section">
          <div className="list">
            <Row label="다음 날 추가" accent onClick={() => { actions.insertDayAfter(day.id); setDayMenu(false); }} />
            <Row label="이 날 복제" accent onClick={() => { actions.duplicateDay(day.id); setDayMenu(false); }} />
            <Row label="진행 기록 초기화" accent onClick={() => actions.resetProgress(day.id)} />
            <Row
              label="이 날 삭제"
              danger
              onClick={() => {
                if (trip.days.length <= 1) {
                  alert('마지막 날짜는 지울 수 없습니다.');
                  return;
                }
                actions.removeDay(day.id);
                onDayChange(Math.max(0, dayIndex - 1));
                setDayMenu(false);
              }}
            />
          </div>
        </div>

        <div className="section">
          <p className="muted tiny" style={{ padding: '0 4px' }}>
            여행 {diffDays(trip.days[0].date, day.date) + 1}일차 · 저장한 총 예산 환산 {formatKRW(
              (day.items.reduce((n, i) => n + i.cost, 0) + legs.reduce((n, l) => n + (l?.fare ?? 0), 0)) * trip.rateToKRW,
            )}
          </p>
        </div>
      </Sheet>
    </>
  );
}
