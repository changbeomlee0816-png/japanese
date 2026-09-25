import { useState } from 'react';
import type { Trip } from '../types';
import { actions } from '../store/tripStore';
import { useFxRate } from '../lib/fx';
import { currencySymbol, formatKRW, formatMoney } from '../lib/fares';
import { formatDateShort } from '../lib/time';
import { Icon } from './Icon';

/** 일본 소비세 — 매장 가격은 대부분 세금 포함(稅込) 표시 */
const JP_TAX = 0.1;
/** 면세 최소 금액 (한 매장·하루, 세금 제외 가격) */
const JP_TAX_FREE_MIN = 5000;

/**
 * 실시간 환율과 계산기.
 * 이 여행에 쓰는 환율(trip.rateToKRW)이 오늘 환율과 다르면 맞출 수 있게 한다.
 */
export function FxCard({ trip, readOnly }: { trip: Trip; readOnly: boolean }) {
  const { fx, loading, error, refresh } = useFxRate(trip.currency);
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState('1000');
  const [krw, setKrw] = useState('');
  const [taxIncluded, setTaxIncluded] = useState(true);

  if (trip.currency === 'KRW') return null;

  const rate = fx?.rate ?? trip.rateToKRW;
  const drift = fx ? Math.abs(fx.rate - trip.rateToKRW) / fx.rate : 0;
  const sym = currencySymbol(trip.currency);
  const isJapan = trip.currency === 'JPY';

  const localNum = Number(local.replace(/,/g, '')) || 0;
  const pre = taxIncluded ? localNum / (1 + JP_TAX) : localNum;
  const tax = pre * JP_TAX;

  return (
    <div className="section">
      <div className="card fx-card">
        <div className="fx-card__head">
          <div>
            <span className="muted tiny">실시간 환율{fx?.date ? ` · ${formatDateShort(fx.date)} 기준` : ''}</span>
            <strong className="fx-card__rate mono">
              {trip.currency === 'JPY' ? '100' : '1'}{sym.trim()} = {formatKRW(rate * (trip.currency === 'JPY' ? 100 : 1))}
            </strong>
          </div>
          <button type="button" className="icon-btn" onClick={refresh} disabled={loading} aria-label="환율 새로 받기">
            {loading ? <span className="spinner" /> : <Icon name="clock" size={18} strokeWidth={2} />}
          </button>
          <button type="button" className="btn btn--gray btn--sm" onClick={() => setOpen((v) => !v)}>
            {open ? '닫기' : '계산기'}
          </button>
        </div>

        {error && !fx && <p className="muted tiny" style={{ marginTop: 6 }}>환율을 받지 못해 이 여행에 적어 둔 환율을 씁니다.</p>}

        {fx && drift > 0.01 && !readOnly && (
          <div className="fx-card__drift">
            <span className="small">
              이 여행은 {formatKRW(trip.rateToKRW * (isJapan ? 100 : 1))} 로 계산 중입니다 ({Math.round(drift * 100)}% 차이).
            </span>
            <button type="button" className="btn btn--tinted btn--sm" onClick={() => actions.updateTrip({ rateToKRW: Number(fx.rate.toFixed(4)), rateDate: fx.date })}>
              오늘 환율로 맞추기
            </button>
          </div>
        )}

        {open && (
          <div className="fx-calc">
            <label className="fx-calc__row">
              <span className="fx-calc__cur">{trip.currency}</span>
              <input
                className="fx-calc__input mono"
                inputMode="decimal"
                value={local}
                onChange={(e) => { setLocal(e.target.value); setKrw(''); }}
              />
            </label>
            <label className="fx-calc__row">
              <span className="fx-calc__cur">KRW</span>
              <input
                className="fx-calc__input mono"
                inputMode="decimal"
                value={krw || (localNum ? Math.round(localNum * rate).toLocaleString('ko-KR') : '')}
                onChange={(e) => {
                  setKrw(e.target.value);
                  const won = Number(e.target.value.replace(/,/g, '')) || 0;
                  setLocal(won ? String(Math.round(won / rate)) : '');
                }}
              />
            </label>
            <div className="fx-calc__chips">
              {(isJapan ? [500, 1000, 3000, 5000, 10000] : [1, 10, 50, 100]).map((v) => (
                <button key={v} type="button" className="taste-chip" onClick={() => { setLocal(String(v)); setKrw(''); }}>
                  {sym.trim()}{v.toLocaleString()}
                </button>
              ))}
            </div>

            {isJapan && localNum > 0 && (
              <div className="fx-tax">
                <label className="fx-tax__toggle">
                  <input type="checkbox" checked={taxIncluded} onChange={(e) => setTaxIncluded(e.target.checked)} />
                  <span className="small">가격표가 세금 포함(稅込)</span>
                </label>
                <div className="fx-tax__rows small">
                  <span>세금 제외</span><b className="mono">{formatMoney(Math.round(pre), 'JPY')}</b>
                  <span>소비세 10%</span><b className="mono">{formatMoney(Math.round(tax), 'JPY')} · {formatKRW(tax * rate)}</b>
                  <span>면세 기준</span>
                  <b>{pre >= JP_TAX_FREE_MIN ? '✓ 5,000엔 이상 — 면세 대상' : `${formatMoney(Math.ceil(JP_TAX_FREE_MIN - pre), 'JPY')} 더 사면 면세`}</b>
                </div>
                <p className="muted tiny" style={{ lineHeight: 1.55, marginTop: 6 }}>
                  한 매장에서 같은 날 세금 제외 5,000엔 이상 사면 소비세를 면제받을 수 있습니다(여권 필요).
                  음식 포장 등은 8%가 적용되기도 합니다. 2026년 11월부터는 계산할 때 세금을 내고 출국할 때 돌려받는
                  방식으로 바뀔 예정이니 매장 안내를 확인하세요.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
