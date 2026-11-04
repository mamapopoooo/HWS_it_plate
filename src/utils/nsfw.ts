/**
 * 图片内容检测（NSFW）—— 学生造物上传前的第一道闸
 *
 * 目标：在图片进入审核队列之前，先在本机把明显不适宜的图挡掉。
 * 这是**辅助**，不是终审：教师审核仍是最终关（见 docs/内容安全红线.md）。
 *
 * 设计：
 * - 模型与 TensorFlow 全部**动态加载**（不进主包），初次检测时才下载；
 * - 模型从 CDN 拉取，若校园网/离线环境拉不到，则**放行并标记 skipped**，
 *   由教师审核兜底（而不是报错卡住学生）；
 * - 只挑 Porn / Hentai / Sexy 三类判定，`Drawing`（插画）与 `Neutral` 属正常内容。
 */

export interface NsfwVerdict {
  /** 是否允许继续 */
  ok: boolean
  /** 是否真的跑了检测（模型没加载成功时为 false） */
  checked: boolean
  /** 判定为不适宜的原因 */
  reason?: string
  /** 命中的最高分与类别，便于教师复核 */
  top?: { label: string; score: number }
}

/** 判定阈值：色情/成人向从严，Sexy 适度放宽（插画常被判 Sexy） */
const THRESHOLDS: Record<string, number> = {
  Porn: 0.5,
  Hentai: 0.5,
  Sexy: 0.8,
}

let modelPromise: Promise<unknown> | null = null

/**
 * 只加载 MobileNetV2 一个模型（约 3.4MB），且走 `nsfwjs/core` 显式传入模型定义。
 *
 * 为什么不直接 `import('nsfwjs')`：它的默认入口会把三个模型（含 32MB 的 InceptionV3）
 * 一起打进产物。用 core + 指定模型，产物只多出一个约 3.4MB 的懒加载分块。
 */
async function loadModel(): Promise<unknown> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import('@tensorflow/tfjs')
      const core = await import('nsfwjs/core')
      const { MobileNetV2Model } = await import('nsfwjs/models/mobilenet_v2')
      return core.load('MobileNetV2', {
        modelDefinitions: { MobileNetV2: MobileNetV2Model },
      } as never)
    })()
  }
  return modelPromise
}

/** 把 File 画到 canvas 并缩到 300px 内，检测更快 */
async function toCanvas(file: File, maxSide = 300): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('图片读取失败'))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建画布')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 检测一张图片。
 * - 模型加载失败（离线/CDN 不可达）→ `ok: true, checked: false`，交给教师审核；
 * - 命中阈值 → `ok: false`，附命中类别与分数。
 */
export async function checkImage(file: File): Promise<NsfwVerdict> {
  // 非图片直接拒
  if (!file.type.startsWith('image/')) {
    return { ok: false, checked: true, reason: '不是图片文件' }
  }

  try {
    const [model, canvas] = await Promise.all([loadModel(), toCanvas(file)])
    const classify = (model as { classify: (input: HTMLCanvasElement, topk?: number) => Promise<Array<{ className: string; probability: number }>> }).classify
    const predictions = await classify.call(model, canvas, 3)

    const hit = predictions.find((p) => (THRESHOLDS[p.className] ?? 1) < p.probability)
    if (hit) {
      return {
        ok: false,
        checked: true,
        reason: `检测到疑似不适宜内容（${hit.className}）`,
        top: { label: hit.className, score: hit.probability },
      }
    }

    const top = predictions[0]
    return { ok: true, checked: true, top: top ? { label: top.className, score: top.probability } : undefined }
  } catch {
    // 模型拉不到：放行但标记未检测，教师审核兜底
    return {
      ok: true,
      checked: false,
      reason: '本地检测模型未加载（离线或网络受限），已交由教师审核',
    }
  }
}
