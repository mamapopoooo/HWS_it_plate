// @vitest-environment node
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { auditStudentIdentities, inspectIdentityFile } from '../scripts/audit-student-identities.mjs'

function schema(db) {
  db.exec(`CREATE TABLE students (student_no TEXT, name TEXT);
    CREATE TABLE users (username TEXT, role TEXT, is_guest INTEGER DEFAULT 0, game_points INTEGER DEFAULT 0);`)
}
describe('身份只读脱敏盘点', () => {
  it('覆盖普通/旧前缀/双身份/占用/未建身份，保留前导零', () => {
    const db = new Database(':memory:')
    try {
      schema(db)
      for (const number of ['0001', '0002', '0003', '0004', '0005']) db.prepare('INSERT INTO students VALUES (?,?)').run(number, '虚构学生')
      db.exec(`INSERT INTO users (username,role) VALUES ('0001','student'),('stu_0002','student'),
        ('0003','student'),('stu_0003','student'),('0004','admin'),('guest','student'),('unmapped-demo','student');
        UPDATE users SET is_guest=1 WHERE username='guest';`)
      const result = auditStudentIdentities(db)
      expect(result.assessment).toBe('needs-review')
      expect(result.counts).toMatchObject({ canonicalOnly: 1, legacyOnly: 1, dualIdentities: 1,
        accountCollisions: 1, missingIdentity: 1, orphanStudentUsers: 1 })
      expect(JSON.stringify(result)).not.toMatch(/0001|0002|虚构学生|unmapped-demo/)
    } finally { db.close() }
  })
  it('发现重复、空学号、首尾空白及前缀命名空间交叉', () => {
    const db = new Database(':memory:')
    try {
      schema(db)
      db.exec(`INSERT INTO students VALUES ('001',''),('001',''),('stu_001',''),('', ''),(NULL,''),(' 002 ', '');
        INSERT INTO users (username,role) VALUES ('stu_001','student');`)
      expect(auditStudentIdentities(db).counts).toMatchObject({ duplicateRosterGroups: 1,
        invalidStudentNumbers: 2, untrimmedStudentNumbers: 1, ambiguousAccountLinks: 1, rosterPrefixCollisions: 1 })
    } finally { db.close() }
  })
  it('缺必要字段明确失败，不为旧库自动补列', () => {
    const db = new Database(':memory:')
    try {
      db.exec('CREATE TABLE students (student_no TEXT)')
      expect(() => auditStudentIdentities(db)).toThrow('必要字段')
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name='users'").get()).toBeUndefined()
    } finally { db.close() }
  })
  it('文件内容只读不变，CLI明确退出码，缺文件不创建', () => {
    const directory = mkdtempSync(join(tmpdir(), 'codex-identity-audit-'))
    try {
      const file = join(directory, 'snapshot.db')
      const missing = join(directory, 'missing.db')
      const db = new Database(file)
      schema(db)
      db.exec(`INSERT INTO students VALUES ('audit-demo', '不应输出的示例姓名');
        INSERT INTO users (username,role,game_points) VALUES ('stu_audit-demo','student',123);`)
      db.close()
      const before = readFileSync(file)
      expect(inspectIdentityFile(file).assessment).toBe('needs-review')
      expect(readFileSync(file)).toEqual(before)
      expect(() => inspectIdentityFile(missing)).toThrow()
      expect(existsSync(missing)).toBe(false)
      const cli = fileURLToPath(new URL('../scripts/audit-student-identities.mjs', import.meta.url))
      const result = spawnSync(process.execPath, [cli, '--db', file], { encoding: 'utf8' })
      expect(result.status).toBe(2)
      expect(JSON.parse(result.stdout).counts.legacyOnly).toBe(1)
      expect(result.stdout).not.toMatch(/audit-demo|不应输出|123/)
      const invalid = spawnSync(process.execPath, [cli, '--db', missing], { encoding: 'utf8' })
      expect(invalid.status).toBe(1)
      expect(existsSync(missing)).toBe(false)
      const noArgs = spawnSync(process.execPath, [cli], { encoding: 'utf8' })
      expect(noArgs.status).toBe(1)
      const cleanFile = join(directory, 'clean.db')
      const clean = new Database(cleanFile)
      schema(clean)
      clean.close()
      const success = spawnSync(process.execPath, [cli, '--db', cleanFile], { encoding: 'utf8' })
      expect(success.status).toBe(0)
      expect(JSON.parse(success.stdout).assessment).toBe('no-conflicts-found')
    } finally {
      if (dirname(directory) !== resolve(tmpdir())) throw new Error('临时目录越界')
      rmSync(directory, { recursive: true, force: true })
    }
  })
  it('只有新名单未建账号不当作资产冲突，干净快照退出0', () => {
    const db = new Database(':memory:')
    try {
      schema(db)
      db.exec("INSERT INTO students VALUES ('fresh-demo','示例')")
      expect(auditStudentIdentities(db)).toMatchObject({ assessment: 'no-conflicts-found', counts: { missingIdentity: 1 } })
    } finally { db.close() }
  })
})
