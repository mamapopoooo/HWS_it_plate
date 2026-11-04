import { createRouter, createWebHistory } from 'vue-router'

/** 学生端页面：需学生登录 */
const STUDENT = { requiresAuth: true, role: 'student' as const }
/** 教师端页面：需管理员登录（造物审核、教师工作台） */
const ADMIN = { requiresAuth: true, role: 'admin' as const }

const router = createRouter({
  history: createWebHistory('/pet-garden/'),
  routes: [
    // v1 页面已下线。保留重定向，避免旧书签 404
    { path: '/', redirect: '/lobby' },
    { path: '/battle', redirect: '/duel' },

    // ===== v3.0 学生端（扁平路由 + 独立页面） =====
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
    { path: '/duel', name: 'duel', component: () => import('@/pages/Duel.vue'), meta: STUDENT },

    // ===== v3.0 学生端（Layout 嵌套路由：Qoder 页面） =====
    {
      path: '/student',
      component: () => import('@/layouts/v3/StudentLayout.vue'),
      meta: STUDENT,
      children: [
        { path: '', name: 'student-dashboard', component: () => import('@/pages/v3/student/Dashboard.vue') },
        { path: 'pets', name: 'student-pets', component: () => import('@/pages/v3/student/Pets.vue') },
        { path: 'gacha', name: 'student-gacha', component: () => import('@/pages/v3/student/Gacha.vue') },
        { path: 'ranking', name: 'student-ranking', component: () => import('@/pages/v3/student/Ranking.vue') },
        { path: 'shop', name: 'student-shop', component: () => import('@/pages/v3/student/Shop.vue') },
        { path: 'battle', name: 'student-battle', component: () => import('@/pages/v3/student/Battle.vue') },
        { path: 'character', name: 'student-character', component: () => import('@/pages/v3/student/Character.vue') },
        { path: 'custom-pet', name: 'student-custom-pet', component: () => import('@/pages/v3/student/CustomPet.vue') },
        { path: 'quests', name: 'student-quests', component: () => import('@/pages/v3/student/Quests.vue') },
        { path: 'achievements', name: 'student-achievements', component: () => import('@/pages/v3/student/Achievements.vue') }
      ]
    },

    // ===== v3.0 教师端（必须登录为管理员） =====
    { path: '/teacher', name: 'teacher', component: () => import('@/pages/TeacherDesk.vue'), meta: ADMIN },
    { path: '/review', name: 'review', component: () => import('@/pages/AdminReview.vue'), meta: ADMIN },
    { path: '/teacher/content', name: 'content-admin', component: () => import('@/pages/ContentAdmin.vue'), meta: ADMIN },

    // ===== v3.0 管理员端（Layout 嵌套路由：Qoder 页面） =====
    {
      path: '/admin',
      component: () => import('@/layouts/v3/AdminLayout.vue'),
      meta: ADMIN,
      children: [
        { path: '', name: 'admin-dashboard', component: () => import('@/pages/v3/admin/Dashboard.vue') },
        { path: 'students', name: 'admin-students', component: () => import('@/pages/v3/admin/Students.vue') },
        { path: 'points', name: 'admin-points', component: () => import('@/pages/v3/admin/Points.vue') },
        { path: 'pets', name: 'admin-pets', component: () => import('@/pages/v3/admin/Pets.vue') },
        { path: 'skins', name: 'admin-skins', component: () => import('@/pages/v3/admin/Skins.vue') },
        { path: 'review', name: 'admin-review', component: () => import('@/pages/v3/admin/Review.vue') }
      ]
    },

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
