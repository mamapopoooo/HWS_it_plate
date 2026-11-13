import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
const mocks = vi.hoisted(() => ({ updateStudent: vi.fn(), deleteStudent: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/adapter', () => ({
  fetchClasses: async () => [{ id: 'demo', name: '示例班' }],
  fetchClassStudents: async () => [{ id: 'student', name: '示例甲', studentNo: '990001', points: 10, petName: '—', petLevel: 1 }],
  fetchEvaluations: async () => [], importStudents: vi.fn(), syncPoints: vi.fn(), ...mocks,
}))
import TeacherDesk from './TeacherDesk.vue'
afterEach(() => vi.clearAllMocks())
it('修改/删除拒绝时保留真实名单并展示服务端原因', async () => {
  const wrapper = mount(TeacherDesk)
  const button = (text: string) => wrapper.findAll('button').find(b => b.text() === text)!
  try {
    await flushPromises()
    await wrapper.get('.stu__who').trigger('click')
    const inputs = wrapper.findAll('.stu__input')
    await inputs[0].setValue('修改后的名字')
    await inputs[1].setValue('990002')
    mocks.updateStudent.mockRejectedValue({ response: { data: { error: '请到名单管理修改学号' } } })
    await button('保存').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('请到名单管理')
    await button('取消').trigger('click')
    expect(wrapper.text()).toContain('示例甲')
    expect(wrapper.text()).not.toContain('修改后的名字')
    await wrapper.get('.stu__who').trigger('click')
    await button('删除').trigger('click')
    mocks.deleteStudent.mockRejectedValue({ response: { data: { error: '还有登录身份，旧接口不删' } } })
    await button('确认删除？').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('还有登录身份')
    expect(wrapper.findAll('.stu').length).toBe(1)
  } finally { wrapper.unmount() }
})
