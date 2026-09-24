/**
 * 여행 회화집 — 인터넷도 키도 없이 쓰는 문장들.
 *
 * reading 은 소리 나는 대로 적은 가나다. 조사 は·を·へ 는 わ·お·え 로 적어야
 * 한글 발음이 맞게 나온다 (こんにちは → こんにちわ → 콘니치와).
 */

export interface Phrase {
  ko: string;
  ja: string;
  reading: string;
  /** 찾기용 다른 말 */
  alt?: string[];
}

export interface PhraseCategory {
  id: string;
  label: string;
  phrases: Phrase[];
}

export const PHRASEBOOK: PhraseCategory[] = [
  {
    id: 'basic',
    label: '기본',
    phrases: [
      { ko: '안녕하세요 (낮)', ja: 'こんにちは', reading: 'こんにちわ', alt: ['안녕하세요', '안녕'] },
      { ko: '안녕하세요 (아침)', ja: 'おはようございます', reading: 'おはようございます', alt: ['좋은 아침'] },
      { ko: '안녕하세요 (저녁)', ja: 'こんばんは', reading: 'こんばんわ' },
      { ko: '감사합니다', ja: 'ありがとうございます', reading: 'ありがとうございます', alt: ['고맙습니다', '고마워요'] },
      { ko: '실례합니다 · 죄송합니다', ja: 'すみません', reading: 'すみません', alt: ['저기요', '죄송합니다', '미안합니다', '실례합니다'] },
      { ko: '괜찮아요', ja: '大丈夫です', reading: 'だいじょうぶです', alt: ['괜찮습니다'] },
      { ko: '네', ja: 'はい', reading: 'はい' },
      { ko: '아니요', ja: 'いいえ', reading: 'いいえ' },
      { ko: '잘 모르겠어요', ja: 'よくわかりません', reading: 'よく わかりません', alt: ['모르겠어요'] },
      { ko: '일본어를 못해요', ja: '日本語が話せません', reading: 'にほんごが はなせません', alt: ['일본어 못해요'] },
      { ko: '영어 할 줄 아세요?', ja: '英語は話せますか？', reading: 'えいごわ はなせますか？', alt: ['영어 가능해요?'] },
      { ko: '천천히 말해 주세요', ja: 'ゆっくり話してください', reading: 'ゆっくり はなして ください' },
      { ko: '한 번 더 말해 주세요', ja: 'もう一度お願いします', reading: 'もう いちど おねがいします', alt: ['다시 말해 주세요'] },
      { ko: '여기에 적어 주세요', ja: 'ここに書いてください', reading: 'ここに かいて ください', alt: ['써 주세요'] },
      { ko: '사진 찍어 주실 수 있나요?', ja: '写真を撮ってもらえますか？', reading: 'しゃしんお とって もらえますか？', alt: ['사진 부탁'] },
    ],
  },
  {
    id: 'food',
    label: '식당',
    phrases: [
      { ko: '두 명이에요', ja: '二人です', reading: 'ふたりです', alt: ['2명', '두명'] },
      { ko: '한 명이에요', ja: '一人です', reading: 'ひとりです', alt: ['1명', '혼자'] },
      { ko: '메뉴 주세요', ja: 'メニューをください', reading: 'めにゅーお ください', alt: ['메뉴판'] },
      { ko: '한국어 메뉴 있어요?', ja: '韓国語のメニューはありますか？', reading: 'かんこくごの めにゅーわ ありますか？' },
      { ko: '추천 메뉴는 뭐예요?', ja: 'おすすめは何ですか？', reading: 'おすすめわ なんですか？', alt: ['추천해 주세요', '뭐가 맛있어요'] },
      { ko: '이걸로 주세요', ja: 'これをください', reading: 'これお ください', alt: ['이거 주세요'] },
      { ko: '물 주세요', ja: 'お水をください', reading: 'おみずお ください', alt: ['물 좀 주세요'] },
      { ko: '계산해 주세요', ja: 'お会計をお願いします', reading: 'おかいけいお おねがいします', alt: ['계산', '영수증'] },
      { ko: '카드 되나요?', ja: 'カードは使えますか？', reading: 'かーどわ つかえますか？', alt: ['카드 결제', '카드로'] },
      { ko: '따로 계산할게요', ja: '別々でお願いします', reading: 'べつべつで おねがいします', alt: ['각자 계산'] },
      { ko: '맛있어요', ja: 'おいしいです', reading: 'おいしいです', alt: ['맛있다'] },
      { ko: '맵지 않게 해 주세요', ja: '辛くしないでください', reading: 'からく しないで ください', alt: ['안 맵게'] },
      { ko: '알레르기가 있어요', ja: 'アレルギーがあります', reading: 'あれるぎーが あります' },
      { ko: '새우 알레르기가 있어요', ja: 'えびアレルギーがあります', reading: 'えびあれるぎーが あります' },
      { ko: '고기를 빼 주세요', ja: 'お肉を抜いてください', reading: 'おにくお ぬいて ください', alt: ['고기 빼'] },
      { ko: '포장해 주세요', ja: '持ち帰りでお願いします', reading: 'もちかえりで おねがいします', alt: ['테이크아웃', '포장'] },
      { ko: '여기서 먹을게요', ja: '店内で食べます', reading: 'てんないで たべます', alt: ['먹고 갈게요'] },
      { ko: '얼마나 기다려야 해요?', ja: 'どのくらい待ちますか？', reading: 'どのくらい まちますか？', alt: ['대기'] },
      { ko: '금연석 있어요?', ja: '禁煙席はありますか？', reading: 'きんえんせきわ ありますか？' },
    ],
  },
  {
    id: 'shopping',
    label: '쇼핑',
    phrases: [
      { ko: '이거 얼마예요?', ja: 'これはいくらですか？', reading: 'これわ いくらですか？', alt: ['얼마예요', '가격'] },
      { ko: '면세 되나요?', ja: '免税できますか？', reading: 'めんぜい できますか？', alt: ['택스프리', 'tax free'] },
      { ko: '입어 봐도 돼요?', ja: '試着してもいいですか？', reading: 'しちゃくしても いいですか？', alt: ['피팅룸'] },
      { ko: '다른 색 있어요?', ja: '他の色はありますか？', reading: 'ほかの いろわ ありますか？' },
      { ko: '더 큰 사이즈 있어요?', ja: 'もっと大きいサイズはありますか？', reading: 'もっと おおきい さいずわ ありますか？' },
      { ko: '봉투 필요 없어요', ja: '袋はいりません', reading: 'ふくろわ いりません', alt: ['봉투 괜찮아요'] },
      { ko: '봉투 주세요', ja: '袋をください', reading: 'ふくろお ください' },
      { ko: '선물용으로 포장해 주세요', ja: 'プレゼント用に包んでください', reading: 'ぷれぜんとように つつんで ください', alt: ['선물 포장'] },
      { ko: '그냥 둘러보는 거예요', ja: '見ているだけです', reading: 'みているだけです', alt: ['구경만'] },
      { ko: '이걸로 할게요', ja: 'これにします', reading: 'これに します' },
    ],
  },
  {
    id: 'transport',
    label: '교통',
    phrases: [
      { ko: '여기에 가고 싶어요 (지도를 보여 주며)', ja: 'ここに行きたいです', reading: 'ここに いきたいです', alt: ['가고 싶어요'] },
      { ko: '역은 어디예요?', ja: '駅はどこですか？', reading: 'えきわ どこですか？', alt: ['역 어디'] },
      { ko: '이 전철 신주쿠에 서나요?', ja: 'この電車は新宿に止まりますか？', reading: 'この でんしゃわ しんじゅくに とまりますか？', alt: ['이 전철 가나요'] },
      { ko: '몇 번 승강장이에요?', ja: '何番線ですか？', reading: 'なんばんせんですか？', alt: ['플랫폼', '타는 곳'] },
      { ko: '표는 어디서 사요?', ja: '切符はどこで買えますか？', reading: 'きっぷわ どこで かえますか？', alt: ['티켓', '표 사기'] },
      { ko: '택시 불러 주세요', ja: 'タクシーを呼んでください', reading: 'たくしーお よんで ください', alt: ['택시'] },
      { ko: '이 주소로 가 주세요', ja: 'この住所までお願いします', reading: 'この じゅうしょまで おねがいします', alt: ['여기로 가 주세요'] },
      { ko: '여기서 세워 주세요', ja: 'ここで止めてください', reading: 'ここで とめて ください', alt: ['내릴게요'] },
      { ko: '공항까지 얼마나 걸려요?', ja: '空港までどのくらいかかりますか？', reading: 'くうこうまで どのくらい かかりますか？', alt: ['얼마나 걸려요'] },
      { ko: '막차는 몇 시예요?', ja: '終電は何時ですか？', reading: 'しゅうでんわ なんじですか？', alt: ['마지막 전철'] },
      { ko: '걸어서 갈 수 있어요?', ja: '歩いて行けますか？', reading: 'あるいて いけますか？' },
      { ko: '길을 잃었어요', ja: '道に迷いました', reading: 'みちに まよいました', alt: ['길 잃음'] },
    ],
  },
  {
    id: 'stay',
    label: '숙소',
    phrases: [
      { ko: '체크인 할게요', ja: 'チェックインをお願いします', reading: 'ちぇっくいんお おねがいします', alt: ['체크인'] },
      { ko: '예약했어요', ja: '予約しています', reading: 'よやく しています', alt: ['예약'] },
      { ko: '짐 맡아 주실 수 있어요?', ja: '荷物を預かってもらえますか？', reading: 'にもつお あずかって もらえますか？', alt: ['짐 보관'] },
      { ko: '와이파이 비밀번호가 뭐예요?', ja: 'Wi-Fiのパスワードは何ですか？', reading: 'わいふぁいの ぱすわーどわ なんですか？', alt: ['와이파이', 'wifi'] },
      { ko: '체크아웃은 몇 시예요?', ja: 'チェックアウトは何時ですか？', reading: 'ちぇっくあうとわ なんじですか？', alt: ['체크아웃'] },
      { ko: '방에 수건이 없어요', ja: '部屋にタオルがありません', reading: 'へやに たおるが ありません', alt: ['수건'] },
      { ko: '에어컨이 안 켜져요', ja: 'エアコンがつきません', reading: 'えあこんが つきません', alt: ['에어컨'] },
    ],
  },
  {
    id: 'sight',
    label: '관광',
    phrases: [
      { ko: '입장료는 얼마예요?', ja: '入場料はいくらですか？', reading: 'にゅうじょうりょうわ いくらですか？', alt: ['입장료'] },
      { ko: '몇 시까지 해요?', ja: '何時まで開いていますか？', reading: 'なんじまで あいていますか？', alt: ['영업시간', '몇 시까지'] },
      { ko: '사진 찍어도 돼요?', ja: '写真を撮ってもいいですか？', reading: 'しゃしんお とっても いいですか？', alt: ['촬영'] },
      { ko: '화장실은 어디예요?', ja: 'トイレはどこですか？', reading: 'といれわ どこですか？', alt: ['화장실'] },
      { ko: '코인로커 있어요?', ja: 'コインロッカーはありますか？', reading: 'こいんろっかーわ ありますか？', alt: ['물품보관함', '락커'] },
      { ko: '줄 서 있는 거예요?', ja: '並んでいますか？', reading: 'ならんでいますか？', alt: ['줄'] },
    ],
  },
  {
    id: 'emergency',
    label: '긴급',
    phrases: [
      { ko: '도와주세요!', ja: '助けてください！', reading: 'たすけて ください！', alt: ['살려주세요', '도와줘'] },
      { ko: '경찰을 불러 주세요', ja: '警察を呼んでください', reading: 'けいさつお よんで ください', alt: ['경찰'] },
      { ko: '구급차를 불러 주세요', ja: '救急車を呼んでください', reading: 'きゅうきゅうしゃお よんで ください', alt: ['구급차', '응급'] },
      { ko: '병원에 가고 싶어요', ja: '病院に行きたいです', reading: 'びょういんに いきたいです', alt: ['병원'] },
      { ko: '몸이 안 좋아요', ja: '気分が悪いです', reading: 'きぶんが わるいです', alt: ['아파요'] },
      { ko: '여기가 아파요', ja: 'ここが痛いです', reading: 'ここが いたいです', alt: ['통증'] },
      { ko: '지갑을 잃어버렸어요', ja: '財布をなくしました', reading: 'さいふお なくしました', alt: ['지갑 분실'] },
      { ko: '여권을 잃어버렸어요', ja: 'パスポートをなくしました', reading: 'ぱすぽーとお なくしました', alt: ['여권 분실'] },
      { ko: '약국은 어디예요?', ja: '薬局はどこですか？', reading: 'やっきょくわ どこですか？', alt: ['약국', '약'] },
    ],
  },
  {
    id: 'numbers',
    label: '숫자',
    phrases: [
      { ko: '하나 (한 개)', ja: '一つ', reading: 'ひとつ', alt: ['1개'] },
      { ko: '둘 (두 개)', ja: '二つ', reading: 'ふたつ', alt: ['2개'] },
      { ko: '셋 (세 개)', ja: '三つ', reading: 'みっつ', alt: ['3개'] },
      { ko: '세 명', ja: '三人', reading: 'さんにん', alt: ['3명'] },
      { ko: '네 명', ja: '四人', reading: 'よにん', alt: ['4명'] },
      { ko: '100엔', ja: '百円', reading: 'ひゃくえん' },
      { ko: '1,000엔', ja: '千円', reading: 'せんえん', alt: ['천엔'] },
      { ko: '10,000엔', ja: '一万円', reading: 'いちまんえん', alt: ['만엔'] },
    ],
  },
];

export const ALL_PHRASES: Phrase[] = PHRASEBOOK.flatMap((c) => c.phrases);

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s?!.,~·()（）]/g, '').replace(/요$/, '');
}

/** 한국어로 찾기 — 입력과 가까운 문장부터 */
export function searchPhrases(query: string, limit = 5): Phrase[] {
  const q = norm(query);
  if (q.length < 1) return [];
  const scored: Array<{ p: Phrase; score: number }> = [];
  for (const p of ALL_PHRASES) {
    const keys = [p.ko, ...(p.alt ?? [])].map(norm);
    let score = 0;
    for (const k of keys) {
      if (k === q) score = Math.max(score, 100);
      else if (k.startsWith(q) || q.startsWith(k)) score = Math.max(score, 60 + Math.min(k.length, q.length));
      else if (k.includes(q) || q.includes(k)) score = Math.max(score, 40 + Math.min(k.length, q.length));
    }
    if (p.ja.includes(query.trim()) && query.trim().length >= 2) score = Math.max(score, 50);
    if (score > 0) scored.push({ p, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.p);
}

/** 입력이 회화집 문장과 사실상 같은가 — 그렇다면 기계 번역보다 회화집을 믿는다 */
export function exactPhrase(query: string): Phrase | null {
  const q = norm(query);
  if (q.length < 2) return null;
  return ALL_PHRASES.find((p) => [p.ko, ...(p.alt ?? [])].some((k) => norm(k) === q)) ?? null;
}
