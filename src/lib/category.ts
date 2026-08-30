import type { Category } from '../types';
import type { IconName } from '../components/Icon';

export interface CategoryMeta {
  label: string;
  color: string;
  icon: IconName;
}

export const CATEGORY: Record<Category, CategoryMeta> = {
  sight: { label: '관광', color: 'var(--blue)', icon: 'pin' },
  food: { label: '식사', color: 'var(--orange)', icon: 'food' },
  cafe: { label: '카페', color: 'var(--brown)', icon: 'food' },
  shopping: { label: '쇼핑', color: 'var(--pink)', icon: 'wallet' },
  stay: { label: '숙소', color: 'var(--purple)', icon: 'flag' },
  transport: { label: '이동', color: 'var(--teal)', icon: 'train' },
  activity: { label: '액티비티', color: 'var(--green)', icon: 'sparkles' },
  etc: { label: '기타', color: 'var(--label-2)', icon: 'circle' },
};

export const CATEGORY_ORDER: Category[] = [
  'sight', 'food', 'cafe', 'shopping', 'activity', 'transport', 'stay', 'etc',
];
