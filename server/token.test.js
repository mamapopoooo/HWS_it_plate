import { describe, it, expect } from 'vitest'
import { generateToken, verifyToken } from './utils/token.js'

describe('Token 生成与验证', () => {
  it('生成的 token 应包含三段（userId:timestamp:signature）', () => {
    const token = generateToken('user-123')
    const parts = token.split(':')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('user-123')
  })

  it('有效 token 应能正确解析出 userId', () => {
    const token = generateToken('abc-def-ghi')
    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload.userId).toBe('abc-def-ghi')
  })

  it('篡改签名应返回 null', () => {
    const token = generateToken('user-1')
    const parts = token.split(':')
    parts[2] = 'tampered-signature'
    const result = verifyToken(parts.join(':'))
    expect(result).toBeNull()
  })

  it('空 token 应返回 null', () => {
    expect(verifyToken('')).toBeNull()
    expect(verifyToken(null)).toBeNull()
    expect(verifyToken(undefined)).toBeNull()
  })

  it('格式错误的 token 应返回 null', () => {
    expect(verifyToken('only-one-part')).toBeNull()
    expect(verifyToken('two:parts')).toBeNull()
    expect(verifyToken('a:b:c:d')).toBeNull()
  })

  it('同一 userId 不同时间生成的 token 应不同', async () => {
    const token1 = generateToken('user-x')
    await new Promise(r => setTimeout(r, 10))
    const token2 = generateToken('user-x')
    expect(token1).not.toBe(token2)
  })

  it('不同 userId 生成的 token 应不同', () => {
    const token1 = generateToken('user-a')
    const token2 = generateToken('user-b')
    expect(token1.split(':')[0]).toBe('user-a')
    expect(token2.split(':')[0]).toBe('user-b')
    expect(token1).not.toBe(token2)
  })
})
