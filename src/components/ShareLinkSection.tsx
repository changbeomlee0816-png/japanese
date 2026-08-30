import { useState } from 'react';
import type { Trip } from '../types';
import { detach, editLink, publishTrip, useCloud, viewLink } from '../lib/cloud';
import { cloudConfigured } from '../lib/supabase';
import { Row } from './ui';
import { Icon } from './Icon';

/** 설정 탭의 "공유 링크" 영역 */
export function ShareLinkSection({ trip }: { trip: Trip }) {
  const cloud = useCloud();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showEditLink, setShowEditLink] = useState(false);

  if (!cloudConfigured()) return null;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 클립보드를 못 쓰는 환경에서는 사용자가 직접 복사하도록 주소를 띄워 둔다
      window.prompt('아래 주소를 복사하세요', text);
    }
    setCopied(label);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const create = async () => {
    setBusy(true);
    try {
      await publishTrip(trip.title, [trip]);
    } catch {
      /* 오류는 상단 안내로 표시된다 */
    } finally {
      setBusy(false);
    }
  };

  if (cloud.mode === 'off') {
    return (
      <div className="section">
        <div className="section__header"><span className="section__title">공유 링크</span></div>
        <div className="list">
          <Row
            label={busy ? '만드는 중…' : '공유 링크 만들기'}
            icon="share"
            accent
            onClick={busy ? undefined : () => void create()}
          />
        </div>
        {cloud.error && (
          <p className="small" style={{ padding: '10px 4px 0', color: 'var(--red)' }}>
            {cloud.error}
          </p>
        )}
        <p className="muted tiny" style={{ padding: '10px 4px 0', lineHeight: 1.6 }}>
          현재 여행(<strong>{trip.title}</strong>)의 링크를 만듭니다. 링크를 받은 사람은 계정 없이
          바로 열어볼 수 있고, 회장님이 일정을 고치면 그 화면에도 자동으로 반영됩니다.
          수정 권한은 이 브라우저에만 남습니다.
        </p>
      </div>
    );
  }

  const isOwner = cloud.mode === 'owner';

  return (
    <div className="section">
      <div className="section__header">
        <span className="section__title">공유 링크</span>
        <span className={`badge ${isOwner ? 'badge--green' : 'badge--blue'}`}>
          {isOwner ? '수정 가능' : '보기 전용'}
        </span>
      </div>

      <div className="linkbox">
        <span className="linkbox__label">보기 링크 · 누구에게나 공유해도 됩니다</span>
        <code className="linkbox__url">{viewLink()}</code>
        <div className="linkbox__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => void copy(viewLink(), 'view')}>
            <Icon name="copy" size={14} strokeWidth={2} /> {copied === 'view' ? '복사됨' : '링크 복사'}
          </button>
          <a className="btn btn--gray btn--sm" href={viewLink()} target="_blank" rel="noreferrer">
            새 창에서 열기
          </a>
        </div>
      </div>

      {isOwner && (
        <div className="linkbox linkbox--danger">
          <span className="linkbox__label">
            <Icon name="warning" size={13} strokeWidth={2.2} /> 수정 링크 · 다른 기기에서 편집할 때만
          </span>
          {showEditLink ? (
            <>
              <code className="linkbox__url">{editLink()}</code>
              <div className="linkbox__actions">
                <button type="button" className="btn btn--danger btn--sm" onClick={() => void copy(editLink(), 'edit')}>
                  <Icon name="copy" size={14} strokeWidth={2} /> {copied === 'edit' ? '복사됨' : '수정 링크 복사'}
                </button>
                <button type="button" className="btn btn--gray btn--sm" onClick={() => setShowEditLink(false)}>
                  숨기기
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn btn--gray btn--sm" onClick={() => setShowEditLink(true)}>
              수정 링크 보기
            </button>
          )}
          <p className="muted tiny" style={{ margin: 0 }}>
            이 링크를 받은 사람은 일정을 고칠 수 있습니다. 같이 짜는 사람에게만 보내세요.
          </p>
        </div>
      )}

      <div className="list" style={{ marginTop: 12 }}>
        {isOwner && (
          <Row
            label="이 브라우저에서 공유 해제"
            danger
            onClick={() => {
              if (confirm('이 브라우저에서만 연결을 끊습니다. 링크와 일정은 그대로 남습니다.')) detach();
            }}
          />
        )}
        {!isOwner && <Row label="이 링크에서 나가기" accent onClick={detach} />}
      </div>

      <p className="muted tiny" style={{ padding: '10px 4px 0', lineHeight: 1.6 }}>
        일정은 Supabase에 저장되고, 링크의 주소를 아는 사람만 열 수 있습니다.
        구글맵 API 키를 포함한 설정은 서버로 보내지 않고 각자 브라우저에만 남습니다.
      </p>
    </div>
  );
}
