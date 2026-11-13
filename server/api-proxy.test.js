// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServer as createHttpServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

let backend, vite, base, apiRoot
beforeAll(async () => {
  // 随机端口假后端，仅验证真实vite代理，不读任何数据库。
  backend = createHttpServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ path: req.url, method: req.method }))
  })
  backend.listen(0, '127.0.0.1')
  await new Promise(resolve => backend.once('listening', resolve))
  vi.stubEnv('API_PROXY_TARGET', `http://127.0.0.1:${backend.address().port}`)
  vite = await createViteServer({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'silent', server: { port: 0, host: '127.0.0.1', watch: null },
  })
  await vite.listen()
  base = `http://127.0.0.1:${vite.httpServer.address().port}`
  apiRoot = (await import('../src/api/index.ts')).API_ROOT
}, 20000)
afterAll(async () => {
  if (vite) await vite.close()
  if (backend) await new Promise(resolve => backend.close(resolve))
  vi.unstubAllEnvs()
})
describe('页面API根路径穿过实际Vite开发代理', () => {
  it.each(['/auth/student/login', '/v2/trainer/me', '/v3/roster/import'])('%s 返回JSON而非SPA或404', async path => {
    const response = await fetch(`${base}${apiRoot}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ path: `/api${path}`, method: 'POST' })
  })
})
