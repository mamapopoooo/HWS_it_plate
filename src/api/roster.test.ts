import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('BASE_URL', '/pet-garden/')
  localStorage.clear()
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('名单请求与认证错误', () => {
  it('v3业务客户端沿用相同部署基路径', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetcher)
    const { fetchConfig } = await import('./v3')
    await fetchConfig()
    expect(fetcher).toHaveBeenCalledWith('/pet-garden/api/v3/config', expect.anything())
  })
  it('旧axios单例在Pinia登录后读取最新token', async () => {
    localStorage.setItem('token', 'guest')
    localStorage.setItem('user', JSON.stringify({ id: 'guest', username: '游客', isGuest: true }))
    const { useAuth } = await import('../composables/useAuth')
    const { api } = useAuth()
    localStorage.setItem('token', 'student-demo-token')
    const adapter = vi.fn(async config => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }))
    api.defaults.adapter = adapter
    await api.get('/v2/trainer/me')
    expect(adapter.mock.calls[0][0].baseURL).toBe('/pet-garden/api')
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer student-demo-token')
  })
  it('沿用部署基路径和Bearer认证', async () => {
    localStorage.setItem('token', 'demo-token')
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ students: [], total: 0 })))
    vi.stubGlobal('fetch', fetcher)
    const roster = await import('./roster')
    await roster.fetchRosterStudents()
    expect(fetcher).toHaveBeenCalledWith('/pet-garden/api/v3/roster/students', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer demo-token' }),
    }))
  })
  it.each(['<html>SPA fallback</html>', '', '{}', 'null', '[]'])('2xx错误响应不能假成功：%s', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
    const roster = await import('./roster')
    await expect(roster.commitImport([{ studentNo: '0001', name: '示例学生' }])).rejects.toThrow()
  })
  it('预演与写入分别校验响应，不把预演当提交成功', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('{"dryRun":true}'))))
    const roster = await import('./roster')
    const rows = [{ studentNo: '0001', name: '示例学生' }]
    await expect(roster.previewImport(rows)).resolves.toEqual({ dryRun: true })
    await expect(roster.commitImport(rows)).rejects.toThrow('名单接口返回格式错误')
  })
  it('服务端逐行方案缺字段时明确报错，不交给页面猜测', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ dryRun: true,
      rowPlans: [{ studentNo: '0001', action: 'update', writeFields: ['name'] }] }))))
    const roster = await import('./roster')
    await expect(roster.previewImport([{ studentNo: '0001', name: '示例学生' }]))
      .rejects.toThrow('逐行预演格式错误')
  })
  it('错误登录401显示原因，不清除已有会话或强刷登录页', async () => {
    localStorage.setItem('token', 'existing-demo')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"姓名和学号对不上"}', { status: 401 })))
    const { api } = await import('./index')
    await expect(api.studentLogin('0001', '错误姓名')).rejects.toThrow('姓名和学号对不上')
    expect(localStorage.getItem('token')).toBe('existing-demo')
  })
})
