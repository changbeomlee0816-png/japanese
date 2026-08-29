import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Day, Restaurant, Trip } from '../types';
import { useLegs } from '../store/useLegs';
import { CATEGORY } from '../lib/category';
import { formatDateKo, formatDuration, addMinutes } from '../lib/time';
import { formatKRW, formatMoney, MODE_LABEL } from '../lib/fares';
import { nearbyRestaurants } from '../lib/maps';
import { Icon } from './Icon';
import { Switch } from './ui';
import { saveFile } from '../lib/share';
import printCss from '../styles/print.css?raw';

interface Props {
  trip: Trip;
  enabled: boolean;
  onClose: () => void;
}

/**
 * 요구사항 4 — 완성된 계획을 PDF로 저장.
 * 브라우저의 "PDF로 저장" 인쇄 기능을 쓴다. 한글 폰트가 그대로 살고 벡터로 저장돼
 * 캔버스 캡처 방식보다 결과가 깨끗하다.
 */
export function PrintPreview({ trip, enabled, onClose }: Props) {
  const [withFood, setWithFood] = useState(true);
  const [dayTotals, setDayTotals] = useState<Record<string, { transit: number; spend: number }>>({});
  const [saveNote, setSaveNote] = useState<string | null>(null);

  /**
   * 인쇄 창이 뜨지 않는 환경(공유 링크의 프레임 안 등)을 위한 대비책.
   * 지금 보고 있는 일정표를 그대로 담은 HTML 파일을 건네준다.
   * 열어서 인쇄하면 같은 PDF가 나온다.
   */
  const downloadDocument = async () => {
    const paper = document.getElementById('print-root')?.outerHTML;
    if (!paper) return;
    const doc = [
      '<!doctype html>',
      '<html lang="ko"><head><meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${trip.title} 일정표</title>`,
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap">',
      '<style>body{margin:0;padding:24px 12px;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,\'Apple SD Gothic Neo\',\'Noto Sans KR\',system-ui,sans-serif;-webkit-font-smoothing:antialiased}',
      '*{box-sizing:border-box}@media print{body{padding:0;background:#fff}}',
      printCss,
      '</style></head><body>',
      paper,
      '</body></html>',
    ].join('\n');

    const result = await saveFile(`${trip.title.replace(/[\\/:*?"<>|]/g, '')} 일정표.html`, doc);
    setSaveNote(
      result === 'saved'
        ? '내려받은 파일을 열고 인쇄(⌘P / Ctrl+P) → PDF로 저장하면 됩니다.'
        : result === 'declined'
          ? '저장을 취소했습니다.'
          : '이 화면에서는 파일을 내려받을 수 없습니다.',
    );
  };

  const grand = useMemo(() => {
    let transit = 0;
    let spend = 0;
    for (const d of trip.days) {
      transit += dayTotals[d.id]?.transit ?? 0;
      spend += dayTotals[d.id]?.spend ?? 0;
    }
    return { transit, spend, total: transit + spend };
  }, [dayTotals, trip.days]);

  return (
    <div className="print-overlay">
      <div className="print-toolbar">
        <button type="button" className="navbar__action" onClick={onClose}>
          <Icon name="chevronLeft" size={18} strokeWidth={2.4} /> 닫기
        </button>
        <span className="sheet__title">PDF 미리보기</span>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => window.print()}>
          <Icon name="printer" size={15} strokeWidth={2} /> PDF로 저장
        </button>
      </div>

      <div className="print-options">
        <span className="small">주변 맛집 추천 포함</span>
        <Switch checked={withFood} onChange={setWithFood} label="맛집 포함" />
      </div>
      <div className="print-hint">
        <p className="muted tiny" style={{ margin: 0 }}>
          저장 대화상자에서 대상을 <strong>&lsquo;PDF로 저장&rsquo;</strong>으로 선택하세요. 배경 그래픽을 켜면 색이 그대로 나옵니다.
        </p>
        <button type="button" className="btn btn--gray btn--sm" onClick={() => void downloadDocument()}>
          <Icon name="share" size={14} strokeWidth={2} /> 인쇄 창이 안 뜨면 파일로 내려받기
        </button>
        {saveNote && <p className="muted tiny" style={{ margin: 0 }}>{saveNote}</p>}
      </div>

      <div className="paper" id="print-root">
        <header className="paper__cover">
          <p className="paper__eyebrow">여행 일정표</p>
          <h1>{trip.title}</h1>
          <p className="paper__sub">
            {trip.destination} · {trip.days.length}일 · {trip.travelers}인
          </p>
          <p className="paper__sub">
            {trip.days.length > 0 && `${formatDateKo(trip.days[0].date)} — ${formatDateKo(trip.days[trip.days.length - 1].date)}`}
          </p>

          <table className="paper__summary">
            <tbody>
              <tr>
                <th>교통비 (1인)</th>
                <td>{formatMoney(grand.transit, trip.currency)}</td>
                <th>현장 지출 (1인)</th>
                <td>{formatMoney(grand.spend, trip.currency)}</td>
              </tr>
              <tr>
                <th>1인 합계</th>
                <td colSpan={trip.travelers > 1 ? 1 : 3}>
                  {formatMoney(grand.total, trip.currency)}
                  <span className="paper__krw"> ({formatKRW(grand.total * trip.rateToKRW)})</span>
                </td>
                {trip.travelers > 1 && (
                  <>
                    <th>{trip.travelers}인 합계</th>
                    <td>
                      {formatMoney(grand.total * trip.travelers, trip.currency)}
                      <span className="paper__krw"> ({formatKRW(grand.total * trip.travelers * trip.rateToKRW)})</span>
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
          <p className="paper__note">
            교통비는 이동 거리·수단 기반 추정치이며, 구글 지도가 실제 운임을 제공하는 구간에서는 그 값을 사용했습니다.
            숙박비와 항공권은 포함되어 있지 않습니다.
          </p>
        </header>

        {trip.days.map((day, i) => (day.items.length === 0 ? null : (
          <PrintDay
            key={day.id}
            day={day}
            index={i}
            trip={trip}
            enabled={enabled}
            withFood={withFood}
            onTotals={(t) =>
              setDayTotals((prev) =>
                prev[day.id]?.transit === t.transit && prev[day.id]?.spend === t.spend ? prev : { ...prev, [day.id]: t },
              )
            }
          />
        )))}

        {trip.days.every((d) => d.items.length === 0) && (
          <p className="paper__empty">아직 일정이 없습니다. 일정을 추가한 뒤 다시 내보내세요.</p>
        )}

        <footer className="paper__footer">
          <span>{trip.title}</span>
          <span>Tabi로 만든 일정표 · {new Date().toLocaleDateString('ko-KR')}</span>
        </footer>
      </div>
    </div>
  );
}

function PrintDay({
  day,
  index,
  trip,
  enabled,
  withFood,
  onTotals,
}: {
  day: Day;
  index: number;
  trip: Trip;
  enabled: boolean;
  withFood: boolean;
  onTotals: (t: { transit: number; spend: number }) => void;
}) {
  const { legs } = useLegs(day, trip.currency, enabled);
  const [food, setFood] = useState<Restaurant[]>([]);

  const transit = legs.reduce((n, l) => n + (l?.fare ?? 0), 0);
  const spend = day.items.reduce((n, i) => n + i.cost, 0);

  useEffect(() => {
    onTotals({ transit, spend });
  }, [transit, spend, onTotals]);

  useEffect(() => {
    if (!withFood) {
      setFood([]);
      return;
    }
    const anchor = day.items.find((i) => i.category === 'food' && i.place.coord) ?? day.items.find((i) => i.place.coord);
    if (!anchor?.place.coord) return;
    let cancelled = false;
    nearbyRestaurants(anchor.place.coord, 1200).then((r) => {
      if (!cancelled) setFood(r.sort((a, b) => b.localScore - a.localScore).slice(0, 4));
    });
    return () => {
      cancelled = true;
    };
  }, [withFood, day.items]);

  return (
    <section className="paper__day">
      <h2>
        <span className="paper__daynum">Day {index + 1}</span>
        {formatDateKo(day.date)}
        {day.title && <em> · {day.title}</em>}
      </h2>

      <table className="paper__table">
        <thead>
          <tr>
            <th style={{ width: '16%' }}>시간</th>
            <th>일정</th>
            <th style={{ width: '11%' }}>분류</th>
            <th style={{ width: '14%' }}>체류</th>
            <th style={{ width: '17%' }}>비용</th>
          </tr>
        </thead>
        <tbody>
          {day.items.map((item, i) => {
            const leg = legs[i];
            const next = day.items[i + 1];
            return (
              <Fragment key={item.id}>
                <tr>
                  <td className="mono">
                    {item.startTime}–{addMinutes(item.startTime, item.durationMin)}
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    {item.place.address && <span className="paper__addr">{item.place.address}</span>}
                    {item.notes && <span className="paper__memo">{item.notes}</span>}
                  </td>
                  <td>{CATEGORY[item.category].label}</td>
                  <td className="mono">{formatDuration(item.durationMin)}</td>
                  <td className="mono">{item.cost > 0 ? formatMoney(item.cost, trip.currency) : '—'}</td>
                </tr>
                {leg && next && (
                  <tr className="paper__legrow">
                    <td />
                    <td colSpan={4}>
                      ↓ {MODE_LABEL[leg.mode]} {formatDuration(leg.durationMin)} · {(leg.distanceM / 1000).toFixed(1)}km ·{' '}
                      {leg.fare > 0 ? formatMoney(leg.fare, trip.currency) : '무료'}
                      {leg.summary ? ` · ${leg.summary}` : ''}
                      {leg.source === 'estimate' ? ' (추정)' : ''}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {day.items.length === 0 && (
            <tr>
              <td colSpan={5} className="paper__empty">일정 없음</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>Day {index + 1} 합계 (1인)</th>
            <td className="mono">
              {formatMoney(transit + spend, trip.currency)}
              <span className="paper__krw"> ({formatKRW((transit + spend) * trip.rateToKRW)})</span>
            </td>
          </tr>
        </tfoot>
      </table>

      {withFood && food.length > 0 && (
        <div className="paper__food">
          <h3>이 날 동선 주변 추천</h3>
          <ul>
            {food.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong>
                <span> · {r.genre}</span>
                {r.rating > 0 && <span> · ★{r.rating.toFixed(1)}</span>}
                <span> · 현지인 지수 {r.localScore}</span>
                {r.note && <em> — {r.note}</em>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
