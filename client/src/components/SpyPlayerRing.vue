<template>
  <div class="player-ring">
    <div
      v-for="p in players"
      :key="p.id"
      class="ring-player"
      :class="{
        eliminated: !p.isAlive,
        speaking: p.id === speakerId,
        'voice-active': speakingPeers?.has(p.id) && p.isAlive,
        self: p.id === localPlayerId,
        'vote-target': p.id === selectedId && !hasVoted,
        clickable: phase === 'voting' && p.isAlive && !hasVoted && p.id !== localPlayerId,
      }"
      @click="handleClick(p.id)"
    >
      <div class="ring-avatar">
        <span>{{ p.nickname[0] }}</span>
      </div>
      <span class="ring-name">{{ p.nickname }}</span>
      <span v-if="!p.isAlive" class="ring-status">💀</span>
      <span v-if="p.voteCount > 0" class="ring-votes">{{ p.voteCount }}票</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SpyPlayer, SpyPhase } from '@draw-and-guess/shared'

const props = defineProps<{
  players: SpyPlayer[]
  speakerId?: string
  speakingPeers?: Set<string>
  localPlayerId?: string
  selectedId?: string
  hasVoted?: boolean
  phase?: SpyPhase
}>()

const emit = defineEmits<{
  vote: [playerId: string]
}>()

function handleClick(playerId: string) {
  if (props.phase === 'voting') {
    emit('vote', playerId)
  }
}
</script>

<style scoped>
.player-ring {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  padding: 8px 0;
}

.ring-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: var(--transition);
}

.ring-player.clickable {
  cursor: pointer;
}

.ring-player.clickable:hover .ring-avatar {
  transform: scale(1.15);
  box-shadow: var(--shadow-md);
}

.ring-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-accent-pale);
  border: 3px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  transition: var(--transition);
  position: relative;
}

.ring-player.speaking .ring-avatar {
  border-color: var(--color-primary);
  animation: speakerPulse 1.5s ease-in-out infinite;
}

.ring-player.voice-active .ring-avatar {
  border-color: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}

.ring-player.eliminated .ring-avatar {
  opacity: 0.4;
  background: var(--color-border-light);
}

.ring-player.vote-target .ring-avatar {
  border-color: var(--color-gold);
  box-shadow: 0 0 10px var(--color-gold);
}

.ring-player.self .ring-avatar {
  background: var(--color-primary-light);
  color: white;
}

.ring-name {
  font-size: 11px;
  color: var(--color-text-secondary);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ring-player.eliminated .ring-name {
  text-decoration: line-through;
  opacity: 0.4;
}

.ring-status {
  font-size: 12px;
}

.ring-votes {
  font-size: 10px;
  color: var(--color-danger);
  font-weight: 600;
}

@keyframes speakerPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
</style>
