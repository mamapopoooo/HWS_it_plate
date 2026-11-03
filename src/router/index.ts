import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/pages/Home.vue'
import PetPreview from '@/pages/PetPreview.vue'
import Battle from '@/pages/Battle.vue'

const router = createRouter({
  history: createWebHistory('/pet-garden/'),
  routes: [
    // v1.0 路由（保留兼容）
    { path: '/', name: 'home', component: Home },
    { path: '/preview', name: 'preview', component: PetPreview },
    { path: '/battle-v1', name: 'battle-v1', component: Battle },

    // v3.0 太极盘大厅
    { path: '/lobby', name: 'lobby', component: () => import('@/pages/GameLobby.vue') },

    // v3.0 登录
    { path: '/login', name: 'login', component: () => import('@/pages/v2/Login.vue') },

    // ========== v3.0 学生路由 ==========
    {
      path: '/student',
      component: () => import('@/layouts/v3/StudentLayout.vue'),
      meta: { requiresAuth: true, role: 'student' },
      children: [
        { path: '', name: 'student-dashboard', component: () => import('@/pages/v3/student/Dashboard.vue') },
        { path: 'pets', name: 'student-pets', component: () => import('@/pages/v3/student/Pets.vue') },
        { path: 'gacha', name: 'student-gacha', component: () => import('@/pages/v3/student/Gacha.vue') },
        { path: 'collection', name: 'student-collection', component: () => import('@/pages/Collection.vue') },
        { path: 'ranking', name: 'student-ranking', component: () => import('@/pages/v3/student/Ranking.vue') },
        { path: 'shop', name: 'student-shop', component: () => import('@/pages/v3/student/Shop.vue') },
        { path: 'battle', name: 'student-battle', component: () => import('@/pages/v3/student/Battle.vue') },
        { path: 'character', name: 'student-character', component: () => import('@/pages/v3/student/Character.vue') },
        { path: 'custom-pet', name: 'student-custom-pet', component: () => import('@/pages/v3/student/CustomPet.vue') },
        { path: 'quests', name: 'student-quests', component: () => import('@/pages/v3/student/Quests.vue') },
        { path: 'achievements', name: 'student-achievements', component: () => import('@/pages/v3/student/Achievements.vue') }
      ]
    },

    // ========== v3.0 管理员路由 ==========
    {
      path: '/admin',
      component: () => import('@/layouts/v3/AdminLayout.vue'),
      meta: { requiresAuth: true, role: 'admin' },
      children: [
        { path: '', name: 'admin-dashboard', component: () => import('@/pages/v3/admin/Dashboard.vue') },
        { path: 'students', name: 'admin-students', component: () => import('@/pages/v3/admin/Students.vue') },
        { path: 'points', name: 'admin-points', component: () => import('@/pages/v3/admin/Points.vue') },
        { path: 'pets', name: 'admin-pets', component: () => import('@/pages/v3/admin/Pets.vue') },
        { path: 'skins', name: 'admin-skins', component: () => import('@/pages/v3/admin/Skins.vue') },
        { path: 'review', name: 'admin-review', component: () => import('@/pages/v3/admin/Review.vue') }
      ]
    }
  ]
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null

  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.meta.role && user?.role !== to.meta.role) {
    if (user?.role === 'admin') next('/admin')
    else if (user?.role === 'student') next('/student')
    else next('/login')
  } else {
    next()
  }
})

export default router
