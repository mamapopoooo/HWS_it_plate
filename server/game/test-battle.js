// 战斗引擎测试 - 验证核心逻辑
import { BattleState, BattleEngine, BattleAI } from './battle-engine.js'
import { PETS } from './pet-data.js'
import { calcStats, MAX_LEVEL } from './constants.js'

console.log('=== 墨境 战斗引擎测试 ===\n')

// 测试 1：属性计算
console.log('--- 测试 1：属性计算 ---')
const foxStats = calcStats(7, 'speed')
const turtleStats = calcStats(7, 'tank')
console.log(`焰尾狐 Lv7（速攻）: HP=${foxStats.maxHp} ATK=${foxStats.atk} DEF=${foxStats.def} SPD=${foxStats.spd}`)
console.log(`潮甲龟 Lv7（坦克）: HP=${turtleStats.maxHp} ATK=${turtleStats.atk} DEF=${turtleStats.def} SPD=${turtleStats.spd}`)
console.log(`坦克 HP 比速攻多: ${turtleStats.maxHp - foxStats.maxHp}`)
console.log(`速攻 ATK 比坦克高: ${foxStats.atk - turtleStats.atk}`)
console.log('')

// 测试 2：创建战斗
console.log('--- 测试 2：创建战斗 ---')
const state = new BattleState(
  { playerId: 'player_1', petId: 'pet_fire_fox', level: 7, equippedSkills: null },
  { playerId: 'player_2', petId: 'pet_water_turtle', level: 7, equippedSkills: null }
)
console.log(`战斗 ID: ${state.id}`)
console.log(`玩家A: ${state.playerA.petName} (${state.playerA.element}) HP=${state.playerA.currentHp}`)
console.log(`玩家B: ${state.playerB.petName} (${state.playerB.element}) HP=${state.playerB.currentHp}`)
console.log('')

// 测试 3：初始化 + 自动对战
console.log('--- 测试 3：自动对战（AI vs AI）---')
const engine = new BattleEngine(state)
engine.init()

const aiA = new BattleAI('normal')
const aiB = new BattleAI('hard')

let turnCount = 0
while (state.status === 'active' && turnCount < 30) {
  const skillA = aiA.chooseSkill(state.playerA, state.playerB)
  const skillB = aiB.chooseSkill(state.playerB, state.playerA)

  const result = engine.executeTurn(
    { skillId: skillA },
    { skillId: skillB }
  )

  turnCount++
  const lastAction = result.turnLog.actions[result.turnLog.actions.length - 1]
  if (lastAction) {
    console.log(`  回合 ${turnCount}: ${lastAction.message}`)
  }
}

console.log('')
console.log(`=== 战斗结束 ===`)
console.log(`总回合数: ${state.turn}`)
console.log(`胜者: ${state.winner === 'A' ? state.playerA.petName : state.playerB.petName}`)
console.log(`玩家A 剩余 HP: ${state.playerA.currentHp}/${state.playerA.maxHp}`)
console.log(`玩家B 剩余 HP: ${state.playerB.currentHp}/${state.playerB.maxHp}`)
console.log('')

// 测试 4：多场对战统计
console.log('--- 测试 4：100 场模拟对战统计 ---')
const results = { A: 0, B: 0, draws: 0, totalTurns: 0, crits: 0 }
for (let i = 0; i < 100; i++) {
  const s = new BattleState(
    { playerId: 'a', petId: 'pet_fire_fox', level: 7, equippedSkills: null },
    { playerId: 'b', petId: 'pet_water_turtle', level: 7, equippedSkills: null }
  )
  const e = new BattleEngine(s)
  e.init()
  const ai1 = new BattleAI('normal')
  const ai2 = new BattleAI('normal')
  let turns = 0
  while (s.status === 'active' && turns < 30) {
    const r = e.executeTurn(
      { skillId: ai1.chooseSkill(s.playerA, s.playerB) },
      { skillId: ai2.chooseSkill(s.playerB, s.playerA) }
    )
    turns++
    for (const a of r.turnLog.actions) {
      if (a.isCrit) results.crits++
    }
  }
  if (s.winner === 'A') results.A++
  else if (s.winner === 'B') results.B++
  else results.draws++
  results.totalTurns += s.turn
}
console.log(`焰尾狐 胜: ${results.A} 场`)
console.log(`潮甲龟 胜: ${results.B} 场`)
console.log(`平局（超时）: ${results.draws} 场`)
console.log(`平均回合数: ${(results.totalTurns / 100).toFixed(1)}`)
console.log(`暴击总次数: ${results.crits}`)
console.log('')

// 测试 5：属性克制验证
console.log('--- 测试 5：属性克制验证 ---')
const matchups = [
  ['pet_fire_fox', 'pet_grass_deer', '火 vs 草（应克制）'],
  ['pet_fire_fox', 'pet_water_turtle', '火 vs 水（应被克）'],
  ['pet_electric_bee', 'pet_water_turtle', '电 vs 水（应克制）'],
  ['pet_light_crane', 'pet_dark_wolf', '光 vs 暗（应互克）']
]
for (const [a, b, desc] of matchups) {
  let wins = 0
  for (let i = 0; i < 50; i++) {
    const s = new BattleState(
      { playerId: 'a', petId: a, level: 7, equippedSkills: null },
      { playerId: 'b', petId: b, level: 7, equippedSkills: null }
    )
    const e = new BattleEngine(s)
    e.init()
    const ai1 = new BattleAI('normal')
    const ai2 = new BattleAI('normal')
    let t = 0
    while (s.status === 'active' && t < 30) {
      e.executeTurn(
        { skillId: ai1.chooseSkill(s.playerA, s.playerB) },
        { skillId: ai2.chooseSkill(s.playerB, s.playerA) }
      )
      t++
    }
    if (s.winner === 'A') wins++
  }
  console.log(`${desc}: A 胜 ${wins}/50 (${wins * 2}%)`)
}

console.log('\n=== 测试完成 ===')
