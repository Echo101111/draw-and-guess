export interface SpyWordPair {
  civilian: string
  spy: string
  category: string
}

export const SPY_WORDS: SpyWordPair[] = [
  { civilian: '苹果', spy: '梨子', category: '食物' },
  { civilian: '香蕉', spy: '芭蕉', category: '食物' },
  { civilian: '饺子', spy: '馄饨', category: '食物' },
  { civilian: '包子', spy: '馒头', category: '食物' },
  { civilian: '面条', spy: '米线', category: '食物' },
  { civilian: '豆浆', spy: '牛奶', category: '食物' },
  { civilian: '可乐', spy: '雪碧', category: '食物' },
  { civilian: '薯条', spy: '薯片', category: '食物' },
  { civilian: '蛋糕', spy: '面包', category: '食物' },
  { civilian: '冰淇淋', spy: '雪糕', category: '食物' },
  { civilian: '医生', spy: '护士', category: '职业' },
  { civilian: '老师', spy: '教授', category: '职业' },
  { civilian: '警察', spy: '保安', category: '职业' },
  { civilian: '厨师', spy: '面包师', category: '职业' },
  { civilian: '飞行员', spy: '空姐', category: '职业' },
  { civilian: '沙发', spy: '椅子', category: '日常' },
  { civilian: '钢笔', spy: '圆珠笔', category: '日常' },
  { civilian: '眼镜', spy: '墨镜', category: '日常' },
  { civilian: '围巾', spy: '领带', category: '日常' },
  { civilian: '雨伞', spy: '遮阳伞', category: '日常' },
  { civilian: '门', spy: '窗户', category: '日常' },
  { civilian: '电风扇', spy: '空调', category: '日常' },
  { civilian: '枕头', spy: '抱枕', category: '日常' },
  { civilian: '台灯', spy: '手电筒', category: '日常' },
  { civilian: '篮球', spy: '排球', category: '运动' },
  { civilian: '羽毛球', spy: '网球', category: '运动' },
  { civilian: '游泳', spy: '潜水', category: '运动' },
  { civilian: '跑步', spy: '竞走', category: '运动' },
  { civilian: '拳击', spy: '散打', category: '运动' },
  { civilian: '狗', spy: '狼', category: '动物' },
  { civilian: '猫', spy: '豹子', category: '动物' },
  { civilian: '马', spy: '驴', category: '动物' },
  { civilian: '海豚', spy: '鲸鱼', category: '动物' },
  { civilian: '蝴蝶', spy: '蛾子', category: '动物' },
  { civilian: '玫瑰', spy: '月季', category: '自然' },
  { civilian: '大海', spy: '湖泊', category: '自然' },
  { civilian: '沙漠', spy: '戈壁', category: '自然' },
  { civilian: '彩虹', spy: '晚霞', category: '自然' },
  { civilian: '地铁', spy: '火车', category: '交通' },
  { civilian: '自行车', spy: '电动车', category: '交通' },
  { civilian: '公交车', spy: '大巴', category: '交通' },
  { civilian: '轿车', spy: '跑车', category: '交通' },
  { civilian: '吉他', spy: '尤克里里', category: '乐器' },
  { civilian: '钢琴', spy: '电子琴', category: '乐器' },
  { civilian: '小提琴', spy: '大提琴', category: '乐器' },
  { civilian: '中国', spy: '日本', category: '地理' },
  { civilian: '北京', spy: '上海', category: '地理' },
  { civilian: '夏天', spy: '春天', category: '季节' },
  { civilian: '春节', spy: '元旦', category: '节日' },
  { civilian: '中秋节', spy: '元宵节', category: '节日' },
]

export function getRandomSpyPair(usedIndices: Set<number>): SpyWordPair | null {
  const available = SPY_WORDS
    .map((p, i) => ({ pair: p, index: i }))
    .filter(({ index }) => !usedIndices.has(index))
  if (available.length === 0) return null
  const pick = available[Math.floor(Math.random() * available.length)]
  usedIndices.add(pick.index)
  return pick.pair
}
