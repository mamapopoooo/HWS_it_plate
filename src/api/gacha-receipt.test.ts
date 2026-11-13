import { afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('@/composables/useAuth', () => ({ useAuth: () => ({ api: mocks }) }))
import { drawWithReceipt, fetchClassStudents, updateStudent, deleteStudent } from './adapter'
afterEach(() => vi.clearAllMocks())

it('教师名单修改/删除的409不会被占位回落吞掉', async () => {
  const rejection = { response: { data: { error: '旧接口不能改学号' }, status: 409 } }
  mocks.put.mockRejectedValue(rejection)
  mocks.delete.mockRejectedValue(rejection)
  await expect(updateStudent('demo', { studentNo: '990002' })).rejects.toBe(rejection)
  await expect(deleteStudent('demo')).rejects.toBe(rejection)
})

it('求签只返回服务端已提交的余额、次数与结果', async () => {
  mocks.post.mockResolvedValue({ data: { newPoints: 97, pityCount: 1, cost: 3,
    results: [{ tier: 1, pet_id: 'pet_demo', is_new: true, fragments: 0 }] } })
  expect(await drawWithReceipt('single')).toEqual({ points: 97, pulls: 1, cost: 3,
    results: [{ tier: 1, petId: 'pet_demo', isNew: true, fragments: 0 }] })
})
it('余额不足或网络失败不会生成本地结果，也不自动重试', async () => {
  mocks.post.mockRejectedValue(new Error('积分不足'))
  await expect(drawWithReceipt('single')).rejects.toThrow('积分不足')
  expect(mocks.post).toHaveBeenCalledTimes(1)
})
it('回执数量/格式不完整时拒绝伪装成功并提示先核对', async () => {
  mocks.post.mockResolvedValue({ data: { newPoints: 97, pityCount: 1, cost: 3, results: [] } })
  await expect(drawWithReceipt('single')).rejects.toThrow('不要重复提交')
  mocks.post.mockResolvedValue({ data: { newPoints: 97, pityCount: 1, cost: 3,
    results: [{ tier: 1, pet_id: '', is_new: false, fragments: 0 }] } })
  await expect(drawWithReceipt('single')).rejects.toThrow('格式错误')
})
it('教师卡片优先读取与HUD一致的游戏余额，保留旧累计字段兼容', async () => {
  mocks.get.mockResolvedValue({ data: { students: [{ id: 'demo', name: '示例', student_no: '0001', total_points: 0, game_points: 128 }] } })
  expect((await fetchClassStudents('demo-class'))[0].points).toBe(128)
})
