// 王宠课堂 - 游戏常量与公式

// ========== 属性系统 ==========
export const ELEMENTS = {
  FIRE: 'fire',
  WATER: 'water',
  GRASS: 'grass',
  ELECTRIC: 'electric',
  LIGHT: 'light',
  DARK: 'dark'
}

// 属性克制关系：火→草→电→水→火（循环），光↔暗（互克）
// 克制系数 ×1.25（温和克制，配装和策略更重要）
export const ELEMENT_CHART = {
  fire:     { fire: 1.0, water: 0.80, grass: 1.25, electric: 1.0, light: 1.0, dark: 1.0 },
  water:    { fire: 1.25, water: 1.0, grass: 0.80, electric: 1.0, light: 1.0, dark: 1.0 },
  electric: { fire: 1.0, water: 1.25, grass: 0.80, electric: 1.0, light: 1.0, dark: 1.0 },
  grass:    { fire: 0.80, water: 1.0, grass: 1.0, electric: 1.25, light: 1.0, dark: 1.0 },
  light:    { fire: 1.0, water: 1.0, grass: 1.0, electric: 1.0, light: 1.0, dark: 1.25 },
  dark:     { fire: 1.0, water: 1.0, grass: 1.0, electric: 1.0, light: 1.25, dark: 1.0 }
}

// 属性配色（用于前端渲染）
export const ELEMENT_COLORS = {
  fire: '#E85D3A',
  water: '#3A8FE8',
  grass: '#4CAF50',
  electric: '#FFD600',
  light: '#FFC107',
  dark: '#7B1FA2'
}

// ========== 宠物定位 ==========
export const PET_ROLES = {
  TANK: 'tank',
  SPEED: 'speed',
  BALANCE: 'balance',
  CONTROL: 'control'
}

// 定位属性修正（极小差距，差异主要来自技能配装和属性克制）
export const ROLE_MODIFIERS = {
  tank:    { hp: 15, atk: -3, spd: -3 },
  speed:   { hp: -10, atk: 3, spd: 3 },
  balance: { hp: 0, atk: 0, spd: 0 },
  control: { hp: -5, atk: -2, spd: 3 }
}

// ========== 成长公式 ==========
export const MAX_LEVEL = 7
export const SKILL_SLOTS = 4       // 战斗装备 4 个技能
export const TOTAL_SKILLS = 7      // 每只宠物共 7 个技能

// 每级升级所需经验
export const LEVEL_EXP = [0, 20, 50, 100, 180, 300, 500]

// 基础属性计算
export function calcStats(level, role) {
  const mod = ROLE_MODIFIERS[role]
  return {
    maxHp: 100 + level * 15 + mod.hp,
    atk: 25 + level * 3 + mod.atk,
    def: 5 + level * 2,
    spd: 10 + level * 2 + mod.spd
  }
}

// ========== 伤害公式 ==========
export const CRIT_RATE = 0.10       // 基础暴击率 10%
export const CRIT_MULTIPLIER = 1.5  // 暴击伤害倍率
export const STAB_BONUS = 1.0       // 同系加成（本游戏技能都是本属性，不设额外加成）
export const RANDOM_RANGE = 0.1     // 随机波动 ±10%
export const MIN_DAMAGE = 1         // 最低伤害

export function calcDamage(attacker, defender, skill) {
  const atkStat = attacker.stats.atk
  const defStat = defender.stats.def
  const skillPower = skill.power || 0.8

  // 基础伤害（防御全额减免）
  let damage = atkStat * skillPower - defStat

  // 属性克制
  const elementCoeff = getElementCoefficient(skill.element, defender.element)
  damage *= elementCoeff

  // STAB 加成
  if (skill.element === attacker.element) {
    damage *= STAB_BONUS
  }

  // 暴击判定
  const isCrit = Math.random() < (skill.critRate || CRIT_RATE)
  if (isCrit) {
    damage *= CRIT_MULTIPLIER
  }

  // 随机波动
  const randomFactor = 1 + (Math.random() * 2 - 1) * RANDOM_RANGE
  damage *= randomFactor

  // 最低伤害保护
  damage = Math.max(MIN_DAMAGE, Math.round(damage))

  return { damage, isCrit, elementCoeff }
}

// 获取属性克制系数
export function getElementCoefficient(atkElement, defElement) {
  if (!ELEMENT_CHART[atkElement] || !ELEMENT_CHART[atkElement][defElement]) {
    return 1.0
  }
  return ELEMENT_CHART[atkElement][defElement]
}

// ========== 技能类型 ==========
export const SKILL_TYPES = {
  BASIC: 'basic',           // 基础攻击
  COUNTER: 'counter',       // 属性克制技
  BUFF: 'buff',             // 增益
  DEBUFF: 'debuff',         // 减益
  CONTROL: 'control',       // 控制
  HEAL: 'heal',             // 回复
  SHIELD: 'shield',         // 护盾
  ULTIMATE: 'ultimate',     // 大招
  PASSIVE: 'passive',       // 被动
  GAMBLE: 'gamble'          // 赌博技
}

// ========== 状态效果 ==========
export const STATUS_EFFECTS = {
  BURN: 'burn',             // 灼烧（每回合扣血）
  FREEZE: 'freeze',         // 冰冻（跳过回合）
  PARALYZE: 'paralyze',     // 麻痹（跳过回合）
  STUN: 'stun',             // 眩晕（跳过回合）
  ATK_UP: 'atk_up',         // 攻击提升
  SPD_UP: 'spd_up',         // 速度提升
  DEF_UP: 'def_up',         // 防御提升
  ATK_DOWN: 'atk_down',     // 攻击降低
  SPD_DOWN: 'spd_down',     // 速度降低
  DEF_DOWN: 'def_down',     // 防御降低
  SHIELD: 'shield',         // 护盾
  DODGE: 'dodge',           // 闪避
  COUNTER_DMG: 'counter_dmg' // 反伤
}

// ========== 战斗配置 ==========
export const BATTLE_CONFIG = {
  MAX_TURNS: 30,            // 最大回合数（防无限战斗）
  TARGET_TURNS: 10,         // 目标平均回合数
  GAMBLE_COOLDOWN: 99,      // 赌博技默认冷却（基本一场只能用一次）
  AI_THINK_DELAY: 800,      // AI 出招延迟（ms，表现层用）
  MATCH_TIMEOUT: 30000,     // 匹配超时（ms），超时后 AI 填充
  MATCH_MMR_RANGE: 100,     // 初始匹配 MMR 范围
  MATCH_WIDEN_INTERVAL: 10000, // 每 10 秒放宽匹配范围
  MATCH_WIDEN_AMOUNT: 50    // 每次放宽量
}

// ========== 段位配置 ==========
export const RANK_TIERS = {
  MASTER:  { name: '大师',   percentile: 0.05, title: '大师训练师' },
  DIAMOND: { name: '钻石',   percentile: 0.15, title: '钻石训练师' },
  PLATINUM:{ name: '铂金',   percentile: 0.35, title: '铂金训练师' },
  GOLD:    { name: '黄金',   percentile: 0.60, title: '黄金训练师' },
  SILVER:  { name: '白银',   percentile: 0.85, title: '白银训练师' },
  BRONZE:  { name: '青铜',   percentile: 1.00, title: '新手训练师' }
}

// 固定名额称号
export const SPECIAL_TITLES = {
  CHAMPION:    { name: '最强训练师', slots: 1, reset: 'weekly' },
  ELITE:       { name: '精英训练师', slots: 10, reset: 'weekly' },
  CLASS_KING:  { name: '班级之王', slots: 'per_class', reset: 'weekly' }
}

// ========== 等级段匹配池 ==========
export const LEVEL_BRACKETS = [
  { min: 1, max: 2, label: '新手池' },
  { min: 3, max: 4, label: '进阶池' },
  { min: 5, max: 6, label: '高手池' },
  { min: 7, max: 7, label: '大师池' }
]

export function getLevelBracket(level) {
  return LEVEL_BRACKETS.find(b => level >= b.min && level <= b.max)
}
