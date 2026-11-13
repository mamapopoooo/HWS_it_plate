// 临时体检脚本：找出库里所有含 U+FFFD（乱码替换符）的名单字段
// 用法：node scripts/check-mojibake.mjs
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { db } from '../server/db.js'

const BAD = String.fromCharCode(0xfffd)
const __dirname = dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(readFileSync(join(__dirname, '..', 'docs', 'seeds', 'students-real.json'), 'utf-8'))
const seedByNo = new Map(seed.map(r => [r.studentNo, r]))

const isBad = v => typeof v === 'string' && v.includes(BAD)

console.log('=== students 乱码行 ===')
for (const s of db.prepare('SELECT id, student_no, name, name_en, class_id FROM students').all()) {
  if (!isBad(s.name) && !isBad(s.name_en)) continue
  const want = seedByNo.get(s.student_no)
  console.log(`${s.student_no} 库内=${JSON.stringify(s.name)}  名单=${JSON.stringify(want && want.name)}`)
}

console.log('=== users 乱码行 ===')
for (const u of db.prepare("SELECT username, real_name, name_en FROM users WHERE role = 'student'").all()) {
  if (!isBad(u.real_name) && !isBad(u.name_en)) continue
  const want = seedByNo.get(u.username)
  console.log(`${u.username} 库内=${JSON.stringify(u.real_name)}  名单=${JSON.stringify(want && want.name)}`)
}

console.log('=== 空班级（0 名学生，多为测试残留）===')
for (const r of db.prepare(
  'SELECT c.id, c.name, COUNT(s.id) n FROM classes c LEFT JOIN students s ON s.class_id = c.id GROUP BY c.id HAVING n = 0'
).all()) {
  console.log(`${r.id}  ${JSON.stringify(r.name)}`)
}
