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
import { EVENTS } from '@/config/contentConfig'
import type { EventDef } from '@/config/contentConfig'
import {
  DEMO_ACHIEVEMENTS,
  DEMO_CHARACTER,
  DEMO_CLASSES,
  DEMO_EVALUATIONS,
  DEMO_OPPONENT,
  DEMO_OWNED,
  DEMO_PROFILE,
  DEMO_QUESTS,
  DEMO_RANK,
  DEMO_STUDENTS,
  DEMO_SUBMISSIONS,
} from './demo'
import type {
  AchievementState,
  BattleReport,
  CharacterState,
  ClassRow,
  CustomPetSubmission,
  EvaluationRow,
  GachaDrawn,
  Gender,
  ImportRow,
  Opponent,
  OwnedMap,
  PointsRecord,
  Profile,
  QuestProgress,
  RankRow,
  TeacherStudent,
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

/* ---------------- 斗法：匹配与结算 ---------------- */

function pickOpponent(data: unknown): Opponent | null {
  const t = asRecord(asRecord(data)?.opponent)
  if (!t) return null
  const petId = str(t.templateId, str(t.template_id, str(t.pet_id)))
  if (!petId) return null
  return {
    petId,
    level: num(t.level, 5),
    awakenLevel: num(t.awakenLevel, num(t.awaken_level, 0)),
    nickname: str(t.nickname) || undefined,
  }
}

/** 按玩家战力匹配对手；接口未就绪时返回固定的占位对手 */
export async function fetchOpponent(power: number): Promise<Opponent> {
  return tryPost('/v2/battle/pvp/match', { power }, pickOpponent, DEMO_OPPONENT)
}

/** 结算上报（失败不影响本地显示，仅记账） */
export async function reportBattle(report: BattleReport): Promise<boolean> {
  return tryPost('/v2/battle/pve/result', report, (d) => Boolean(asRecord(d)?.success), false)
}

/* ---------------- 活动 ---------------- */

function pickEvents(data: unknown): EventDef[] | null {
  const rows = asArray(asRecord(data)?.events)
  if (!rows) return null
  return rows.map((raw, i) => {
    const e = asRecord(raw) ?? {}
    return {
      id: str(e.id),
      name: str(e.name),
      type: str(e.type, 'festival'),
      startDate: str(e.startDate, str(e.start_date, '')),
      endDate: str(e.endDate, str(e.end_date, '')),
      desc: str(e.description, ''),
      reward: [],
      banner: str(e.banner_image) || undefined,
      sortOrder: num(e.sort_order, i + 1),
    }
  })
}

/** 进行中的活动；接口未就绪时用 seeds 里的活动表 */
export async function fetchEvents(): Promise<EventDef[]> {
  return tryGet('/v2/events/active', pickEvents, EVENTS)
}

/* ---------------- 教师端 ---------------- */

function pickStudents(data: unknown): TeacherStudent[] | null {
  const rows = asArray(asRecord(data)?.students)
  if (!rows) return null
  return rows.map((raw) => {
    const s = asRecord(raw) ?? {}
    return {
      id: str(s.id),
      name: str(s.name, str(s.real_name)),
      studentNo: str(s.student_no, str(s.username)),
      points: num(s.points, num(s.total_points)),
      petName: str(s.pet_name, '—'),
      petLevel: num(s.pet_level, 1),
    }
  })
}

/** 班级名单（含积分与宠物等级） */
export async function fetchTeacherStudents(): Promise<TeacherStudent[]> {
  return tryGet('/v2/teacher/students', pickStudents, DEMO_STUDENTS)
}

/** 批量同步积分（教师端加减分） */
export async function syncPoints(records: PointsRecord[]): Promise<boolean> {
  return tryPost('/v2/teacher/sync-points', { records }, (d) => Boolean(asRecord(d)?.success), false)
}

/* ---------------- 班级与学生（v2 接口，教师端在用） ---------------- */

function pickClasses(data: unknown): ClassRow[] | null {
  const rows = asArray(asRecord(data)?.classes)
  if (!rows) return null
  return rows.map((raw) => {
    const c = asRecord(raw) ?? {}
    return { id: str(c.id), name: str(c.name) }
  })
}

/** 班级列表；未登录/未就绪时回落占位两个班 */
export async function fetchClasses(): Promise<ClassRow[]> {
  return tryGet('/classes', pickClasses, DEMO_CLASSES)
}

function pickClassStudents(data: unknown): TeacherStudent[] | null {
  const rows = asArray(asRecord(data)?.students)
  if (!rows) return null
  return rows.map((raw) => {
    const s = asRecord(raw) ?? {}
    return {
      id: str(s.id),
      name: str(s.name),
      studentNo: str(s.student_no),
      points: num(s.total_points),
      petName: str(s.pet_name, '—'),
      petLevel: num(s.pet_level, 1),
    }
  })
}

/** 某班学生名单 */
export async function fetchClassStudents(classId: string): Promise<TeacherStudent[]> {
  return tryGet(`/classes/${classId}/students`, pickClassStudents, DEMO_STUDENTS)
}

/** 批量导入学生：body { classId, students: [{ name, studentNo }] } */
export async function importStudents(classId: string, rows: ImportRow[]): Promise<number> {
  return tryPost(
    '/students/import',
    { classId, students: rows },
    (d) => {
      const t = asRecord(d)
      if (!t || !t.success) return null
      return num(t.imported, rows.length)
    },
    0,
  )
}

/** 新建班级；失败返回 null（占位模式由调用方本地造一个） */
export async function createClass(name: string): Promise<ClassRow | null> {
  return tryPost(
    '/classes',
    { name },
    (d) => {
      const c = asRecord(d)
      if (!c || !c.id) return null
      return { id: str(c.id), name: str(c.name, name) }
    },
    null,
  )
}

/** 修改学生（改名 / 改学号） */
export async function updateStudent(id: string, patch: { name?: string; studentNo?: string }): Promise<boolean> {
  return tryPost(`/students/${id}`, patch, (d) => Boolean(asRecord(d)?.success), false)
}

/** 删除学生 */
export async function deleteStudent(id: string): Promise<boolean> {
  try {
    const res = await api.delete(`/students/${id}`, { timeout: TIMEOUT })
    if (asRecord(res.data)?.success) return ok(true)
  } catch {
    /* 未就绪 */
  }
  return mock(false)
}

function pickEvaluations(data: unknown): EvaluationRow[] | null {
  const rows = asArray(asRecord(data)?.records)
  if (!rows) return null
  return rows.map((raw) => {
    const r = asRecord(raw) ?? {}
    return {
      id: str(r.id),
      studentName: str(r.student_name, '—'),
      points: num(r.points),
      reason: str(r.reason),
      category: str(r.category),
      timestamp: num(r.timestamp),
    }
  })
}

/** 最近积分流水（按班级） */
export async function fetchEvaluations(classId: string, pageSize = 10): Promise<EvaluationRow[]> {
  return tryGet(`/evaluations?classId=${classId}&pageSize=${pageSize}`, pickEvaluations, DEMO_EVALUATIONS)
}
