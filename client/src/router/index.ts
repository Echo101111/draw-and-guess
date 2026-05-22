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
    // 旧路由别名，兼容已有分享链接
    {
      path: '/lobby/:roomName',
      redirect: (to) => `/draw/lobby/${to.params.roomName}`,
    },
    {
      path: '/game/:roomName',
      redirect: (to) => `/draw/game/${to.params.roomName}`,
    },
    // 新路由
    {
      path: '/draw/lobby/:roomName',
      name: 'draw-lobby',
      component: () => import('@/pages/DrawLobbyPage.vue'),
      meta: { requiresRoom: true, gameType: 'draw' },
    },
    {
      path: '/draw/game/:roomName',
      name: 'draw-game',
      component: () => import('@/pages/DrawGamePage.vue'),
      meta: { requiresRoom: true, gameType: 'draw' },
    },
    {
      path: '/spy/lobby/:roomName',
      name: 'spy-lobby',
      component: () => import('@/pages/SpyLobbyPage.vue'),
      meta: { requiresRoom: true, gameType: 'spy' },
    },
    {
      path: '/spy/game/:roomName',
      name: 'spy-game',
      component: () => import('@/pages/SpyGamePage.vue'),
      meta: { requiresRoom: true, gameType: 'spy' },
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