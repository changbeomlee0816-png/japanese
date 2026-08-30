import { flush as flushArtifact, useShare } from '../lib/share';
import { flush as flushCloud, pull, useCloud } from '../lib/cloud';
import { Icon } from './Icon';

/** 네비게이션 바에 들어가는 저장 상태 표시 */
export function SaveChip() {
  const cloud = useCloud();
  const share = useShare();

  // 공유 링크(Supabase)로 열린 경우가 우선이다
  if (cloud.mode !== 'off') {
    if (cloud.status === 'saving' || cloud.status === 'loading') {
      return (
        <span className="savechip" aria-live="polite">
          <span className="spinner" /> {cloud.status === 'saving' ? '저장 중' : '불러오는 중'}
        </span>
      );
    }
    if (cloud.status === 'error') {
      return (
        <button type="button" className="savechip savechip--error" onClick={() => void flushCloud()}>
          <Icon name="warning" size={13} strokeWidth={2.2} /> 다시 저장
        </button>
      );
    }
    if (cloud.status === 'dirty') {
      return (
        <button type="button" className="savechip savechip--dirty" onClick={() => void flushCloud()}>
          <Icon name="share" size={13} strokeWidth={2.2} /> 저장하기
        </button>
      );
    }
    if (cloud.remoteUpdate) {
      return (
        <button type="button" className="savechip savechip--dirty" onClick={() => void pull()}>
          <Icon name="info" size={13} strokeWidth={2.2} /> 새 변경 있음
        </button>
      );
    }
    return (
      <span className="savechip savechip--ok">
        <Icon name="check" size={13} strokeWidth={2.8} />
        {cloud.mode === 'viewer' ? '실시간' : '저장됨'}
      </span>
    );
  }

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
      <button type="button" className="savechip savechip--dirty" onClick={() => void flushArtifact()}>
        <Icon name="share" size={13} strokeWidth={2.2} /> 공유본에 저장
      </button>
    );
  }
  if (share.status === 'error') {
    return (
      <button type="button" className="savechip savechip--error" onClick={() => void flushArtifact()}>
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

/** 화면 위쪽 안내 */
export function ShareNotice() {
  const cloud = useCloud();
  const share = useShare();

  if (cloud.mode === 'viewer' && !cloud.error) {
    return (
      <div className="section">
        <div className="notice">
          <Icon name="info" size={17} strokeWidth={2} color="var(--label-2)" />
          <span className="small">
            <strong>공유받은 일정</strong> — 일정이 바뀌면 이 화면에도 자동으로 반영됩니다.
            지도·맛집·PDF는 그대로 쓸 수 있고, 여기서 고친 내용은 저장되지 않습니다.
          </span>
        </div>
      </div>
    );
  }

  if (cloud.error) {
    return (
      <div className="section">
        <div className="notice notice--warn">
          <Icon name="warning" size={17} strokeWidth={2} color="var(--orange)" />
          <span className="small">{cloud.error}</span>
          <button type="button" className="btn btn--gray btn--sm" onClick={() => void flushCloud()}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (cloud.mode === 'owner' && cloud.remoteUpdate) {
    return (
      <div className="section">
        <div className="notice">
          <Icon name="info" size={17} strokeWidth={2} color="var(--blue)" />
          <span className="small">다른 기기에서 이 일정을 수정했습니다.</span>
          <button type="button" className="btn btn--tinted btn--sm" onClick={() => void pull()}>
            최신본 불러오기
          </button>
        </div>
      </div>
    );
  }

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
          <button type="button" className="btn btn--gray btn--sm" onClick={() => void flushArtifact()}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return null;
}
