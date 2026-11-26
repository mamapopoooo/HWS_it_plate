import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
const mocks = vi.hoisted(() => ({ updateStudent: vi.fn(), deleteStudent: vi.fn(), syncPoints: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/adapter', () => ({
  fetchClasses: async () => [{ id: 'demo', name: '示例班' }],
  fetchClassStudents: async () => [{ id: 'student', name: '示例甲', studentNo: '990001', points: 10, petName: '—', petLevel: 1 }],
  fetchEvaluations: async () => [], importStudents: vi.fn(), ...mocks,
}))
import TeacherDesk from './TeacherDesk.vue'
afterEach(() => vi.clearAllMocks())
it('待提交先持久化；丢响应后重试沿用事件，确认前不显示假余额', async () => {
  localStorage.setItem('user', JSON.stringify({id:'test-teacher'}))
  localStorage.removeItem('mojing-teacher-points-test-teacher')
  let wrapper = mount(TeacherDesk)
  try {
    await flushPromises()
    await wrapper.findAll('button').find(b=>b.text()==='+5')!.trigger('click')
    const saved=JSON.parse(localStorage.getItem('mojing-teacher-points-test-teacher')!)
    expect(saved[0]).toMatchObject({studentNo:'990001',amount:5})
    expect(wrapper.get('.stu__points').text()).toBe('10')
    mocks.syncPoints.mockRejectedValueOnce(new Error('响应丢失'))
    await wrapper.get('.td__flush').trigger('click'); await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('响应丢失')
    wrapper.unmount(); wrapper=mount(TeacherDesk); await flushPromises()
    mocks.syncPoints.mockResolvedValueOnce(true)
    await wrapper.get('.td__flush').trigger('click'); await flushPromises()
    expect(mocks.syncPoints).toHaveBeenNthCalledWith(1,saved)
    expect(mocks.syncPoints).toHaveBeenNthCalledWith(2,saved)
    expect(JSON.parse(localStorage.getItem('mojing-teacher-points-test-teacher')!)).toEqual([])
  } finally { wrapper.unmount(); localStorage.removeItem('user'); localStorage.removeItem('mojing-teacher-points-test-teacher') }
})
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
