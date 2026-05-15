import { randomBytes } from 'crypto'
import { WORDS, WORD_CATEGORIES } from './words.js'
import type { WordEntry, WordCategory } from './words.js'
import type { RoomWordConfig, CustomWord } from '@draw-and-guess/shared'

interface WordIndex {
  byCategory: Map<WordCategory, WordEntry[]>
  byDifficulty: Map<string, WordEntry[]>
  wordToEntry: Map<string, WordEntry>
}

let index: WordIndex | null = null

function getIndex(): WordIndex {
  if (!index) {
    index = buildIndex()
  }
  return index
}

function buildIndex(): WordIndex {
  const byCategory = new Map<WordCategory, WordEntry[]>()
  const byDifficulty = new Map<string, WordEntry[]>()
  const wordToEntry = new Map<string, WordEntry>()

  for (const category of WORD_CATEGORIES) {
    const entries = WORDS[category]
    byCategory.set(category, entries)

    for (const entry of entries) {
      const diffList = byDifficulty.get(entry.difficulty) ?? []
      diffList.push(entry)
      byDifficulty.set(entry.difficulty, diffList)

      wordToEntry.set(entry.word, entry)
    }
  }

  return { byCategory, byDifficulty, wordToEntry }
}

function randomIndex(length: number): number {
  return Math.floor(randomBytes(4).readUInt32LE(0) / 0xffffffff * length)
}

export function selectWord(
  wordConfig: RoomWordConfig,
  usedWords: Set<string>,
): string | null {
  const idx = getIndex()
  let pool: WordEntry[] = []

  const categories = wordConfig.categoryFilter.length > 0
    ? wordConfig.categoryFilter
    : WORD_CATEGORIES

  for (const cat of categories) {
    const entries = idx.byCategory.get(cat)
    if (entries) pool.push(...entries)
  }

  const finalDifficulties = wordConfig.difficultyFilter

  if (finalDifficulties.length > 0) {
    pool = pool.filter(e => finalDifficulties.includes(e.difficulty))
  }

  if (wordConfig.customWords.length > 0) {
    const customs: WordEntry[] = wordConfig.customWords.map((c: CustomWord) => ({
      word: c.word,
      difficulty: c.difficulty ?? 'easy',
      drawability: 5,
      synonyms: [],
    }))

    if (wordConfig.useOnlyCustomWords) {
      pool = customs
    } else {
      pool.push(...customs)
    }
  }

  if (wordConfig.minDrawability > 1) {
    pool = pool.filter(e => e.drawability >= wordConfig.minDrawability)
  }

  const available = pool.filter(e => !usedWords.has(e.word))

  if (available.length > 0) {
    return available[randomIndex(available.length)].word
  }

  if (pool.length > 0) {
    return pool[randomIndex(pool.length)].word
  }

  return null
}

export function matchAnswer(input: string, target: string, looseMatching: boolean): boolean {
  const normalizedInput = input.trim().replace(/\s+/g, '').toLowerCase()
  const normalizedTarget = target.replace(/\s+/g, '').toLowerCase()

  if (normalizedInput === normalizedTarget) return true

  const idx = getIndex()
  const entry = idx.wordToEntry.get(target)
  if (entry?.synonyms?.some(s => {
    const syn = s.replace(/\s+/g, '').toLowerCase()
    return normalizedInput === syn
  })) {
    return true
  }

  if (looseMatching && normalizedTarget.length >= 3 && normalizedInput.includes(normalizedTarget)) return true

  return false
}

export function getWordEntry(word: string): WordEntry | undefined {
  return getIndex().wordToEntry.get(word)
}
