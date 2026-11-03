/**
 * 前端数据契约（对应 00-总纲 §11 协作契约 与 §12 API 契约）
 *
 * 页面只依赖这里的类型；真实接口与占位数据的差异由 api/adapter.ts 吸收。
 */

export type Gender = 'male' | 'female'

/** 玩家档案（HUD 用） */
export interface Profile {
  userId: string
  /** 昵称 · 姓名（排行榜与 HUD 统一用这个格式） */
  displayName: string
  nickname: string
  realName: string
  grade: 6 | 7
  realm: string
  trainerLevel: number
  points: number
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
