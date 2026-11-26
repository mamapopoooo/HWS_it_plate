// 名单链路真实服务端冒烟（Qoder，第十轮起改为入库可复跑版）。
//
// 为什么要有这个文件：前几轮的冒烟脚本放在系统临时目录、没进仓库，别人无法复跑，
// 我自己换台机器也得重写。这里改成入库版本。
//
// 安全边界（三条，缺一不可）：
//   1. 子进程的 PET_GARDEN_DB 指向 os.tmpdir() 下**唯一**新建目录里的空库，
//      启动前断言该绝对路径确实落在临时目录内、且不在仓库内 —— 绝不碰工作区默认库。
//   2. 管理员用显式 ADMIN_USERNAME/ADMIN_PASSWORD 初始化（7a058e4 起不再建默认弱口令账号），
//      口令是本脚本现编的虚构串，不是任何真实凭据。
//   3. 数据全部虚构：学号 9900009xx、姓名「示例甲/乙/丙」。不读 docs/seeds 的真实名单
//      （importSeeds 只读游戏配置 JSON，已核对），不连生产。
// 退出时先杀子进程再删目录（Windows 不先结束进程会 EPERM）。
//
// 用法：node docs/handoffs/qd-roster-smoke.mjs
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const sandbox = mkdtempSync(join(tmpdir(), 'qd-roster-smoke-'))
const dbPath = join(sandbox, 'smoke.db')
if (!resolve(dbPath).startsWith(resolve(tmpdir()) + sep)) throw new Error('沙箱越界：库不在临时目录内')
if (resolve(dbPath).startsWith(repo + sep)) throw new Error('沙箱越界：库落在仓库内')

const PORT = 39417
const ADMIN = { username: 'qdsmokeadmin', password: 'QdSmoke-20261126!' }
const child = spawn(process.execPath, ['server/index.js'], {
  cwd: repo,
  env: { ...process.env, PET_GARDEN_DB: dbPath, PORT: String(PORT), ADMIN_USERNAME: ADMIN.username, ADMIN_PASSWORD: ADMIN.password },
  stdio: ['ignore', 'pipe', 'pipe']
})
let bootLog = ''
child.stdout.on('data', (b) => { bootLog += b })
child.stderr.on('data', (b) => { bootLog += b })

const say = (s) => console.log(s)
const results = []
function check(name, actual, wanted) {
  const pass = JSON.stringify(actual) === JSON.stringify(wanted)
  results.push({ name, pass })
  say(`  ${pass ? '✅' : '❌'} ${name}　预期 ${JSON.stringify(wanted)}　实测 ${JSON.stringify(actual)}`)
}

const base = `http://127.0.0.1:${PORT}`
let token = ''
async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  let data = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

try {
  // 等真实进程打印监听行（最多 30 秒），不靠固定 sleep
  const deadline = Date.now() + 30000
  while (!/Server running/.test(bootLog)) {
    if (Date.now() > deadline) throw new Error('服务启动超时：\n' + bootLog)
    if (child.exitCode !== null) throw new Error('服务提前退出：\n' + bootLog)
    await new Promise((r) => setTimeout(r, 200))
  }
  say(`== 真实服务端已起（PID ${child.pid}，库 ${dbPath}） ==`)

  const login = await call('POST', '/api/auth/login', ADMIN)
  check('管理员显式凭据登录', login.status, 200)
  token = login.data?.token || ''

  say('')
  say('== 名单增删改查 ==')
  const made = await call('POST', '/api/v3/roster/students', { studentNo: '990000901', name: '示例甲', nameEn: 'Alice Example', className: '六年级A班' })
  check('单条新增（按班级名建班）', made.status, 200)
  const sid = made.data?.student?.id || made.data?.id
  const list = await call('GET', '/api/v3/roster/students')
  check('名单列表含新生', Array.isArray(list.data?.students) && list.data.students.some((s) => s.studentNo === '990000901'), true)
  check('英文名落库', list.data?.students?.find((s) => s.studentNo === '990000901')?.nameEn, 'Alice Example')

  const upd = await call('PUT', `/api/v3/roster/students/${sid}`, { name: '示例甲改' })
  check('改名成功', upd.status, 200)
  const occ = await call('POST', '/api/v3/roster/students', { studentNo: '990000902', name: '示例乙', className: '六年级A班' })
  check('第二名新增', occ.status, 200)
  const sid2 = occ.data?.student?.id || occ.data?.id
  const clash = await call('PUT', `/api/v3/roster/students/${sid2}`, { studentNo: '990000901' })
  check('改学号撞已占用学号 → 409', clash.status, 409)
  const noConfirm = await call('DELETE', `/api/v3/roster/students/${sid2}`, {})
  check('删除不带 confirm → 400', noConfirm.status, 400)

  say('')
  say('== 登录与导入 ==')
  // 入参是 realName（server/utils/studentLogin.js:57），第一版脚本写成 name 吃了 400 —— 是我的预期错
  const stuLogin = await call('POST', '/api/auth/student/login', { studentNo: '990000901', realName: 'Alice Example' })
  check('英文名 + 学号登录', stuLogin.status, 200)
  const badLogin = await call('POST', '/api/auth/student/login', { studentNo: '990000901', realName: '示例乙' })
  check('姓名对不上 → 401', badLogin.status, 401)

  // v3 导入的班级是**逐行 class 列**（src/api/roster.ts:168 只发 {rows,dryRun}），
  // 顶层 className 不被读取。第一版脚本把班级放在顶层，行被判「新增学生必须有班级」—— 是我的入参错。
  const dry = await call('POST', '/api/v3/roster/import', { dryRun: true, rows: [{ studentNo: '990000903', name: '示例丙', class: '六年级A班' }] })
  check('导入预演成功', dry.status, 200)
  check('预演不写库', (await call('GET', '/api/v3/roster/students')).data.students.some((s) => s.studentNo === '990000903'), false)
  const commit = await call('POST', '/api/v3/roster/import', { rows: [{ studentNo: '990000903', name: '示例丙', class: '六年级A班' }] })
  check('导入提交成功', [commit.status, commit.data?.created], [200, 1])
  say(`      提交回执：${JSON.stringify(commit.data)}`)
  // v3 契约是「逐行判定 + rejected 清单」，不是整批 4xx；整批拒绝是 v1 /students/import 的口径（QD-12）。
  // 第一版脚本把 v1 的预期套到 v3 上，判成失败 —— 是我的预期错，这里按各自契约分开断言。
  const dup = await call('POST', '/api/v3/roster/import', { rows: [{ studentNo: '990000903', name: '示例丙', class: '六年级A班' }, { studentNo: '990000903', name: '示例丙重复', class: '六年级A班' }] })
  check('v3 批内重复学号：200 + rejected 非空', [dup.status, (dup.data?.rejected?.length ?? 0) > 0], [200, true])
  check('v3 重复行没有把名字改掉', (await call('GET', '/api/v3/roster/students')).data.students.find((s) => s.studentNo === '990000903')?.name, '示例丙')

  const classId = (await call('GET', '/api/v3/roster/students')).data.students.find((s) => s.studentNo === '990000902')?.classId
  const v1dup = await call('POST', '/api/students/import', { classId, students: [{ studentNo: '990000905', name: '示例戊' }, { studentNo: '990000905', name: '示例戊重复' }] })
  check('v1 批内重复学号 → 4xx 整批拒绝', v1dup.status >= 400 && v1dup.status < 500, true)
  check('v1 整批零写入', (await call('GET', '/api/v3/roster/students')).data.students.some((s) => s.studentNo === '990000905'), false)

  say('')
  say('== 守门 ==')
  // garbled() 只认 U+FFFD 替换符（server/utils/garbled.js:5），不认「æµ‹è¯•」这种可读乱码。
  // 第一版脚本用了后者，判成守卫失效 —— 是我的样例错，守卫口径本来就是替换符。
  const mojibake = await call('POST', '/api/v3/roster/students', { studentNo: '990000904', name: '示例\uFFFD丁', className: '六年级A班' })
  check('含 U+FFFD 的姓名 → 400', mojibake.status, 400)
  const badGrade = await call('POST', '/api/v3/roster/bulk', { action: 'move', ids: [sid], className: '图书角' })
  check('转班目标推不出年级 → 400', badGrade.status, 400)
  const v1del = await call('DELETE', `/api/students/${sid}`, {})
  check('v1 旧删除入口遇登录身份 → 409', v1del.status, 409)
  const purge = await call('DELETE', `/api/v3/roster/students/${sid}`, { confirm: true })
  check('名单管理带确认删除 → 200', purge.status, 200)
} catch (e) {
  say('❌ 冒烟异常：' + e.message)
  results.push({ name: '冒烟流程未跑完', pass: false })
} finally {
  child.kill()
  await new Promise((r) => child.once('exit', r))
  try { rmSync(sandbox, { recursive: true, force: true }) } catch (e) { say('沙箱清理失败：' + e.message) }
}

const bad = results.filter((r) => !r.pass)
say('')
say(`===== 名单真实服务端冒烟：${results.length - bad.length}/${results.length} 通过 =====`)
say(`  沙箱已清理：${sandbox}`)
process.exitCode = bad.length ? 1 : 0