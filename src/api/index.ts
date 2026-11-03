// API 封装层
const BASE_URL = '/api/v2'

export function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T = any>(
  path: string,
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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  })

  const data = await res.json()

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/pet-garden/login'
    }
    throw new Error(data.error || '请求失败')
  }

  return data
}

export const api = {
  get: <T = any>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  // 认证
  studentLogin: (studentNo: string, realName: string) =>
    api.post('/auth/student/login', { studentNo, realName }),
  adminLogin: (username: string, password: string) =>
    api.post('/auth/admin/login', { username, password }),
  getMe: () => api.get('/auth/me'),

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
  createAchievement: (data: any) => api.post('/admin/achievements/create', data)
}
