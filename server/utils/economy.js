import { ECONOMY, priceFor } from '../game/gacha.js'

/** 配置库为运行期覆盖，seeds为唯一默认值；不把年级系数写进路由。 */
export function readEconomy(db) {
  const result = { ...ECONOMY }
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='economy_config'").get()) return result
  for (const row of db.prepare('SELECT key,value_json FROM economy_config').all()) {
    const value = JSON.parse(row.value_json)
    result[row.key] = value && typeof value === 'object' && !Array.isArray(value)
      ? { ...result[row.key], ...value } : value
  }
  return result
}

export function routePrice(db, base, grade) { return priceFor(base, grade, readEconomy(db)) }

/** 调用方必须处于与资产写入相同事务；余额条件防止并发超扣。 */
export function debit(db, userId, cost) {
  if (!Number.isSafeInteger(cost) || cost < 0) throw new Error('扣款金额无效')
  const changed = db.prepare('UPDATE users SET game_points=game_points-? WHERE id=? AND game_points>=?')
    .run(cost, userId, cost).changes
  if (changed !== 1) throw new Error('余额不足或账号不存在')
}
