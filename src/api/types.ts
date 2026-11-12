/**
 * 前端数据契约（对应 00-总纲 §11 协作契约 与 §12 API 契约）
 *
 * 页面只依赖这里的类型；真实接口与占位数据的差异由 api/adapter.ts 吸收。
 */

export type Gender = 'male' | 'female'

/** 玩家档案（HUD 用） */
export interface Profile {
  userId: string
  /** 显示名：有角色昵称时「昵称 · 真名」，没有昵称就只显示真名 */
  displayName: string
  nickname: string
  realName: string
  grade: 6 | 7
  /** 后端返回的真实班级名，如「七年级A班」；缺失时 HUD 回落成 G7 班 */
  className: string
  realm: string
  trainerLevel: number
  points: number
  /** 今日新增功名（当天积分流水之和，不是总积分） */
  todayPoints: number
  /** 今日斗法场次 */
  duelsToday: number
  shards: number
  gender: Gender
}

/** 玩家持有的一只宠物 */
export interface OwnedPet {
  petId: string
  level: number
  exp: number
  awakenLevel: number
  /** 由觉醒阶换算：form = awaken + 1（受品阶封顶） */
  form: number
  /** 立绘覆盖（缺省按约定路径） */
  image?: string
}

/** 图鉴持有情况：petId → 等级 */
export type OwnedMap = Record<string, number>

/** 任务进度 */
export interface QuestProgress {
  questId: string
  progress: number
  claimed: boolean
}

/** 成就状态 */
export interface AchievementState {
  achievementId: string
  unlocked: boolean
  progress: number
}

/** 排行榜行 */
export interface RankRow {
  userId: string
  nickname: string
  realName: string
  gender: Gender
  points: number
  power: number
  collection: number
  /** 收集率 0–1 */
  rate: number
  me?: boolean
}

/** 角色（修行者）状态 */
export interface CharacterState {
  nickname: string
  realName: string
  gender: Gender
  skinId: string
  ownedSkinIds: string[]
}

/** 钱包（灵石与碎片） */
export interface Wallet {
  points: number
  shards: number
}

/** 求签结果（服务端权威；本地占位时由 utils/gacha 生成） */
export interface GachaDrawn {
  tier: number
  petId: string
  isNew: boolean
  fragments: number
}

/** 造物提交单 */
export interface CustomPetSubmission {
  id: string
  student: string
  nickname: string
  petName: string
  pinyin: string
  desc: string
  skills: string[]
  submittedAt: string
  status: 'pending' | 'approved' | 'rejected'
  note?: string
}

/** 集市限购计数 */
export type BoughtMap = Record<string, number>

/** 斗法匹配到的对手 */
export interface Opponent {
  petId: string
  level: number
  awakenLevel: number
  /** 对手昵称（AI 或真实玩家） */
  nickname?: string
}

/** 一场斗法的结算（上报服务端） */
export interface BattleReport {
  winner: 'player' | 'enemy'
  turns: number
  playerPetId: string
}

/** 教师端：班级学生一行 */
export interface TeacherStudent {
  id: string
  name: string
  studentNo: string
  points: number
  petName: string
  petLevel: number
}

/** 教师端：一条加分/扣分记录 */
export interface PointsRecord {
  studentNo: string
  amount: number
  reason: string
}

/** 班级一行 */
export interface ClassRow {
  id: string
  name: string
}

/** 待导入的学生（粘贴名单解析后） */
export interface ImportRow {
  name: string
  studentNo?: string
}

/** 一条积分流水 */
export interface EvaluationRow {
  id: string
  studentName: string
  points: number
  reason: string
  category: string
  timestamp: number
}
