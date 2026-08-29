/** 짧고 충돌 없는 로컬 ID 생성기 (localStorage 저장용이라 UUID까지는 필요 없다) */
let counter = 0;

export function uid(prefix = 'id'): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}
