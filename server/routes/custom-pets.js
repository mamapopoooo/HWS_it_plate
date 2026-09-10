import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CUSTOM_PETS_DIR = join(__dirname, '..', '..', 'public', 'custom-pets')

const router = Router()

// 确保自定义宠物图片目录存在
async function ensureDir() {
  await mkdir(CUSTOM_PETS_DIR, { recursive: true })
}

// 获取当前教师的所有自定义宠物
router.get('/', authMiddleware, async (req, res) => {
  const pets = db.prepare(`
    SELECT cp.*, COUNT(cpi.id) as image_count
    FROM custom_pets cp
    LEFT JOIN custom_pet_images cpi ON cp.id = cpi.custom_pet_id
    WHERE cp.user_id = ?
    GROUP BY cp.id
    ORDER BY cp.created_at DESC
  `).all(req.userId)

  // 为每个宠物附加图片路径
  for (const pet of pets) {
    pet.images = db.prepare('SELECT level, image_path FROM custom_pet_images WHERE custom_pet_id = ? ORDER BY level')
      .all(pet.id)
      .reduce((acc, img) => { acc[img.level] = img.image_path; return acc }, {})
  }

  res.json({ pets })
})

// 创建自定义宠物（含7张等级图片）
router.post('/', authMiddleware, async (req, res) => {
  const { name, images } = req.body
  // images: { "1": "data:image/png;base64,...", "2": "...", ... "7": "..." }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '宠物名称不能为空' })
  }

  if (!images || typeof images !== 'object') {
    return res.status(400).json({ error: '需要提供7张等级图片' })
  }

  const requiredLevels = [1, 2, 3, 4, 5, 6, 7]
  for (const lvl of requiredLevels) {
    if (!images[String(lvl)]) {
      return res.status(400).json({ error: `缺少第${lvl}级图片` })
    }
  }

  await ensureDir()

  const petId = uuidv4()
  const now = Date.now()

  // 创建自定义宠物记录
  db.prepare('INSERT INTO custom_pets (id, user_id, name, created_at) VALUES (?, ?, ?, ?)')
    .run(petId, req.userId, name.trim(), now)

  // 保存每级图片
  const insertImg = db.prepare('INSERT INTO custom_pet_images (id, custom_pet_id, level, image_path) VALUES (?, ?, ?, ?)')

  for (const [levelStr, dataUrl] of Object.entries(images)) {
    const level = parseInt(levelStr)
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      continue
    }

    // 解析 base64 数据
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) continue

    const ext = match[1] === 'image/png' ? 'png' : match[1] === 'image/jpeg' ? 'jpg' : 'png'
    const buffer = Buffer.from(match[2], 'base64')
    const fileName = `${petId}_lv${level}.${ext}`
    const filePath = join(CUSTOM_PETS_DIR, fileName)

    await writeFile(filePath, buffer)

    const imgId = uuidv4()
    insertImg.run(imgId, petId, level, `/pet-garden/custom-pets/${fileName}`)
  }

  res.json({
    id: petId,
    name: name.trim(),
    created_at: now
  })
})

// 删除自定义宠物
router.delete('/:id', authMiddleware, async (req, res) => {
  const pet = db.prepare('SELECT * FROM custom_pets WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId)

  if (!pet) {
    return res.status(404).json({ error: '自定义宠物不存在或无权操作' })
  }

  // 删除图片文件
  const images = db.prepare('SELECT image_path FROM custom_pet_images WHERE custom_pet_id = ?').all(req.params.id)
  for (const img of images) {
    try {
      const fileName = img.image_path.split('/').pop()
      await rm(join(CUSTOM_PETS_DIR, fileName))
    } catch (e) { /* ignore */ }
  }

  // 删除数据库记录
  db.prepare('DELETE FROM custom_pet_images WHERE custom_pet_id = ?').run(req.params.id)
  db.prepare('DELETE FROM custom_pets WHERE id = ?').run(req.params.id)

  // 将引用此自定义宠物的学生重置为蛋
  db.prepare("UPDATE students SET pet_type = NULL, custom_pet_id = NULL, pet_level = 0, pet_exp = 0 WHERE custom_pet_id = ?")
    .run(req.params.id)

  res.json({ success: true })
})

// 学生选择自定义宠物
router.post('/:id/select', authMiddleware, (req, res) => {
  const { studentId } = req.body

  const pet = db.prepare('SELECT * FROM custom_pets WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId)
  if (!pet) {
    return res.status(404).json({ error: '自定义宠物不存在' })
  }

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId)
  if (!student) {
    return res.status(404).json({ error: '学生不存在' })
  }

  // 如果学生已有宠物且满级，发徽章
  if (student.pet_type && student.pet_level >= 7) {
    const badgeId = uuidv4()
    db.prepare('INSERT INTO badges (id, student_id, pet_type, earned_at) VALUES (?, ?, ?, ?)')
      .run(badgeId, studentId, student.pet_type || 'custom', Date.now())
  }

  // 清除内置宠物类型，设置自定义宠物
  db.prepare('UPDATE students SET pet_type = NULL, custom_pet_id = ?, pet_level = 1, pet_exp = 0 WHERE id = ?')
    .run(req.params.id, studentId)

  res.json({ success: true, petLevel: 1 })
})

export default router
