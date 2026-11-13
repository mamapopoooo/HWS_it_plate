// @vitest-environment node
import { expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 串行起 5 个冷启动 node 子进程，单独跑约 2s；21 个测试文件并行时会被压到 5s 默认超时之外，
// 这里显式放宽，不让门禁出现「单独跑绿、全量偶发红」的假失败。
it('乱码检查缺库/缺表不得假通过，自检独立可运行', () => {
  const directory = mkdtempSync(join(tmpdir(), 'codex-mojibake-'))
  const cli = fileURLToPath(new URL('../scripts/check-mojibake.mjs', import.meta.url))
  const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
  try {
    const missing = join(directory, 'missing.db')
    expect(run(['--db', missing]).status).toBe(2)
    expect(existsSync(missing)).toBe(false)
    const empty = join(directory, 'empty.db')
    new Database(empty).close()
    expect(run(['--db', empty]).status).toBe(2)
    expect(run([]).status).toBe(2)
    expect(run(['--self-test']).status).toBe(0)
  } finally {
    if (dirname(directory) !== resolve(tmpdir())) throw new Error('临时目录越界')
    rmSync(directory, { recursive: true, force: true })
  }
}, 30_000)
