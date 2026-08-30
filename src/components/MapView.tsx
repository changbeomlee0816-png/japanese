import { useEffect, useMemo, useRef, useState } from 'react';
import type { Day, Item, Leg } from '../types';
import { CATEGORY } from '../lib/category';
import { bounds, centroid, decodePolyline } from '../lib/geo';
import { mapsLoaded, useMapsReady } from '../lib/maps';

interface Props {
  day: Day;
  legs: Array<Leg | null>;
  activeItemId?: string;
  onSelect?: (item: Item) => void;
  height?: number;
}

/** 마커용 SVG 핀 (번호 + 분류 색) */
function pinSvg(index: number, color: string, active: boolean): string {
  const size = active ? 44 : 38;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 38 46">
    <path d="M19 45C19 45 35 28.5 35 17.5C35 8.4 27.8 1 19 1C10.2 1 3 8.4 3 17.5C3 28.5 19 45 19 45Z"
      fill="${color}" stroke="white" stroke-width="2.5"/>
    <circle cx="19" cy="17" r="11" fill="white" fill-opacity="0.92"/>
    <text x="19" y="22" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif"
      font-size="14" font-weight="700" fill="${color}">${index}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function MapView({ day, legs, activeItemId, onSelect, height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Array<google.maps.Marker | google.maps.Polyline>>([]);
  const [ready, setReady] = useState(false);
  const scriptReady = useMapsReady();

  // 이동 항목은 마커로 찍지 않는다 — 동선의 점은 장소만이어야 읽힌다
  const stops = useMemo(
    () =>
      day.items
        .map((item, i) => ({ item, i }))
        .filter((s) => !!s.item.place.coord && !s.item.transport),
    [day],
  );

  /* 지도 초기화 */
  useEffect(() => {
    void scriptReady; // 스크립트가 늦게 붙어도 이 시점에 다시 시도한다
    if (!mapsLoaded() || !containerRef.current || mapRef.current) return;
    const center = stops.length ? centroid(stops.map((s) => s.item.place.coord!)) : { lat: 35.68, lng: 139.76 };
    mapRef.current = new google.maps.Map(containerRef.current, {
      center,
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
      styles: [
        { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit.station.bus', stylers: [{ visibility: 'off' }] },
      ],
    });
    setReady(true);
  }, [stops, scriptReady]);

  /* 마커 · 경로 다시 그리기 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    stops.forEach(({ item, i }) => {
      const marker = new google.maps.Marker({
        map,
        position: item.place.coord!,
        icon: {
          url: pinSvg(i + 1, resolveColor(CATEGORY[item.category].color), item.id === activeItemId),
          scaledSize: new google.maps.Size(item.id === activeItemId ? 44 : 38, item.id === activeItemId ? 52 : 46),
          anchor: new google.maps.Point(item.id === activeItemId ? 22 : 19, item.id === activeItemId ? 52 : 46),
        },
        title: item.title,
        zIndex: item.id === activeItemId ? 999 : i,
      });
      marker.addListener('click', () => onSelect?.(item));
      overlaysRef.current.push(marker);
    });

    // 구간별 경로: Directions 폴리라인이 있으면 실제 경로, 없으면 점선 직선
    legs.forEach((leg, i) => {
      const a = day.items[i]?.place.coord;
      const b = day.items[i + 1]?.place.coord;
      if (!a || !b) return;

      const path = leg?.polyline ? decodePolyline(leg.polyline) : [a, b];
      const dashed = !leg?.polyline;
      const line = new google.maps.Polyline({
        map,
        path,
        strokeColor: '#007AFF',
        strokeOpacity: dashed ? 0 : 0.85,
        strokeWeight: 4,
        ...(dashed
          ? {
              icons: [
                {
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, strokeWeight: 3, scale: 3 },
                  offset: '0',
                  repeat: '14px',
                },
              ],
            }
          : {}),
      });
      overlaysRef.current.push(line);
    });

    if (stops.length === 1) {
      map.setCenter(stops[0].item.place.coord!);
      map.setZoom(15);
    } else if (stops.length > 1) {
      const b = new google.maps.LatLngBounds();
      stops.forEach((s) => b.extend(s.item.place.coord!));
      map.fitBounds(b, { top: 48, bottom: 48, left: 36, right: 36 });
    }
  }, [stops, legs, day.items, activeItemId, ready, onSelect]);

  if (!mapsLoaded()) {
    return <SchematicMap day={day} legs={legs} activeItemId={activeItemId} onSelect={onSelect} height={height} />;
  }

  return <div ref={containerRef} className="map" style={{ height }} />;
}

/** CSS 변수는 SVG data URI에 못 넣으므로 실제 색으로 바꿔준다 */
function resolveColor(cssVar: string): string {
  if (!cssVar.startsWith('var(')) return cssVar;
  const name = cssVar.slice(4, -1).trim();
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || '#007AFF';
}

/* ------------------------------------------------------------------ *
 * API 키가 없을 때의 개략도
 * ------------------------------------------------------------------ */

function SchematicMap({ day, legs, activeItemId, onSelect, height }: Props & { height: number }) {
  const stops = day.items
    .map((item, i) => ({ item, i }))
    .filter((s) => !!s.item.place.coord && !s.item.transport);

  if (stops.length === 0) {
    return (
      <div className="map map--empty" style={{ height }}>
        <p className="muted small">위치가 지정된 일정이 없습니다</p>
      </div>
    );
  }

  const coords = stops.map((s) => s.item.place.coord!);
  const b = bounds(coords);
  const padLat = Math.max((b.maxLat - b.minLat) * 0.18, 0.004);
  const padLng = Math.max((b.maxLng - b.minLng) * 0.18, 0.004);
  const W = 100;
  const H = 100;

  const project = (lat: number, lng: number) => {
    const x = ((lng - (b.minLng - padLng)) / (b.maxLng - b.minLng + padLng * 2)) * W;
    // 위도는 위로 갈수록 커지므로 y를 뒤집는다
    const y = H - ((lat - (b.minLat - padLat)) / (b.maxLat - b.minLat + padLat * 2)) * H;
    return { x, y };
  };

  const points = stops.map((s) => ({ ...s, ...project(s.item.place.coord!.lat, s.item.place.coord!.lng) }));

  return (
    <div className="map map--schematic" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="schematic">
        <defs>
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" fill="none" stroke="var(--separator)" strokeWidth="0.25" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />

        {points.slice(0, -1).map((p, i) => {
          const q = points[i + 1];
          const leg = legs[p.i];
          return (
            <line
              key={`l-${i}`}
              x1={p.x} y1={p.y} x2={q.x} y2={q.y}
              stroke="var(--blue)"
              strokeWidth="0.9"
              strokeLinecap="round"
              strokeDasharray={leg?.source === 'google' ? undefined : '2.5 2'}
              opacity="0.75"
            />
          );
        })}

        {points.map((p) => {
          const active = p.item.id === activeItemId;
          return (
            <g
              key={p.item.id}
              transform={`translate(${p.x} ${p.y})`}
              onClick={() => onSelect?.(p.item)}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            >
              <circle r={active ? 4.6 : 3.6} fill={CATEGORY[p.item.category].color} stroke="var(--card)" strokeWidth="1" />
              <text
                textAnchor="middle"
                dy="1.2"
                fontSize="3.4"
                fontWeight="700"
                fill="#fff"
                style={{ pointerEvents: 'none' }}
              >
                {p.i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map__note">
        <span className="badge badge--blue">개략도</span>
        <span className="muted tiny">설정에서 구글맵 키를 넣으면 실제 지도와 경로가 표시됩니다</span>
      </div>
    </div>
  );
}
