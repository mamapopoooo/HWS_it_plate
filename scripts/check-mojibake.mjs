// 名单乱码体检：找出库里含 U+FFFD 替换符（GBK 误解码指纹）的字段。
//
// 用法：
//   node scripts/check-mojibake.mjs --self-test
//       CI 门禁模式：不碰任何库，用内置的虚构样例验证检测逻辑本身还有效。
//   node scripts/check-mojibake.mjs --db <数据库文件路径> [--seed <名单json>] [--show-names]
//       人工体检模式：只读打开指定库，输出脱敏报告。
//
// 退出码：0 干净 / 1 检出乱码 / 2 用法或库文件问题
//
// 为什么改掉旧写法：旧版 `import { db } from '../server/db.js'` 会直接打开（甚至顺手创建）
// 默认库，又把 docs/seeds/students-real.json 里的真实姓名打印到终端——既没法进 CI，
// 也会把未成年人「姓名＋学号」泄进日志。现在库路径必须显式给、只读打开、文件不存在就报错。

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import Database from 'better-sqlite3'
import { garbled } from '../server/utils/garbled.js'

const BAD = String.fromCharCode(0xfffd)
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const opt = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

// 判据和 server/utils/garbled.js 写入口共用同一个函数，避免体检和拦截两套标准
const FIELDS = [
  { table: 'students', keyCol: 'student_no', cols: ['name', 'name_en'] },
  { table: 'users', keyCol: 'username', cols: ['real_name', 'name_en'], where: 'WHERE role = \'student\'' },
  { table: 'classes', keyCol: 'id', cols: ['name'] }
]

const columnsOf = (db, table) =>
  new Set(db.prepare('SELECT name FROM pragma_table_info(?)').all(table).map((r) => r.name))

/** 学号/班级名脱敏：留首 2 末 1，够教师定位行，又不会把整份名单抄进日志 */
function mask(value) {
  const s = String(value ?? '')
  if (s.length <= 3) return '*'.repeat(Math.max(s.length, 1))
  return `${s.slice(0, 2)}${'*'.repeat(s.length - 3)}${s.slice(-1)}`
}

function scan(db) {
  const findings = []
  for (const field of FIELDS) {
    const have = columnsOf(db, field.table)
    if (!have.has('id')) continue
    const cols = field.cols.filter((c) => have.has(c))
    if (!cols.length) continue
    const key = field.keyCol && have.has(field.keyCol) ? field.keyCol : 'id'
    const rows = db
      .prepare(`SELECT id, ${key} AS keyCol, ${cols.join(', ')} FROM ${field.table} ${field.where || ''}`)
      .all()
    for (const row of rows) {
      const hit = cols.filter((c) => garbled(row[c]))
      if (!hit.length) continue
      findings.push({
        table: field.table,
        rawKey: String(row.keyCol ?? ''),
        id: row.id,
        cols: hit,
        values: hit.map((c) => row[c])
      })
    }
  }
  return findings
}

/** 空班级：多半是测试残留，不是学生 PII，但会污染教师端的班级下拉 */
function emptyClasses(db) {
  if (!columnsOf(db, 'classes').has('id') || !columnsOf(db, 'students').has('class_id')) return []
  return db.prepare(`
    SELECT c.id, c.name FROM classes c
    LEFT JOIN students s ON s.class_id = c.id
    GROUP BY c.id HAVING COUNT(s.id) = 0
  `).all()
}

function line(f, showNames) {
  const key = showNames ? f.rawKey : mask(f.rawKey)
  const detail = showNames
    ? f.values.map((v, i) => `${f.cols[i]}=${JSON.stringify(v)}`).join(' ')
    : f.cols.join(',')
  return `  ${f.table}#${key}  ${detail}`
}

// 虚构样例：假名字、假学号，和任何真实学生无关，可以安全留在仓库和 CI 日志里
function selfTest() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE students (id TEXT PRIMARY KEY, student_no TEXT, name TEXT, name_en TEXT, class_id TEXT);
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, real_name TEXT, name_en TEXT, role TEXT);
    INSERT INTO classes VALUES ('c1', '示例班'), ('c2', '示${BAD}班');
    INSERT INTO students VALUES
      ('s1', '990000001', '示例甲', 'Demo One', 'c1'),
      ('s2', '990000002', '示例${BAD}', 'Demo Two', 'c1'),
      ('s3', '990000003', '示例丙', 'Demo${BAD}', 'c1');
    INSERT INTO users VALUES
      ('u1', '990000001', '示例甲', '', 'student'),
      ('u2', '990000002', '示${BAD}子', '', 'student'),
      ('u3', '990000003', '示例丙', 'De${BAD}mo', 'student'),
      ('u4', '990000004', '示${BAD}老师', '', 'teacher');
  `)

  // 预期 5 处：students 中文名 + 英文名各 1，users 中文名 + 英文名各 1，classes 班级名 1。
  // u4 是教师身份，按学生口径过滤后不该出现——它也在断言里，防止以后有人放宽条件。
  const expected = [
    'classes#c2 name',
    'students#990000002 name',
    'students#990000003 name_en',
    'users#990000002 real_name',
    'users#990000003 name_en'
  ].join('\n')
  const findings = scan(db)
  const actual = findings
    .map((f) => `${f.table}#${f.rawKey} ${f.cols.join(',')}`)
    .sort()
    .join('\n')
  const empties = emptyClasses(db)
  db.close()

  console.log(`自检样例：检出 ${findings.length} 处（预期 5 处）`)
  for (const item of actual.split('\n')) console.log(`  ${item}`)
  if (actual !== expected) {
    console.error('❌ 自检未通过：命中行或命中列与预期不符')
    console.error(`   预期：\n${expected}`)
    return 1
  }
  console.log(`✅ 自检通过：中文名、英文名、班级名、users 档案名的乱码都能检出，教师身份按口径排除（空班级 ${empties.length} 个）`)
  return 0
}

function main() {
  if (flag('self-test')) process.exit(selfTest())

  const dbPath = opt('db')
  if (!dbPath) {
    console.error('用法：--self-test（CI 门禁）或 --db <数据库文件路径>（人工体检，只读）')
    process.exit(2)
  }
  const abs = resolve(dbPath)
  if (!existsSync(abs)) {
    // 关键：绝不为「体检」创建一个空库，否则下一次体检会把空库当成干净库放行
    console.error(`❌ 数据库文件不存在：${abs}（本脚本只读，不会创建库）`)
    process.exit(2)
  }

  const db = new Database(abs, { readonly: true, fileMustExist: true })
  // 缺表/缺列不能当作“零乱码”；那表示此库尚未完成检查。
  for (const field of FIELDS) {
    const required = ['id', ...field.cols, ...(field.where ? ['role'] : [])]
    const columns = columnsOf(db, field.table)
    if (required.some(column => !columns.has(column))) {
      db.close()
      console.error('未检查：数据库缺少名单检查所需表或字段，请先核对快照结构')
      process.exit(2)
    }
  }
  const findings = scan(db)
  const empties = emptyClasses(db)
  db.close()

  const showNames = flag('show-names')
  console.log(`库：${abs}`)
  console.log(`乱码字段：${findings.length} 处`)
  for (const f of findings) console.log(line(f, showNames))

  const seedPath = opt('seed')
  if (seedPath && existsSync(resolve(seedPath))) {
    // 名单只用来数「多少行能自动修」，姓名一律不读出来
    const seed = JSON.parse(readFileSync(resolve(seedPath), 'utf-8'))
    const clean = new Set(
      seed.filter((r) => !garbled(r.name, r.nameEn)).map((r) => String(r.studentNo || '').trim())
    )
    const fixable = findings.filter((f) => f.table === 'students' && clean.has(f.rawKey)).length
    console.log(`其中 ${fixable} 处在名单里有无乱码的同款学号，可回写修复`)
  }

  console.log(`空班级：${empties.length} 个`)
  for (const c of empties) {
    console.log(`  ${showNames ? JSON.stringify(c.name) : JSON.stringify(mask(c.name))}`)
  }
  process.exit(findings.length ? 1 : 0)
}

try { main() } catch {
  console.error('未检查：无法读取有效的SQLite快照或指定输入')
  process.exitCode = 2
}
