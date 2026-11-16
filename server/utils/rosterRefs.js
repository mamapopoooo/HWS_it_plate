// 名单关联引用的只读盘点。
//
// foreign_keys 在实际启动连接上为 1，但只保护 DDL 已声明的关系；
// 所以「删一个学生 / 删一个班级」会不会留下孤儿，只能靠写入方自己查。
// 旧 v1 入口（routes/students.js、routes/classes.js）曾经直接 DELETE 主行，
// 把 users 登录身份和十几张游戏资产表留在库里 —— 学生档案没了，账号和宠物还在，
// 下次重传表格时这些资产会悄悄挂到同名学号上。删除前必须先数清楚牵连。
//
// 这里只读：不写库、不开事务、不改结构。删除动作留给调用方决定。

import { db } from '../db.js'

// 按 user_id 挂的学生游戏资产表。v3 加表时这里要一起加，
// 否则 roster.js 的级联清理和这里的引用盘点会各拿一份清单，迟早对不上。
export const USER_DATA_TABLES = [
  'trainers', 'characters', 'player_pets', 'player_skins', 'player_character_skins',
  'player_fragments', 'player_items', 'player_quests', 'player_achievements',
  'player_event_progress', 'gacha_records', 'gacha_pity', 'game_points_records',
  'exchange_records', 'notifications', 'pvp_rankings', 'class_battle_records', 'custom_pets'
]

// 不按 user_id 直挂、但确实属于这个学生的表。params(id) 自己声明要几个占位符，
// 免得多列 OR 的语句被当成单参数调用（真库上就是这么炸成 500 的）。
const EXTRA_ASSET_QUERIES = [
  {
    table: 'battle_records',
    sql: 'SELECT COUNT(*) AS n FROM battle_records WHERE player_a_id = ? OR player_b_id = ?',
    params: (id) => [id, id]
  },
  {
    table: 'custom_pet_images',
    sql: 'SELECT COUNT(*) AS n FROM custom_pet_images WHERE custom_pet_id IN (SELECT id FROM custom_pets WHERE user_id = ?)',
    params: (id) => [id]
  }
]

function hasTable(name) {
  return !!db.prepare('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?').get('table', name)
}

function countOr(sql, params, acc, table) {
  if (!hasTable(table)) { acc.missingTables.push(table); return 0 }
  return db.prepare(sql).get(...params).n
}

/**
 * 某个学号牵连了哪些登录身份与游戏数据。
 * 只数「确实存在」的东西，缺表记进 missingTables，不假装数是 0。
 * @param {string} studentNo
 */
export function studentRefs(studentNo) {
  const no = String(studentNo ?? '').trim()
  const refs = {
    studentNo: no, identities: [], legacyUsernames: [], assets: [], assetRows: 0,
    records: { evaluations: 0, badges: 0 }, missingTables: []
  }
  if (!no) return refs

  if (!hasTable('users')) {
    refs.missingTables.push('users')
  } else {
    // 旧版自动建号写过 stu_ 前缀用户名，它和纯学号身份是两条不同记录，两条都算牵连
    const rows = db.prepare(`
      SELECT id, username, role, is_guest AS isGuest, game_points AS gamePoints
      FROM users WHERE username IN (?, ?)
    `).all(no, `stu_${no}`)
    refs.identities = rows.map(r => ({ ...r, isGuest: !!r.isGuest }))
    refs.legacyUsernames = refs.identities.filter(r => r.username !== no).map(r => r.username)
  }

  for (const { id } of refs.identities) {
    for (const table of USER_DATA_TABLES) {
      const n = countOr(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`, [id], refs, table)
      if (n) pushAsset(refs, table, n)
    }
    for (const extra of EXTRA_ASSET_QUERIES) {
      const n = countOr(extra.sql, extra.params(id), refs, extra.table)
      if (n) pushAsset(refs, extra.table, n)
    }
  }

  if (hasTable('evaluation_records')) {
    refs.records.evaluations = db.prepare('SELECT COUNT(*) AS n FROM evaluation_records WHERE student_id IN (SELECT id FROM students WHERE student_no = ?)').get(no).n
  } else refs.missingTables.push('evaluation_records')
  if (hasTable('badges')) {
    refs.records.badges = db.prepare('SELECT COUNT(*) AS n FROM badges WHERE student_id IN (SELECT id FROM students WHERE student_no = ?)').get(no).n
  } else refs.missingTables.push('badges')

  return refs
}

function pushAsset(refs, table, rows) {
  const hit = refs.assets.find(a => a.table === table)
  if (hit) hit.rows += rows
  else refs.assets.push({ table, rows })
  refs.assetRows += rows
}

/** 旧入口能不能自己删这个学生。
 *
 * 口径是「只挡旧入口清不掉的孤儿」：登录身份（users）和挂在身份上的游戏资产
 * 一旦留下，学生档案没了账号还在，下次重传表格会悄悄挂到同学号身上 —— 这种必须拒绝，
 * 走名单管理（roster.js 的 purgeStudent 会在同一事务里清干净）。
 * evaluation_records / badges 不按 user_id 挂，旧入口自己就能连带删掉（本轮补上 badges），
 * 所以它们不作为拒绝理由，否则教师连一个从没登录过的学生都删不掉。
 * users 表查不到时同样拒绝 —— 无法证明安全就不能当成安全。 */
export function studentDeletable(refs) {
  if (refs.missingTables.includes('users')) return false
  return refs.identities.length === 0 && refs.assetRows === 0
}

/** 名单管理（v3 purgeStudent）能不能安全把这个学号清干净。
 *
 * purgeStudent 只认「username 恰等于学号且 role='student'」那一条身份，
 * 其余形态它一行都不碰：
 *   · 旧版自动建号留下的 stu_学号 账号 —— 它的宠物、抽卡、功名全在它名下；
 *   · 学号被非 student 角色（admin/teacher/游客）占用的账号。
 * 这两种情况照删就会清掉 students 行、把带资产的账号留在库里，
 * 而响应还写着「已清理 N 行数据」—— 那是假干净。
 * 所以删除前必须先问这里；不能自动删旧账号，也不能把资产搬到另一条身份上。
 * @returns {string} 拒绝理由，空串表示可以安全清理 */
export function purgeBlockReason(refs) {
  if (refs.missingTables.includes('users')) return '登录身份表无法读取，名单管理不删'
  const legacy = refs.identities.filter((r) => r.username !== refs.studentNo)
  const nonStudent = refs.identities.filter((r) => r.role !== 'student')
  const parts = []
  if (legacy.length) parts.push(`${legacy.length} 个旧 stu_ 前缀账号仍挂着它自己的宠物与功名`)
  if (nonStudent.length) parts.push(`该学号被 ${nonStudent.length} 个非学生角色账号占用`)
  if (!parts.length) return ''
  return `${parts.join('，')}。名单管理只清理与学号同名的学生身份，不会自动删除这些账号，也不会把资产搬过去；请先人工核对处理后再删`
}

/**
 * 某个班级牵连的学生与档案。删班级前必须先看这里，
 * 旧入口以前是「把班里的 students 一起删掉」，那正好制造 users 身份孤儿。
 * @param {string} classId
 */
export function classRefs(classId) {
  const links = { classId, students: 0, withIdentity: 0, identityRefs: 0, battles: 0, missingTables: [] }
  if (!classId) return links
  if (!hasTable('students')) {
    links.missingTables.push('students')
    return links
  }
  links.students = db.prepare('SELECT COUNT(*) AS n FROM students WHERE class_id = ?').get(classId).n
  // 档案已经转走、但 users.class_id_ref 还指着这个班的账号：删了班就变成孤儿引用
  if (hasTable('users')) {
    links.identityRefs = db.prepare('SELECT COUNT(*) AS n FROM users WHERE class_id_ref = ?').get(classId).n
  } else links.missingTables.push('users')
  if (hasTable('users')) {
    links.withIdentity = db.prepare(`
      SELECT COUNT(*) AS n FROM users u
      WHERE u.role = 'student' AND u.username IN (SELECT student_no FROM students WHERE class_id = ?)
    `).get(classId).n
  }
  // 班级战按 class_a_id / class_b_id 挂班：班删了记录还在，对阵表里会出现查无此班的比分
  if (hasTable('class_battles')) {
    links.battles = db.prepare(
      'SELECT COUNT(*) AS n FROM class_battles WHERE class_a_id = ? OR class_b_id = ?'
    ).get(classId, classId).n
  }
  return links
}

/** 给人看的拒绝理由：只报「挡路的」那几项和数量，不报姓名/学号，
 *  避免把名单塞进日志或回显给前端。评价/徽章不在这里 —— 它们不是拒绝理由。 */
export function studentBlockReason(refs) {
  const parts = []
  if (refs.identities.length) {
    parts.push(`${refs.identities.length} 个登录身份`)
    if (refs.legacyUsernames.length) parts.push(`其中 ${refs.legacyUsernames.length} 个是旧 stu_ 前缀账号`)
  }
  if (refs.assetRows) parts.push(`${refs.assetRows} 行游戏资产`)
  return parts.join('、')
}
