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
      path: '/lobby/:roomName',
      name: 'lobby',
      component: () => import('@/pages/LobbyPage.vue'),
    },
    {
      path: '/game/:roomName',
      name: 'game',
      component: () => import('@/pages/GamePage.vue'),
    },
  ],
})

export default router