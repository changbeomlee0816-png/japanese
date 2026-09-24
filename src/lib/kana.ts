/**
 * 일본어 가나 → 한글 발음.
 *
 * 외래어 표기법이 아니라 "소리 내어 읽을 수 있게" 적는다 — 번역 앱들이 보여 주는 방식이다.
 *   ありがとう → 아리가토-     ちょっと → 촛토     コーヒー → 코-히-
 *
 * 한자는 읽을 수 없으므로 읽는 법(가나)이 있어야 한다. Claude 는 읽는 법을 함께 돌려주고,
 * 회화집은 미리 적어 두었다. 가나로 바꾸면 발음은 항상 같은 규칙으로 나온다.
 */

const BASE: Record<string, string> = {
  あ: '아', い: '이', う: '우', え: '에', お: '오',
  か: '카', き: '키', く: '쿠', け: '케', こ: '코',
  さ: '사', し: '시', す: '스', せ: '세', そ: '소',
  た: '타', ち: '치', つ: '츠', て: '테', と: '토',
  な: '나', に: '니', ぬ: '누', ね: '네', の: '노',
  は: '하', ひ: '히', ふ: '후', へ: '헤', ほ: '호',
  ま: '마', み: '미', む: '무', め: '메', も: '모',
  や: '야', ゆ: '유', よ: '요',
  ら: '라', り: '리', る: '루', れ: '레', ろ: '로',
  わ: '와', ゐ: '이', ゑ: '에', を: '오',
  が: '가', ぎ: '기', ぐ: '구', げ: '게', ご: '고',
  ざ: '자', じ: '지', ず: '즈', ぜ: '제', ぞ: '조',
  だ: '다', ぢ: '지', づ: '즈', で: '데', ど: '도',
  ば: '바', び: '비', ぶ: '부', べ: '베', ぼ: '보',
  ぱ: '파', ぴ: '피', ぷ: '푸', ぺ: '페', ぽ: '포',
  ゔ: '부',
  ぁ: '아', ぃ: '이', ぅ: '우', ぇ: '에', ぉ: '오', ゃ: '야', ゅ: '유', ょ: '요', ゎ: '와',
};

/** 두 글자 조합 (요음·외래어 음) */
const PAIRS: Record<string, string> = {
  きゃ: '캬', きゅ: '큐', きょ: '쿄', しゃ: '샤', しゅ: '슈', しょ: '쇼', ちゃ: '차', ちゅ: '추', ちょ: '초',
  にゃ: '냐', にゅ: '뉴', にょ: '뇨', ひゃ: '햐', ひゅ: '휴', ひょ: '효', みゃ: '먀', みゅ: '뮤', みょ: '묘',
  りゃ: '랴', りゅ: '류', りょ: '료', ぎゃ: '갸', ぎゅ: '규', ぎょ: '교', じゃ: '쟈', じゅ: '쥬', じょ: '죠',
  ぢゃ: '쟈', ぢゅ: '쥬', ぢょ: '죠', びゃ: '뱌', びゅ: '뷰', びょ: '뵤', ぴゃ: '퍄', ぴゅ: '퓨', ぴょ: '표',
  ふぁ: '화', ふぃ: '피', ふぇ: '페', ふぉ: '포', ふゅ: '퓨', てぃ: '티', でぃ: '디', とぅ: '투', どぅ: '두',
  うぃ: '위', うぇ: '웨', うぉ: '워', ちぇ: '체', しぇ: '셰', じぇ: '제', つぁ: '차', つぃ: '치', つぇ: '체', つぉ: '초',
  ゔぁ: '바', ゔぃ: '비', ゔぇ: '베', ゔぉ: '보', いぇ: '예', くぁ: '콰', ぐぁ: '과', てゅ: '튜', でゅ: '듀',
};

const PUNCT: Record<string, string> = { '、': ', ', '。': '. ', '？': '?', '！': '!', '「': '"', '」': '"', '・': ' ', '　': ' ', '〜': '~' };

/** 가타카나 → 히라가나 (ー 는 그대로) */
export function toHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function hasKanji(text: string): boolean {
  return /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
}

export function isKanaOnly(text: string): boolean {
  return /[\u3041-\u30FF]/.test(text) && !hasKanji(text) && !/[a-z\uAC00-\uD7A3]/i.test(text);
}

/** 가나의 모음 — 장음을 알아보는 데 쓴다 */
const VOWEL: Record<string, 'a' | 'i' | 'u' | 'e' | 'o'> = {};
const ROWS: Array<[string, 'a' | 'i' | 'u' | 'e' | 'o']> = [
  ['あかさたなはまやらわがざだばぱぁゃゎ', 'a'],
  ['いきしちにひみりゐぎじぢびぴぃ', 'i'],
  ['うくすつぬふむゆるぐずづぶぷゔぅゅ', 'u'],
  ['えけせてねへめれゑげぜでべぺぇ', 'e'],
  ['おこそとのほもよろをごぞどぼぽぉょ', 'o'],
];
for (const [chars, v] of ROWS) for (const c of chars) VOWEL[c] = v;

/** 앞 글자와 이어져 길게 읽는 모음인가 — ああ, いい, くう, こう, せい */
function isLongVowel(ch: string, prev: string | undefined): boolean {
  if (!prev) return false;
  const pv = VOWEL[prev];
  if (!pv) return false;
  if (ch === 'あ') return pv === 'a';
  if (ch === 'い') return pv === 'i' || pv === 'e';
  if (ch === 'う') return pv === 'u' || pv === 'o';
  if (ch === 'え') return pv === 'e';
  if (ch === 'お') return pv === 'o';
  return false;
}

/** 한글 음절에 받침을 붙인다 (ㄴ=4, ㅅ=19) */
function addFinal(syllable: string, final: number): string | null {
  const code = syllable.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171 || code % 28 !== 0) return null;
  return String.fromCharCode(0xac00 + code + final);
}

export function kanaToHangul(input: string): string {
  const text = toHiragana(input);
  let out = '';
  let pendingSokuon = false;

  const pushSyllable = (s: string) => {
    out += s;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const prev = text[i - 1];

    // 장음: ー, 그리고 앞 글자와 이어지는 모음 (こう → 코-, せんせい → 센세-, おいしい → 오이시-)
    if (ch === 'ー' || isLongVowel(ch, prev)) {
      out += '-';
      continue;
    }

    // 촉음 っ → 앞 글자에 ㅅ 받침
    if (ch === 'っ') {
      const last = out.slice(-1);
      const joined = last ? addFinal(last, 19) : null;
      if (joined) out = out.slice(0, -1) + joined;
      else pendingSokuon = true;
      continue;
    }

    // 발음 ん → 앞 글자에 ㄴ 받침
    if (ch === 'ん') {
      const last = out.slice(-1);
      const joined = last ? addFinal(last, 4) : null;
      out = joined ? out.slice(0, -1) + joined : out + '응';
      continue;
    }

    const pair = PAIRS[text.slice(i, i + 2)];
    if (pair) {
      pushSyllable(pair);
      i += 1;
    } else if (BASE[ch]) {
      pushSyllable(BASE[ch]);
    } else if (PUNCT[ch] !== undefined) {
      out += PUNCT[ch];
    } else {
      out += ch;
    }

    if (pendingSokuon) pendingSokuon = false;
  }

  return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.?!])/g, '$1').trim();
}
