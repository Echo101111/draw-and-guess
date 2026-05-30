import { WORD_MAX_LENGTH, WORD_BATCH_MAX, WORD_ERROR_TRUNCATE } from '@draw-and-guess/shared'
import { getWordCategory } from './words.js'
import { getCustomWordSet } from './customWordBank.js'
import { containsSensitiveContent } from './sensitiveWords.js'

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
  if (trimmed.length > WORD_MAX_LENGTH) return { valid: false, error: `"${trimmed.slice(0, WORD_ERROR_TRUNCATE)}..."过长（最多${WORD_MAX_LENGTH}字）` }

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
  if (words.length > WORD_BATCH_MAX) return { valid: false, error: `单次最多提交${WORD_BATCH_MAX}个词语` }

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
