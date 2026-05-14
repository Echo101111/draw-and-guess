import { createRouter, createWebHistory } from 'vue-router'
import { useRoomStore } from '@/stores/room'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      path: '/lobby/:roomName',
      name: 'lobby',
      component: () => import('@/pages/LobbyPage.vue'),
      meta: { requiresRoom: true },
    },
    {
      path: '/game/:roomName',
      name: 'game',
      component: () => import('@/pages/GamePage.vue'),
      meta: { requiresRoom: true },
    },
  ],
})

router.beforeEach((to, _from) => {
  if (to.meta.requiresRoom) {
    const roomStore = useRoomStore()
    if (!roomStore.room || !roomStore.currentPlayerId) {
      return { path: '/' }
    }
  }
})

export default router