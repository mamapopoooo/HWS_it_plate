// 身份只读盘点：只输出计数，不输出姓名、学号、用户ID或资产明细。
import Database from 'better-sqlite3'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function auditStudentIdentities(db) {
  for (const [table, required] of [['students', ['student_no']], ['users', ['username', 'role', 'is_guest']]]) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name)
    if (required.some(column => !columns.includes(column))) {
      throw new Error(`缺少${table}必要字段；只读盘点不会自动迁移数据库`)
    }
  }
  return db.transaction(() => {
    const students = db.prepare('SELECT student_no FROM students').all()
    const users = db.prepare('SELECT username, role, is_guest FROM users').all()
    const roster = new Map()
    const accounts = new Map()
    for (const { student_no: number } of students) {
      if (typeof number === 'string' && number.trim()) roster.set(number, (roster.get(number) || 0) + 1)
    }
    for (const user of users) {
      const list = accounts.get(user.username) || []
      list.push(user)
      accounts.set(user.username, list)
    }
    const counts = {
      rosterRows: students.length, uniqueStudentNumbers: roster.size,
      invalidStudentNumbers: students.filter(row => typeof row.student_no !== 'string' || !row.student_no.trim()).length,
      untrimmedStudentNumbers: [...roster.keys()].filter(number => number !== number.trim()).length,
      duplicateRosterGroups: [...roster.values()].filter(count => count > 1).length,
      canonicalOnly: 0, legacyOnly: 0, dualIdentities: 0, accountCollisions: 0, missingIdentity: 0,
      ambiguousAccountLinks: 0, rosterPrefixCollisions: 0, orphanStudentUsers: 0,
    }
    const links = new Map()
    for (const number of roster.keys()) {
      const canonical = accounts.get(number) || []
      const legacy = accounts.get(`stu_${number}`) || []
      const collision = canonical.length > 1 || legacy.length > 1 || [...canonical, ...legacy]
        .some(user => user.role !== 'student' || user.is_guest)
      if (collision) counts.accountCollisions++
      else if (canonical.length && legacy.length) counts.dualIdentities++
      else if (legacy.length) counts.legacyOnly++
      else if (canonical.length) counts.canonicalOnly++
      else counts.missingIdentity++
      for (const username of [number, `stu_${number}`]) {
        if (accounts.has(username)) links.set(username, (links.get(username) || 0) + 1)
      }
    }
    counts.ambiguousAccountLinks = [...links.values()].filter(count => count > 1).length
    counts.rosterPrefixCollisions = [...roster.keys()].filter(number => number.startsWith('stu_') && roster.has(number.slice(4))).length
    counts.orphanStudentUsers = users.filter(user => user.role === 'student' && !user.is_guest && !links.has(user.username)).length
    const needsReview = ['invalidStudentNumbers', 'untrimmedStudentNumbers', 'duplicateRosterGroups', 'legacyOnly',
      'dualIdentities', 'accountCollisions', 'ambiguousAccountLinks', 'rosterPrefixCollisions', 'orphanStudentUsers'].some(key => counts[key] > 0)
    return { schemaVersion: 1, assessment: needsReview ? 'needs-review' : 'no-conflicts-found', counts }
  })()
}

export function inspectIdentityFile(filename) {
  const db = new Database(resolve(filename), { readonly: true, fileMustExist: true })
  try {
    db.pragma('query_only = ON')
    return auditStudentIdentities(db)
  } finally { db.close() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--db' || !process.argv[3].trim()) {
      throw new Error('用法：node scripts/audit-student-identities.mjs --db <已存在的隔离数据库快照>')
    }
    const result = inspectIdentityFile(process.argv[3])
    console.log(JSON.stringify(result, null, 2))
    // 2表示盘点已完成但需人工审核；1表示未能完成盘点。
    process.exitCode = result.assessment === 'needs-review' ? 2 : 0
  } catch {
    console.error('身份盘点未完成：需要 --db 指定已存在且具备students/users必要字段的可读SQLite快照；不会创建或迁移库。')
    process.exitCode = 1
  }
}
