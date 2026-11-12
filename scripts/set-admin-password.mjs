#!/usr/bin/env node
/**
 * 设置/重置教师账号密码
 *
 * 用法：
 *   node scripts/set-admin-password.mjs                       # 把 admin 密码重置为随机 10 位并打印
 *   node scripts/set-admin-password.mjs 新密码                 # 把 admin 密码改成指定值
 *   node scripts/set-admin-password.mjs 账号 新密码            # 指定账号
 */
import { v4 as uuidv4 } from 'uuid'
import { db } from '../server/db.js'
import { hashPassword } from '../server/utils/password.js'
import { ensureUserColumns } from '../server/utils/userSchema.js'

ensureUserColumns()

const args = process.argv.slice(2)
const randomPass = () => Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 9000 + 1000)

let username = 'admin'
let password
if (args.length === 1 && /^\d{3,}$/.test(args[0]) === false) {
  // 只有一个参数：视为新密码
  password = args[0]
} else if (args.length >= 2) {
  username = args[0]
  password = args[1]
}
password = password || randomPass()

const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
if (row) {
  db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?').run(hashPassword(password), 'admin', row.id)
  console.log(`✓ 已重置 ${username} 的密码`)
} else {
  db.prepare(
    'INSERT INTO users (id, username, password_hash, is_guest, role, real_name, created_at) VALUES (?, ?, ?, 0, ?, ?, ?)',
  ).run(uuidv4(), username, hashPassword(password), 'admin', username === 'admin' ? '管理员' : username, Date.now())
  console.log(`✓ 已创建教师账号 ${username}`)
}

console.log(`  账号：${username}`)
console.log(`  密码：${password}`)
