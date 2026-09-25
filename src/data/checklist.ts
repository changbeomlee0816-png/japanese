/**
 * 여행 준비 체크리스트 기본 목록 — 여행 앱들이 공통으로 챙기는 것.
 * japanOnly 는 일본 여행일 때만 넣는다.
 */

export interface ChecklistTemplateItem {
  text: string;
  group: string;
  note?: string;
  japanOnly?: boolean;
  abroadOnly?: boolean;
}

export const CHECKLIST_GROUPS = ['서류·예약', '돈', '통신·전자', '교통', '짐', '출발 전날'] as const;

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  { group: '서류·예약', text: '여권 유효기간 확인' },
  { group: '서류·예약', text: '항공권 e티켓 · 출발 시각 확인' },
  { group: '서류·예약', text: '숙소 예약 확인서' },
  { group: '서류·예약', text: '여행자 보험' },
  { group: '서류·예약', text: 'Visit Japan Web 등록', note: '입국심사·세관 신고를 미리 해 두고 QR 코드를 받는다', japanOnly: true },

  { group: '돈', text: '엔화 환전', note: '현금만 받는 가게·동전 쓰는 곳이 아직 많다', japanOnly: true },
  { group: '돈', text: '현지 통화 환전', abroadOnly: true },
  { group: '돈', text: '트래블카드 충전', note: '트래블월렛·트래블로그 등', abroadOnly: true },
  { group: '돈', text: '해외 결제 되는 신용카드', abroadOnly: true },
  { group: '돈', text: '동전 지갑', japanOnly: true },

  { group: '통신·전자', text: 'eSIM · 유심 · 포켓와이파이', abroadOnly: true },
  { group: '통신·전자', text: '돼지코 어댑터', note: '일본은 11자(A타입) 콘센트 · 100V. 대부분의 휴대폰 충전기는 프리볼트', japanOnly: true },
  { group: '통신·전자', text: '보조배터리', note: '위탁 수하물에 넣을 수 없다 — 기내에 들고 탄다' },
  { group: '통신·전자', text: '충전기 · 케이블' },

  { group: '교통', text: '교통카드 (Suica · ICOCA)', note: '아이폰은 지갑 앱에 바로 추가할 수 있다', japanOnly: true },
  { group: '교통', text: '교통 패스가 필요한지 확인' },
  { group: '교통', text: '공항 ↔ 숙소 이동편' },

  { group: '짐', text: '편한 신발', note: '하루 2만 보 넘게 걷기 쉽다' },
  { group: '짐', text: '우산 · 우비' },
  { group: '짐', text: '상비약', note: '소화제 · 진통제 · 밴드' },
  { group: '짐', text: '세면도구' },
  { group: '짐', text: '장바구니 · 에코백', note: '편의점·마트 봉투가 유료', japanOnly: true },

  { group: '출발 전날', text: '온라인 체크인' },
  { group: '출발 전날', text: '위탁 수하물 무게 확인' },
  { group: '출발 전날', text: '공항 가는 교통편 · 출발 시각 확인' },
];

export function templateFor(country: string | undefined): ChecklistTemplateItem[] {
  const japan = country === '일본';
  const abroad = country !== '한국';
  return CHECKLIST_TEMPLATE.filter((t) => (!t.japanOnly || japan) && (!t.abroadOnly || abroad) && !(japan && t.text === '현지 통화 환전'));
}
