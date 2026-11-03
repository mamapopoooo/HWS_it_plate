import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './utils/password.js'

describe('密码哈希与验证', () => {
  it('相同密码应生成相同的哈希（固定 salt）', () => {
    const h1 = hashPassword('123456')
    const h2 = hashPassword('123456')
    expect(h1).toBe(h2)
  })

  it('不同密码应生成不同的哈希', () => {
    const h1 = hashPassword('password1')
    const h2 = hashPassword('password2')
    expect(h1).not.toBe(h2)
  })

  it('verifyPassword 应正确验证密码', () => {
    const hash = hashPassword('admin-pass')
    expect(verifyPassword('admin-pass', hash)).toBe(true)
    expect(verifyPassword('wrong-pass', hash)).toBe(false)
  })

  it('空密码也应能正常哈希和验证', () => {
    const hash = hashPassword('')
    expect(verifyPassword('', hash)).toBe(true)
    expect(verifyPassword('not-empty', hash)).toBe(false)
  })

  it('哈希值应为 64 位十六进制字符串（SHA-256）', () => {
    const hash = hashPassword('test')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})
