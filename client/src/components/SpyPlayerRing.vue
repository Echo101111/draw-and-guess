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
        <span v-if="!p.isAlive" class="avatar-text">💀</span>
        <span v-else class="avatar-text">{{ p.nickname[0] }}</span>
      </div>
      <span class="ring-name">{{ p.nickname }}</span>
      <div class="ring-badges">
        <span v-if="p.isOwner" class="badge-owner">👑</span>
        <span v-if="p.voteCount > 0" class="badge-votes">{{ p.voteCount }}票</span>
      </div>
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
  gap: 14px 12px;
  padding: 12px 4px;
}

.ring-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  transition: var(--transition);
  position: relative;
}

.ring-player.clickable {
  cursor: pointer;
}

.ring-player.clickable:hover .ring-avatar {
  transform: scale(1.12);
  box-shadow: 0 0 0 4px var(--color-gold);
}

.ring-avatar {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent-pale), var(--color-bg-warm));
  border: 3px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text);
  transition: var(--transition);
  position: relative;
  box-shadow: var(--shadow-sm);
  user-select: none;
}

.ring-player.speaking .ring-avatar {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(232, 133, 108, 0.25);
  animation: speakerPulse 1.5s ease-in-out infinite;
}

.ring-player.voice-active .ring-avatar {
  border-color: var(--color-success);
  box-shadow: 0 0 0 5px rgba(126, 184, 122, 0.2);
}

.ring-player.eliminated .ring-avatar {
  opacity: 0.3;
  background: var(--color-border-light);
  border-style: dashed;
}

.ring-player.vote-target .ring-avatar {
  border-color: var(--color-gold);
  box-shadow: 0 0 0 5px rgba(245, 179, 66, 0.3);
  transform: scale(1.08);
}

.ring-player.self .ring-avatar {
  background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
  color: white;
  border-color: var(--color-primary-dark);
}

.avatar-text { line-height: 1; }

.ring-name {
  font-size: 12px;
  color: var(--color-text-secondary);
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.ring-player.eliminated .ring-name {
  text-decoration: line-through;
  opacity: 0.3;
}

.ring-player.self .ring-name {
  color: var(--color-primary-dark);
  font-weight: 700;
}

.ring-badges {
  display: flex;
  gap: 4px;
  align-items: center;
  min-height: 14px;
}

.badge-owner { font-size: 12px; }

.badge-votes {
  font-size: 10px;
  color: var(--color-danger);
  font-weight: 700;
  background: var(--color-danger-light);
  padding: 1px 6px;
  border-radius: var(--radius-full);
}

@keyframes speakerPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}

@media (max-width: 380px) {
  .ring-avatar {
    width: 56px;
    height: 56px;
    font-size: 22px;
  }
  .player-ring { gap: 10px 8px; }
}
</style>
