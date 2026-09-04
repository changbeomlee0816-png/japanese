import { useEffect, useState } from 'react';
import type { Category, Day, Item, LatLng, PlaceRef, Trip } from '../types';
import { CATEGORY, CATEGORY_ORDER } from '../lib/category';
import { actions } from '../store/tripStore';
import { currencySymbol } from '../lib/fares';
import { addMinutes, formatDateShort, toMinutes } from '../lib/time';
import { defaultDuration } from '../lib/parsePlan';
import { Sheet, Row, Switch } from './ui';
import { PlaceSearch } from './PlaceSearch';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  trip: Trip;
  day: Day;
  /** 없으면 새 항목 추가 모드 */
  item: Item | null;
  bias?: LatLng;
  onClose: () => void;
  /** 열자마자 장소 검색부터 띄울지 */
  focusPlace?: boolean;
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

export function ItemEditSheet({ open, trip, day, item, bias, onClose, focusPlace }: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('sight');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMin, setDurationMin] = useState(60);
  const [cost, setCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [place, setPlace] = useState<PlaceRef | null>(null);
  const [pinned, setPinned] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? '');
    setCategory(item?.category ?? 'sight');
    setStartTime(item?.startTime ?? nextSlot(day));
    setDurationMin(item?.durationMin ?? 60);
    setCost(item?.cost ?? 0);
    setNotes(item?.notes ?? '');
    setPlace(item?.place ?? null);
    setPinned(!!item?.pinned);
    setSearching(!!focusPlace || (!item && true));
  }, [open, item, day, focusPlace]);

  const canSave = title.trim().length > 0;

  const save = () => {
    const payload = {
      title: title.trim(),
      category,
      startTime,
      durationMin,
      cost,
      notes: notes.trim() || undefined,
      pinned,
      place: place ?? { name: title.trim() },
    };
    if (item) actions.updateItem(day.id, item.id, payload);
    else actions.addItem(day.id, payload);
    onClose();
  };

  return (
    <Sheet
      open={open}
      title={item ? '일정 수정' : '일정 추가'}
      onClose={onClose}
      confirmLabel={item ? '저장' : '추가'}
      onConfirm={save}
      confirmDisabled={!canSave}
    >
      {searching ? (
        <div className="section">
          <PlaceSearch
            initialQuery={title}
            bias={bias}
            autoFocus
            onPick={(p) => {
              setPlace(p);
              if (!title.trim() || !item) setTitle(p.name);
              setSearching(false);
            }}
          />
          <button
            type="button"
            className="btn btn--gray btn--block"
            style={{ marginTop: 16 }}
            onClick={() => setSearching(false)}
          >
            검색 없이 직접 입력
          </button>
        </div>
      ) : (
        <>
          <div className="section">
            <div className="list">
              <div className="field">
                <span className="field__label">이름</span>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 아사쿠사 센소지"
                />
              </div>
              <button type="button" className="field" onClick={() => setSearching(true)} style={{ width: '100%', textAlign: 'left' }}>
                <span className="field__label">장소</span>
                <span className="input" style={{ color: place?.coord ? 'var(--label)' : 'var(--label-3)' }}>
                  {place?.coord ? place.address || place.name : '위치를 검색해 주세요'}
                </span>
                <Icon name={place?.coord ? 'pin' : 'search'} size={17} strokeWidth={2} color="var(--blue)" />
              </button>
            </div>
          </div>

          <div className="section">
            <div className="section__header"><span className="section__title">분류</span></div>
            <div className="cat-grid">
              {CATEGORY_ORDER.map((c) => {
                const meta = CATEGORY[c];
                const active = c === category;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`cat-chip${active ? ' cat-chip--active' : ''}`}
                    style={{ '--cat': meta.color } as React.CSSProperties}
                    onClick={() => {
                      setCategory(c);
                      if (!item) setDurationMin(defaultDuration(c));
                    }}
                  >
                    <Icon name={meta.icon} size={17} strokeWidth={2} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="section">
            <div className="list">
              <div className="field">
                <span className="field__label">시작</span>
                <input
                  className="input"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div className="field">
                <span className="field__label">종료</span>
                <input
                  className="input"
                  type="time"
                  value={addMinutes(startTime, durationMin)}
                  onChange={(e) => {
                    // 종료 시각을 고치면 그 사이가 머무는 시간이 된다 (자정을 넘기면 다음 날로)
                    const span = (toMinutes(e.target.value) - toMinutes(startTime) + 1440) % 1440;
                    setDurationMin(span > 0 ? span : 0);
                  }}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div className="field">
                <span className="field__label">머무는 시간</span>
                <select
                  className="select"
                  value={DURATIONS.includes(durationMin) ? durationMin : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') setDurationMin(Number(e.target.value));
                  }}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d >= 60 ? `${d / 60}시간${d % 60 ? ` ${d % 60}분` : ''}` : `${d}분`}
                    </option>
                  ))}
                  {!DURATIONS.includes(durationMin) && (
                    <option value="custom">
                      {durationMin >= 60
                        ? `${Math.floor(durationMin / 60)}시간${durationMin % 60 ? ` ${durationMin % 60}분` : ''}`
                        : `${durationMin}분`}
                    </option>
                  )}
                </select>
              </div>
              <div className="field">
                <span className="field__label">시각 고정</span>
                <span className="input muted small" style={{ textAlign: 'left' }}>
                  예약이 있어 순서를 바꾸면 안 될 때
                </span>
                <Switch checked={pinned} onChange={setPinned} label="시각 고정" />
              </div>
              <div className="field">
                <span className="field__label">예상 비용</span>
                <span className="muted">{currencySymbol(trip.currency)}</span>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={cost || ''}
                  placeholder="0"
                  onChange={(e) => setCost(Number(e.target.value) || 0)}
                  style={{ textAlign: 'right' }}
                />
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section__header"><span className="section__title">메모</span></div>
            <div className="input-box">
              <textarea
                className="textarea"
                style={{ minHeight: 80, fontFamily: 'inherit', fontSize: 15 }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예약 번호, 준비물, 팁 등"
              />
            </div>
          </div>

          {item && (
            <div className="section">
              <div className="list">
                <Row label="다른 날짜로 옮기기" />
                <div className="field">
                  <select
                    className="select"
                    style={{ textAlign: 'left', width: '100%' }}
                    value={day.id}
                    onChange={(e) => {
                      if (e.target.value !== day.id) {
                        actions.moveItemToDay(day.id, item.id, e.target.value);
                        onClose();
                      }
                    }}
                  >
                    {trip.days.map((d, i) => (
                      <option key={d.id} value={d.id}>
                        Day {i + 1} · {formatDateShort(d.date)}
                      </option>
                    ))}
                  </select>
                </div>
                <Row
                  label="복제"
                  accent
                  onClick={() => {
                    actions.duplicateItem(day.id, item.id);
                    onClose();
                  }}
                />
                <Row
                  label="삭제"
                  danger
                  onClick={() => {
                    actions.removeItem(day.id, item.id);
                    onClose();
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

/** 새 항목의 기본 시각 — 마지막 일정 뒤 30분 */
function nextSlot(day: Day): string {
  const last = day.items[day.items.length - 1];
  if (!last) return '09:00';
  const [h, m] = last.startTime.split(':').map(Number);
  const total = (h * 60 + m + last.durationMin + 30) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
