import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({ preview: vi.fn(), commit: vi.fn(), matrix: [] as string[][] }))
vi.mock('xlsx', () => ({ read: () => ({ Sheets: { demo: {} }, SheetNames: ['demo'] }),
  utils: { sheet_to_json: () => mocks.matrix } }))
vi.mock('@/api/adapter', () => ({
  fetchRosterClasses: async () => ({ classes: [] }), fetchRosterStudents: async () => ({ students: [], total: 0 }),
  fetchDuplicateNames: async () => ({ english: [], chinese: [] }), previewImport: mocks.preview, commitImport: mocks.commit,
  bulkDelete: vi.fn(), bulkMove: vi.fn(), createRosterStudent: vi.fn(), deleteRosterStudent: vi.fn(), updateRosterStudent: vi.fn(),
}))
import Students from './Students.vue'

afterEach(() => { vi.clearAllMocks() })
async function upload(rowPlans?: unknown[], matrix?: string[][]) {
  mocks.matrix = matrix || [['学号', '姓名'], ['0001', '示例学生']]
  mocks.preview.mockResolvedValue({ dryRun: true, total: 1, wouldCreate: 0, wouldUpdate: 1,
    invalid: 0, garbled: 0, existingNos: ['0001'], ...(rowPlans === undefined ? {} : { rowPlans }) })
  const wrapper = mount(Students)
  await flushPromises()
  const input = wrapper.find('input[type=file]')
  Object.defineProperty(input.element, 'files', { configurable: true,
    value: [{ name: 'demo.xlsx', arrayBuffer: async () => new ArrayBuffer(0) }] })
  await input.trigger('change')
  await flushPromises()
  return wrapper
}
describe('名单导入兼容性阻断与缺席列', () => {
  it.each([undefined, []])('没有完整服务端方案不能确认导入：%s', async plans => {
    const wrapper = await upload(plans)
    try {
      const button = wrapper.findAll('button').find(b => b.text().startsWith('确认导入'))!
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
      expect(mocks.commit).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('已暂停导入')
      expect(wrapper.text()).not.toContain('这些字段按服务端方案保留原值')
    } finally { wrapper.unmount() }
  })
  it('简表缺席列不发空串，确认时保留原预演批次', async () => {
    const wrapper = await upload([{ studentNo: '0001', action: 'update', writeFields: ['name'],
      skipFields: ['nameEn', 'class', 'course', 'gender'], warnings: [], errors: [] }])
    try {
      expect(mocks.preview).toHaveBeenCalledWith([{ studentNo: '0001', name: '示例学生' }])
      mocks.commit.mockResolvedValue({ created: 0, updated: 1, rejected: [] })
      const button = wrapper.findAll('button').find(b => b.text().startsWith('确认导入'))!
      expect(button.attributes('disabled')).toBeUndefined()
      await button.trigger('click')
      await flushPromises()
      expect(mocks.commit).toHaveBeenCalledWith([{ studentNo: '0001', name: '示例学生' }])
    } finally { wrapper.unmount() }
  })
  it('拒绝原因可见且完整提交空白姓名行，零更新与无变化正常显示', async () => {
    const wrapper = await upload([
      { studentNo: '0001', action: 'update', writeFields: [], skipFields: ['name'], warnings: [], errors: [] },
      { studentNo: '0002', action: 'reject', writeFields: [], skipFields: [], warnings: [], errors: ['示例拒绝原因'] },
    ], [['学号', '姓名'], ['0001', '示例学生'], ['0002', '']])
    try {
      expect(wrapper.text()).toContain('示例拒绝原因')
      expect(wrapper.text()).toContain('拒绝')
      mocks.commit.mockResolvedValue({ created: 0, updated: 0, unchanged: 1,
        rejected: [{ studentNo: '0002', reason: '示例拒绝原因' }] })
      await wrapper.findAll('button').find(b => b.text().startsWith('确认导入'))!.trigger('click')
      await flushPromises()
      expect(mocks.commit).toHaveBeenCalledWith([{ studentNo: '0001', name: '示例学生' }, { studentNo: '0002', name: '' }])
      expect(wrapper.text()).toContain('新增 0 人，更新 0 人，无变化 1 人，1 行被拒绝')
    } finally { wrapper.unmount() }
  })
})
