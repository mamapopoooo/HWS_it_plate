/**
 * 美术候选的**开发预览覆盖**
 *
 * 背景：GPT 交付的候选图在 public/art-review/20261113/，按 Codex 交接要求：
 * - 不拷进正式路径（public/pets|characters），因为尺寸/体积/边缘还没处理到达标
 * - 但要能在真实页面里看到效果
 *
 * 做法：只在 DEV 构建生效；正式构建 `import.meta.env.DEV === false` 时全部返回空串，
 * 页面自动回落到正式路径（当前还没有文件 → 走缺图回退）。
 *
 * 想临时关掉预览看真实缺图效果：URL 加 `?art=off`。
 */

const DIR = `${import.meta.env.BASE_URL}art-review/20261113`

const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
export const ART_PREVIEW_ENABLED = import.meta.env.DEV && query?.get('art') !== 'off'

/** 宠物首形态候选（青龙只对应 form1，其它形态不得复用） */
const PET_PREVIEW: Record<string, Record<number, string>> = {
  pet_qinglong: { 1: `${DIR}/qinglong-form1.png` },
}

/** 角色基础形象候选 */
const SKIN_PREVIEW: Record<string, string> = {
  skin_base_m: `${DIR}/base_m-plain.png`,
  skin_base_f: `${DIR}/base_f-plain.png`,
}

export function previewPetImage(petId: string, form: number): string {
  if (!ART_PREVIEW_ENABLED) return ''
  return PET_PREVIEW[petId]?.[form] ?? ''
}

export function previewSkinImage(skinId: string): string {
  if (!ART_PREVIEW_ENABLED) return ''
  return SKIN_PREVIEW[skinId] ?? ''
}

/** 预览页/自检用：列出当前覆盖了哪些素材 */
export function previewSummary(): Array<{ target: string; file: string }> {
  const rows: Array<{ target: string; file: string }> = []
  for (const [petId, forms] of Object.entries(PET_PREVIEW)) {
    for (const [form, file] of Object.entries(forms)) rows.push({ target: `${petId}#form${form}`, file })
  }
  for (const [skinId, file] of Object.entries(SKIN_PREVIEW)) rows.push({ target: skinId, file })
  return rows
}
