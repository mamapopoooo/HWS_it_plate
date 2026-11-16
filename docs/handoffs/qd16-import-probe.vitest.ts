// D16 取证（Qoder，第九轮）：v1 导入被后端 409 整批拒绝时，教师端到底显示什么。
//
// 为什么文件名是 .vitest.ts 而不是 .test.ts：vitest 默认 include 只拾取 *.test/*.spec，
// 这样它**不会进测试套件**（全量仍是 366 例），也不会在 DSH/Codex 的文件里钉住一个缺陷行为。
// tsconfig 只 include src/**，所以 vue-tsc 也不会检查它。它是可复跑的证据，不是产品代码。
//
// 复跑方式（在仓库根目录，PowerShell 用 ; 分隔）：
//   Copy-Item docs/handoffs/qd16-import-probe.vitest.ts docs/handoffs/qd16-import-probe.test.ts
//   node node_modules/vitest/vitest.mjs run docs/handoffs/qd16-import-probe.test.ts
//   Remove-Item docs/handoffs/qd16-import-probe.test.ts
// 跑完务必删掉临时副本，别把它提交进套件。
//
// 手法：只 mock axios 实例（useAuth().api），让**真实** adapter 与**真实** TeacherDesk 跑完整链路。
// 注意读数：api.get 故意失败以走占位回落，所以卡片里有 12 行 DEMO_STUDENTS 是探针造成的，
// 真正的发现是末尾那 2 行本地伪造的「示例甲/示例乙」，以及提示语与服务端原因的去向。
import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const post = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    api: {
      // 只读取数故意失败，走 adapter 既有占位回落，页面照样能挂起来
      get: vi.fn(() => Promise.reject(new Error('只读取数失败，走占位'))),
      post,
      put: vi.fn(),
      delete: vi.fn()
    }
  })
}))

import TeacherDesk from '@/pages/TeacherDesk.vue'
import { importStudents } from '@/api/adapter'

const REJECT_409 = {
  response: { status: 409, data: { error: '这批里有 2 个学号已被登录身份占用，整批一行都没写' } }
}

it('adapter 把后端 409 吞成 0，服务端中文原因被丢弃', async () => {
  post.mockRejectedValue(REJECT_409)
  const n = await importStudents('c1', [{ name: '示例甲', studentNo: '990000901' }])
  console.log('【实测】importStudents 返回 =', n, '（后端说的是 409 整批零写入）')
  expect(n).toBe(0)
})

it('教师端因此本地追加并提示「接口未就绪」，而不是显示拒绝原因', async () => {
  post.mockRejectedValue(REJECT_409)
  const wrapper = mount(TeacherDesk)
  try {
    await flushPromises()
    const btn = (t: string) => wrapper.findAll('button').find((b) => b.text() === t)!
    await btn('导入学生').trigger('click')
    await wrapper.get('textarea').setValue('990000901 示例甲\n990000902 示例乙')
    await btn('确认导入').trigger('click')
    await flushPromises()
    const msg = wrapper.get('.import__msg').text()
    console.log('【实测】教师端提示 =', msg)
    console.log('【实测】本地名单卡片数 =', wrapper.findAll('.stu').length)
    console.log('【实测】页面是否出现服务端原因 =', wrapper.text().includes('整批一行都没写'))
    console.log('【实测】本地伪造行 id =', wrapper.findAll('.stu').map((n) => n.text().slice(0, 12)))
    expect(msg).toContain('已在本地追加')
    expect(wrapper.text()).not.toContain('整批一行都没写')
  } finally {
    wrapper.unmount()
  }
})