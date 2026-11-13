// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../', import.meta.url))
const probe = `
  const {db,initDb} = await import('./server/db.js');
  initDb();
  const result = {name:db.name, count:db.prepare('SELECT COUNT(*) AS n FROM students').get().n};
  db.close(); console.log(JSON.stringify(result));
`
function run(dbPath) {
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
    cwd: repo, env: { ...process.env, PET_GARDEN_DB: dbPath }, encoding: 'utf8',
  }).trim().split('\n').at(-1))
}
describe('测试数据库路径隔离', () => {
  it('显式临时路径只创建临时库，不触碰工作区默认库', () => {
    const directory = mkdtempSync(join(tmpdir(), 'codex-db-isolation-'))
    const target = join(directory, 'sandbox.db')
    const defaultPath = join(repo, 'server', 'pet-garden.db')
    const existed = existsSync(defaultPath)
    try {
      expect(run(target)).toEqual({ name: resolve(target), count: 0 })
      expect(existsSync(target)).toBe(true)
      expect(existsSync(defaultPath)).toBe(existed)
    } finally {
      // 只清理由本用例创建、且确认为系统临时目录直属子目录的沙箱。
      if (dirname(directory) !== resolve(tmpdir())) throw new Error('临时目录越界')
      rmSync(directory, { recursive: true, force: true })
    }
  })
  it('支持明确的内存库配置', () => {
    expect(run(':memory:')).toEqual({ name: ':memory:', count: 0 })
  })
})
