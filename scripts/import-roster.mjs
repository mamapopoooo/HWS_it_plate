// CLI：把 docs/seeds/students-real.json 灌进数据库
// 用法：node scripts/import-roster.mjs [--dry-run]
//
// students-real.json 由 scripts/read-roster.py 从 D:\德育工作\26下班级名单\*.xlsx 生成。

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { db } from '../server/db.js'
import { initDb } from '../server/db.js'
import { migrateV2 } from '../server/game/migrate-v2.js'
import { migrateV3 } from '../server/game/migrate-v3.js'
import { importRoster } from '../server/game/import-roster.js'
import { migrateRoster } from '../server/game/migrate-roster.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dryRun = process.argv.includes('--dry-run')

// 与 server/index.js 同序，保证单独跑脚本时表结构齐备
initDb()
migrateV2()
migrateV3()
migrateRoster()

const rows = JSON.parse(readFileSync(join(__dirname, '..', 'docs', 'seeds', 'students-real.json'), 'utf-8'))
console.log(`读到 ${rows.length} 条名单`)

if (dryRun) {
  const byClass = {}
  for (const r of rows) byClass[r.class] = (byClass[r.class] || 0) + 1
  for (const [c, n] of Object.entries(byClass).sort()) console.log(`  ${c}  ${n} 人`)
  console.log('\n--dry-run：未写库')
  process.exit(0)
}

// 清掉 v1 遗留的 3 条英文测试生（Zhang San / Li Si / Wang Wu），
// 它们的学号 001-003 与真实 7 位学号不同构，留着会一直出现在教师名单里造成困惑。
const testNos = ['001', '002', '003']
const delStudents = db.prepare(`DELETE FROM students WHERE student_no IN (${testNos.map(() => '?').join(',')})`)
const delUsers = db.prepare(`DELETE FROM users WHERE username IN (${testNos.map(() => '?').join(',')}) AND role = 'student'`)
const removedS = delStudents.run(...testNos).changes
const removedU = delUsers.run(...testNos).changes
if (removedS || removedU) console.log(`清理测试生：students ${removedS} 行 / users ${removedU} 行`)

const res = importRoster(rows)
console.log(`导入完成：新增 ${res.created}，更新 ${res.updated}，拒绝 ${res.rejected.length}`)
for (const r of res.rejected.slice(0, 10)) console.log(`  跳过 ${r.studentNo}：${r.reason}`)

const total = db.prepare('SELECT COUNT(*) AS c FROM students').get().c
const withEn = db.prepare("SELECT COUNT(*) AS c FROM students WHERE name_en != ''").get().c
const identities = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'student'").get().c
console.log(`\n现状：students ${total} 人（含英文名 ${withEn}）· users 学生身份 ${identities} 条`)
