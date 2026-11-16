import { ECONOMY, PETS, TIERS, TRIGRAMS } from '@/config/gameConfig'
import { SKILL_EFFECTS } from '@/config/contentConfig'
import {
  coefAgainst as coreCoefAgainst,
  createFighter as coreCreateFighter,
  endTurn,
  pickEnemySkill as corePickEnemySkill,
  resolveSkill as coreResolveSkill,
  statsOf as coreStatsOf,
  winnerOf,
  type DuelConfig,
  type DuelFighter,
  type Side,
} from './duel-core.js'

export type { DuelEvent, DuelFighter, DuelSkill, DuelState, Side } from './duel-core.js'

const config: DuelConfig = {
  tiers: TIERS,
  trigrams: TRIGRAMS,
  pets: PETS,
  economy: ECONOMY,
  skillEffects: SKILL_EFFECTS,
}

export function statsOf(tier: number, level: number, awaken: number) {
  return coreStatsOf(tier, level, awaken, config)
}

export function createFighter(petId: string, level: number, awaken: number): DuelFighter | null {
  return coreCreateFighter(petId, level, awaken, config)
}

export function coefAgainst(attacker: string, defender: string): number {
  return coreCoefAgainst(attacker, defender, config)
}

export function resolveSkill(
  actor: DuelFighter,
  target: DuelFighter,
  skillCode: string,
  side: Side,
  rng: () => number = Math.random,
) {
  return coreResolveSkill(actor, target, skillCode, side, rng, config)
}

export function pickEnemySkill(enemy: DuelFighter, rng: () => number = Math.random): string {
  return corePickEnemySkill(enemy, rng)
}

export { endTurn, winnerOf }
