export type Side = 'player' | 'enemy'

export interface DuelSkill {
  code: string
  name: string
  cost: number
  /** 冷却回合数 */
  cd: number
  /** 剩余冷却，0 表示可用 */
  remain: number
}

export interface DuelFighter {
  petId: string
  name: string
  pinyin: string
  tier: number
  trigram: string
  level: number
  awaken: number
  maxHp: number
  hp: number
  atk: number
  def: number
  spd: number
  /** 护盾可吸收的伤害 */
  shield: number
  /** 攻击增益，0.2 = +20% */
  atkBuff: number
  buffTurns: number
  skills: DuelSkill[]
}

export interface DuelEvent {
  side: Side
  kind: 'hit' | 'crit' | 'miss' | 'heal' | 'shield' | 'buff' | 'ko'
  value: number
  message: string
}

export interface DuelState {
  player: DuelFighter
  enemy: DuelFighter
  turn: number
  log: DuelEvent[]
  finished: boolean
  winner?: Side
}

export interface DuelStats {
  maxHp: number
  atk: number
  def: number
  spd: number
}

export interface DuelConfig {
  tiers: Array<{ tier: number; powerCoef: number; skillSlots: number }>
  trigrams: Array<{ code: string; opposite: string }>
  pets: Array<{ id: string; name: string; pinyin: string; tier: number; trigram: string }>
  economy: { levelCoef: number; awakenBonus: number[] }
  skillEffects: Array<{ code: string; name: string; cost: number }>
}

export function statsOf(tier: number, level: number, awaken: number, config: DuelConfig): DuelStats
export function createFighter(petId: string, level: number, awaken: number, config: DuelConfig): DuelFighter | null
export function coefAgainst(attacker: string, defender: string, config: DuelConfig): number
export function resolveSkill(
  actor: DuelFighter,
  target: DuelFighter,
  skillCode: string,
  side: Side,
  rng: () => number,
  config: DuelConfig,
): DuelEvent[]
export function endTurn(fighter: DuelFighter): void
export function pickEnemySkill(enemy: DuelFighter, rng: () => number): string
export function winnerOf(player: DuelFighter, enemy: DuelFighter): Side | null
