/** SF Symbols 느낌의 스트로크 아이콘 세트 (외부 의존성 없이 인라인 SVG) */

export type IconName =
  | 'plan' | 'map' | 'food' | 'wallet' | 'gear'
  | 'plus' | 'chevronRight' | 'chevronLeft' | 'chevronDown' | 'close'
  | 'walk' | 'train' | 'car' | 'bike'
  | 'clock' | 'check' | 'circle' | 'checkCircle'
  | 'share' | 'trash' | 'copy' | 'pencil' | 'pin' | 'sparkles'
  | 'bell' | 'printer' | 'search' | 'star' | 'list' | 'calendar'
  | 'play' | 'flag' | 'warning' | 'info' | 'drag';

const PATHS: Record<IconName, string> = {
  plan: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  map: 'M9 4.5 3.5 6.8v12.7L9 17.2m0-12.7 6 2.3m-6-2.3v12.7m6-10.4 5.5-2.3v12.7L15 19.5m0-12.7v12.7m0 0-6-2.3',
  food: 'M6 3v8a2.5 2.5 0 0 0 5 0V3M8.5 11v10M17.5 3c-1.4 1.2-2 3-2 5.2 0 1.6.7 2.6 2 2.8V21',
  wallet: 'M3.5 8.5A2.5 2.5 0 0 1 6 6h12a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-9Zm0 0V7a2 2 0 0 1 2-2h10M16.5 13h.01',
  gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm8-3.2c0-.6-.06-1.1-.17-1.65l2-1.5-2-3.46-2.35.97a8 8 0 0 0-2.85-1.65L14.3 2h-4l-.33 2.7a8 8 0 0 0-2.85 1.66L4.77 5.4l-2 3.46 2 1.5A8.4 8.4 0 0 0 4.6 12c0 .56.06 1.1.17 1.64l-2 1.5 2 3.46 2.35-.97a8 8 0 0 0 2.85 1.65L10.3 22h4l.33-2.7a8 8 0 0 0 2.85-1.66l2.35.97 2-3.46-2-1.5c.11-.54.17-1.09.17-1.65Z',
  plus: 'M12 5v14M5 12h14',
  chevronRight: 'm9 5 7 7-7 7',
  chevronLeft: 'm15 5-7 7 7 7',
  chevronDown: 'm5 9 7 7 7-7',
  close: 'M6 6l12 12M18 6 6 18',
  walk: 'M13.5 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM11 22l1.6-6.2L10 13l.8-4.6L8 10.2 6.5 13m6.1-4.8 3 2.2 2.4-.6M12.6 15.8 16 22',
  train: 'M6.5 3.5h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Zm-2 5h15M8.5 12.5h.01M15.5 12.5h.01M7 16.5 4.5 21m12.5-4.5L19.5 21',
  car: 'M4.5 16.5v2.8h3v-2.8m9 0v2.8h3v-2.8M3.6 12.2l1.7-5A2 2 0 0 1 7.2 5.8h9.6a2 2 0 0 1 1.9 1.4l1.7 5m-16.8 0h16.8m-16.8 0v3.3a1 1 0 0 0 1 1h14.8a1 1 0 0 0 1-1v-3.3M7 15h.01M17 15h.01',
  bike: 'M6 19.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm12 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM12 16l-2.5-5.5H14l2.5 5m-2.9-9H16M9.5 10.5H14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2',
  check: 'm5 13 4.5 4.5L19 7',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3.6-9.2 2.6 2.6 4.8-4.9',
  share: 'M12 15.5V3.5m0 0L8.2 7.3M12 3.5l3.8 3.8M5.5 12.5v6a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6',
  trash: 'M4.5 6.5h15M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7m3 0-.8 12.4a1.8 1.8 0 0 1-1.8 1.6H8.1a1.8 1.8 0 0 1-1.8-1.6L5.5 6.5',
  copy: 'M8.5 8.5V5.8a2 2 0 0 1 2-2h7.7a2 2 0 0 1 2 2v7.7a2 2 0 0 1-2 2H15.5M5.8 8.5h7.7a2 2 0 0 1 2 2v7.7a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2v-7.7a2 2 0 0 1 2-2Z',
  pencil: 'M4.5 19.5h3.2L18.9 8.3a1.6 1.6 0 0 0 0-2.3l-.9-.9a1.6 1.6 0 0 0-2.3 0L4.5 16.3v3.2ZM14.5 6.5l3 3',
  pin: 'M12 21s6.8-6 6.8-11A6.8 6.8 0 0 0 5.2 10c0 5 6.8 11 6.8 11Zm0-8.8a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z',
  sparkles: 'm12 3 1.7 4.6L18.3 9l-4.6 1.7L12 15l-1.7-4.3L5.7 9l4.6-1.4L12 3Zm6.5 9.5.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2ZM6 15l.7 1.8 1.8.7-1.8.7L6 20l-.7-1.8-1.8-.7 1.8-.7L6 15Z',
  bell: 'M18 9.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5ZM13.7 19.5a2 2 0 0 1-3.4 0',
  printer: 'M7 9V4.5h10V9M7 18.5H5.5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H17M7 14.5h10v5H7v-5Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5.2-1.8L21 21',
  star: 'm12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.6-5 2.6.9-5.6-4-4 5.6-.8L12 3.8Z',
  list: 'M4 6h16M4 12h16M4 18h10',
  calendar: 'M4.5 8.5h15M6.5 5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm1.5-2v4m8-4v4',
  play: 'M7.5 5.2v13.6l11-6.8-11-6.8Z',
  flag: 'M5.5 21V4m0 0h11l-2 3.5 2 3.5h-11',
  warning: 'M12 9v4.5m0 3h.01M10.3 3.9 2.6 17.2a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9.5V16m0-8h.01',
  drag: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
};

const FILLED: Partial<Record<IconName, boolean>> = { play: true, flag: false };

interface Props {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
}

export function Icon({ name, size = 22, strokeWidth = 1.7, className, color }: Props) {
  const filled = FILLED[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      <path
        d={PATHS[name]}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}
