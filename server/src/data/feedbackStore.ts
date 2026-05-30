import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.resolve(__dirname, '../../data')
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json')

export interface FeedbackEntry {
  text: string
  timestamp: number
}

const MAX_ENTRIES = 1000

let cachedEntries: FeedbackEntry[] | null = null

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadRaw(): FeedbackEntry[] {
  try {
    ensureDataDir()
    if (!fs.existsSync(FEEDBACK_FILE)) {
      fs.writeFileSync(FEEDBACK_FILE, '[]', 'utf-8')
      return []
    }
    const raw = fs.readFileSync(FEEDBACK_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as FeedbackEntry[]
  } catch (err) {
    console.warn('[FeedbackStore] Failed to load feedback:', (err as Error).message)
    return []
  }
}

function saveRaw(entries: FeedbackEntry[]): void {
  try {
    ensureDataDir()
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(entries, null, 2), 'utf-8')
    cachedEntries = entries
  } catch (err) {
    console.error('[FeedbackStore] Failed to save feedback:', (err as Error).message)
  }
}

function loadFeedback(): FeedbackEntry[] {
  if (cachedEntries) return cachedEntries
  cachedEntries = loadRaw()
  return cachedEntries
}

export function getAllFeedback(): FeedbackEntry[] {
  return loadFeedback()
}

export function addFeedback(text: string, timestamp: number): void {
  const entries = loadFeedback()
  entries.push({ text, timestamp })
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES)
  }
  saveRaw(entries)
}

export const feedbackStore: FeedbackEntry[] = loadFeedback()
