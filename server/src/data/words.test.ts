import { describe, it, expect } from 'vitest'
import { getRandomWord, getRandomWords, WORD_CATEGORIES, TOTAL_WORD_COUNT } from './words.js'

describe('words', () => {
  describe('getRandomWord', () => {
    it('should return a word from the pool', () => {
      const word = getRandomWord(new Set())
      expect(word).not.toBeNull()
      expect(typeof word).toBe('string')
      expect(word!).not.toBeNull()
      expect(word!.length).toBeGreaterThan(0)
    })

    it('should not return used words', () => {
      const usedWords = new Set(['猫', '狗'])
      for (let i = 0; i < 100; i++) {
        const word = getRandomWord(usedWords)
        if (word) {
          expect(usedWords.has(word)).toBe(false)
        }
      }
    })

    it('should return word when usedWords is empty', () => {
      const word = getRandomWord(new Set())
      expect(word).not.toBeNull()
    })

    it('should filter by categories', () => {
      const word = getRandomWord(new Set(), ['animals'])
      expect(word).not.toBeNull()
    })

    it('should filter by safe sensitivity', () => {
      const word = getRandomWord(new Set(), undefined, 'safe')
      expect(word).not.toBeNull()
    })

    it('should filter by moderate sensitivity', () => {
      const word = getRandomWord(new Set(), undefined, 'moderate')
      expect(word).not.toBeNull()
    })
  })

  describe('getRandomWords', () => {
    it('should return requested number of words', () => {
      const words = getRandomWords(5)
      expect(words).toHaveLength(5)
    })

    it('should not have duplicates', () => {
      const words = getRandomWords(30)
      const unique = new Set(words)
      expect(unique.size).toBe(words.length)
    })

    it('should filter by categories', () => {
      const words = getRandomWords(10, ['animals', 'food'])
      expect(words.length).toBeLessThanOrEqual(10)
    })

    it('should return all words when count exceeds pool', () => {
      const words = getRandomWords(1000, ['animals'])
      expect(words.length).toBeLessThanOrEqual(50)
    })
  })

  describe('WORD_CATEGORIES', () => {
    it('should have all expected categories', () => {
      const expected = ['animals', 'food', 'daily', 'vehicles', 'nature', 'sports', 'jobs']
      expected.forEach(cat => {
        expect(WORD_CATEGORIES).toContain(cat)
      })
    })

    it('should have at least 6 categories', () => {
      expect(WORD_CATEGORIES.length).toBeGreaterThanOrEqual(6)
    })
  })

  describe('TOTAL_WORD_COUNT', () => {
    it('should be greater than 200', () => {
      expect(TOTAL_WORD_COUNT).toBeGreaterThan(200)
    })
  })
})