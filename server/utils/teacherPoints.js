import { randomUUID } from 'node:crypto'

export function migrateTeacherPoints(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS teacher_point_events (
    event_id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, payload TEXT NOT NULL,
    user_id TEXT NOT NULL, created_at INTEGER NOT NULL)`)
}

// 同一批全成或全退；eventId全局唯一，跨重启仍可核对相同教师及请求体。
export function createTeacherPointsRoute(db) {
  return (req, res) => {
    if (db.prepare('SELECT role FROM users WHERE id=?').get(req.userId)?.role !== 'admin') return res.status(403).json({ error: '权限不足' })
    const records = req.body.records
    if (!Array.isArray(records) || !records.length || records.length > 200) return res.status(400).json({ error: '每批需1至200条记录' })
    const seen = new Set()
    for (const r of records) {
      if (!r || typeof r.eventId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(r.eventId) || seen.has(r.eventId) ||
          typeof r.studentNo !== 'string' || !r.studentNo.trim() || !Number.isSafeInteger(r.amount) || r.amount === 0 || Math.abs(r.amount) > 10000 ||
          typeof r.reason !== 'string' || r.reason.length > 200) return res.status(400).json({ error: '积分记录无效，需唯一eventId、学号、非零整数金额和原因；整批未提交' })
      seen.add(r.eventId)
    }
    try {
      const results = db.transaction(() => records.map(r => {
        const payload = JSON.stringify([r.studentNo, r.amount, r.reason])
        const previous = db.prepare('SELECT * FROM teacher_point_events WHERE event_id=?').get(r.eventId)
        if (previous) {
          if (previous.teacher_id !== req.userId || previous.payload !== payload) throw new Error('事件号已被不同内容或教师使用')
          return { eventId: r.eventId, status: 'duplicate' }
        }
        const student = db.prepare(`SELECT u.id,u.game_points,s.id AS student_id,s.total_points FROM users u
          JOIN students s ON s.student_no=u.username WHERE u.username=? AND u.role='student' AND COALESCE(u.is_guest,0)=0`).get(r.studentNo)
        if (!student) throw new Error('学号没有有效的名单与学生身份')
        const balance = student.game_points + r.amount
        const total = (student.total_points ?? 0) + r.amount
        if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(total)) throw new Error('余额不足或超出范围，整批未提交')
        db.prepare('UPDATE users SET game_points=? WHERE id=?').run(balance, student.id)
        db.prepare('UPDATE students SET total_points=? WHERE id=?').run(total, student.student_id)
        const now = Date.now()
        db.prepare(`INSERT INTO game_points_records(id,user_id,amount,reason,category,created_at) VALUES(?,?,?,?,'teacher_sync',?)`)
          .run(randomUUID(), student.id, r.amount, r.reason, now)
        db.prepare('INSERT INTO teacher_point_events VALUES(?,?,?,?,?)').run(r.eventId, req.userId, payload, student.id, now)
        return { eventId: r.eventId, status: 'applied' }
      }))()
      res.json({ success: true, synced: results.length, results })
    } catch (err) { res.status(409).json({ success: false, error: err.message }) }
  }
}
