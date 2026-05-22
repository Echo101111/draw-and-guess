<template>
  <Transition name="card">
    <div v-if="word" class="word-card">
      <div class="card-inner" :class="{ flipped: revealed }">
        <div class="card-front">
          <span class="card-hint">点击查看</span>
        </div>
        <div class="card-back" :class="{ spy: isSpy }">
          <span class="card-word">{{ word }}</span>
          <span v-if="isSpy" class="card-tag">你是卧底！</span>
        </div>
      </div>
      <button v-if="!revealed" class="card-reveal-btn" @click="reveal">查看词语</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineProps<{
  word: string
  isSpy: boolean
}>()

const emit = defineEmits<{
  revealed: []
}>()

const revealed = ref(false)

function reveal() {
  revealed.value = true
  emit('revealed')
}

onMounted(() => {
  setTimeout(() => {
    reveal()
  }, 800)
})
</script>

<style scoped>
.word-card {
  perspective: 600px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.card-inner {
  width: 180px;
  height: 100px;
  position: relative;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.card-inner.flipped {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden;
}

.card-front {
  background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
  color: white;
}

.card-back {
  background: linear-gradient(135deg, var(--color-accent-pale), var(--color-bg));
  color: var(--color-text);
  border: 2px solid var(--color-accent);
  transform: rotateY(180deg);
}

.card-back.spy {
  border-color: var(--color-danger);
  background: linear-gradient(135deg, var(--color-danger-light), #fff);
}

.card-word {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 2px;
}

.card-tag {
  font-size: 12px;
  color: var(--color-danger);
  font-weight: 600;
  margin-top: 2px;
}

.card-hint {
  font-size: 14px;
  opacity: 0.9;
}

.card-reveal-btn {
  border: none;
  background: var(--color-primary);
  color: white;
  padding: 6px 20px;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: 14px;
  transition: var(--transition);
}

.card-reveal-btn:hover {
  background: var(--color-primary-dark);
}

.card-enter-active,
.card-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
