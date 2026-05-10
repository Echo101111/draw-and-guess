import { randomBytes } from 'crypto'

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  const bytes = randomBytes(shuffled.length * 4)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (bytes.readUInt32LE(i * 4) % (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const WORDS = {
  animals: [
    '猫', '狗', '大象', '狮子', '老虎', '兔子', '熊猫', '猴子', '马', '牛',
    '猪', '羊', '鸡', '鸭', '鹅', '鱼', '鸟', '鹰', '蛇', '青蛙',
    '乌龟', '蝴蝶', '蜜蜂', '蚂蚁', '蜗牛', '螃蟹', '虾', '章鱼', '海豚', '鲸鱼',
    '豹子', '狼', '狐狸', '熊', '鹿', '豹', '犀牛', '河马', '斑马', '袋鼠',
    '考拉', '鹦鹉', '鸽子', '乌鸦', '猫头鹰', '天鹅', '孔雀', '火烈鸟', '企鹅', '鸵鸟',
  ],
  food: [
    '苹果', '香蕉', '橙子', '葡萄', '西瓜', '草莓', '桃子', '梨', '菠萝', '芒果',
    '米饭', '面条', '饺子', '包子', '馒头', '面包', '蛋糕', '饼干', '巧克力', '冰淇淋',
    '披萨', '汉堡', '炸鸡', '薯条', '咖啡', '茶', '牛奶', '可乐', '果汁', '水',
    '火锅', '烤肉', '寿司', '沙拉', '汤', '粥', '饺子', '炒饭', '炒面', '烧烤',
    '糖葫芦', '月饼', '汤圆', '粽子', '年糕', '豆腐', '鸡蛋', '西红柿', '黄瓜', '土豆',
  ],
  daily: [
    '手机', '电脑', '电视', '冰箱', '洗衣机', '空调', '风扇', '灯', '桌子', '椅子',
    '床', '沙发', '衣柜', '书柜', '窗户', '门', '钥匙', '锁', '雨伞', '帽子',
    '眼镜', '手表', '项链', '戒指', '背包', '箱子', '杯子', '碗', '盘子', '勺子',
    '筷子', '刀', '叉', '锅', '铲子', '砧板', '水壶', '梯子', '镜子', '梳子',
    '牙刷', '毛巾', '肥皂', '洗发水', '沐浴露', '纸巾', '垃圾桶', '扫帚', '拖把', '抹布',
  ],
  vehicles: [
    '汽车', '卡车', '公交车', '地铁', '火车', '飞机', '直升机', '轮船', '潜艇', '摩托车',
    '自行车', '电动车', '出租车', '救护车', '消防车', '警车', '校车', '货车', '拖车', '挖掘机',
    '拖拉机', '收割机', '压路机', '搅拌车', '吊车', '推土机', '叉车', '沙滩车', '卡丁车', '赛车',
    '游艇', '帆船', '木筏', '皮划艇', '热气球', '滑翔机', '飞艇', '马车', '三轮车', '独轮车',
  ],
  nature: [
    '太阳', '月亮', '星星', '云', '雨', '雪', '风', '雷', '闪电', '彩虹',
    '山', '河', '湖', '海', '岛', '森林', '草原', '沙漠', '峡谷', '瀑布',
    '火山', '岩石', '石头', '沙子', '泥土', '草地', '花', '树', '叶子', '树枝',
    '树干', '树根', '果实', '种子', '水', '冰', '雾', '霜', '露水', '气泡',
    '石头', '山丘', '悬崖', '洞穴', '小溪', '池塘', '井', '喷泉', '冰川', '湿地',
  ],
  sports: [
    '足球', '篮球', '排球', '网球', '羽毛球', '乒乓球', '高尔夫', '保龄球', '棒球', '垒球',
    '拳击', '摔跤', '柔道', '跆拳道', '武术', '游泳', '跳水', '滑冰', '滑雪', '滑板',
    '自行车', '赛马', '斗牛', '钓鱼', '划船', '冲浪', '帆船', '攀岩', '跳伞', '蹦极',
    '跑步', '跳远', '跳高', '标枪', '铅球', '铁饼', '体操', '瑜伽', '跳舞', '啦啦队',
  ],
  jobs: [
    '医生', '护士', '老师', '警察', '消防员', '厨师', '司机', '飞行员', '护士', '律师',
    '法官', '警察', '军官', '士兵', '记者', '作家', '画家', '音乐家', '演员', '歌手',
    '舞蹈家', '建筑师', '工程师', '科学家', '医生', '会计', '律师', '设计师', '摄影师', '主持人',
    '导游', '服务员', '售货员', '快递员', '农民', '渔夫', '矿工', '木匠', '电工', '水管工',
  ],
  shapes: [
    '圆形', '方形', '三角形', '长方形', '椭圆形', '菱形', '五边形', '六边形', '心形', '星形',
    '波浪形', '螺旋形', '月牙形', '十字形', '箭头', '柱形', '锥形', '球形', '立方体', '圆柱',
  ],
  colors: [
    '红色', '蓝色', '绿色', '黄色', '紫色', '橙色', '粉色', '黑色', '白色', '灰色',
    '棕色', '金色', '银色', '青色', '米色', '紫色', '深蓝', '浅绿', '暗红', '天蓝',
  ],
}

export const WORD_CATEGORIES = Object.keys(WORDS) as (keyof typeof WORDS)[]

export function getRandomWord(usedWords: Set<string>, categories?: (keyof typeof WORDS)[]): string | null {
  const pools = categories ? categories.map((c) => WORDS[c]).flat() : Object.values(WORDS).flat()
  const available = pools.filter((w) => !usedWords.has(w))

  if (available.length > 0) {
    return available[Math.floor(randomBytes(4).readUInt32LE(0) / 0xffffffff * available.length)]
  }

  // Fallback: return from all pools excluding usedWords (shouldn't happen normally)
  const allAvailable = pools.filter((w) => !usedWords.has(w))
  if (allAvailable.length > 0) {
    return allAvailable[Math.floor(randomBytes(4).readUInt32LE(0) / 0xffffffff * allAvailable.length)]
  }

  return null
}

export function getRandomWords(count: number, categories?: (keyof typeof WORDS)[]): string[] {
  const pools = categories ? categories.map((c) => WORDS[c]).flat() : Object.values(WORDS).flat()
  const shuffled = shuffleArray(pools)
  return shuffled.slice(0, count)
}

export const TOTAL_WORD_COUNT = Object.values(WORDS).flat().length