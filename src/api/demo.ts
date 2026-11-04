/**
 * 占位数据（唯一来源）
 *
 * 接口未就绪时由 adapter 返回这里的数据；页面不再自己写 DEMO_*。
 * 后端上线后本文件只用于「离线演示 / 空库兜底」，不需要删除。
 */
import type {
  AchievementState,
  BoughtMap,
  CharacterState,
  ClassRow,
  CustomPetSubmission,
  EvaluationRow,
  Opponent,
  OwnedMap,
  Profile,
  QuestProgress,
  RankRow,
  TeacherStudent,
  Wallet,
} from './types'

export const DEMO_PROFILE: Profile = {
  userId: 'demo-student',
  displayName: '小狐仙 · 李四',
  nickname: '小狐仙',
  realName: '李四',
  grade: 6,
  realm: '筑基三层',
  trainerLevel: 12,
  points: 1250,
  shards: 12,
  gender: 'female',
}

export const DEMO_WALLET: Wallet = { points: 1250, shards: 12 }

/** 图鉴持有：id → 等级 */
export const DEMO_OWNED: OwnedMap = {
  pet_jiuweihu: 5,
  pet_tiangou: 3,
  pet_huan: 2,
  pet_qitu: 4,
  pet_qianyang: 2,
  pet_changyou: 1,
  pet_baize: 4,
  pet_lushu: 3,
  pet_diting: 2,
  pet_baihu: 7,
}

export const DEMO_QUESTS: QuestProgress[] = [
  { questId: 'quest_login', progress: 1, claimed: false },
  { questId: 'quest_feed', progress: 1, claimed: false },
  { questId: 'quest_browse', progress: 1, claimed: false },
  { questId: 'quest_battle3', progress: 1, claimed: false },
  { questId: 'quest_awaken1', progress: 0, claimed: false },
  { questId: 'quest_draw10', progress: 4, claimed: false },
  { questId: 'quest_powerup', progress: 12, claimed: false },
]

export const DEMO_ACHIEVEMENTS: AchievementState[] = [
  { achievementId: 'ach_first_win', unlocked: true, progress: 1 },
  { achievementId: 'ach_streak5', unlocked: true, progress: 5 },
  { achievementId: 'ach_battle100', unlocked: false, progress: 45 },
  { achievementId: 'ach_awaken4', unlocked: false, progress: 0 },
  { achievementId: 'ach_tier3', unlocked: false, progress: 1 },
  { achievementId: 'ach_tier4', unlocked: false, progress: 0 },
  { achievementId: 'ach_collect20', unlocked: false, progress: 18 },
  { achievementId: 'ach_collect_all', unlocked: false, progress: 18 },
  { achievementId: 'ach_draw50', unlocked: true, progress: 50 },
  { achievementId: 'ach_creator', unlocked: false, progress: 0 },
  { achievementId: 'ach_class_top3', unlocked: false, progress: 6 },
]

export const DEMO_BOUGHT: BoughtMap = {}

export const DEMO_RANK: RankRow[] = [
  { userId: 'u1', nickname: '小狐仙', realName: '李四', gender: 'female', points: 1250, power: 244, collection: 18, rate: 0.47, me: true },
  { userId: 'u2', nickname: '玄鸟', realName: '王小二', gender: 'male', points: 1180, power: 268, collection: 22, rate: 0.58 },
  { userId: 'u3', nickname: '云中君', realName: '张三', gender: 'male', points: 1120, power: 231, collection: 16, rate: 0.42 },
  { userId: 'u4', nickname: '白露', realName: '赵六', gender: 'female', points: 1050, power: 198, collection: 14, rate: 0.37 },
  { userId: 'u5', nickname: '南山雪', realName: '陈七', gender: 'female', points: 980, power: 187, collection: 13, rate: 0.34 },
  { userId: 'u6', nickname: '小鱼干', realName: '周八', gender: 'male', points: 940, power: 176, collection: 12, rate: 0.32 },
  { userId: 'u7', nickname: '青丘', realName: '吴九', gender: 'female', points: 905, power: 170, collection: 11, rate: 0.29 },
  { userId: 'u8', nickname: '风息', realName: '郑十', gender: 'male', points: 860, power: 163, collection: 10, rate: 0.26 },
  { userId: 'u9', nickname: '叶上秋', realName: '孙一', gender: 'female', points: 820, power: 152, collection: 9, rate: 0.24 },
  { userId: 'u10', nickname: '雷泽', realName: '马二', gender: 'male', points: 760, power: 141, collection: 8, rate: 0.21 },
  { userId: 'u11', nickname: '素问', realName: '朱三', gender: 'female', points: 700, power: 133, collection: 7, rate: 0.18 },
  { userId: 'u12', nickname: '石中火', realName: '胡四', gender: 'male', points: 650, power: 120, collection: 6, rate: 0.16 },
]

export const DEMO_CHARACTER: CharacterState = {
  nickname: '小狐仙',
  realName: '李四',
  gender: 'female',
  skinId: 'skin_base_f',
  ownedSkinIds: ['skin_base_f', 'skin_school_f'],
}

/** 积分流水占位 */
export const DEMO_EVALUATIONS: EvaluationRow[] = [
  { id: 'e1', studentName: '李四', points: 5, reason: '作业优秀', category: '学习', timestamp: Date.now() - 6 * 60 * 1000 },
  { id: 'e2', studentName: '王小二', points: 3, reason: '回答问题', category: '学习', timestamp: Date.now() - 22 * 60 * 1000 },
  { id: 'e3', studentName: '张三', points: -1, reason: '迟到', category: '行为', timestamp: Date.now() - 40 * 60 * 1000 },
  { id: 'e4', studentName: '赵六', points: 3, reason: '帮助同学', category: '行为', timestamp: Date.now() - 90 * 60 * 1000 },
  { id: 'e5', studentName: '陈七', points: 5, reason: '课堂展示', category: '学习', timestamp: Date.now() - 3 * 60 * 60 * 1000 },
]

/** 班级占位（接口未就绪时使用） */
export const DEMO_CLASSES: ClassRow[] = [
  { id: 'demo-g6-1', name: 'G6-1 班' },
  { id: 'demo-g7-2', name: 'G7-2 班' },
]

/** 教师端：占位班级名单（接口未就绪时使用） */
export const DEMO_STUDENTS: TeacherStudent[] = [
  { id: 's01', name: '李四', studentNo: '20260101', points: 1250, petName: '白虎·监兵', petLevel: 7 },
  { id: 's02', name: '王小二', studentNo: '20260102', points: 1180, petName: '白泽', petLevel: 6 },
  { id: 's03', name: '张三', studentNo: '20260103', points: 1120, petName: '九尾狐', petLevel: 5 },
  { id: 's04', name: '赵六', studentNo: '20260104', points: 1050, petName: '鹿蜀', petLevel: 5 },
  { id: 's05', name: '陈七', studentNo: '20260105', points: 980, petName: '夫诸', petLevel: 4 },
  { id: 's06', name: '周八', studentNo: '20260106', points: 940, petName: '天狗', petLevel: 4 },
  { id: 's07', name: '吴九', studentNo: '20260107', points: 905, petName: '鵸鵌', petLevel: 3 },
  { id: 's08', name: '郑十', studentNo: '20260108', points: 860, petName: '长右', petLevel: 3 },
  { id: 's09', name: '孙一', studentNo: '20260109', points: 820, petName: '羬羊', petLevel: 3 },
  { id: 's10', name: '马二', studentNo: '20260110', points: 760, petName: '赤鱬', petLevel: 2 },
  { id: 's11', name: '朱三', studentNo: '20260111', points: 700, petName: '讙', petLevel: 2 },
  { id: 's12', name: '胡四', studentNo: '20260112', points: 650, petName: '文鳐鱼', petLevel: 1 },
]

/** 斗法占位对手（匹配接口未就绪时使用） */
export const DEMO_OPPONENT: Opponent = {
  petId: 'pet_qinglong',
  level: 7,
  awakenLevel: 3,
  nickname: '陪练的木人',
}

export const DEMO_SUBMISSIONS: CustomPetSubmission[] = [
  {
    id: 'sub_001',
    student: '王小二',
    nickname: '玄鸟',
    petName: '混沌',
    pinyin: 'hùn dùn',
    desc: '混沌未分，天地一气',
    skills: ['damage_single', 'heal_pct', 'first_strike'],
    submittedAt: '今天 09:12',
    status: 'pending',
  },
  {
    id: 'sub_002',
    student: '张三',
    nickname: '云中君',
    petName: '烛照',
    pinyin: 'zhú zhào',
    desc: '衔烛而照幽都',
    skills: ['damage_aoe', 'damage_burn', 'buff_stat'],
    submittedAt: '昨天 16:40',
    status: 'pending',
  },
  {
    id: 'sub_003',
    student: '赵六',
    nickname: '白露',
    petName: '幽荧',
    pinyin: 'yōu yíng',
    desc: '月魄所化，照夜无声',
    skills: ['heal_pct', 'shield_pct'],
    submittedAt: '昨天 10:05',
    status: 'pending',
  },
  {
    id: 'sub_000',
    student: '陈七',
    nickname: '南山雪',
    petName: '霜序',
    pinyin: 'shuāng xù',
    desc: '秋霜为序',
    skills: ['damage_single', 'stun'],
    submittedAt: '前天 14:20',
    status: 'approved',
  },
]
