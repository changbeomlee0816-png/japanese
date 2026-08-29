import { flush, useShare } from '../lib/share';
import { Icon } from './Icon';

/** 네비게이션 바에 들어가는 공유 저장 상태 표시 */
export function SaveChip() {
  const share = useShare();
  if (share.mode !== 'shared') return null;

  if (share.status === 'saving') {
    return (
      <span className="savechip" aria-live="polite">
        <span className="spinner" /> 저장 중
      </span>
    );
  }
  if (share.status === 'dirty') {
    return (
      <button type="button" className="savechip savechip--dirty" onClick={() => void flush()}>
        <Icon name="share" size={13} strokeWidth={2.2} /> 공유본에 저장
      </button>
    );
  }
  if (share.status === 'error') {
    return (
      <button type="button" className="savechip savechip--error" onClick={() => void flush()}>
        <Icon name="warning" size={13} strokeWidth={2.2} /> 다시 저장
      </button>
    );
  }
  return (
    <span className="savechip savechip--ok">
      <Icon name="check" size={13} strokeWidth={2.8} /> 저장됨
    </span>
  );
}

/** 화면 위쪽에 한 번 뜨는 공유 상태 안내 */
export function ShareNotice() {
  const share = useShare();

  if (share.mode === 'readonly') {
    return (
      <div className="section">
        <div className="notice">
          <Icon name="info" size={17} strokeWidth={2} color="var(--label-2)" />
          <span className="small">
            <strong>보기 전용</strong> — 이 링크를 만든 사람이 일정을 바꾸면 여기에도 그대로 반영됩니다.
            여기서 고친 내용은 공유본에 저장되지 않고, 새로고침하면 원래 일정으로 돌아옵니다.
            지도·맛집·PDF 내보내기는 그대로 쓸 수 있습니다.
          </span>
        </div>
      </div>
    );
  }

  if (share.mode === 'shared' && share.error) {
    return (
      <div className="section">
        <div className="notice notice--warn">
          <Icon name="warning" size={17} strokeWidth={2} color="var(--orange)" />
          <span className="small">{share.error}</span>
          <button type="button" className="btn btn--gray btn--sm" onClick={() => void flush()}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return null;
}
