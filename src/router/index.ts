import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/pages/Home.vue'
import PetPreview from '@/pages/PetPreview.vue'
import Battle from '@/pages/Battle.vue'

const router = createRouter({
  history: createWebHistory('/pet-garden/'),
  routes: [
    // v1.0 路由
    { path: '/', name: 'home', component: Home },
    { path: '/preview', name: 'preview', component: PetPreview },
    { path: '/battle', name: 'battle', component: Battle },

    // v2.0 登录
    { path: '/login', name: 'login', component: () => import('@/pages/v2/Login.vue') },

    // v2.0 学生路由
    {
      path: '/student',
      component: () => import('@/layouts/StudentLayout.vue'),
      meta: { requiresAuth: true, role: 'student' },
      children: [
        { path: '', name: 'student-dashboard', component: () => import('@/pages/v2/student/Dashboard.vue') },
        { path: 'pets', name: 'student-pets', component: () => import('@/pages/v2/student/Pets.vue') },
        { path: 'battle', name: 'student-battle', component: () => import('@/pages/v2/student/Battle.vue') },
        { path: 'shop', name: 'student-shop', component: () => import('@/pages/v2/student/Shop.vue') },
        { path: 'gacha', name: 'student-gacha', component: () => import('@/pages/v2/student/Gacha.vue') },
        { path: 'achievements', name: 'student-achievements', component: () => import('@/pages/v2/student/Achievements.vue') },
        { path: 'quests', name: 'student-quests', component: () => import('@/pages/v2/student/Quests.vue') },
        { path: 'ranking', name: 'student-ranking', component: () => import('@/pages/v2/student/Ranking.vue') }
      ]
    },

    // v2.0 教师/管理员路由
    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true, role: 'admin' },
      children: [
        { path: '', name: 'admin-dashboard', component: () => import('@/pages/v2/admin/Dashboard.vue') },
        { path: 'students', name: 'admin-students', component: () => import('@/pages/v2/admin/Students.vue') },
        { path: 'points', name: 'admin-points', component: () => import('@/pages/v2/admin/Points.vue') },
        { path: 'pets', name: 'admin-pets', component: () => import('@/pages/v2/admin/Pets.vue') },
        { path: 'skins', name: 'admin-skins', component: () => import('@/pages/v2/admin/Skins.vue') },
        { path: 'quests', name: 'admin-quests', component: () => import('@/pages/v2/admin/Quests.vue') },
        { path: 'achievements', name: 'admin-achievements', component: () => import('@/pages/v2/admin/Achievements.vue') }
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
    // 角色不匹配，重定向到对应首页
    if (user?.role === 'admin') next('/admin')
    else if (user?.role === 'student') next('/student')
    else next('/login')
  } else {
    next()
  }
})

export default router
