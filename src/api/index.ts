// API 封装层
//
// 基址必须跟着 Vite 的 base 走：Vite 配置了 base: '/pet-garden/'，
// 开发期只有 '/pet-garden/api' 会被代理到后端（见 vite.config.ts），
// 生产期由 Nginx 把 /pet-garden/api 转到 3002。写死 '/api/v2' 会打到 Vite 自己，
// 拿到一段非 JSON 文本，前端就会报 "Unexpected token ..." 之类。
const API_ROOT = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, '')

/** v2 业务接口（训练师/宠物/战斗/商城…）挂在 /api/v2 下 */
const V2 = `${API_ROOT}/v2`

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { ...options, headers })

  // 后端没起来 / 被代理转成 HTML 时，不要直接 res.json()，否则报 "Unexpected token"
  const text = await res.text()
  let data: any = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = `${import.meta.env.BASE_URL}login`
      }
      throw new Error(
        res.ok
          ? '接口返回的不是 JSON，确认后端已在 3002 启动'
          : `接口异常（HTTP ${res.status}），确认后端已在 3002 启动`
      )
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = `${import.meta.env.BASE_URL}login`
    }
    throw new Error(data.error || '请求失败')
  }

  return data as T
}

/** 认证类接口挂在 /api 下（不是 /api/v2） */
const auth = {
  get: <T = any>(path: string) => request<T>(`${API_ROOT}${path}`, { method: 'GET' }),
  post: <T = any>(path: string, body?: any) =>
    request<T>(`${API_ROOT}${path}`, { method: 'POST', body: JSON.stringify(body) }),
}

export const api = {
  get: <T = any>(path: string) => request<T>(`${V2}${path}`, { method: 'GET' }),
  post: <T = any>(path: string, body?: any) =>
    request<T>(`${V2}${path}`, { method: 'POST', body: JSON.stringify(body) }),

  // 认证（/api/auth/*）
  studentLogin: (studentNo: string, realName: string) =>
    auth.post('/auth/student/login', { studentNo, realName }),
  adminLogin: (username: string, password: string) =>
    auth.post('/auth/admin/login', { username, password }),
  getMe: () => auth.get('/auth/me'),

  // 训练师
  getTrainer: () => api.get('/trainer/me'),
  levelUp: () => api.post('/trainer/level-up'),
  updateTitle: (title: string) => api.post('/trainer/update-title', { title }),

  // 宠物
  getPetTemplates: () => api.get('/pets/templates'),
  getMyPets: () => api.get('/pets/my'),
  obtainPet: (templateId: string) => api.post('/pets/obtain', { templateId }),
  awakenPet: (petId: string) => api.post(`/pets/${petId}/awaken`),
  equipSkin: (petId: string, skinId: string) =>
    api.post(`/pets/${petId}/equip-skin`, { skinId }),
  getPetSkills: (petId: string) => api.get(`/pets/${petId}/skills`),
  learnSkill: (petId: string, skillId: string) =>
    api.post(`/pets/${petId}/learn-skill`, { skillId }),
  getCollection: () => api.get('/pets/collection'),

  // 战斗
  startPVE: (teamPetIds: string[]) =>
    api.post('/battle/pve/start', { teamPetIds }),
  matchPVP: () => api.post('/battle/pvp/match'),
  getClassBattleInfo: () => api.get('/battle/class/info'),

  // 商城
  getItems: () => api.get('/shop/items'),
  buyItem: (itemId: string, quantity = 1) =>
    api.post('/shop/buy', { itemId, quantity }),
  getSkins: () => api.get('/shop/skins'),
  buySkin: (skinId: string) => api.post('/shop/skins/buy', { skinId }),

  // 抽卡
  draw: (eggType: string, count = 1) =>
    api.post('/gacha/draw', { eggType, count }),
  getGachaRecords: () => api.get('/gacha/records'),
  getGachaRates: () => api.get('/gacha/rates'),

  // 任务
  getDailyQuests: () => api.get('/quests/daily'),
  getWeeklyQuests: () => api.get('/quests/weekly'),
  claimQuest: (questId: string) => api.post(`/quests/${questId}/claim`),

  // 成就
  getAchievements: () => api.get('/achievements'),
  getMyAchievements: () => api.get('/achievements/my'),
  claimAchievement: (id: string) => api.post(`/achievements/${id}/claim`),

  // 排行榜
  getPointsRanking: () => api.get('/ranking/points'),
  getPVPRanking: () => api.get('/ranking/pvp'),
  getClassRanking: () => api.get('/ranking/class'),

  // 教师端
  syncPoints: (records: any[]) => api.post('/teacher/sync-points', { records }),
  getStudents: () => api.get('/teacher/students'),
  startClassBattle: (classAId: string, classBId: string, duration = 5) =>
    api.post('/teacher/class-battle/start', { classAId, classBId, duration }),

  // 管理端
  getStats: () => api.get('/admin/stats'),
  createPet: (data: any) => api.post('/admin/pets/create', data),
  createSkin: (data: any) => api.post('/admin/skins/create', data),
  createQuest: (data: any) => api.post('/admin/quests/create', data),
  createAchievement: (data: any) => api.post('/admin/achievements/create', data),
}
