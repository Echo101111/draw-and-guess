<template>
  <div class="game-page">
    <h1>游戏进行中</h1>
    <p>房间: {{ roomCode }}</p>
    <p class="hint">Phase 2 将实现游戏功能</p>
    <button class="btn-leave" @click="handleLeave">离开游戏</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()

const roomCode = computed(() => route.params.roomCode as string)

function handleLeave() {
  roomStore.leaveRoom()
  router.push('/')
}
</script>

<style scoped>
.game-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 1rem;
}

h1 {
  font-size: 2.5rem;
  color: #333;
}

p {
  color: #666;
}

.hint {
  font-size: 0.9rem;
  color: #999;
  font-style: italic;
}

.btn-leave {
  margin-top: 2rem;
  padding: 0.75rem 2rem;
  background: #fff;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
}

.btn-leave:hover {
  background: #f5f5f5;
}
</style>