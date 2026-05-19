import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { WordEntry } from './words.js'
import type { WordDifficulty } from '@draw-and-guess/shared'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从 src/data/ 向上两层得到 server/，再进 data/
const DATA_DIR = path.resolve(__dirname, '../../data')
const CUSTOM_WORDS_FILE = path.join(DATA_DIR, 'custom-words.json')

export interface CustomWordEntry {
  word: string
  category: string
  difficulty: WordDifficulty
  drawability: number
  addedAt: number
}

let cachedEntries: CustomWordEntry[] | null = null

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadRaw(): CustomWordEntry[] {
  try {
    ensureDataDir()
    if (!fs.existsSync(CUSTOM_WORDS_FILE)) {
      fs.writeFileSync(CUSTOM_WORDS_FILE, '[]', 'utf-8')
      return []
    }
    const raw = fs.readFileSync(CUSTOM_WORDS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as CustomWordEntry[]
  } catch (err) {
    console.warn('[CustomWordBank] Failed to load custom words:', (err as Error).message)
    return []
  }
}

function saveRaw(entries: CustomWordEntry[]): void {
  try {
    ensureDataDir()
    fs.writeFileSync(CUSTOM_WORDS_FILE, JSON.stringify(entries, null, 2), 'utf-8')
    cachedEntries = entries
  } catch (err) {
    console.error('[CustomWordBank] Failed to save custom words:', (err as Error).message)
    throw err
  }
}

export function loadCustomWords(): CustomWordEntry[] {
  if (cachedEntries) return cachedEntries
  cachedEntries = loadRaw()
  return cachedEntries
}

export function getAllCustomWordEntries(): CustomWordEntry[] {
  return loadCustomWords()
}

export function getCustomWordEntries(): WordEntry[] {
  return loadCustomWords().map(e => ({
    word: e.word,
    difficulty: e.difficulty,
    drawability: e.drawability as WordEntry['drawability'],
  }))
}

export function addCustomWord(
  word: string,
  category: string,
  difficulty: WordDifficulty,
): boolean {
  const entries = loadCustomWords()

  const exists = entries.some(e => e.word === word && e.category === category)
  if (exists) return false

  entries.push({
    word,
    category,
    difficulty,
    drawability: 3,
    addedAt: Date.now(),
  })

  saveRaw(entries)
  return true
}

export function getCustomWordSet(): Set<string> {
  return new Set(loadCustomWords().map(e => e.word))
}
