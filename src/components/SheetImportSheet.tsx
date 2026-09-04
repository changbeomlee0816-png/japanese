import { useRef, useState } from 'react';
import type { LatLng, Trip } from '../types';
import { actions } from '../store/tripStore';
import { buildXlsx, readSpreadsheet } from '../lib/xlsx';
import { SHEET_HEADERS, SHEET_SAMPLE_ROWS, importSheetRows } from '../lib/importSheet';
import { resolveMissingPlaces, type ResolveProgress } from '../lib/resolve';
import { saveFile } from '../lib/share';
import { addMinutes, formatDateShort, formatDuration } from '../lib/time';
import { transportLabel } from '../lib/transport';
import { CATEGORY } from '../lib/category';
import { Sheet, Segmented } from './ui';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  trip: Trip;
  bias?: LatLng;
  onClose: () => void;
  onImported?: (firstDate: string) => void;
}

/**
 * 엑셀로 일정 넣기.
 *
 * 여러 날짜를 한 번에 옮겨 적을 때는 표가 편하다.
 * 양식을 내려받아 채운 뒤 그대로 올리면 된다. 엑셀에서 CSV로 저장해도 읽는다.
 */
export function SheetImportSheet({ open, trip, bias, onClose, onImported }: Props) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ResolveProgress | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = rows ? importSheetRows(rows, trip.days[0]?.date) : null;

  const reset = () => {
    setRows(null);
    setFileName('');
    setError(null);
    setProgress(null);
  };

  const downloadTemplate = async () => {
    const content = [[...SHEET_HEADERS], ...SHEET_SAMPLE_ROWS];
    const blob = buildXlsx(content, '일정');
    const result = await saveFile(`${trip.title} 일정 양식.xlsx`, blob);
    if (result === 'unavailable') setError('이 화면에서는 파일을 내려받을 수 없습니다.');
  };

  const pickFile = async (file: File) => {
    setError(null);
    try {
      const parsed = await readSpreadsheet(file);
      if (parsed.length === 0) {
        setError('빈 파일입니다.');
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      console.warn('[sheet] 읽기 실패', e);
      setError('엑셀 파일을 읽지 못했습니다. 양식을 내려받아 그대로 채운 뒤 다시 올려주세요.');
    }
  };

  const run = async () => {
    if (!rows || !preview || preview.itemCount === 0) return;
    setBusy(true);
    const result = actions.importSheet(rows, mode);

    // 주소·장소명으로 좌표를 찾아야 경로와 비용이 계산된다
    const latest = JSON.parse(actions.exportState()) as { trips: Trip[] };
    const updated = latest.trips.find((t) => t.id === trip.id) ?? trip;
    await resolveMissingPlaces(updated, bias, setProgress);
    actions.completeTransportEstimates();

    setBusy(false);
    if (result.days[0]) onImported?.(result.days[0].date);
    reset();
    onClose();
  };

  return (
    <Sheet
      open={open}
      title="엑셀로 가져오기"
      onClose={busy ? () => {} : () => { reset(); onClose(); }}
      confirmLabel={busy ? '처리 중…' : '가져오기'}
      onConfirm={run}
      confirmDisabled={busy || !preview || preview.itemCount === 0}
    >
      <div className="section">
        <div className="section__header"><span className="section__title">1. 양식 받기</span></div>
        <button type="button" className="btn btn--tinted btn--block" onClick={() => void downloadTemplate()}>
          <Icon name="share" size={16} strokeWidth={2} /> 엑셀 양식 내려받기
        </button>
        <div className="sheet-spec">
          <div className="sheet-spec__row sheet-spec__row--head">
            {SHEET_HEADERS.map((h) => <span key={h}>{h}</span>)}
          </div>
          <div className="sheet-spec__row">
            <span>9/12</span><span>07:10~09:05</span><span>인천에서 오사카로</span>
            <span>인천국제공항 → 간사이 국제공항 비행기</span><span />
          </div>
          <div className="sheet-spec__row">
            <span /><span>11:00-12:30</span><span>점심 먹고 간판 구경</span>
            <span>도톤보리</span><span>오사카시 주오구 도톤보리</span>
          </div>
        </div>
        <p className="sheet-spec__hint">다섯 칸입니다 — 좁은 화면에서는 표를 옆으로 밀면 주소 칸이 나옵니다.</p>
        <ul className="paste-help" style={{ paddingLeft: 16, marginTop: 10 }}>
          <li><b>날짜</b>를 비우면 위 행과 같은 날로 봅니다.</li>
          <li><b>시간대</b>를 <code>07:10~09:05</code> 로 적으면 그 사이가 머무는 시간입니다. <code>10:00</code> 만 적어도 됩니다.</li>
          <li><b>장소명</b>에 <code>A → B</code> 와 <code>비행기</code> 같은 말을 쓰면 이동으로 읽어 두 곳을 방문지로 세웁니다.</li>
          <li><b>주소</b>를 적으면 위치를 훨씬 정확히 찾습니다. 비워도 됩니다.</li>
          <li>내용에 <code>600엔</code> 처럼 쓰면 비용으로 잡습니다.</li>
        </ul>
      </div>

      <div className="section">
        <div className="section__header"><span className="section__title">2. 채운 파일 올리기</span></div>
        <button
          type="button"
          className={`btn btn--block ${rows ? 'btn--gray' : 'btn--primary'}`}
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Icon name="copy" size={16} strokeWidth={2} />
          {fileName ? `${fileName} — 다시 고르기` : '엑셀 파일 선택 (.xlsx · .csv)'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickFile(f);
            e.target.value = '';
          }}
        />
        {error && <p className="small" style={{ color: 'var(--red)', padding: '10px 4px 0' }}>{error}</p>}
      </div>

      {preview && (
        <>
          <div className="section">
            <div className="section__header"><span className="section__title">추가 방식</span></div>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'append', label: '기존 일정에 더하기' },
                { value: 'replace', label: '전체 교체' },
              ]}
            />
          </div>

          <div className="section">
            <div className="section__header">
              <span className="section__title">미리보기</span>
              <span className="muted small">{preview.days.length}일 · {preview.itemCount}개 일정</span>
            </div>
            <div className="list">
              {preview.days.map((d) => (
                <div key={d.id} className="preview-day">
                  <div className="preview-day__head">{formatDateShort(d.date)}</div>
                  {d.items.map((it) => (
                    <div key={it.id}>
                      <div className="preview-item">
                        <span className="mono muted small">
                          {it.startTime}
                          {it.durationMin > 0 && `–${addMinutes(it.startTime, it.durationMin)}`}
                        </span>
                        <span className="preview-item__title">{it.title}</span>
                        <span className="badge" style={{ color: CATEGORY[it.category].color }}>
                          {CATEGORY[it.category].label}
                        </span>
                      </div>
                      {it.transportToNext && (
                        <div className="preview-item preview-item--link">
                          <span className="mono muted small" />
                          <span className="preview-item__title muted small">
                            ↓ {transportLabel(it.transportToNext.mode)}{' '}
                            {it.transportToNext.durationMin > 0
                              ? formatDuration(it.transportToNext.durationMin)
                              : '소요시간 자동 계산'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {preview.warnings.length > 0 && (
              <div className="notice notice--warn" style={{ marginTop: 10 }}>
                <Icon name="warning" size={17} strokeWidth={2} color="var(--orange)" />
                <span className="small">{preview.warnings.slice(0, 3).join(' / ')}</span>
              </div>
            )}
          </div>
        </>
      )}

      {busy && (
        <div className="section">
          <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="spinner" />
            <div>
              <div style={{ fontSize: 15 }}>
                {progress ? `장소 찾는 중 ${progress.done}/${progress.total}` : '일정 정리 중…'}
              </div>
              {progress?.currentTitle && <div className="muted small">{progress.currentTitle}</div>}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
