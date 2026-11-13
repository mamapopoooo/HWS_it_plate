import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { PETS } from '@/config/gameConfig'
const mocks = vi.hoisted(() => ({ drawWithReceipt: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/adapter', () => ({
  fetchProfile: async () => ({ grade: 7 }), fetchOwned: async () => ({}),
  fetchWallet: async () => ({ points: 100, shards: 2 }), ...mocks,
}))
import Gacha from './Gacha.vue'
afterEach(() => vi.clearAllMocks())
const mountPage = () => mount(Gacha, { global: { stubs: { GachaAnimation: true } } })
it('刷新不伪造累计次数；只展示回执余额、次数和新增碎片', async () => {
  const wrapper = mountPage()
  try {
    await flushPromises()
    expect(wrapper.text()).toContain('累计抽数与保底进度待确认')
    expect(wrapper.text()).toContain('省 3')
    mocks.drawWithReceipt.mockResolvedValue({ points: 97, pulls: 21,
      results: [{ petId: PETS[0].id, tier: PETS[0].tier, isNew: false, fragments: 5 }] })
    await wrapper.get('.gk__draw').trigger('click')
    await flushPromises()
    expect(wrapper.get('.gk__pity-note').text()).toContain('21')
    expect(wrapper.get('.gk__coin').text()).toContain('97')
    expect(wrapper.get('.gk__shard').text()).toContain('7')
  } finally { wrapper.unmount() }
})
it('超时后保留钱包并阻止再次发送，等待核对', async () => {
  const wrapper = mountPage()
  try {
    await flushPromises()
    mocks.drawWithReceipt.mockRejectedValue(new Error('timeout'))
    await wrapper.get('.gk__draw').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('请求未确认')
    expect(wrapper.get('.gk__coin').text()).toContain('100')
    expect(wrapper.get('.gk__draw').attributes('disabled')).toBeDefined()
    await wrapper.get('.gk__draw').trigger('click')
    expect(mocks.drawWithReceipt).toHaveBeenCalledTimes(1)
  } finally { wrapper.unmount() }
})
