import { useEffect, useMemo, useState } from 'react';
import type { Item, TabKey } from './types';
import { actions, useActiveTrip, useSettings } from './store/tripStore';
import { useTodayIndex } from './store/useLive';
import { loadGoogleMaps, useMapsReady } from './lib/maps';
import { lookupArea } from './data/poi';
import { PlanScreen } from './components/PlanScreen';
import { MapScreen } from './components/MapScreen';
import { FoodScreen } from './components/FoodScreen';
import { CostScreen } from './components/CostScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { PrintPreview } from './components/PrintDocument';
import { Icon, type IconName } from './components/Icon';
import { useScrolled } from './components/ui';
import { SaveChip, ShareNotice } from './components/ShareBar';
import { initShare, setUiSnapshot, takeUiState, useShare } from './lib/share';
import { initCloud, useCloud } from './lib/cloud';

const TABS: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: 'plan', label: '일정', icon: 'plan' },
  { key: 'map', label: '지도', icon: 'map' },
  { key: 'food', label: '맛집', icon: 'food' },
  { key: 'cost', label: '비용', icon: 'wallet' },
  { key: 'settings', label: '설정', icon: 'gear' },
];

const NAV_TITLE: Record<TabKey, string> = {
  plan: '일정',
  map: '지도',
  food: '맛집',
  cost: '비용',
  settings: '설정',
};

export default function App() {
  const trip = useActiveTrip();
  const settings = useSettings();
  const scrolled = useScrolled();
  // 지도 스크립트가 준비되면 아래 화면들이 추정치 대신 실제 데이터로 다시 그려진다
  const mapsReady = useMapsReady();

  const share = useShare();
  const cloud = useCloud();
  // 공유 링크를 보기만 하는 사람, 또는 쓰기 권한 없는 아티팩트 뷰어
  const readOnly = cloud.mode === 'viewer' || (cloud.mode === 'off' && share.mode === 'readonly');

  // 공유본 저장 뒤 화면이 새로고침되므로, 보던 탭·날짜·스크롤을 되돌려 준다
  const restored = useMemo(() => takeUiState(), []);
  const todayIndex = useTodayIndex(trip.days);
  const [tab, setTab] = useState<TabKey>((restored?.tab as TabKey) ?? 'plan');
  const [dayIndex, setDayIndex] = useState(restored?.dayIndex ?? todayIndex);
  const [foodAnchor, setFoodAnchor] = useState<string | undefined>(undefined);
  const [printing, setPrinting] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  /* 공유 모드 판별 — 링크로 열렸으면 그 일정을 불러온다 */
  useEffect(() => {
    void initShare();
    void initCloud((trips) => actions.applyRemoteTrips(trips));
  }, []);

  /* 현재 보고 있는 위치를 기록해 두었다가 새로고침 뒤 복원 */
  useEffect(() => {
    setUiSnapshot({ tab, dayIndex });
  }, [tab, dayIndex]);

  useEffect(() => {
    if (!restored) return;
    const id = window.setTimeout(() => window.scrollTo({ top: restored.scrollY }), 60);
    return () => window.clearTimeout(id);
  }, [restored]);

  /* 여행이 바뀌면 오늘 날짜로 되돌린다 */
  useEffect(() => {
    setDayIndex((i) => (i < trip.days.length ? i : Math.max(0, trip.days.length - 1)));
  }, [trip.id, trip.days.length]);

  /* 테마 */
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  /* 구글 지도 로드 */
  useEffect(() => {
    if (!settings.googleMapsApiKey) return;
    loadGoogleMaps(settings.googleMapsApiKey).catch((e: Error) => {
      setMapsError(
        e.message === 'SCRIPT_LOAD_FAILED'
          ? '구글 지도를 불러오지 못했습니다. API 키와 네트워크를 확인해 주세요.'
          : e.message === 'KEY_CHANGED_RELOAD_REQUIRED'
            ? '키가 바뀌었습니다. 새로고침하면 적용됩니다.'
            : '구글 지도 초기화에 실패했습니다.',
      );
    });
  }, [settings.googleMapsApiKey]);

  /* 지도가 붙으면 이전 오류 안내는 걷어낸다 */
  useEffect(() => {
    if (mapsReady) setMapsError(null);
  }, [mapsReady]);

  /* 지도·검색의 지역 기준점 */
  const bias = useMemo(() => {
    const withCoord = trip.days.flatMap((d) => d.items).find((i) => i.place.coord);
    return withCoord?.place.coord ?? lookupArea(trip.destination) ?? undefined;
  }, [trip]);

  const openFood = (item: Item) => {
    const idx = trip.days.findIndex((d) => d.items.some((i) => i.id === item.id));
    if (idx >= 0) setDayIndex(idx);
    setFoodAnchor(item.id);
    setTab('food');
  };

  if (printing) {
    return <PrintPreview trip={trip} enabled={!!settings.googleMapsApiKey} onClose={() => setPrinting(false)} />;
  }

  return (
    <div className="app">
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
        <div className="navbar__inner">
          <button
            type="button"
            className="navbar__action"
            onClick={() => {
              setDayIndex(todayIndex);
              setTab('plan');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            오늘
          </button>
          <span className="navbar__title">{NAV_TITLE[tab]}</span>
          <div className="navbar__action navbar__action--right">
            <SaveChip />
            <button type="button" onClick={() => setPrinting(true)} aria-label="PDF로 내보내기">
              <Icon name="printer" size={19} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </nav>

      <main className="app__body">
        <ShareNotice />

        {mapsError && (
          <div className="section">
            <div className="notice notice--warn">
              <Icon name="warning" size={17} strokeWidth={2} color="var(--orange)" />
              <span className="small">{mapsError}</span>
              <button type="button" className="btn btn--gray btn--sm" onClick={() => setMapsError(null)}>닫기</button>
            </div>
          </div>
        )}

        {tab === 'plan' && (
          <PlanScreen
            trip={trip}
            settings={settings}
            dayIndex={dayIndex}
            onDayChange={setDayIndex}
            bias={bias}
            onShowFood={openFood}
            onPrint={() => setPrinting(true)}
            readOnly={readOnly}
          />
        )}
        {tab === 'map' && (
          <MapScreen
            trip={trip}
            settings={settings}
            dayIndex={dayIndex}
            onDayChange={setDayIndex}
            onShowFood={openFood}
          />
        )}
        {tab === 'food' && (
          <FoodScreen
            trip={trip}
            settings={settings}
            dayIndex={dayIndex}
            anchorItemId={foodAnchor}
            onAnchorChange={setFoodAnchor}
          />
        )}
        {tab === 'cost' && <CostScreen trip={trip} settings={settings} readOnly={readOnly} />}
        {tab === 'settings' && <SettingsScreen trip={trip} settings={settings} readOnly={readOnly} />}
      </main>

      <nav className="tabbar">
        <div className="tabbar__inner">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tabbar__item${tab === t.key ? ' tabbar__item--active' : ''}`}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key}
            >
              <Icon name={t.icon} size={23} strokeWidth={tab === t.key ? 2.1 : 1.7} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** 개발 편의: 콘솔에서 상태를 만질 수 있게 노출 */
if (import.meta.env.DEV) {
  (window as unknown as { tabi: typeof actions }).tabi = actions;
}
