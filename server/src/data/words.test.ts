import { describe, it, expect } from 'vitest'
import { selectWord, matchAnswer } from './wordIndex.js'
import { WORD_CATEGORIES, TOTAL_WORD_COUNT, getWordCategory, WORDS } from './words.js'

describe('words', () => {
  describe('TOTAL_WORD_COUNT', () => {
    it('should be 789', () => {
      expect(TOTAL_WORD_COUNT).toBe(789)
    })
  })

  describe('WORD_CATEGORIES', () => {
    it('should have 12 categories', () => {
      expect(WORD_CATEGORIES).toHaveLength(12)
    })

    it('should contain expected categories', () => {
      const expected = ['animals', 'food', 'daily', 'nature', 'vehicles', 'sports', 'celebrities', 'professions', 'instruments', 'tools', 'furniture', 'treasures']
      for (const cat of expected) {
        expect(WORD_CATEGORIES).toContain(cat)
      }
    })
  })

  describe('getWordCategory', () => {
    it('should return category for known word', () => {
      expect(getWordCategory('猫')).toBe('animals')
      expect(getWordCategory('苹果')).toBe('food')
      expect(getWordCategory('医生')).toBe('professions')
    })

    it('should return null for unknown word', () => {
      expect(getWordCategory('不存在的词')).toBeNull()
    })
  })

  describe('selectWord', () => {
    it('should return a word', () => {
      const word = selectWord(new Set())
      expect(word).not.toBeNull()
      expect(typeof word).toBe('string')
      expect(word!.length).toBeGreaterThan(0)
    })

    it('should not return used words', () => {
      const usedWords = new Set<string>(['猫', '狗', '苹果', '手机', '太阳', '汽车', '足球', '医生'])
      for (let i = 0; i < 50; i++) {
        const word = selectWord(usedWords)
        if (word) {
          expect(usedWords.has(word)).toBe(false)
        }
      }
    })

    it('should return all system words', () => {
      const found = new Set<string>()
      // Try to get many unique words
      for (let i = 0; i < 50; i++) {
        const word = selectWord(found)
        if (word) found.add(word)
      }
      expect(found.size).toBeGreaterThan(10)
    })

    it('should auto-reset and not return null when pool exhausted', () => {
      const usedWords = new Set<string>()
      const allWordSet = new Set<string>()
      for (const entries of Object.values(WORDS)) {
        for (const entry of entries) {
          allWordSet.add(entry.word)
          usedWords.add(entry.word)
        }
      }
      // 所有词已使用，应自动重置并返回有效词
      const word = selectWord(usedWords)
      expect(word).not.toBeNull()
      expect(typeof word).toBe('string')
      // usedWords 应被清空（重置）
      expect(usedWords.size).toBe(0)
    })
  })

  describe('matchAnswer', () => {
    it('should match exact answer (case-insensitive)', () => {
      expect(matchAnswer('猫', '猫', false)).toBe(true)
      expect(matchAnswer(' 猫 ', '猫', false)).toBe(true)
    })

    it('should match synonym', () => {
      expect(matchAnswer('猫咪', '猫', false)).toBe(true)
    })

    it('should not match wrong answer', () => {
      expect(matchAnswer('狗', '猫', false)).toBe(false)
    })

    it('should match lax with looseMatching enabled', () => {
      expect(matchAnswer('夹心巧克力', '巧克力', true)).toBe(true)
    })

    it('should not match lax without looseMatching', () => {
      expect(matchAnswer('夹心巧克力', '巧克力', false)).toBe(false)
    })

    it('should not match short words via contains with looseMatching', () => {
      expect(matchAnswer('斑马', '马', true)).toBe(false)
    })
  })
})
