export interface SpyWordPair {
  civilian: string
  spy: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export const SPY_WORDS: SpyWordPair[] = [
  // === 食物 (25对) ===
  { civilian: '苹果', spy: '梨子', category: '食物', difficulty: 'easy' },
  { civilian: '香蕉', spy: '芭蕉', category: '食物', difficulty: 'easy' },
  { civilian: '饺子', spy: '馄饨', category: '食物', difficulty: 'easy' },
  { civilian: '包子', spy: '馒头', category: '食物', difficulty: 'easy' },
  { civilian: '面条', spy: '米线', category: '食物', difficulty: 'easy' },
  { civilian: '豆浆', spy: '牛奶', category: '食物', difficulty: 'easy' },
  { civilian: '可乐', spy: '雪碧', category: '食物', difficulty: 'easy' },
  { civilian: '薯条', spy: '薯片', category: '食物', difficulty: 'easy' },
  { civilian: '蛋糕', spy: '面包', category: '食物', difficulty: 'easy' },
  { civilian: '冰淇淋', spy: '雪糕', category: '食物', difficulty: 'easy' },
  { civilian: '巧克力', spy: '糖果', category: '食物', difficulty: 'easy' },
  { civilian: '西瓜', spy: '哈密瓜', category: '食物', difficulty: 'medium' },
  { civilian: '草莓', spy: '蓝莓', category: '食物', difficulty: 'medium' },
  { civilian: '葡萄', spy: '提子', category: '食物', difficulty: 'medium' },
  { civilian: '火锅', spy: '烧烤', category: '食物', difficulty: 'medium' },
  { civilian: '寿司', spy: '刺身', category: '食物', difficulty: 'medium' },
  { civilian: '汉堡', spy: '三明治', category: '食物', difficulty: 'medium' },
  { civilian: '披萨', spy: '馅饼', category: '食物', difficulty: 'medium' },
  { civilian: '咖啡', spy: '奶茶', category: '食物', difficulty: 'medium' },
  { civilian: '酸奶', spy: '乳酸菌', category: '食物', difficulty: 'medium' },
  { civilian: '味精', spy: '鸡精', category: '食物', difficulty: 'hard' },
  { civilian: '酱油', spy: '醋', category: '食物', difficulty: 'hard' },
  { civilian: '蜂蜜', spy: '糖浆', category: '食物', difficulty: 'hard' },
  { civilian: '芝麻', spy: '花生', category: '食物', difficulty: 'hard' },
  { civilian: '辣椒', spy: '花椒', category: '食物', difficulty: 'hard' },

  // === 职业 (15对) ===
  { civilian: '医生', spy: '护士', category: '职业', difficulty: 'easy' },
  { civilian: '老师', spy: '教授', category: '职业', difficulty: 'easy' },
  { civilian: '警察', spy: '保安', category: '职业', difficulty: 'easy' },
  { civilian: '厨师', spy: '面包师', category: '职业', difficulty: 'easy' },
  { civilian: '飞行员', spy: '空姐', category: '职业', difficulty: 'easy' },
  { civilian: '司机', spy: '售票员', category: '职业', difficulty: 'medium' },
  { civilian: '演员', spy: '歌手', category: '职业', difficulty: 'medium' },
  { civilian: '律师', spy: '法官', category: '职业', difficulty: 'medium' },
  { civilian: '记者', spy: '编辑', category: '职业', difficulty: 'medium' },
  { civilian: '程序员', spy: '设计师', category: '职业', difficulty: 'medium' },
  { civilian: '画家', spy: '雕塑家', category: '职业', difficulty: 'medium' },
  { civilian: '运动员', spy: '教练', category: '职业', difficulty: 'hard' },
  { civilian: '科学家', spy: '工程师', category: '职业', difficulty: 'hard' },
  { civilian: '作家', spy: '诗人', category: '职业', difficulty: 'hard' },
  { civilian: '消防员', spy: '救援员', category: '职业', difficulty: 'hard' },

  // === 日常 (25对) ===
  { civilian: '沙发', spy: '椅子', category: '日常', difficulty: 'easy' },
  { civilian: '钢笔', spy: '圆珠笔', category: '日常', difficulty: 'easy' },
  { civilian: '眼镜', spy: '墨镜', category: '日常', difficulty: 'easy' },
  { civilian: '围巾', spy: '领带', category: '日常', difficulty: 'easy' },
  { civilian: '雨伞', spy: '遮阳伞', category: '日常', difficulty: 'easy' },
  { civilian: '门', spy: '窗户', category: '日常', difficulty: 'easy' },
  { civilian: '电风扇', spy: '空调', category: '日常', difficulty: 'easy' },
  { civilian: '枕头', spy: '抱枕', category: '日常', difficulty: 'easy' },
  { civilian: '台灯', spy: '手电筒', category: '日常', difficulty: 'easy' },
  { civilian: '牙刷', spy: '牙膏', category: '日常', difficulty: 'easy' },
  { civilian: '毛巾', spy: '浴巾', category: '日常', difficulty: 'medium' },
  { civilian: '杯子', spy: '碗', category: '日常', difficulty: 'medium' },
  { civilian: '剪刀', spy: '刀', category: '日常', difficulty: 'medium' },
  { civilian: '钥匙', spy: '锁', category: '日常', difficulty: 'medium' },
  { civilian: '镜子', spy: '玻璃', category: '日常', difficulty: 'medium' },
  { civilian: '扫把', spy: '拖把', category: '日常', difficulty: 'medium' },
  { civilian: '肥皂', spy: '洗手液', category: '日常', difficulty: 'medium' },
  { civilian: '纸巾', spy: '湿巾', category: '日常', difficulty: 'medium' },
  { civilian: '电池', spy: '充电器', category: '日常', difficulty: 'hard' },
  { civilian: '遥控器', spy: '鼠标', category: '日常', difficulty: 'hard' },
  { civilian: '闹钟', spy: '手表', category: '日常', difficulty: 'hard' },
  { civilian: '水龙头', spy: '花洒', category: '日常', difficulty: 'hard' },
  { civilian: '衣架', spy: '挂钩', category: '日常', difficulty: 'hard' },
  { civilian: '垃圾桶', spy: '回收箱', category: '日常', difficulty: 'hard' },
  { civilian: '晾衣架', spy: '烘干机', category: '日常', difficulty: 'hard' },

  // === 运动 (15对) ===
  { civilian: '篮球', spy: '排球', category: '运动', difficulty: 'easy' },
  { civilian: '羽毛球', spy: '网球', category: '运动', difficulty: 'easy' },
  { civilian: '游泳', spy: '潜水', category: '运动', difficulty: 'easy' },
  { civilian: '跑步', spy: '竞走', category: '运动', difficulty: 'easy' },
  { civilian: '拳击', spy: '散打', category: '运动', difficulty: 'easy' },
  { civilian: '足球', spy: '橄榄球', category: '运动', difficulty: 'medium' },
  { civilian: '乒乓球', spy: '壁球', category: '运动', difficulty: 'medium' },
  { civilian: '滑雪', spy: '滑冰', category: '运动', difficulty: 'medium' },
  { civilian: '骑自行车', spy: '骑摩托车', category: '运动', difficulty: 'medium' },
  { civilian: '登山', spy: '攀岩', category: '运动', difficulty: 'medium' },
  { civilian: '瑜伽', spy: '普拉提', category: '运动', difficulty: 'medium' },
  { civilian: '跳绳', spy: '踢毽子', category: '运动', difficulty: 'hard' },
  { civilian: '高尔夫', spy: '保龄球', category: '运动', difficulty: 'hard' },
  { civilian: '击剑', spy: '跆拳道', category: '运动', difficulty: 'hard' },
  { civilian: '冲浪', spy: '帆船', category: '运动', difficulty: 'hard' },

  // === 动物 (20对) ===
  { civilian: '狗', spy: '狼', category: '动物', difficulty: 'easy' },
  { civilian: '猫', spy: '豹子', category: '动物', difficulty: 'easy' },
  { civilian: '马', spy: '驴', category: '动物', difficulty: 'easy' },
  { civilian: '海豚', spy: '鲸鱼', category: '动物', difficulty: 'easy' },
  { civilian: '蝴蝶', spy: '蛾子', category: '动物', difficulty: 'easy' },
  { civilian: '兔子', spy: '仓鼠', category: '动物', difficulty: 'easy' },
  { civilian: '鸡', spy: '鸭', category: '动物', difficulty: 'easy' },
  { civilian: '牛', spy: '羊', category: '动物', difficulty: 'easy' },
  { civilian: '老虎', spy: '狮子', category: '动物', difficulty: 'easy' },
  { civilian: '熊猫', spy: '考拉', category: '动物', difficulty: 'easy' },
  { civilian: '猴子', spy: '猩猩', category: '动物', difficulty: 'medium' },
  { civilian: '蛇', spy: '蜥蜴', category: '动物', difficulty: 'medium' },
  { civilian: '青蛙', spy: '蟾蜍', category: '动物', difficulty: 'medium' },
  { civilian: '蜜蜂', spy: '黄蜂', category: '动物', difficulty: 'medium' },
  { civilian: '乌龟', spy: '甲鱼', category: '动物', difficulty: 'medium' },
  { civilian: '企鹅', spy: '海豹', category: '动物', difficulty: 'medium' },
  { civilian: '长颈鹿', spy: '大象', category: '动物', difficulty: 'hard' },
  { civilian: '变色龙', spy: '壁虎', category: '动物', difficulty: 'hard' },
  { civilian: '鹦鹉', spy: '八哥', category: '动物', difficulty: 'hard' },
  { civilian: '松鼠', spy: '花栗鼠', category: '动物', difficulty: 'hard' },

  // === 自然 (15对) ===
  { civilian: '玫瑰', spy: '月季', category: '自然', difficulty: 'easy' },
  { civilian: '大海', spy: '湖泊', category: '自然', difficulty: 'easy' },
  { civilian: '沙漠', spy: '戈壁', category: '自然', difficulty: 'easy' },
  { civilian: '彩虹', spy: '晚霞', category: '自然', difficulty: 'easy' },
  { civilian: '太阳', spy: '月亮', category: '自然', difficulty: 'easy' },
  { civilian: '星星', spy: '流星', category: '自然', difficulty: 'easy' },
  { civilian: '雨', spy: '雪', category: '自然', difficulty: 'easy' },
  { civilian: '风', spy: '台风', category: '自然', difficulty: 'medium' },
  { civilian: '山', spy: '丘陵', category: '自然', difficulty: 'medium' },
  { civilian: '河流', spy: '小溪', category: '自然', difficulty: 'medium' },
  { civilian: '森林', spy: '草原', category: '自然', difficulty: 'medium' },
  { civilian: '火山', spy: '地震', category: '自然', difficulty: 'medium' },
  { civilian: '云', spy: '雾', category: '自然', difficulty: 'hard' },
  { civilian: '雷', spy: '闪电', category: '自然', difficulty: 'hard' },
  { civilian: '冰川', spy: '冻土', category: '自然', difficulty: 'hard' },

  // === 交通 (10对) ===
  { civilian: '地铁', spy: '火车', category: '交通', difficulty: 'easy' },
  { civilian: '自行车', spy: '三轮车', category: '交通', difficulty: 'easy' },
  { civilian: '公交车', spy: '大巴', category: '交通', difficulty: 'easy' },
  { civilian: '轿车', spy: '跑车', category: '交通', difficulty: 'easy' },
  { civilian: '飞机', spy: '直升机', category: '交通', difficulty: 'medium' },
  { civilian: '轮船', spy: '游艇', category: '交通', difficulty: 'medium' },
  { civilian: '出租车', spy: '网约车', category: '交通', difficulty: 'medium' },
  { civilian: '摩托车', spy: '电动车', category: '交通', difficulty: 'medium' },
  { civilian: '高铁', spy: '动车', category: '交通', difficulty: 'hard' },
  { civilian: '帆船', spy: '皮划艇', category: '交通', difficulty: 'hard' },

  // === 科技 (12对，新增分类) ===
  { civilian: '手机', spy: '平板', category: '科技', difficulty: 'easy' },
  { civilian: '电脑', spy: '笔记本', category: '科技', difficulty: 'easy' },
  { civilian: '微信', spy: 'QQ', category: '科技', difficulty: 'easy' },
  { civilian: '淘宝', spy: '京东', category: '科技', difficulty: 'easy' },
  { civilian: '抖音', spy: '快手', category: '科技', difficulty: 'easy' },
  { civilian: '支付宝', spy: '微信支付', category: '科技', difficulty: 'medium' },
  { civilian: '百度', spy: '谷歌', category: '科技', difficulty: 'medium' },
  { civilian: 'WiFi', spy: '蓝牙', category: '科技', difficulty: 'medium' },
  { civilian: '路由器', spy: '交换机', category: '科技', difficulty: 'medium' },
  { civilian: '耳机', spy: '音箱', category: '科技', difficulty: 'medium' },
  { civilian: '摄像头', spy: '监控', category: '科技', difficulty: 'hard' },
  { civilian: '充电宝', spy: '数据线', category: '科技', difficulty: 'hard' },

  // === 娱乐 (15对，新增分类) ===
  { civilian: '电影', spy: '电视剧', category: '娱乐', difficulty: 'easy' },
  { civilian: '游戏', spy: '比赛', category: '娱乐', difficulty: 'easy' },
  { civilian: '唱歌', spy: '跳舞', category: '娱乐', difficulty: 'easy' },
  { civilian: '看书', spy: '听书', category: '娱乐', difficulty: 'easy' },
  { civilian: '旅游', spy: '度假', category: '娱乐', difficulty: 'easy' },
  { civilian: 'KTV', spy: '酒吧', category: '娱乐', difficulty: 'medium' },
  { civilian: '演唱会', spy: '音乐节', category: '娱乐', difficulty: 'medium' },
  { civilian: '话剧', spy: '歌剧', category: '娱乐', difficulty: 'medium' },
  { civilian: '相声', spy: '小品', category: '娱乐', difficulty: 'medium' },
  { civilian: '漫画', spy: '动画', category: '娱乐', difficulty: 'medium' },
  { civilian: '桌游', spy: '剧本杀', category: '娱乐', difficulty: 'hard' },
  { civilian: '密室逃脱', spy: '鬼屋', category: '娱乐', difficulty: 'hard' },
  { civilian: '魔术', spy: '杂技', category: '娱乐', difficulty: 'hard' },
  { civilian: '脱口秀', spy: '单口喜剧', category: '娱乐', difficulty: 'hard' },
  { civilian: '电子竞技', spy: '体育比赛', category: '娱乐', difficulty: 'hard' },

  // === 家具 (10对，新增分类) ===
  { civilian: '床', spy: '床垫', category: '家具', difficulty: 'easy' },
  { civilian: '桌子', spy: '茶几', category: '家具', difficulty: 'easy' },
  { civilian: '衣柜', spy: '书柜', category: '家具', difficulty: 'easy' },
  { civilian: '鞋柜', spy: '储物柜', category: '家具', difficulty: 'medium' },
  { civilian: '书桌', spy: '办公桌', category: '家具', difficulty: 'medium' },
  { civilian: '摇椅', spy: '躺椅', category: '家具', difficulty: 'medium' },
  { civilian: '餐桌', spy: '吧台', category: '家具', difficulty: 'medium' },
  { civilian: '电视柜', spy: '音响柜', category: '家具', difficulty: 'hard' },
  { civilian: '梳妆台', spy: '化妆镜', category: '家具', difficulty: 'hard' },
  { civilian: '榻榻米', spy: '地台', category: '家具', difficulty: 'hard' },

  // === 服装 (12对，新增分类) ===
  { civilian: '衣服', spy: '裤子', category: '服装', difficulty: 'easy' },
  { civilian: '鞋', spy: '靴子', category: '服装', difficulty: 'easy' },
  { civilian: '帽子', spy: '头盔', category: '服装', difficulty: 'easy' },
  { civilian: '手套', spy: '袖套', category: '服装', difficulty: 'easy' },
  { civilian: '袜子', spy: '丝袜', category: '服装', difficulty: 'medium' },
  { civilian: '裙子', spy: '连衣裙', category: '服装', difficulty: 'medium' },
  { civilian: '外套', spy: '大衣', category: '服装', difficulty: 'medium' },
  { civilian: 'T恤', spy: 'Polo衫', category: '服装', difficulty: 'medium' },
  { civilian: '短裤', spy: '七分裤', category: '服装', difficulty: 'medium' },
  { civilian: '西装', spy: '礼服', category: '服装', difficulty: 'hard' },
  { civilian: '旗袍', spy: '汉服', category: '服装', difficulty: 'hard' },
  { civilian: '泳衣', spy: '潜水服', category: '服装', difficulty: 'hard' },

  // === 地理 (10对) ===
  { civilian: '中国', spy: '日本', category: '地理', difficulty: 'easy' },
  { civilian: '北京', spy: '上海', category: '地理', difficulty: 'easy' },
  { civilian: '美国', spy: '英国', category: '地理', difficulty: 'easy' },
  { civilian: '法国', spy: '德国', category: '地理', difficulty: 'easy' },
  { civilian: '韩国', spy: '朝鲜', category: '地理', difficulty: 'medium' },
  { civilian: '澳大利亚', spy: '新西兰', category: '地理', difficulty: 'medium' },
  { civilian: '泰国', spy: '越南', category: '地理', difficulty: 'medium' },
  { civilian: '印度', spy: '巴基斯坦', category: '地理', difficulty: 'medium' },
  { civilian: '俄罗斯', spy: '乌克兰', category: '地理', difficulty: 'hard' },
  { civilian: '巴西', spy: '阿根廷', category: '地理', difficulty: 'hard' },

  // === 节日 (8对) ===
  { civilian: '春节', spy: '元旦', category: '节日', difficulty: 'easy' },
  { civilian: '中秋节', spy: '元宵节', category: '节日', difficulty: 'easy' },
  { civilian: '端午节', spy: '清明节', category: '节日', difficulty: 'easy' },
  { civilian: '国庆节', spy: '劳动节', category: '节日', difficulty: 'easy' },
  { civilian: '情人节', spy: '七夕', category: '节日', difficulty: 'medium' },
  { civilian: '圣诞节', spy: '感恩节', category: '节日', difficulty: 'medium' },
  { civilian: '儿童节', spy: '青年节', category: '节日', difficulty: 'medium' },
  { civilian: '万圣节', spy: '愚人节', category: '节日', difficulty: 'hard' },

  // === 乐器 (8对) ===
  { civilian: '吉他', spy: '尤克里里', category: '乐器', difficulty: 'easy' },
  { civilian: '钢琴', spy: '电子琴', category: '乐器', difficulty: 'easy' },
  { civilian: '小提琴', spy: '大提琴', category: '乐器', difficulty: 'easy' },
  { civilian: '鼓', spy: '锣', category: '乐器', difficulty: 'medium' },
  { civilian: '笛子', spy: '箫', category: '乐器', difficulty: 'medium' },
  { civilian: '二胡', spy: '琵琶', category: '乐器', difficulty: 'medium' },
  { civilian: '萨克斯', spy: '单簧管', category: '乐器', difficulty: 'hard' },
  { civilian: '口琴', spy: '手风琴', category: '乐器', difficulty: 'hard' },
]

// 按难度分组
export const SPY_WORDS_BY_DIFFICULTY = {
  easy: SPY_WORDS.filter(w => w.difficulty === 'easy'),
  medium: SPY_WORDS.filter(w => w.difficulty === 'medium'),
  hard: SPY_WORDS.filter(w => w.difficulty === 'hard'),
}

export function getRandomSpyPair(
  usedIndices: Set<number>,
  difficulty?: 'easy' | 'medium' | 'hard'
): SpyWordPair | null {
  const available = SPY_WORDS
    .map((pair, globalIndex) => ({ pair, globalIndex }))
    .filter(({ pair, globalIndex }) => {
      if (usedIndices.has(globalIndex)) return false
      if (difficulty && pair.difficulty !== difficulty) return false
      return true
    })

  if (available.length === 0) return null

  const pick = available[Math.floor(Math.random() * available.length)]
  usedIndices.add(pick.globalIndex)
  return pick.pair
}
