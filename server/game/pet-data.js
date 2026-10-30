// 王宠课堂 - P0 六只宠物模板数据
// 每只宠物：属性 + 定位 + 7 个技能（Lv1-7 各解锁 1 个）
// 技能槽位：S1基础 / S2克制 / S3增益减益 / S4签名技 / S5稳定or赌博 / S6大招 / S7被动

import { ELEMENTS, PET_ROLES, SKILL_TYPES, STATUS_EFFECTS } from './constants.js'

export const PETS = [
  // ==================== 火属性：焰尾狐（速攻）====================
  {
    id: 'pet_fire_fox',
    name: '焰尾狐',
    element: ELEMENTS.FIRE,
    role: PET_ROLES.SPEED,
    description: '尾巴燃烧着不灭之火的灵狐，擅长灼烧和连击。',
    signature: 'burn',
    skills: [
      // Lv1 - 基础攻击
      {
        id: 'fire_fox_s1',
        name: '火爪击',
        type: SKILL_TYPES.BASIC,
        element: ELEMENTS.FIRE,
        power: 0.8,
        cooldown: 0,
        description: '挥出燃烧的爪子攻击对手。',
        effect: null
      },
      // Lv2 - 属性克制技
      {
        id: 'fire_fox_s2',
        name: '烈焰冲',
        type: SKILL_TYPES.COUNTER,
        element: ELEMENTS.FIRE,
        power: 1.0,
        cooldown: 2,
        description: '全身裹火冲锋，对草属性伤害翻倍。',
        effect: null
      },
      // Lv3 - 增益
      {
        id: 'fire_fox_s3',
        name: '疾步',
        type: SKILL_TYPES.BUFF,
        element: 'normal',
        power: 0,
        cooldown: 4,
        description: '速度 +40%，持续 2 回合。',
        effect: {
          type: 'buff',
          stat: 'spd',
          value: 0.4,
          duration: 2
        }
      },
      // Lv4 - 签名技（灼烧）
      {
        id: 'fire_fox_s4',
        name: '灼烧之尾',
        type: SKILL_TYPES.COUNTER,
        element: ELEMENTS.FIRE,
        power: 0.6,
        cooldown: 3,
        description: '60% 伤害，30% 概率附加灼烧（每回合 5% maxHP，2 回合）。',
        effect: {
          type: 'dot',
          status: STATUS_EFFECTS.BURN,
          probability: 0.3,
          damagePercent: 0.05,
          duration: 2
        }
      },
      // Lv5 - 稳定选项
      {
        id: 'fire_fox_s5_stable',
        name: '闪避姿态',
        type: SKILL_TYPES.SHIELD,
        element: 'normal',
        power: 0,
        cooldown: 3,
        description: '进入闪避姿态，下回合 50% 闪避率。',
        effect: {
          type: 'dodge',
          probability: 0.5,
          duration: 1
        }
      },
      // Lv5 - 赌博选项
      {
        id: 'fire_fox_s5_gamble',
        name: '自爆',
        type: SKILL_TYPES.GAMBLE,
        element: ELEMENTS.FIRE,
        power: 0,
        cooldown: 99,
        description: '以自身当前 HP×2 造成伤害，自身直接阵亡。',
        effect: {
          type: 'self_destruct',
          damageFormula: 'current_hp_x2',
          selfKnockout: true
        }
      },
      // Lv6 - 大招
      {
        id: 'fire_fox_s6',
        name: '九尾火舞',
        type: SKILL_TYPES.ULTIMATE,
        element: ELEMENTS.FIRE,
        power: 1.6,
        cooldown: 4,
        description: '九条尾巴化为火焰风暴，造成 160% 伤害。',
        effect: null
      },
      // Lv7 - 被动（签名被动）
      {
        id: 'fire_fox_s7',
        name: '火之心',
        type: SKILL_TYPES.PASSIVE,
        element: ELEMENTS.FIRE,
        power: 0,
        cooldown: 0,
        description: '击杀对手后攻击 +15%（可叠加）。',
        effect: {
          type: 'passive_on_kill',
          stat: 'atk',
          value: 0.15,
          stackable: true
        }
      }
    ]
  },

  // ==================== 水属性：潮甲龟（坦克）====================
  {
    id: 'pet_water_turtle',
    name: '潮甲龟',
    element: ELEMENTS.WATER,
    role: PET_ROLES.TANK,
    description: '背负坚硬龟壳的海龟，擅长防御和反伤。',
    signature: 'counter_damage',
    skills: [
      {
        id: 'water_turtle_s1',
        name: '水弹',
        type: SKILL_TYPES.BASIC,
        element: ELEMENTS.WATER,
        power: 0.8,
        cooldown: 0,
        description: '发射高压水弹攻击对手。',
        effect: null
      },
      {
        id: 'water_turtle_s2',
        name: '潮涌',
        type: SKILL_TYPES.COUNTER,
        element: ELEMENTS.WATER,
        power: 1.0,
        cooldown: 2,
        description: '召唤潮水冲击，对火属性伤害翻倍。',
        effect: null
      },
      {
        id: 'water_turtle_s3',
        name: '铁壁',
        type: SKILL_TYPES.BUFF,
        element: 'normal',
        power: 0,
        cooldown: 4,
        description: '防御 +50%，持续 2 回合。',
        effect: {
          type: 'buff',
          stat: 'def',
          value: 0.5,
          duration: 2
        }
      },
      {
        id: 'water_turtle_s4',
        name: '荆棘甲',
        type: SKILL_TYPES.COUNTER,
        element: ELEMENTS.WATER,
        power: 0.6,
        cooldown: 3,
        description: '60% 伤害，附加反伤 20% 持续 2 回合。',
        effect: {
          type: 'dot',
          status: STATUS_EFFECTS.COUNTER_DMG,
          probability: 1.0,
          damagePercent: 0.2,
          duration: 2
        }
      },
      {
        id: 'water_turtle_s5_stable',
        name: '护盾',
        type: SKILL_TYPES.SHIELD,
        element: 'normal',
        power: 0,
        cooldown: 3,
        description: '生成 25% maxHP 的护盾。',
        effect: {
          type: 'shield',
          valuePercent: 0.25
        }
      },
      {
        id: 'water_turtle_s5_gamble',
        name: '绝对零度',
        type: SKILL_TYPES.GAMBLE,
        element: ELEMENTS.WATER,
        power: 0,
        cooldown: 99,
        description: '5% 概率直接秒杀对手，未命中则本回合空过。',
        effect: {
          type: 'instant_kill',
          probability: 0.05,
          missPenalty: 'skip_turn'
        }
      },
      {
        id: 'water_turtle_s6',
        name: '巨浪冲击',
        type: SKILL_TYPES.ULTIMATE,
        element: ELEMENTS.WATER,
        power: 1.5,
        cooldown: 4,
        description: '召唤巨浪冲击对手，造成 150% 伤害。',
        effect: null
      },
      {
        id: 'water_turtle_s7',
        name: '坚岩之心',
        type: SKILL_TYPES.PASSIVE,
        element: ELEMENTS.WATER,
        power: 0,
        cooldown: 0,
        description: 'HP < 30% 时防御翻倍。',
        effect: {
          type: 'passive_low_hp',
          threshold: 0.3,
          stat: 'def',
          multiplier: 2
        }
      }
    ]
  },

  // ==================== 草属性：叶灵鹿（均衡）====================
  {
    id: 'pet_grass_deer',
    name: '叶灵鹿',
    element: ELEMENTS.GRASS,
    role: PET_ROLES.BALANCE,
    description: '森林深处的灵鹿，拥有自然回复之力。',
    signature: 'regen',
    skills: [
      {
        id: 'grass_deer_s1',
        name: '藤鞭',
        type: SKILL_TYPES.BASIC,
        element: ELEMENTS.GRASS,
        power: 0.8,
        cooldown: 0,
        description: '挥出藤蔓鞭打对手。',
        effect: null
      },
      {
        id: 'grass_deer_s2',
        name: '叶刃风暴',
        type: SKILL_TYPES.COUNTER,
        element: ELEMENTS.GRASS,
        power: 1.0,
        cooldown: 2,
        description: '叶片化为飞刃，对电属性伤害翻倍。',
        effect: null
      },
      {
        id: 'grass_deer_s3',
        name: '自然之力',
        type: SKILL_TYPES.BUFF,
        element: 'normal',
        power: 0,
        cooldown: 4,
        description: '攻击 +30%，持续 2 回合。',
        effect: {
          type: 'buff',
          stat: 'atk',
          value: 0.3,
          duration: 2
        }
      },
      {
        id: 'grass_deer_s4',
        name: '寄生种子',
        type: SKILL_TYPES.DEBUFF,
        element: ELEMENTS.GRASS,
        power: 0.5,
        cooldown: 3,
        description: '50% 伤害，寄生种子吸取对手 10% maxHP 回复自身。',
        effect: {
          type: 'drain',
          damagePercent: 0.1,
          healPercent: 0.1
        }
      },
      {
        id: 'grass_deer_s5_stable',
        name: '光合作用',
        type: SKILL_TYPES.HEAL,
        element: 'normal',
        power: 0,
        cooldown: 3,
        description: '回复 20% maxHP。',
        effect: {
          type: 'heal',
          valuePercent: 0.2
        }
      },
      {
        id: 'grass_deer_s5_gamble',
        name: '奇迹绽放',
        type: SKILL_TYPES.GAMBLE,
        element: ELEMENTS.GRASS,
        power: 0,
        cooldown: 99,
        description: '8% 概率所有技能冷却清零，未触发则本回合空过。',
        effect: {
          type: 'reset_cooldowns',
          probability: 0.08,
          missPenalty: 'skip_turn'
        }
      },
      {
        id: 'grass_deer_s6',
        name: '森林怒吼',
        type: SKILL_TYPES.ULTIMATE,
        element: ELEMENTS.GRASS,
        power: 1.5,
        cooldown: 4,
        description: '大自然的力量爆发，造成 150% 伤害。',
        effect: null
      },
      {
        id: 'grass_deer_s7',
        name: '生命之树',
        type: SKILL_TYPES.PASSIVE,
        element: ELEMENTS.GRASS,
        power: 0,
        cooldown: 0,
        description: '每 3 回合自动回复 10% maxHP。',
        effect: {
          type: 'passive_regen',
          interval: 3,
          valuePercent: 0.1
        }
      }
    ]
  },

  // ==================== 电属性：雷光蜂（速攻）====================
  {
    id: 'pet_electric_bee',
    name: '雷光蜂',
    element: ELEMENTS.ELECTRIC,
    role: PET_ROLES.SPEED,
    description: '翅膀闪烁电光的蜜蜂，速度极快，擅长麻痹控制。',
    signature: 'paralyze',
    skills: [
      {
        id: 'electric_bee_s1',
        name: '电刺',
        type: SKILL_TYPES.BASIC,
        element: ELEMENTS.ELECTRIC,
        power: 0.8,
        cooldown: 0,
        description: '用带电的尾针刺击对手。',
        effect: null
      },
      {
        id: 'electric_bee_s2',
        name: '闪电突击',
        type: SKILL_TYPES.COUNTER,
        element: ELEMENTS.ELECTRIC,
        power: 1.0,
        cooldown: 2,
        description: '化为闪电突击，对水属性伤害翻倍。先制度 +1。',
        priority: 1,
        effect: null
      },
      {
        id: 'electric_bee_s3',
        name: '电磁加速',
        type: SKILL_TYPES.BUFF,
        element: 'normal',
        power: 0,
        cooldown: 4,
        description: '速度 +50%，持续 2 回合。',
        effect: {
          type: 'buff',
          stat: 'spd',
          value: 0.5,
          duration: 2
        }
      },
      {
        id: 'electric_bee_s4',
        name: '麻痹针',
        type: SKILL_TYPES.CONTROL,
        element: ELEMENTS.ELECTRIC,
        power: 0.5,
        cooldown: 3,
        description: '50% 伤害，25% 概率麻痹对手（下回合跳过）。',
        priority: 1,
        effect: {
          type: 'cc',
          status: STATUS_EFFECTS.PARALYZE,
          probability: 0.25,
          duration: 1
        }
      },
      {
        id: 'electric_bee_s5_stable',
        name: '急救',
        type: SKILL_TYPES.HEAL,
        element: 'normal',
        power: 0,
        cooldown: 3,
        description: '回复 15% maxHP。',
        effect: {
          type: 'heal',
          valuePercent: 0.15
        }
      },
      {
        id: 'electric_bee_s5_gamble',
        name: '天雷一击',
        type: SKILL_TYPES.GAMBLE,
        element: ELEMENTS.ELECTRIC,
        power: 3.0,
        cooldown: 99,
        description: '15% 概率造成 300% 伤害，未命中则自伤 10% maxHP。',
        effect: {
          type: 'high_risk',
          probability: 0.15,
          hitPower: 3.0,
          missSelfDamage: 0.1
        }
      },
      {
        id: 'electric_bee_s6',
        name: '万伏雷击',
        type: SKILL_TYPES.ULTIMATE,
        element: ELEMENTS.ELECTRIC,
        power: 1.6,
        cooldown: 4,
        description: '召唤万伏雷电，造成 160% 伤害。',
        effect: null
      },
      {
        id: 'electric_bee_s7',
        name: '静电场',
        type: SKILL_TYPES.PASSIVE,
        element: ELEMENTS.ELECTRIC,
        power: 0,
        cooldown: 0,
        description: '受击时 20% 概率麻痹攻击者。',
        effect: {
          type: 'passive_on_hit',
          probability: 0.2,
          status: STATUS_EFFECTS.PARALYZE,
          duration: 1
        }
      }
    ]
  },

  // ==================== 光属性：辉羽鹤（控制）====================
  {
    id: 'pet_light_crane',
    name: '辉羽鹤',
    element: ELEMENTS.LIGHT,
    role: PET_ROLES.CONTROL,
    description: '羽毛散发圣光的仙鹤，能净化一切减益效果。',
    signature: 'purify',
    skills: [
      {
        id: 'light_crane_s1',
        name: '光束',
        type: SKILL_TYPES.BASIC,
        element: ELEMENTS.LIGHT,
        power: 0.8,
        cooldown: 0,
        description: '发射纯净的光束攻击对手。',
        effect: null
      },
      {
        id: 'light_crane_s2',
        name: '圣光裁决',
        type: SKILL_TYPES.COUNTER,
        element: ELEMENTS.LIGHT,
        power: 1.0,
        cooldown: 2,
        description: '降下圣光，对暗属性伤害翻倍。',
        effect: null
      },
      {
        id: 'light_crane_s3',
        name: '致盲',
        type: SKILL_TYPES.DEBUFF,
        element: ELEMENTS.LIGHT,
        power: 0,
        cooldown: 4,
        description: '对手攻击命中率 -40%，持续 2 回合。',
        effect: {
          type: 'debuff',
          stat: 'accuracy',
          value: -0.4,
          duration: 2
        }
      },
      {
        id: 'light_crane_s4',
        name: '净化之光',
        type: SKILL_TYPES.HEAL,
        element: 'normal',
        power: 0.3,
        cooldown: 3,
        description: '30% 伤害，驱散自身所有减益效果。',
        effect: {
          type: 'purify',
          removeDebuffs: true
        }
      },
      {
        id: 'light_crane_s5_stable',
        name: '圣盾',
        type: SKILL_TYPES.SHIELD,
        element: 'normal',
        power: 0,
        cooldown: 3,
        description: '生成 20% maxHP 护盾 + 免疫减益 1 回合。',
        effect: {
          type: 'shield',
          valuePercent: 0.2,
          bonus: 'debuff_immune',
          bonusDuration: 1
        }
      },
      {
        id: 'light_crane_s5_gamble',
        name: '奇迹之光',
        type: SKILL_TYPES.GAMBLE,
        element: ELEMENTS.LIGHT,
        power: 0,
        cooldown: 99,
        description: '10% 概率全队回满 HP（1v1 则回满自身），未触发无惩罚。',
        effect: {
          type: 'full_heal',
          probability: 0.1,
          missPenalty: 'none'
        }
      },
      {
        id: 'light_crane_s6',
        name: '天罚',
        type: SKILL_TYPES.ULTIMATE,
        element: ELEMENTS.LIGHT,
        power: 1.5,
        cooldown: 4,
        description: '天降神罚，造成 150% 伤害 + 1 回合眩晕。',
        effect: {
          type: 'cc',
          status: STATUS_EFFECTS.STUN,
          probability: 1.0,
          duration: 1
        }
      },
      {
        id: 'light_crane_s7',
        name: '光辉庇护',
        type: SKILL_TYPES.PASSIVE,
        element: ELEMENTS.LIGHT,
        power: 0,
        cooldown: 0,
        description: '免疫所有减益效果（被动）。',
        effect: {
          type: 'passive_immune',
          immune: 'debuffs'
        }
      }
    ]
  },

  // ==================== 暗属性：影幽狼（均衡）====================
  {
    id: 'pet_dark_wolf',
    name: '影幽狼',
    element: ELEMENTS.DARK,
    role: PET_ROLES.BALANCE,
    description: '暗影中潜行的孤狼，攻击附带吸血效果。',
    signature: 'lifesteal',
    skills: [
      {
        id: 'dark_wolf_s1',
        name: '暗影爪',
        type: SKILL_TYPES.BASIC,
        element: ELEMENTS.DARK,
        power: 0.8,
        cooldown: 0,
        description: '暗影凝聚的利爪攻击对手。',
        effect: null
      },
      {
        id: 'dark_wolf_s2',
        name: '暗蚀',
        type: SKILL_TYPES.COUNTER,
        element: ELEMENTS.DARK,
        power: 1.0,
        cooldown: 2,
        description: '暗影侵蚀，对光属性伤害翻倍。',
        effect: null
      },
      {
        id: 'dark_wolf_s3',
        name: '暗影步',
        type: SKILL_TYPES.BUFF,
        element: 'normal',
        power: 0,
        cooldown: 4,
        description: '速度 +30% + 攻击 +20%，持续 2 回合。',
        effect: {
          type: 'multi_buff',
          buffs: [
            { stat: 'spd', value: 0.3, duration: 2 },
            { stat: 'atk', value: 0.2, duration: 2 }
          ]
        }
      },
      {
        id: 'dark_wolf_s4',
        name: '噬魂咬',
        type: SKILL_TYPES.COUNTER,
        element: ELEMENTS.DARK,
        power: 0.7,
        cooldown: 3,
        description: '70% 伤害，造成伤害的 30% 转化为自身 HP。',
        effect: {
          type: 'lifesteal',
          convertPercent: 0.3
        }
      },
      {
        id: 'dark_wolf_s5_stable',
        name: '暗影回复',
        type: SKILL_TYPES.HEAL,
        element: 'normal',
        power: 0,
        cooldown: 3,
        description: '回复 25% maxHP。',
        effect: {
          type: 'heal',
          valuePercent: 0.25
        }
      },
      {
        id: 'dark_wolf_s5_gamble',
        name: '影袭',
        type: SKILL_TYPES.GAMBLE,
        element: ELEMENTS.DARK,
        power: 2.0,
        cooldown: 99,
        description: '25% 概率造成 200% 伤害 + 吸血 50%，未命中则防御 -30%。',
        effect: {
          type: 'high_risk',
          probability: 0.25,
          hitPower: 2.0,
          hitBonus: { type: 'lifesteal', convertPercent: 0.5 },
          missPenalty: { stat: 'def', value: -0.3, duration: 2 }
        }
      },
      {
        id: 'dark_wolf_s6',
        name: '暗影风暴',
        type: SKILL_TYPES.ULTIMATE,
        element: ELEMENTS.DARK,
        power: 1.6,
        cooldown: 4,
        description: '暗影风暴席卷对手，造成 160% 伤害。',
        effect: null
      },
      {
        id: 'dark_wolf_s7',
        name: '夜行者',
        type: SKILL_TYPES.PASSIVE,
        element: ELEMENTS.DARK,
        power: 0,
        cooldown: 0,
        description: '首次攻击 50% 概率暴击。',
        effect: {
          type: 'passive_first_crit',
          critRate: 0.5
        }
      }
    ]
  }
]

// 导出宠物 ID 列表
export const PET_IDS = PETS.map(p => p.id)

// 按 ID 查找宠物模板
export function getPetTemplate(petId) {
  return PETS.find(p => p.id === petId)
}

// 按属性查找宠物
export function getPetsByElement(element) {
  return PETS.filter(p => p.element === element)
}

// 按定位查找宠物
export function getPetsByRole(role) {
  return PETS.filter(p => p.role === role)
}
