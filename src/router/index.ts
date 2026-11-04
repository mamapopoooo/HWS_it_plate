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

    // 登录（v3 国风版；v2 登录页保留在 pages/v2 仅作对照，路由已切到 v3）
    { path: '/login', name: 'login', component: () => import('@/pages/Login.vue') },

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
    if (user?.role === 'admin') next('/admin')
    else if (user?.role === 'student') next('/student')
    else next('/login')
  } else {
    next()
  }
})

export default router
