import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { holdPublishing } from '../lib/share';

/* ── 시트 (아래에서 올라오는 모달) ────────────────────── */

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 오른쪽 상단 확인 버튼 */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
}

export function Sheet({ open, title, onClose, children, confirmLabel, onConfirm, confirmDisabled }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // 편집 도중에 공유본이 발행되면 화면이 새로고침되므로 시트가 닫힐 때까지 미룬다
    const release = holdPublishing();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      release();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grabber" />
        <div className="sheet__header">
          <button className="navbar__action" onClick={onClose} type="button">
            취소
          </button>
          <div className="sheet__title">{title}</div>
          {onConfirm ? (
            <button
              className="navbar__action navbar__action--right"
              onClick={onConfirm}
              disabled={confirmDisabled}
              style={{ fontWeight: 600, opacity: confirmDisabled ? 0.35 : 1 }}
              type="button"
            >
              {confirmLabel ?? '완료'}
            </button>
          ) : (
            <span style={{ minWidth: 64 }} />
          )}
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}

/* ── 세그먼티드 컨트롤 ───────────────────────────────── */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`segmented__item${o.value === value ? ' segmented__item--active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── 토글 스위치 ─────────────────────────────────────── */

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' switch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__knob" />
    </button>
  );
}

/* ── 스테퍼 ──────────────────────────────────────────── */

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} aria-label="줄이기">
        −
      </button>
      <span />
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} aria-label="늘리기">
        +
      </button>
    </div>
  );
}

/* ── 목록 행 ─────────────────────────────────────────── */

export function Row({
  label,
  value,
  onClick,
  icon,
  danger,
  accent,
  children,
}: {
  label: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  danger?: boolean;
  accent?: boolean;
  children?: ReactNode;
}) {
  const cls = [
    'row',
    onClick ? 'row--tappable' : '',
    danger ? 'row--danger' : '',
    accent ? 'row--button' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {icon && <Icon name={icon} size={20} />}
      <span className="row__label">{label}</span>
      {value !== undefined && <span className="row__value">{value}</span>}
      {children}
      {onClick && !children && <Icon name="chevronRight" size={16} className="chevron" strokeWidth={2.2} />}
    </>
  );

  return onClick ? (
    <button className={cls} type="button" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

/* ── 빈 상태 ─────────────────────────────────────────── */

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} strokeWidth={1.3} color="var(--label-3)" />
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

/* ── 스크롤 감지 (네비게이션 바 구분선용) ────────────── */

export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}
