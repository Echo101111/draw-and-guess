import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      path: '/lobby/:roomCode',
      name: 'lobby',
      component: () => import('@/pages/LobbyPage.vue'),
    },
    {
      path: '/game/:roomCode',
      name: 'game',
      component: () => import('@/pages/GamePage.vue'),
    },
  ],
})

export default router