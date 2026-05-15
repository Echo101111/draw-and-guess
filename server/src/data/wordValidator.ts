import type { CustomWord } from '@draw-and-guess/shared'

const BAD_WORDS = new Set([
  'fuck', 'shit', 'ass', 'bitch', 'dick', 'damn', 'cunt',
  '傻逼', '妈的', '操你', '去死', '白痴',
])

export function validateCustomWords(inputs: { word: string; category: string }[]): { valid: boolean; words?: CustomWord[]; error?: string } {
  const words: CustomWord[] = []
  for (const input of inputs) {
    const word = input.word?.trim()
    const category = input.category?.trim()
    if (!word) continue
    if (word.length > 20) return { valid: false, error: `词汇"${word.slice(0, 10)}..."过长` }
    if (!category) return { valid: false, error: `词汇"${word}"缺少分类` }
    if (BAD_WORDS.has(word.toLowerCase())) return { valid: false, error: `词汇"${word}"包含不适当内容` }
    words.push({ word, category })
  }
  if (words.length === 0) return { valid: false, error: '至少需要1个有效词汇' }
  return { valid: true, words }
}
