// 名单管理 API 客户端（/api/v3/roster）
//
// 和 adapter 的区别：这里每个失败都抛错，不做静默回落。
// 教师改名单是写操作，悄悄失败等于丢数据，必须让界面能红字报错。

import { getToken } from './index'

const BASE_URL = '/api/v3/roster'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `请求失败（${res.status}）`)
  }
  return data as T
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
