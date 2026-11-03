/**
 * 数据对接层（adapter）
 *
 * 页面只调这里的函数，不直接摸 axios、也不自己写 DEMO_*。
 * 每个函数都是「先试真实接口，失败则回落占位数据」——
 * 所以 Qoder 的 /api/v2 就绪后，前端不需要改任何页面，刷新即生效。
 *
 * 端点前缀：/pet-garden/api + /v2/*（见 00-总纲 §12）。
 */
import { reactive } from 'vue'
import { useAuth } from '@/composables/useAuth'
import {
  DEMO_ACHIEVEMENTS,
  DEMO_CHARACTER,
  DEMO_OWNED,
  DEMO_PROFILE,
  DEMO_QUESTS,
  DEMO_RANK,
  DEMO_SUBMISSIONS,
} from './demo'
import type {
  AchievementState,
  CharacterState,
  CustomPetSubmission,
  GachaDrawn,
  Gender,
  OwnedMap,
  Profile,
  QuestProgress,
  RankRow,
  Wallet,
} from './types'

const { api } = useAuth()

/** 接口超时：课堂网络差时别让页面卡住，1.5s 内没响应就走占位 */
const TIMEOUT = 1500

/** 统计「这一屏数据有多少来自真接口」，方便在界面上做数据来源标识 */
export const dataStats = reactive({ live: 0, mock: 0 })

function ok<T>(value: T): T {
  dataStats.live += 1
  return value
}

function mock<T>(value: T): T {
  dataStats.mock += 1
  return value
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const asArray = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null)

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def)
const str = (v: unknown, def = ''): string => (typeof v === 'string' ? v : def)

async function tryGet<T>(url: string, pick: (data: unknown) => T | null, fallback: T): Promise<T> {
  try {
    const res = await api.get(url, { timeout: TIMEOUT })
    const value = pick(res.data)
    if (value !== null) return ok(value)
  } catch {
    /* 接口未就绪 → 走占位 */
  }
  return mock(fallback)
}

async function tryPost<T>(url: string, body: unknown, pick: (data: unknown) => T | null, fallback: T): Promise<T> {
  try {
    const res = await api.post(url, body, { timeout: TIMEOUT })
    const value = pick(res.data)
    if (value !== null) return ok(value)
  } catch {
    /* 同上 */
  }
  return mock(fallback)
}

/* ---------------- 档案与钱包 ---------------- */

function pickProfile(data: unknown): Profile | null {
  const t = asRecord(asRecord(data)?.trainer)
  if (!t) return null
  const nickname = str(t.nickname, str(t.real_name, '同学们'))
  const realName = str(t.real_name, '')
  return {
    userId: str(t.user_id),
    displayName: realName ? `${nickname} · ${realName}` : nickname,
    nickname,
    realName,
    grade: num(t.grade, 6) === 7 ? 7 : 6,
    realm: str(t.title, '练气'),
    trainerLevel: num(t.level, 1),
    points: num(t.game_points),
    shards: num(t.fragments),
    gender: (str(t.gender, 'female') === 'male' ? 'male' : 'female') as Gender,
  }
}

export async function fetchProfile(): Promise<Profile> {
  return tryGet('/v2/trainer/me', pickProfile, DEMO_PROFILE)
}

export async function fetchWallet(): Promise<Wallet> {
  const profile = await fetchProfile()
  return { points: profile.points, shards: profile.shards }
}

/* ---------------- 宠物与图鉴 ---------------- */

function pickOwned(data: unknown): OwnedMap | null {
  const pets = asArray(asRecord(data)?.pets)
  if (!pets) return null
  const map: OwnedMap = {}
  for (const raw of pets) {
    const p = asRecord(raw)
    if (!p) continue
    const id = str(p.templateId, str(p.template_id, str(p.id)))
    if (id) map[id] = num(p.level, 1)
  }
  return map
}

export async function fetchOwned(): Promise<OwnedMap> {
  return tryGet('/v2/pets/my', pickOwned, DEMO_OWNED)
}

/* ---------------- 任务 / 成就 ---------------- */

function pickQuests(data: unknown): QuestProgress[] | null {
  const rows = asArray(asRecord(data)?.progress)
  if (!rows) return null
  return rows.map((raw) => {
    const q = asRecord(raw) ?? {}
    return {
      questId: str(q.quest_id, str(q.questId)),
      progress: num(q.progress),
      claimed: Boolean(q.claimed),
    }
  })
}

export async function fetchQuests(): Promise<QuestProgress[]> {
  return tryGet('/v2/quests/daily', pickQuests, DEMO_QUESTS)
}

export async function claimQuest(questId: string): Promise<{ ok: boolean; points: number }> {
  return tryPost(
    `/v2/quests/${questId}/claim`,
    {},
    (data) => {
      const t = asRecord(data)
      if (!t) return null
      return { ok: Boolean(t.success ?? true), points: num(t.reward_points) }
    },
    { ok: false, points: 0 },
  )
}

function pickAchievements(data: unknown): AchievementState[] | null {
  const rows = asArray(asRecord(data)?.achievements)
  if (!rows) return null
  return rows.map((raw) => {
    const a = asRecord(raw) ?? {}
    return {
      achievementId: str(a.id, str(a.achievement_id)),
      unlocked: Boolean(a.unlocked),
      progress: num(a.progress),
    }
  })
}

export async function fetchAchievements(): Promise<AchievementState[]> {
  return tryGet('/v2/achievements/my', pickAchievements, DEMO_ACHIEVEMENTS)
}

/* ---------------- 排行榜 ---------------- */

function pickRank(data: unknown): RankRow[] | null {
  const rows = asArray(asRecord(data)?.rankings)
  if (!rows) return null
  return rows.map((raw) => {
    const r = asRecord(raw) ?? {}
    const nickname = str(r.nickname)
    const realName = str(r.real_name)
    return {
      userId: str(r.user_id),
      nickname,
      realName,
      gender: (str(r.gender, 'female') === 'male' ? 'male' : 'female') as Gender,
      points: num(r.points),
      power: num(r.power),
      collection: num(r.collection),
      rate: num(r.rate),
      me: Boolean(r.is_me),
    }
  })
}

export async function fetchRanking(metric: 'points' | 'power' | 'collection', grade: number): Promise<RankRow[]> {
  const path =
    metric === 'points' ? '/v2/ranking/points' : metric === 'power' ? '/v2/ranking/pvp' : '/v2/ranking/class'
  return tryGet(`${path}?grade=${grade}`, pickRank, DEMO_RANK)
}

/* ---------------- 角色 ---------------- */

function pickCharacter(data: unknown): CharacterState | null {
  const t = asRecord(asRecord(data)?.character)
  if (!t) return null
  return {
    nickname: str(t.nickname, '同学们'),
    realName: str(t.real_name, ''),
    gender: (str(t.gender, 'female') === 'male' ? 'male' : 'female') as Gender,
    skinId: str(t.skin_id, 'skin_base_f'),
    ownedSkinIds: asArray(t.owned_skin_ids)?.map((x) => str(x)) ?? [],
  }
}

export async function fetchCharacter(): Promise<CharacterState> {
  return tryGet('/v2/character/me', pickCharacter, DEMO_CHARACTER)
}

export async function saveSkin(skinId: string): Promise<boolean> {
  return tryPost(`/v2/character/skin`, { skinId }, (d) => Boolean(asRecord(d)?.success), false)
}

/* ---------------- 造物与审核 ---------------- */

function pickSubmissions(data: unknown): CustomPetSubmission[] | null {
  const rows = asArray(asRecord(data)?.items)
  if (!rows) return null
  return rows.map((raw) => {
    const s = asRecord(raw) ?? {}
    return {
      id: str(s.id),
      student: str(s.student_name),
      nickname: str(s.nickname),
      petName: str(s.pet_name),
      pinyin: str(s.pinyin),
      desc: str(s.description),
      skills: asArray(s.skills)?.map((x) => str(x)) ?? [],
      submittedAt: str(s.submitted_at_display, '—'),
      status: (str(s.status, 'pending') as CustomPetSubmission['status']) ?? 'pending',
      note: str(s.review_note) || undefined,
    }
  })
}

export async function fetchSubmissions(): Promise<CustomPetSubmission[]> {
  return tryGet('/v2/admin/custom-pets/pending', pickSubmissions, DEMO_SUBMISSIONS)
}

export async function reviewSubmission(id: string, action: 'approve' | 'reject', note: string): Promise<boolean> {
  return tryPost(
    `/v2/admin/custom-pets/${id}/review`,
    { action, note },
    (d) => Boolean(asRecord(d)?.success),
    false,
  )
}

/* ---------------- 求签（服务端权威前先用本地） ---------------- */

export async function drawOnServer(kind: 'single' | 'ten'): Promise<GachaDrawn[] | null> {
  try {
    const res = await api.post('/v2/gacha/draw', { kind }, { timeout: TIMEOUT })
    const rows = asArray(asRecord(res.data)?.results)
    if (!rows) return null
    return rows.map((raw) => {
      const r = asRecord(raw) ?? {}
      return {
        tier: num(r.tier, 1),
        petId: str(r.pet_id),
        isNew: Boolean(r.is_new),
        fragments: num(r.fragments),
      }
    })
  } catch {
    return null
  }
}
