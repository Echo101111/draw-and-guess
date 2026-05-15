import type { CustomWord } from '@draw-and-guess/shared'

const BAD_WORDS = new Set([
  'fuck', 'shit', 'ass', 'bitch', 'dick', 'damn', 'cunt',
  '傻逼', '妈的', '操你', '去死', '白痴',
])

export interface ValidationResult {
  valid: boolean
  words?: CustomWord[]
  error?: string
}

export function validateCustomWords(rawInput: string): ValidationResult {
  const lines = rawInput.split(/[\n,]/)

  const words: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    if (trimmed.length > 20) {
      return { valid: false, error: `词汇"${trimmed.slice(0, 10)}..."过长，每个词最多20个字符` }
    }
    words.push(trimmed)
  }

  const unique = [...new Set(words)]

  for (const word of unique) {
    const lower = word.toLowerCase()
    if (BAD_WORDS.has(lower)) {
      return { valid: false, error: `词汇"${word}"包含不适当内容` }
    }
  }

  if (unique.length < 5) {
    return { valid: false, error: '至少需要5个自定义词汇' }
  }

  return {
    valid: true,
    words: unique.map(w => ({ word: w })),
  }
}
