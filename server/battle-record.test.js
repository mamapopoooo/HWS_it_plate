// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import { generateToken } from './utils/token.js'

let db, server, base

async function post(path, body, userId = 'player-demo') {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${generateToken(userId)}` } : {}) },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let data
  try { data = JSON.parse(text) } catch { data = { error: text } }
  return { status: response.status, data }
}

beforeAll(async () => {
  db = new Database(':memory:')
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, password_hash TEXT, is_guest INTEGER, created_at INTEGER, name_en TEXT);
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE students (id TEXT PRIMARY KEY, student_no TEXT, gender TEXT);`)
  vi.doMock('./db.js', () => ({ db }))
  const { migrateV2 } = await import('./game/migrate-v2.js')
  migrateV2()
  const { migrateV3 } = await import('./game/migrate-v3.js')
  migrateV3()
  db.prepare(`INSERT INTO users (id, username, grade) VALUES ('player-demo', 'demo', 7), ('opponent-demo', 'opponent', 7)`).run()
  db.prepare(`INSERT INTO pets_template (id, name, element, role, skills_json)
    VALUES ('pet_fire_fox', '示例宠物', 'fire', 'speed', '[]')`).run()
  db.prepare(`INSERT INTO player_pets (id, user_id, template_id, level, exp, equipped_skills)
    VALUES ('pet-demo', 'player-demo', 'pet_fire_fox', 1, 0, ?)`)
    .run(JSON.stringify(['fire_fox_s1']))

  const game = (await import('./routes/game.js')).default
  const gameV2 = (await import('./routes/game-v2.js')).default
  const app = express()
  app.use(express.json())
  app.use('/api/game', game)
  app.use('/api/v2', gameV2)
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

beforeEach(() => {
  db.exec(`DELETE FROM battle_records; DELETE FROM trainers;
    INSERT INTO trainers (user_id) VALUES ('player-demo'), ('opponent-demo');`)
})

afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  db?.close()
  vi.doUnmock('./db.js')
})

describe('战斗记录适配启动实际表结构', () => {
  it('结束后真实落库，将引擎胜方转换为对应玩家 id 并保留旧记录', async () => {
    db.prepare(`INSERT INTO battle_records (id, battle_type, player_a_id, player_b_id, winner_id, turn_count, log_json, created_at)
      VALUES ('legacy-demo', 'pve', 'legacy-player', 'ai_opponent', 'ai_opponent', 2, '[]', 1)`).run()

    const started = await post('/api/game/battle/start', { playerId: 'player-demo', petId: 'pet-demo' })
    expect(started.status).toBe(200)
    expect(started.data.player.skills).toHaveLength(1)

    let action
    for (let turn = 0; turn < 100; turn++) {
      action = await post(`/api/game/battle/${started.data.battleId}/action`, { skillId: 'fire_fox_s1' })
      expect(action.status).toBe(200)
      if (action.data.battleStatus === 'finished') break
    }

    const records = db.prepare('SELECT * FROM battle_records ORDER BY created_at').all()
    expect(action.data.battleStatus).toBe('finished')
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ id: 'legacy-demo', winner_id: 'ai_opponent' })
    expect(records[1]).toMatchObject({
      battle_type: 'pve',
      player_a_id: 'player-demo',
      player_b_id: 'ai_opponent',
      winner_id: action.data.winner === 'player' ? 'player-demo' : 'ai_opponent',
      turn_count: action.data.turn,
    })
    expect(JSON.parse(records[1].log_json).length).toBeGreaterThan(0)
  }, 15_000)

  it('AI 获胜时将 winner_id 保存为 ai_opponent', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const started = await post('/api/game/battle/start', { playerId: 'player-demo', petId: 'pet-demo' })
      let action
      for (let turn = 0; turn < 100; turn++) {
        action = await post(`/api/game/battle/${started.data.battleId}/action`, { skillId: 'fire_fox_s1' })
        expect(action.status, JSON.stringify(action.data)).toBe(200)
        if (action.data.battleStatus === 'finished') break
      }
      expect(action.data.winner).toBe('opponent')
      expect(db.prepare('SELECT winner_id FROM battle_records').get().winner_id).toBe('ai_opponent')
    } finally {
      vi.restoreAllMocks()
    }
  }, 15_000)

  it('/duel 自报胜负明确返回未支持，不造正式记录或发奖励', async () => {
    const result = await post('/api/v2/battle/pve/result', { winner: 'player', turns: 3, playerPetId: 'pet-demo' }, 'player-demo')
    expect(result.status).toBe(501)
    expect(result.data).toMatchObject({ success: false, code: 'AUTHORITATIVE_BATTLE_REQUIRED' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM battle_records').get().n).toBe(0)
  })

  it('双方今日斗法按玩家 id 统计且不重复计算无关用户', async () => {
    const now = Date.now()
    db.prepare(`INSERT INTO battle_records (id, battle_type, player_a_id, player_b_id, winner_id, turn_count, log_json, created_at)
      VALUES ('count-demo', 'pve', 'player-demo', 'opponent-demo', 'player-demo', 3, '[]', ?)`).run(now)
    db.prepare(`INSERT INTO battle_records (id, battle_type, player_a_id, player_b_id, winner_id, turn_count, log_json, created_at)
      VALUES ('unrelated-demo', 'pve', 'other-demo', 'ai_opponent', 'ai_opponent', 2, '[]', ?)`).run(now)

    for (const userId of ['player-demo', 'opponent-demo']) {
      const response = await fetch(`${base}/api/v2/trainer/me`, { headers: { Authorization: `Bearer ${generateToken(userId)}` } })
      const text = await response.text()
      if (response.status !== 200) throw new Error(text)
      const data = JSON.parse(text)
      expect(response.status, text).toBe(200)
      expect(data.trainer.today_battles).toBe(1)
    }
  })

  it('已结束战斗再次结算返回 404，不产生第二条记录', async () => {
    const started = await post('/api/game/battle/start', { playerId: 'player-demo', petId: 'pet-demo' })
    let action
    for (let turn = 0; turn < 100; turn++) {
      action = await post(`/api/game/battle/${started.data.battleId}/action`, { skillId: 'fire_fox_s1' })
      expect(action.status, JSON.stringify(action.data)).toBe(200)
      if (action.data.battleStatus === 'finished') break
    }
    const repeated = await post(`/api/game/battle/${started.data.battleId}/action`, { skillId: 'fire_fox_s1' })
    expect(repeated.status).toBe(404)
    expect(db.prepare('SELECT COUNT(*) AS n FROM battle_records').get().n).toBe(1)
  }, 15_000)

  it('开始战斗拒绝使用其他用户的宠物', async () => {
    const response = await post('/api/game/battle/start', { playerId: 'opponent-demo', petId: 'pet-demo' })
    expect(response.status).toBe(403)
    expect(db.prepare('SELECT COUNT(*) AS n FROM battle_records').get().n).toBe(0)
  })
  it('匿名、伪造playerId及跨玩家行动/状态请求被拒绝', async () => {
    expect((await post('/api/game/battle/start', { playerId: 'player-demo', petId: 'pet-demo' }, null)).status).toBe(401)
    expect((await post('/api/game/battle/start', { playerId: 'player-demo', petId: 'pet-demo' }, 'opponent-demo')).status).toBe(403)
    const started = await post('/api/game/battle/start', { petId: 'pet-demo' })
    expect(started.status).toBe(200)
    expect((await post(`/api/game/battle/${started.data.battleId}/action`, { skillId: 'fire_fox_s1' }, 'opponent-demo')).status).toBe(403)
    const state = await fetch(`${base}/api/game/battle/${started.data.battleId}/state`, {
      headers: { Authorization: `Bearer ${generateToken('opponent-demo')}` },
    })
    expect(state.status).toBe(403)
    expect(db.prepare('SELECT COUNT(*) AS n FROM battle_records').get().n).toBe(0)
  })
})
