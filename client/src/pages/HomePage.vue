<template>
  <div class="home-page">
    <h1>你画我猜</h1>

    <div class="tabs">
      <button :class="{ active: activeTab === 'create' }" @click="activeTab = 'create'">
        创建房间
      </button>
      <button :class="{ active: activeTab === 'join' }" @click="activeTab = 'join'">
        加入房间
      </button>
    </div>

    <form v-if="activeTab === 'create'" class="form" @submit.prevent="handleCreate">
      <div class="field">
        <label for="nickname-create">你的昵称</label>
        <input
          id="nickname-create"
          v-model="nickname"
          type="text"
          placeholder="1-10个字符"
          maxlength="10"
          required
        />
      </div>

      <div class="field">
        <label for="room-name">房间名称（可选）</label>
        <input
          id="room-name"
          v-model="roomName"
          type="text"
          placeholder="默认：房间"
          maxlength="20"
        />
      </div>

      <div class="field">
        <label for="max-players">最大人数</label>
        <select id="max-players" v-model="maxPlayers">
          <option v-for="n in 10" :key="n" :value="n * 5">{{ n * 5 }} 人</option>
        </select>
      </div>

      <div class="field">
        <label for="password-create">房间密码（可选）</label>
        <input
          id="password-create"
          v-model="password"
          type="password"
          placeholder="无密码"
          maxlength="20"
        />
      </div>

      <button type="submit" class="btn-primary" :disabled="isLoading">
        {{ isLoading ? '创建中...' : '创建房间' }}
      </button>
    </form>

    <form v-else class="form" @submit.prevent="handleJoin">
      <div class="field">
        <label for="nickname-join">你的昵称</label>
        <input
          id="nickname-join"
          v-model="nickname"
          type="text"
          placeholder="1-10个字符"
          maxlength="10"
          required
        />
      </div>

      <div class="field">
        <label for="room-code">房间码</label>
        <input
          id="room-code"
          v-model="roomCode"
          type="text"
          placeholder="6位房间码"
          maxlength="6"
          required
        />
      </div>

      <div class="field">
        <label for="password-join">房间密码（如有）</label>
        <input
          id="password-join"
          v-model="password"
          type="password"
          placeholder="无密码"
          maxlength="20"
        />
      </div>

      <button type="submit" class="btn-primary" :disabled="isLoading">
        {{ isLoading ? '加入中...' : '加入房间' }}
      </button>
    </form>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'

const router = useRouter()
const roomStore = useRoomStore()

const activeTab = ref<'create' | 'join'>('create')
const nickname = ref('')
const roomName = ref('')
const roomCode = ref('')
const maxPlayers = ref(50)
const password = ref('')
const isLoading = ref(false)

const errorMessage = ref<string | null>(null)

watch(() => roomStore.error, (newError) => {
  errorMessage.value = newError
})

watch(() => roomStore.room, (newRoom) => {
  if (newRoom && roomStore.currentPlayerId) {
    router.push(`/lobby/${newRoom.code}`)
  }
})

function handleCreate() {
  if (!nickname.value.trim()) return

  isLoading.value = true
  errorMessage.value = null

  roomStore.createRoom(nickname.value.trim(), {
    roomName: roomName.value.trim() || undefined,
    maxPlayers: maxPlayers.value,
    password: password.value || undefined,
  })

  setTimeout(() => {
    if (!roomStore.room) {
      isLoading.value = false
    }
  }, 3000)
}

function handleJoin() {
  if (!nickname.value.trim() || !roomCode.value.trim()) return

  isLoading.value = true
  errorMessage.value = null

  roomStore.joinRoom(roomCode.value.trim(), nickname.value.trim(), password.value || undefined)

  setTimeout(() => {
    if (!roomStore.room) {
      isLoading.value = false
    }
  }, 3000)
}
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  gap: 1.5rem;
}

h1 {
  font-size: 2.5rem;
  color: #333;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  background: #e0e0e0;
  border-radius: 8px;
  padding: 4px;
}

.tabs button {
  padding: 0.5rem 1.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.2s;
}

.tabs button.active {
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 320px;
  background: #fff;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-size: 0.9rem;
  color: #666;
}

.field input,
.field select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: #4a90d9;
}

.btn-primary {
  padding: 0.75rem;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #3a7fc9;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error {
  color: #e53935;
  font-size: 0.9rem;
}
</style>