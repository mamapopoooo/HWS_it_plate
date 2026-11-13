import { awakeningPayment } from '../game/gacha.js'
import { readEconomy, debit } from './economy.js'

export function createAwakenRoute(db) {
  return (req, res) => {
    const result = db.transaction(() => {
      const pet = db.prepare('SELECT * FROM player_pets WHERE id=? AND user_id=?').get(req.params.petId, req.userId)
      if (!pet) return { status: 404, error: '宠物不存在' }
      const template = db.prepare('SELECT tier FROM pets_template WHERE id=?').get(pet.template_id)
      const tier = template && db.prepare('SELECT awaken_cap FROM tier_config WHERE tier=?').get(template.tier)
      if (!tier) return { status: 503, error: '宠物品阶配置尚未就绪' }
      if ((pet.awakening_level || 0) >= tier.awaken_cap) return { status: 400, error: '已达该品阶最高觉醒' }
      const user = db.prepare('SELECT grade,game_points FROM users WHERE id=?').get(req.userId)
      if (!user) return { status: 401, error: '登录身份不存在' }
      const fragment = db.prepare('SELECT count FROM player_fragments WHERE user_id=? AND tier=?').get(req.userId, template.tier)
      const payment = awakeningPayment(template.tier, user.grade, fragment?.count || 0, readEconomy(db))
      if (user.game_points < payment.pointsCost) return { status: 400, error: '积分不足', required: payment.pointsCost, current: user.game_points }
      debit(db, req.userId, payment.pointsCost)
      if (payment.fragmentCost) db.prepare('UPDATE player_fragments SET count=count-? WHERE user_id=? AND tier=?')
        .run(payment.fragmentCost, req.userId, template.tier)
      const newLevel = (pet.awakening_level || 0) + 1
      db.prepare('UPDATE player_pets SET awakening_level=?,form=? WHERE id=?').run(newLevel, newLevel + 1, pet.id)
      return { success: true, newLevel, awakeningLevel: newLevel, form: newLevel + 1, formChanged: true,
        cost: payment.pointsCost, totalCost: payment.price, fragmentCost: payment.fragmentCost, newPoints: user.game_points - payment.pointsCost }
    })()
    if (result.error) return res.status(result.status).json(result)
    return res.json(result)
  }
}
