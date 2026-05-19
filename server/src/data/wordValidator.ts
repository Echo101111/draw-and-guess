import type { CustomWord } from '@draw-and-guess/shared'
import { getWordCategory } from './words.js'
import { getCustomWordSet } from './customWordBank.js'
import { containsSensitiveContent } from './sensitiveWords.js'

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

export interface WordValidationResult {
  valid: boolean
  error?: string
}

export function validateGlobalWord(
  word: string,
  category: string,
): WordValidationResult {
  const trimmed = word.trim()
  if (!trimmed) return { valid: false, error: '词语不能为空' }
  if (trimmed.length > 20) return { valid: false, error: `"${trimmed.slice(0, 10)}..."过长（最多20字）` }

  if (!category?.trim()) {
    return { valid: false, error: '请填写分类' }
  }

  if (containsSensitiveContent(trimmed)) {
    return { valid: false, error: '包含不适当内容，请重新填写' }
  }

  if (getWordCategory(trimmed)) {
    return { valid: false, error: `"${trimmed}" 已在词库中` }
  }

  if (getCustomWordSet().has(trimmed)) {
    return { valid: false, error: `"${trimmed}" 已被其他用户贡献过` }
  }

  return { valid: true }
}

export function validateGlobalWords(
  words: string[],
  category: string,
): { valid: boolean; error?: string; failed?: string[] } {
  if (words.length === 0) return { valid: false, error: '至少输入一个词语' }
  if (words.length > 20) return { valid: false, error: '单次最多提交20个词语' }

  const failed: string[] = []
  for (const w of words) {
    const result = validateGlobalWord(w, category)
    if (!result.valid) {
      failed.push(w)
    }
  }

  if (failed.length > 0) {
    return {
      valid: false,
      error: `以下词语验证失败：${failed.join('、')}`,
      failed,
    }
  }

  return { valid: true }
}
