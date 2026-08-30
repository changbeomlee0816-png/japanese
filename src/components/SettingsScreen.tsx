import { useRef, useState } from 'react';
import type { Settings, Trip } from '../types';
import { actions, useStore } from '../store/tripStore';
import { clearLegCache } from '../store/useLegs';
import { mapsLoaded } from '../lib/maps';
import { todayISO } from '../lib/time';
import { saveFile } from '../lib/share';
import { Row, Sheet, Switch, Segmented } from './ui';
import { ShareLinkSection } from './ShareLinkSection';
import { NewTripSheet, RegionGrid } from './NewTripSheet';
import { findRegion } from '../data/regions';
import { DEFAULT_RATE_TO_KRW } from '../lib/fares';
import { useCloud } from '../lib/cloud';
import { Icon } from './Icon';

interface Props {
  trip: Trip;
  settings: Settings;
  readOnly?: boolean;
}

export function SettingsScreen({ trip, settings, readOnly = false }: Props) {
  const { trips } = useStore();
  const cloud = useCloud();
  const [keyDraft, setKeyDraft] = useState(settings.googleMapsApiKey);
  const [tripSheet, setTripSheet] = useState(false);
  const [regionSheet, setRegionSheet] = useState(false);
  const [regionQuery, setRegionQuery] = useState('');
  const [newTrip, setNewTrip] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveKey = () => {
    actions.updateSettings({ googleMapsApiKey: keyDraft.trim() });
    clearLegCache();
    if (keyDraft.trim() && !mapsLoaded()) window.location.reload();
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      alert('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }
    const perm = await Notification.requestPermission();
    actions.updateSettings({ notificationsEnabled: perm === 'granted' });
    if (perm !== 'granted') alert('브라우저에서 알림이 차단되어 있습니다.');
  };

  const exportData = async () => {
    const result = await saveFile(`tabi-${todayISO()}.json`, actions.exportState());
    if (result === 'unavailable') alert('이 화면에서는 파일을 내려받을 수 없습니다.');
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        actions.importState(String(reader.result));
        alert('가져왔습니다.');
      } catch (e) {
        alert(`가져오기 실패: ${e instanceof Error ? e.message : e}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="large-title">
        <h1>설정</h1>
        <p>지도 연동, 실시간 알림, 데이터 관리</p>
      </div>

      <ShareLinkSection trip={trip} />

      <div className="section">
        <div className="section__header">
          <span className="section__title">구글 지도 연동</span>
          <span className={`badge ${mapsLoaded() ? 'badge--green' : ''}`}>{mapsLoaded() ? '연결됨' : '미연결'}</span>
        </div>
        <div className="list">
          <div className="field">
            <span className="field__label">API 키</span>
            <input
              className="input"
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="AIza..."
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Row
            label={settings.googleMapsApiKey ? '키 저장 · 새로고침' : '키 저장'}
            accent
            onClick={saveKey}
          />
          {settings.googleMapsApiKey && (
            <Row
              label="키 삭제"
              danger
              onClick={() => {
                actions.updateSettings({ googleMapsApiKey: '' });
                setKeyDraft('');
                clearLegCache();
                window.location.reload();
              }}
            />
          )}
        </div>
        <p className="muted tiny" style={{ padding: '10px 4px 0', lineHeight: 1.6 }}>
          키는 이 브라우저에만 저장되고 어디에도 전송되지 않습니다. Google Cloud Console에서
          <strong> Maps JavaScript API</strong>, <strong>Places API (New)</strong>, <strong>Directions API</strong>를
          켠 뒤 키를 만들고, HTTP 리퍼러 제한을 걸어두는 걸 권합니다.
          키 없이도 거리 기반 추정과 내장 장소·맛집 데이터로 앱 전체가 동작합니다.
        </p>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">실시간 일정</span></div>
        <div className="list">
          <Row label="지연되면 이후 일정 자동 조정">
            <Switch
              checked={settings.autoShift}
              onChange={(v) => actions.updateSettings({ autoShift: v })}
              label="자동 조정"
            />
          </Row>
          <div className="field">
            <span className="field__label">출발 알림</span>
            <select
              className="select"
              value={settings.departureAlertMin}
              onChange={(e) => actions.updateSettings({ departureAlertMin: Number(e.target.value) })}
            >
              {[0, 5, 10, 15, 20, 30].map((m) => (
                <option key={m} value={m}>{m === 0 ? '정시' : `${m}분 전`}</option>
              ))}
            </select>
          </div>
          <Row label="브라우저 알림">
            <Switch
              checked={settings.notificationsEnabled}
              onChange={(v) => (v ? requestNotifications() : actions.updateSettings({ notificationsEnabled: false }))}
              label="알림"
            />
          </Row>
        </div>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">맛집 추천</span></div>
        <div className="list">
          <div className="field">
            <span className="field__label">현지인 지수</span>
            <select
              className="select"
              value={settings.minLocalScore}
              onChange={(e) => actions.updateSettings({ minLocalScore: Number(e.target.value) })}
            >
              {[40, 50, 60, 70, 80].map((v) => (
                <option key={v} value={v}>{v}점 이상</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">화면</span></div>
        <Segmented
          value={settings.theme}
          onChange={(v) => actions.updateSettings({ theme: v })}
          options={[
            { value: 'system', label: '시스템' },
            { value: 'light', label: '라이트' },
            { value: 'dark', label: '다크' },
          ]}
        />
      </div>

      {!readOnly && (
        <div className="section">
          <div className="section__header">
            <span className="section__title">여행</span>
            <button type="button" className="section__action" onClick={() => setNewTrip(true)}>새 여행</button>
          </div>
          <div className="list">
            <Row label="현재 여행" value={trip.title} onClick={() => setTripSheet(true)} />
            <Row
              label="여행지"
              value={trip.destination || '정하지 않음'}
              onClick={() => setRegionSheet(true)}
            />
            <Row label="저장된 여행" value={`${trips.length}개`} onClick={() => setTripSheet(true)} />
          </div>
          <p className="muted tiny" style={{ padding: '10px 4px 0' }}>
            여행지를 정하면 둘러보기 목록과 지도 중심, 통화가 함께 맞춰집니다.
          </p>
        </div>
      )}

      <div className="section">
        <div className="section__header"><span className="section__title">데이터</span></div>
        <div className="list">
          <Row label="백업 파일 내보내기" icon="share" accent onClick={() => void exportData()} />
          {!readOnly && (
            <Row label="백업 파일 가져오기" icon="copy" accent onClick={() => fileRef.current?.click()} />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importData(f);
            e.target.value = '';
          }}
        />
        <p className="muted tiny" style={{ padding: '10px 4px 0', lineHeight: 1.6 }}>
          {cloud.mode === 'off'
            ? '일정은 이 브라우저(localStorage)에만 저장됩니다. 기기를 옮길 때는 백업 파일을 쓰세요.'
            : '이 일정은 공유 서버에 저장되어 링크로 열립니다. 설정과 구글맵 키는 이 브라우저에만 남습니다.'}
        </p>
      </div>

      <Sheet
        open={regionSheet}
        title="여행지 바꾸기"
        onClose={() => {
          setRegionQuery('');
          setRegionSheet(false);
        }}
      >
        <div className="section">
          <div className="search-bar">
            <Icon name="search" size={17} strokeWidth={2.2} color="var(--label-2)" />
            <input
              className="input"
              value={regionQuery}
              onChange={(e) => setRegionQuery(e.target.value)}
              placeholder="도시 이름으로 찾기"
            />
          </div>
        </div>
        <div className="section">
          <RegionGrid
            query={regionQuery}
            onPick={(r) => {
              actions.updateTrip({
                regionId: r.id,
                destination: r.name,
                currency: r.currency,
                rateToKRW: DEFAULT_RATE_TO_KRW[r.currency] ?? trip.rateToKRW,
              });
              setRegionQuery('');
              setRegionSheet(false);
            }}
          />
        </div>
        <div className="section">
          <p className="muted tiny" style={{ padding: '0 4px' }}>
            지금 여행지는 <strong>{trip.destination || '미정'}</strong>
            {findRegion(trip.destination) ? '' : ' — 목록에 없는 곳이라 둘러보기가 비어 있을 수 있습니다'}.
            이미 넣은 일정은 그대로 남습니다.
          </p>
        </div>
      </Sheet>

      <TripListSheet open={tripSheet} onClose={() => setTripSheet(false)} activeId={trip.id} trips={trips} />
      <NewTripSheet open={newTrip} onClose={() => setNewTrip(false)} />
    </>
  );
}

function TripListSheet({ open, onClose, trips, activeId }: { open: boolean; onClose: () => void; trips: Trip[]; activeId: string }) {
  return (
    <Sheet open={open} title="여행 목록" onClose={onClose}>
      <div className="section">
        <div className="list">
          {trips.map((t) => (
            <div key={t.id} className={`row${t.id === activeId ? ' row--active' : ''}`}>
              <button
                type="button"
                style={{ flex: 1, textAlign: 'left', background: 'none' }}
                onClick={() => {
                  actions.setActiveTrip(t.id);
                  onClose();
                }}
              >
                <strong>{t.title}</strong>
                <span className="muted small" style={{ display: 'block' }}>
                  {t.destination} · {t.days.length}일 · {t.days.reduce((n, d) => n + d.items.length, 0)}개 일정
                </span>
              </button>
              {t.id === activeId && <Icon name="check" size={18} strokeWidth={2.6} color="var(--blue)" />}
              <button type="button" onClick={() => actions.duplicateTrip(t.id)} aria-label="복제">
                <Icon name="copy" size={18} strokeWidth={1.9} color="var(--label-2)" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`"${t.title}"을(를) 삭제할까요?`)) actions.deleteTrip(t.id);
                }}
                aria-label="삭제"
              >
                <Icon name="trash" size={18} strokeWidth={1.9} color="var(--red)" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
