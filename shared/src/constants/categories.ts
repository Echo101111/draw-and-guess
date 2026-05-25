import type { WordCategory } from '../types.js'

export interface CategoryEntry {
  value: WordCategory
  label: string
}

export const CATEGORIES: CategoryEntry[] = [
  { value: 'animals', label: '动物' },
  { value: 'food', label: '食物' },
  { value: 'daily', label: '日常物品' },
  { value: 'nature', label: '自然' },
  { value: 'vehicles', label: '交通工具' },
  { value: 'sports', label: '体育运动' },
  { value: 'celebrities', label: '角色' },
  { value: 'professions', label: '职业' },
  { value: 'instruments', label: '乐器' },
  { value: 'tools', label: '工具' },
  { value: 'furniture', label: '家具' },
  { value: 'treasures', label: '宝物' },
  { value: 'clothing', label: '服饰鞋帽' },
  { value: 'buildings', label: '建筑场所' },
  { value: 'appliances', label: '电器/家电' },
  { value: 'tableware', label: '餐具厨具' },
  { value: 'plants', label: '植物花卉' },
  { value: 'astronomy', label: '天文太空' },
  { value: 'mythology', label: '神话传说' },
  { value: 'body', label: '身体部位' },
  { value: 'games', label: '游戏玩具' },
  { value: 'festivals', label: '节日庆典' },
] as const

export const CATEGORY_VALUES: WordCategory[] = CATEGORIES.map(c => c.value) as WordCategory[]

export const CATEGORY_DISPLAY_NAMES: Record<WordCategory, string> = {} as Record<WordCategory, string>
for (const cat of CATEGORIES) {
  CATEGORY_DISPLAY_NAMES[cat.value] = cat.label
}
