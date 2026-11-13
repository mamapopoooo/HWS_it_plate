// 名单管理 API 客户端（/api/v3/roster）
//
// 和 adapter 的区别：这里每个失败都抛错，不做静默回落。
// 教师改名单是写操作，悄悄失败等于丢数据，必须让界面能红字报错。

import { API_ROOT, request as apiRequest } from './index'

const BASE_URL = `${API_ROOT}/v3/roster`

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const data = await apiRequest<unknown>(`${BASE_URL}${path}`, options)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('名单接口返回格式错误')
  const value = data as Record<string, unknown>
  if ('rowPlans' in value && (!Array.isArray(value.rowPlans) || !value.rowPlans.every(isImportPlan))) {
    throw new Error('名单接口逐行预演格式错误')
  }
  const method = options.method || 'GET'
  const valid = method !== 'GET'
    ? (path === '/import' && JSON.parse(String(options.body)).dryRun ? value.dryRun === true : value.success === true)
    : path === '/classes' ? Array.isArray(value.classes)
    : path.startsWith('/students') ? Array.isArray(value.students) && typeof value.total === 'number'
    : path === '/duplicate-names' && Array.isArray(value.english) && Array.isArray(value.chinese)
  if (!valid) throw new Error('名单接口返回格式错误，请刷新核对后重试')
  return data as T
}

function isImportPlan(plan: unknown): boolean {
  if (!plan || typeof plan !== 'object') return false
  const p = plan as Record<string, unknown>
  const fields = ['name', 'nameEn', 'gender', 'class', 'course']
  return typeof p.studentNo === 'string' && ['create', 'update', 'reject'].includes(String(p.action)) &&
    ['writeFields', 'skipFields'].every(key => Array.isArray(p[key]) && p[key].every(f => typeof f === 'string' && fields.includes(f))) &&
    ['warnings', 'errors'].every(key => Array.isArray(p[key]) && p[key].every(message => typeof message === 'string'))
}

export interface RosterClass {
  id: string
  name: string
  studentCount: number
  grade: number
}

export interface RosterStudent {
  id: string
  userId: string | null
  studentNo: string
  name: string
  nameEn: string
  gender: string
  grade: number
  course: string
  classId: string
  className: string
  totalPoints: number
  gamePoints: number
  trainerLevel: number
  trainerTitle: string
  petCount: number
  loggedIn: boolean
}

/** 表格里的一行，字段名与 docs/seeds/students-real.json 对齐 */
export interface RosterRow {
  studentNo: string
  name: string
  nameEn?: string
  gender?: string
  class?: string
  course?: string
}

export interface RosterPatch {
  studentNo?: string
  name?: string
  nameEn?: string
  gender?: string
  course?: string
  className?: string
  classId?: string
}

export interface ImportResult {
  created: number
  updated: number
  rejected: Array<{ studentNo: string; reason: string }>
  /** 兼容扩展：待Qoder实现，旧响应可缺省；不能据此假定服务端已支持列保留。 */
  rowPlans?: RosterImportPlan[]
}

export type RosterImportField = 'name' | 'nameEn' | 'gender' | 'class' | 'course'

/** 学号只作定位键；grade从有效班级/课程推导，不接受导入端猜测。 */
export interface RosterImportPlan {
  studentNo: string
  action: 'create' | 'update' | 'reject'
  writeFields: RosterImportField[]
  skipFields: RosterImportField[]
  warnings: string[]
  errors: string[]
}

export interface DryRunResult {
  dryRun: true
  total: number
  wouldCreate: number
  wouldUpdate: number
  invalid: number
  garbled: number
  /** 库里已存在的学号，供预览逐行判定「新增/更新」，不受页面筛选影响 */
  existingNos: string[]
  /** 同一批rows的预演与提交必须由服务端同一规划函数生成。 */
  rowPlans?: RosterImportPlan[]
}

export function fetchRosterClasses(): Promise<{ classes: RosterClass[] }> {
  return request('/classes')
}

export function fetchRosterStudents(params: { classId?: string; grade?: number; q?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.classId) qs.set('classId', params.classId)
  if (params.grade) qs.set('grade', String(params.grade))
  if (params.q) qs.set('q', params.q)
  const suffix = qs.toString()
  return request<{ total: number; students: RosterStudent[] }>(`/students${suffix ? `?${suffix}` : ''}`)
}

export function createRosterStudent(row: RosterPatch & { studentNo: string; name: string }) {
  return request<{ success: boolean; id: string }>('/students', {
    method: 'POST',
    body: JSON.stringify(row)
  })
}

export function updateRosterStudent(id: string, patch: RosterPatch) {
  return request<{ success: boolean }>(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch)
  })
}

export function deleteRosterStudent(id: string) {
  return request<{ success: boolean; dataRows: number }>(`/students/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirm: true })
  })
}

export function bulkMove(ids: string[], classId: string) {
  return request<{ success: boolean; moved: number }>('/bulk', {
    method: 'POST',
    body: JSON.stringify({ action: 'move', ids, classId })
  })
}

export function bulkDelete(ids: string[]) {
  return request<{ success: boolean; deleted: number; dataRows: number }>('/bulk', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', ids, confirm: true })
  })
}

export function previewImport(rows: RosterRow[]) {
  return request<DryRunResult>('/import', {
    method: 'POST',
    body: JSON.stringify({ rows, dryRun: true })
  })
}

export function commitImport(rows: RosterRow[]) {
  return request<ImportResult>('/import', {
    method: 'POST',
    body: JSON.stringify({ rows })
  })
}

export function fetchDuplicateNames() {
  return request<{
    english: Array<{ name: string; n: number; studentNos: string }>
    chinese: Array<{ name: string; n: number; studentNos: string }>
  }>('/duplicate-names')
}
