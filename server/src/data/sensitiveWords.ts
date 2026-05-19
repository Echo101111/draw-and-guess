export const SENSITIVE_PATTERNS: string[] = [
  // 脏话
  'fuck', 'shit', 'ass', 'bitch', 'dick', 'damn', 'cunt',
  '傻逼', '妈的', '操你', '去死', '白痴',
  '草泥马', '尼玛', '你妈', '煞笔', '沙比',
  '他妈', '特么', 'tmd', 'cnm', 'wcnm',
  '废物', '垃圾', '蠢货',

  // 政治敏感
  '习近平', '江泽民', '胡锦涛', '邓小平',
  '天安门', '六四', '法轮功', '藏独', '疆独',
  '台独', '港独', '钓鱼岛',
  '共产党', '国民党',
  '复辟', '反革命',

  // 暴力恐怖
  '杀人', '自杀', '爆炸', '恐怖袭击', '绑架',
  '枪支', '毒品', '贩毒', '赌博',
  '强奸', '抢劫', '偷窃',

  // 色情
  '色情', '裸体', '裸照', '三级片', 'av',
  '约炮', '嫖娼', '卖淫', '包养',
  '成人', '18禁',
]

export function containsSensitiveContent(text: string): boolean {
  const lower = text.toLowerCase()
  return SENSITIVE_PATTERNS.some(pattern => lower.includes(pattern.toLowerCase()))
}
