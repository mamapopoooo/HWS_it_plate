import { createRouter, createWebHistory } from 'vue-router'

/** 学生端页面：需学生登录 */
const STUDENT = { requiresAuth: true, role: 'student' as const }
/** 教师端页面：需管理员登录（造物审核、教师工作台） */
const ADMIN = { requiresAuth: true, role: 'admin' as const }

const router = createRouter({
  history: createWebHistory('/pet-garden/'),
  routes: [
    // v1 页面已下线（2026-11-04）。保留两条重定向，避免旧书签/退出登录跳转 404
    { path: '/', redirect: '/lobby' },
    { path: '/battle', redirect: '/duel' },

    // ===== v3.0 学生端（太极盘大厅及衍生页） =====
    { path: '/lobby', name: 'lobby', component: () => import('@/pages/GameLobby.vue'), meta: STUDENT },
    { path: '/collection', name: 'collection', component: () => import('@/pages/Collection.vue'), meta: STUDENT },
    { path: '/pet/:id', name: 'pet-detail', component: () => import('@/pages/PetDetail.vue'), meta: STUDENT },
    { path: '/gacha', name: 'gacha', component: () => import('@/pages/Gacha.vue'), meta: STUDENT },
    { path: '/ranking', name: 'ranking', component: () => import('@/pages/Ranking.vue'), meta: STUDENT },
    { path: '/shop', name: 'shop', component: () => import('@/pages/Shop.vue'), meta: STUDENT },
    { path: '/quests', name: 'quests', component: () => import('@/pages/Quests.vue'), meta: STUDENT },
    { path: '/achievements', name: 'achievements', component: () => import('@/pages/Achievements.vue'), meta: STUDENT },
    { path: '/character', name: 'character', component: () => import('@/pages/Character.vue'), meta: STUDENT },
    { path: '/custom', name: 'custom', component: () => import('@/pages/CustomPet.vue'), meta: STUDENT },
    { path: '/events', name: 'events', component: () => import('@/pages/Events.vue'), meta: STUDENT },
    // 斗法重做版；/battle 保留为旧版入口
    { path: '/duel', name: 'duel', component: () => import('@/pages/Duel.vue'), meta: STUDENT },

    // ===== v3.0 教师端（必须登录为管理员） =====
    { path: '/teacher', name: 'teacher', component: () => import('@/pages/TeacherDesk.vue'), meta: ADMIN },
    { path: '/review', name: 'review', component: () => import('@/pages/AdminReview.vue'), meta: ADMIN },
    { path: '/teacher/content', name: 'content-admin', component: () => import('@/pages/ContentAdmin.vue'), meta: ADMIN },

    // 登录（v3 国风版）
    { path: '/login', name: 'login', component: () => import('@/pages/Login.vue') }
  ]
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 开发预览：仅在 DEV 构建下生效，带 ?preview=1 可跳过角色校验（生产构建不会命中）
  if (import.meta.env.DEV && to.query.preview === '1') {
    next()
    return
  }

  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null

  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.meta.role && user?.role !== to.meta.role) {
    // 管理员可以查看学生端页面（课堂演示需要）；但学生不能进入教师端
    if (to.meta.role === 'student' && user?.role === 'admin') {
      next()
      return
    }
    // 角色不匹配，重定向到对应首页
    if (user?.role === 'admin') next('/teacher')
    else if (user?.role === 'student') next('/lobby')
    else next('/login')
  } else {
    next()
  }
})

export default router
