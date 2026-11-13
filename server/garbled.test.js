// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { GARBLED_HINT, garbled, garbledRows } from './utils/garbled.js'

const BAD = String.fromCharCode(0xfffd)

describe('名单写入乱码守卫', () => {
  it('干净的中文名、英文名、班级名应放行', () => {
    expect(garbled('张三丰', 'Kevin Zhang', '七年级A班')).toBe(false)
  })

  it('任一字段的替换符都要拦住', () => {
    expect(garbled(`${BAD}${BAD}${BAD}`)).toBe(true)
    expect(garbled('张三', `${BAD}班`)).toBe(true)
    expect(garbled('2020048', 'Li Si', `${BAD}Si`)).toBe(true)
  })

  it('非字符串字段不误判', () => {
    expect(garbled(undefined, null, 123, '', '正常')).toBe(false)
  })

  it('只统计真正含乱码的行', () => {
    const rows = [
      { studentNo: '2021301', name: '张三', class: '七年级A班' },
      { studentNo: '2021302', name: `${BAD}可欣`, class: '七年级B班' },
      { studentNo: '2021303', name: '王五', class: `${BAD}${BAD}${BAD}` },
      { studentNo: '2021304', name: '赵六', nameEn: 'Amy', class: '七年级C班' }
    ]
    expect(garbledRows(rows)).toBe(2)
    expect(garbledRows([])).toBe(0)
  })

  it('提示语要让教师知道是编码问题，不是表格填错', () => {
    expect(GARBLED_HINT).toContain('UTF-8')
    expect(GARBLED_HINT).toContain('拒绝写入')
  })
})
