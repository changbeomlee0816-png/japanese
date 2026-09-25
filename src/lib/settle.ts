import type { Category, Expense, Member } from '../types';

/**
 * 더치페이 정산.
 *
 * 지출마다 적을 때의 환율로 원화로 바꿔 두었으므로(expense.rateToKRW), 누가 언제 보더라도 같은 숫자가 나온다.
 * 각자 "낸 돈 − 내 몫" 을 구한 뒤, 받을 사람과 줄 사람을 큰 금액부터 짝지어 송금 횟수를 줄인다.
 */

export interface Balance {
  memberId: string;
  /** 이 사람이 낸 돈 (원) */
  paid: number;
  /** 이 사람 몫 (원) */
  share: number;
  /** 받을 돈(+) / 줄 돈(−) */
  net: number;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export function activeExpenses(expenses: Expense[] | undefined): Expense[] {
  return (expenses ?? []).filter((e) => !e.deleted);
}

export function expenseKRW(e: Expense): number {
  return Math.round(e.amount * (e.currency === 'KRW' ? 1 : e.rateToKRW));
}

/** 이 지출을 나눠 낼 사람들 — 비어 있거나 지금 없는 사람만 적혀 있으면 모두 */
export function participants(e: Expense, members: Member[]): string[] {
  const ids = new Set(members.map((m) => m.id));
  const chosen = e.splitAmong.filter((id) => ids.has(id));
  return chosen.length ? chosen : members.map((m) => m.id);
}

export function computeBalances(expenses: Expense[] | undefined, members: Member[]): Balance[] {
  const map = new Map<string, Balance>(members.map((m) => [m.id, { memberId: m.id, paid: 0, share: 0, net: 0 }]));
  for (const e of activeExpenses(expenses)) {
    const krw = expenseKRW(e);
    const who = participants(e, members);
    if (who.length === 0) continue;
    const payer = map.get(e.paidBy);
    if (payer) payer.paid += krw;
    // 1원 단위로 나누고 남는 원은 앞사람부터 1원씩 — 합이 정확히 맞게
    const base = Math.floor(krw / who.length);
    let rest = krw - base * who.length;
    for (const id of who) {
      const b = map.get(id);
      if (!b) continue;
      b.share += base + (rest > 0 ? 1 : 0);
      if (rest > 0) rest -= 1;
    }
  }
  for (const b of map.values()) b.net = b.paid - b.share;
  return [...map.values()];
}

/** 최소한의 송금으로 정산 — 줄 사람 → 받을 사람 */
export function settleUp(balances: Balance[]): Transfer[] {
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.memberId, left: b.net })).sort((a, b) => b.left - a.left);
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.memberId, left: -b.net })).sort((a, b) => b.left - a.left);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (amount > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i += 1;
    if (creditors[j].left === 0) j += 1;
  }
  return out;
}

export function totalsByCategory(expenses: Expense[] | undefined): Partial<Record<Category, number>> {
  const out: Partial<Record<Category, number>> = {};
  for (const e of activeExpenses(expenses)) out[e.category] = (out[e.category] ?? 0) + expenseKRW(e);
  return out;
}

/** 카카오톡에 붙여 넣을 정산 문구 */
export function settlementText(title: string, transfers: Transfer[], members: Member[], total: number): string {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? '?';
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
  const lines = [`[${title}] 정산`, `총 지출 ${won(total)}`, ''];
  if (transfers.length === 0) lines.push('정산할 돈이 없습니다 👍');
  for (const t of transfers) lines.push(`${name(t.from)} → ${name(t.to)}  ${won(t.amount)}`);
  return lines.join('\n');
}
