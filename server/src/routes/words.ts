import { Router, type Request, type Response } from 'express'
import type { WordDifficulty } from '@draw-and-guess/shared'
import { validateGlobalWord } from '../data/wordValidator.js'
import { addCustomWord, loadCustomWords, removeCustomWord } from '../data/customWordBank.js'
import { invalidateIndex } from '../data/wordIndex.js'

export const wordsRouter: Router = Router()

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_MAX = 5

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip) ?? []
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW)
  if (recent.length >= RATE_LIMIT_MAX) return false
  recent.push(now)
  rateLimitMap.set(ip, recent)
  return true
}

interface WordSubmitBody {
  words: string[]
  category: string
  difficulty: WordDifficulty
}

wordsRouter.get('/', (_req: Request, res: Response) => {
  const entries = loadCustomWords()
  const items = entries.map(e => ({
    word: e.word,
    category: e.category,
    difficulty: e.difficulty,
    addedAt: e.addedAt,
  }))
  items.reverse()
  res.json({ words: items, total: items.length })
})

wordsRouter.post('/', (req: Request, res: Response) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
  if (!checkRateLimit(ip)) {
    res.status(429).json({ success: false, message: '提交太频繁，请稍后再试' })
    return
  }

  const { words, category, difficulty } = req.body as WordSubmitBody

  if (!Array.isArray(words) || words.length === 0) {
    res.status(400).json({ success: false, message: '请至少输入一个词语' })
    return
  }

  if (words.length > 20) {
    res.status(400).json({ success: false, message: '单次最多提交20个词语' })
    return
  }

  const validDifficulties: WordDifficulty[] = ['easy', 'medium', 'hard']
  if (!difficulty || !validDifficulties.includes(difficulty)) {
    res.status(400).json({ success: false, message: '请选择有效的难度' })
    return
  }

  const normalizedCategory = category?.trim()
  if (!normalizedCategory) {
    res.status(400).json({ success: false, message: '请填写分类' })
    return
  }

  const failedWords: string[] = []
  const addedWords: string[] = []

  for (const rawWord of words) {
    const word = rawWord.trim()
    if (!word) continue

    const validation = validateGlobalWord(word, normalizedCategory)
    if (!validation.valid) {
      failedWords.push(word)
      continue
    }

    const added = addCustomWord(word, normalizedCategory, difficulty)
    if (added) {
      addedWords.push(word)
    } else {
      failedWords.push(word)
    }
  }

  if (addedWords.length > 0) {
    invalidateIndex()
  }

  if (addedWords.length === 0) {
    const msg = failedWords.length > 0
      ? `提交失败：${failedWords.join('、')}`
      : '没有有效的词语可提交'
    res.status(400).json({ success: false, message: msg, failed: failedWords })
    return
  }

  const msg = failedWords.length > 0
    ? `成功提交 ${addedWords.length} 个词，${failedWords.length} 个词失败`
    : `🎉 成功提交 ${addedWords.length} 个词语，感谢你的贡献！`

  res.json({ success: true, message: msg, count: addedWords.length, failed: failedWords.length > 0 ? failedWords : undefined })
})

wordsRouter.delete('/:word', (req: Request, res: Response) => {
  const word = decodeURIComponent(req.params.word).trim()
  if (!word) {
    res.status(400).json({ success: false, message: '请指定要删除的词语' })
    return
  }

  const removed = removeCustomWord(word)
  if (!removed) {
    res.status(404).json({ success: false, message: `未找到词语"${word}"` })
    return
  }

  invalidateIndex()
  res.json({ success: true, message: `已删除"${word}"` })
})
