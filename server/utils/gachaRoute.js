import { v4 as uuidv4 } from 'uuid'
import { createDrawState, drawMany, priceFor } from '../game/gacha.js'
import { readEconomy, debit } from './economy.js'

export function createGachaRoute(db) {
  return (req, res) => {
    const kind = req.body?.kind
    if (kind !== undefined && !['single', 'ten'].includes(kind)) return res.status(400).json({ error: '无效求签类型' })
    const count = kind === 'single' ? 1 : kind === 'ten' ? 10 : (req.body?.count ?? 1)
    if (!Number.isInteger(count) || count < 1 || count > 10 ||
        (kind !== undefined && req.body.count !== undefined && req.body.count !== count)) {
      return res.status(400).json({ error: '抽卡数量必须为1到10整数，且与类型一致' })
    }
    const result = db.transaction(() => {
      const user = db.prepare('SELECT grade,game_points FROM users WHERE id=?').get(req.userId)
      if (!user) return { status: 401, error: '登录身份不存在' }
      const economy = readEconomy(db)
      const base = count === 10 ? economy.gacha.ten : economy.gacha.single * count
      const cost = priceFor(base, user.grade, economy)
      if (user.game_points < cost) return { status: 400, error: '积分不足', required: cost, current: user.game_points }
      const templates = db.prepare('SELECT * FROM pets_template WHERE is_active=1').all()
      const tiers = db.prepare('SELECT tier,is_gacha AS isGacha,gacha_rate AS gachaRate FROM tier_config').all()
      const pity = db.prepare("SELECT count FROM gacha_pity WHERE user_id=? AND egg_type='v3'").get(req.userId)
      const owned = db.prepare('SELECT template_id FROM player_pets WHERE user_id=?').all(req.userId).map(p => p.template_id)
      const state = createDrawState({ pulls: pity?.count || 0, owned })
      const draws = drawMany(state, count, Math.random, { tiers, pets: templates, economy })
      debit(db, req.userId, cost)
      const results = draws.map((draw, index) => {
        const pet = templates.find(p => p.id === draw.pet_id)
        if (draw.is_new) {
          const skills = JSON.parse(pet.skills_json || '[]').slice(0, 1).map(skill => typeof skill === 'string' ? skill : skill.id)
          db.prepare(`INSERT INTO player_pets(id,user_id,template_id,level,exp,equipped_skills,form,power,obtained_at)
            VALUES(?,?,?,1,0,?,1,0,?)`).run(uuidv4(), req.userId, pet.id, JSON.stringify(skills), Date.now())
        } else {
          db.prepare(`INSERT INTO player_fragments(user_id,tier,count) VALUES(?,?,?)
            ON CONFLICT(user_id,tier) DO UPDATE SET count=count+excluded.count`).run(req.userId, draw.tier, draw.fragments)
        }
        db.prepare(`INSERT INTO gacha_records(id,user_id,egg_type,pet_template_id,rarity,pity_count,tier,trigram,created_at)
          VALUES(?,?,'v3',?,?,?,?,?,?)`).run(uuidv4(), req.userId, pet.id, draw.tier, (pity?.count || 0) + index + 1,
          draw.tier, pet.trigram, Date.now())
        return { petTemplateId: pet.id, petName: pet.name, tier: draw.tier, trigram: pet.trigram, isNew: draw.is_new,
          pet_id: pet.id, is_new: draw.is_new, fragments: draw.fragments }
      })
      db.prepare(`INSERT INTO gacha_pity(user_id,egg_type,count) VALUES(?,'v3',?)
        ON CONFLICT(user_id,egg_type) DO UPDATE SET count=excluded.count`).run(req.userId, state.pulls)
      return { results, newPoints: user.game_points - cost, pityCount: state.pulls, cost }
    })()
    if (result.error) return res.status(result.status).json(result)
    return res.json(result)
  }
}
