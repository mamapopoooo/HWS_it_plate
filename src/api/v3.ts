// 王宠课堂 v3 API 封装
// 基础路径 /api/v3，支持 config 缓存和图片回落链

import { getToken } from './index'

const BASE_URL = '/api/v3'

// ========== 请求核心 ==========

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
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

// ========== 配置（前端启动缓存） ==========

let _configCache: any = null

export async function fetchConfig() {
  if (_configCache) return _configCache
  _configCache = await request('/config')
  return _configCache
}

export function getCachedConfig() {
  return _configCache
}

// ========== 宠物 ==========

export const v3Pets = {
  /** 宠物模板列表（支持 tier/trigram 筛选） */
  getTemplates(params?: { tier?: number; trigram?: string }) {
    const qs = new URLSearchParams()
    if (params?.tier) qs.set('tier', String(params.tier))
    if (params?.trigram) qs.set('trigram', params.trigram)
    const query = qs.toString()
    return request(`/pets/templates${query ? '?' + query : ''}`)
  },

  /** 我的宠物（含 form/power） */
  getMyPets() {
    return request('/pets/my')
  },

  /** 觉醒（返回 form/formChanged） */
  awakenPet(petId: string) {
    return request(`/pets/${petId}/awaken`, { method: 'POST' })
  },

  /** 检查隐藏位解锁（阴鱼+阳鱼） */
  checkHiddenUnlock() {
    return request('/pets/hidden/check', { method: 'POST' })
  }
}

// ========== 抽卡 ==========

export const v3Gacha = {
  /** 抽卡（返回 tier/trigram/isNew） */
  draw(count = 1) {
    return request('/gacha/draw', {
      method: 'POST',
      body: JSON.stringify({ count })
    })
  },

  /** 概率公示 */
  getRates() {
    return request('/gacha/rates')
  }
}

// ========== 图鉴 ==========

export const v3Collection = {
  /** 图鉴（按 tier 分组） */
  get() {
    return request('/collection')
  }
}

// ========== 角色 ==========

export const v3Character = {
  /** 我的角色 */
  getMe() {
    return request('/character/me')
  },

  /** 更新角色（nickname/gender） */
  update(data: { nickname?: string; gender?: string }) {
    return request('/character/update', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  /** 装备皮肤 */
  equipSkin(skinId: string) {
    return request('/character/equip-skin', {
      method: 'POST',
      body: JSON.stringify({ skinId })
    })
  },

  /** 可购买皮肤列表 */
  getSkins() {
    return request('/character/skins')
  },

  /** 购买皮肤 */
  buySkin(skinId: string) {
    return request('/character/buy-skin', {
      method: 'POST',
      body: JSON.stringify({ skinId })
    })
  }
}

// ========== 造物 ==========

export const v3CustomPets = {
  /** 提交造物 */
  submit(data: { name: string; image?: string; trigram?: string; skills: any[] }) {
    return request('/custom-pets/submit', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  /** 我的造物 */
  getMy() {
    return request('/custom-pets/my')
  }
}

// ========== 教师审核 ==========

export const v3Admin = {
  /** 待审队列 */
  getPendingCustomPets() {
    return request('/admin/custom-pets/pending')
  },

  /** 审核 */
  reviewCustomPet(petId: string, approved: boolean, note?: string) {
    return request('/admin/custom-pets/review', {
      method: 'POST',
      body: JSON.stringify({ petId, approved, note })
    })
  }
}

// ========== 活动 ==========

export const v3Events = {
  /** 当前活动 */
  getActive() {
    return request('/events/active')
  },

  /** 领取奖励 */
  claim(eventId: string) {
    return request(`/events/${eventId}/claim`, { method: 'POST' })
  }
}

// ========== 排行榜 ==========

export const v3Rankings = {
  /** 获取榜单（id: points/power/collection） */
  get(id: string, grade?: number) {
    const qs = grade ? `?grade=${grade}` : ''
    return request(`/rankings/${id}${qs}`)
  }
}

// ========== 图片回落链 ==========

/**
 * 生成宠物图片 URL（带回落链）
 * 回落顺序：form{N}.png → form1.png → 默认占位图
 *
 * @param petId - 宠物模板 ID（如 pet_luwu）
 * @param form - 当前形数（1-based）
 * @param formImages - form_images JSON 对象 { 1: "/path/form1.png", ... }
 * @returns 最终可用的图片 URL
 */
export function getPetImageUrl(
  petId: string,
  form: number = 1,
  formImages?: Record<number, string>
): string {
  const prefix = petId.replace('pet_', '')
  const basePath = `/pet-garden/pets/${prefix}`

  // 如果有 formImages 配置，优先使用
  if (formImages) {
    // 尝试当前 form
    if (formImages[form]) return formImages[form]
    // 回落到 form1
    if (formImages[1]) return formImages[1]
  }

  // 回落链：当前 form → form1 → 默认占位
  return `${basePath}/form${form}.png`
}

/**
 * 图片加载失败时的回落处理
 * 用于 <img @error="fallbackHandler"> 场景
 */
export function createImageFallbackChain(
  petId: string,
  form: number = 1
): (e: Event) => void {
  const prefix = petId.replace('pet_', '')
  const basePath = `/pet-garden/pets/${prefix}`

  // 构建回落序列
  const chain: string[] = []
  if (form > 1) chain.push(`${basePath}/form${form}.png`)
  chain.push(`${basePath}/form1.png`)
  chain.push('/pet-garden/pets/_placeholder.png') // 最终占位图

  let attempt = 0
  return (e: Event) => {
    attempt++
    const img = e.target as HTMLImageElement
    if (attempt < chain.length) {
      img.src = chain[attempt]
    } else {
      // 所有回落都失败，用 CSS 占位
      img.style.display = 'none'
    }
  }
}
