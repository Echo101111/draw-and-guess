import { randomBytes } from 'crypto'
import { WORDS } from './words.js'
import { getCustomWordEntries } from './customWordBank.js'
import type { WordEntry } from './words.js'

interface WordIndex {
  allWords: WordEntry[]
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
  const allWords: WordEntry[] = []
  const wordToEntry = new Map<string, WordEntry>()

  for (const entries of Object.values(WORDS)) {
    for (const entry of entries) {
      allWords.push(entry)
      wordToEntry.set(entry.word, entry)
    }
  }

  for (const entry of getCustomWordEntries()) {
    allWords.push(entry)
    wordToEntry.set(entry.word, entry)
  }

  return { allWords, wordToEntry }
}

function randomIndex(length: number): number {
  return Math.floor(randomBytes(4).readUInt32LE(0) / 0xffffffff * length)
}

export function selectWord(usedWords: Set<string>): string | null {
  const idx = getIndex()
  const available = idx.allWords.filter(e => !usedWords.has(e.word))
  if (available.length > 0) return available[randomIndex(available.length)].word
  if (idx.allWords.length > 0) {
    usedWords.clear()
    return idx.allWords[randomIndex(idx.allWords.length)].word
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

export function invalidateIndex(): void {
  index = null
}
