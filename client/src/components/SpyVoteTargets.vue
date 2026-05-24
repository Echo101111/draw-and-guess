<template>
  <div class="vote-targets">
    <div class="vote-title">🗳️ 请选择你认为是卧底的人</div>
    <div v-if="hasVoted" class="vote-done">✅ 已投票</div>
    <div class="vote-grid">
      <button
        v-for="p in players"
        :key="p.id"
        class="vote-card"
        :class="{
          selected: p.id === selectedId,
          disabled: hasVoted || p.id === localPlayerId,
        }"
        :disabled="hasVoted || p.id === localPlayerId"
        @click="emit('vote', p.id)"
      >
        <span class="vote-avatar" v-html="avatarSvg(p.avatar)"></span>
        <span class="vote-name">{{ p.nickname }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SpyPlayer } from '@draw-and-guess/shared'
import { getAvatarSvg } from '@/data/avatars'

defineProps<{
  players: SpyPlayer[]
  selectedId: string
  hasVoted: boolean
  localPlayerId: string
}>()

function avatarSvg(index: number): string {
  return getAvatarSvg(index)
}

const emit = defineEmits<{
  vote: [playerId: string]
}>()
</script>

<style scoped>
.vote-targets {
  text-align: center;
}

.vote-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.vote-done {
  color: var(--color-success);
  font-weight: 600;
  margin-bottom: 12px;
}

.vote-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.vote-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  padding: 12px 16px;
  cursor: pointer;
  transition: var(--transition);
  min-width: 72px;
}

.vote-card:not(.disabled):hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.vote-card.selected {
  border-color: var(--color-gold);
  background: var(--color-gold-bg);
}

.vote-card.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.vote-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent-pale), var(--color-bg-warm));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  overflow: hidden;
  color: var(--color-text);
}

.vote-avatar svg {
  width: 60%;
  height: 60%;
}

.vote-name {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
