<template>
  <Transition name="card">
    <div v-if="word" class="word-card">
      <div class="card-inner" :class="{ flipped: revealed }">
        <div class="card-front">
          <span class="card-icon">🕵️</span>
        </div>
        <div class="card-back" :class="{ spy: isSpy }">
          <span class="card-word">{{ word }}</span>
          <span v-if="isSpy" class="card-tag">卧底</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineProps<{
  word: string
  isSpy: boolean
}>()

const revealed = ref(false)

onMounted(() => {
  setTimeout(() => {
    revealed.value = true
  }, 800)
})
</script>

<style scoped>
.word-card {
  perspective: 800px;
  display: flex;
  justify-content: center;
}

.card-inner {
  width: 220px;
  height: 130px;
  position: relative;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-style: preserve-3d;
}

.card-inner.flipped {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.card-front {
  background: linear-gradient(145deg, var(--color-primary-light), var(--color-primary));
  color: white;
}

.card-icon {
  font-size: 40px;
  animation: cardFloat 1.8s ease-in-out infinite;
}

@keyframes cardFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.card-back {
  background: linear-gradient(145deg, var(--color-accent-pale), var(--color-bg));
  color: var(--color-text);
  border: 2px solid var(--color-accent);
  transform: rotateY(180deg);
  gap: 6px;
}

.card-back.spy {
  border-color: var(--color-danger);
  background: linear-gradient(145deg, var(--color-danger-light), #fff);
}

.card-word {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 3px;
  color: var(--color-text);
}

.card-back.spy .card-word {
  color: var(--color-danger);
}

.card-tag {
  font-size: 13px;
  color: var(--color-danger);
  font-weight: 700;
  background: var(--color-danger-light);
  padding: 2px 14px;
  border-radius: var(--radius-full);
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
