<template>
  <div class="phase-banner" :class="bannerClass">
    <span class="phase-icon">{{ icon }}</span>
    <span class="phase-text">{{ label }}</span>
    <span v-if="showTimer && timeLeft > 0" class="phase-timer">⏱ {{ timeLeft }}s</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SpyPhase } from '@draw-and-guess/shared'

const props = defineProps<{
  phase: SpyPhase
  speakerName?: string
  timeLeft: number
}>()

const PHASE_CONFIG: Record<SpyPhase, { icon: string; text: string; showTimer: boolean; cls: string }> = {
  idle: { icon: '', text: '', showTimer: false, cls: '' },
  word_distribution: { icon: '🔍', text: '查看你的词语...', showTimer: false, cls: 'info' },
  describing: { icon: '💬', text: '描述阶段', showTimer: true, cls: 'desc' },
  discussion: { icon: '💭', text: '自由讨论', showTimer: true, cls: 'discuss' },
  voting: { icon: '🗳️', text: '投票找出卧底！', showTimer: true, cls: 'vote' },
  reveal: { icon: '📊', text: '投票结果揭晓', showTimer: false, cls: 'info' },
  tie_break: { icon: '🔄', text: '加赛阶段', showTimer: true, cls: 'desc' },
  round_end: { icon: '🔄', text: '回合结束', showTimer: false, cls: 'info' },
  game_over: { icon: '🏆', text: '游戏结束', showTimer: false, cls: 'info' },
}

const config = computed(() => PHASE_CONFIG[props.phase])
const icon = computed(() => config.value?.icon ?? '')
const showTimer = computed(() => config.value?.showTimer ?? false)
const bannerClass = computed(() => config.value?.cls ?? '')

const label = computed(() => {
  if (props.phase === 'describing' && props.speakerName) {
    return `当前发言：${props.speakerName}`
  }
  return config.value?.text ?? ''
})
</script>

<style scoped>
.phase-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.phase-banner.desc {
  background: var(--color-accent-pale);
  color: var(--color-primary-dark);
}

.phase-banner.vote {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.phase-banner.discuss { background: var(--color-primary-light); color: white; }
.phase-banner.info {
  background: var(--color-bg-warm);
  color: var(--color-text-secondary);
}

.phase-timer {
  font-family: var(--font-number);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-surface);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  min-width: 48px;
  text-align: center;
}
</style>
