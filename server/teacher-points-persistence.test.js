// @vitest-environment node
import { expect,it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateTeacherPoints,createTeacherPointsRoute } from './utils/teacherPoints.js'
it('关闭并重新打开SQLite后，丢响应的同事件仍不重复记分',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mojing-point-test-')),file=join(dir,'test.db')
  let db=new Database(file)
  try {
    db.exec(`CREATE TABLE users(id TEXT,username TEXT,role TEXT,game_points INTEGER,is_guest INTEGER);
      CREATE TABLE students(id TEXT,student_no TEXT,total_points INTEGER);
      CREATE TABLE game_points_records(id TEXT,user_id TEXT,amount INTEGER,reason TEXT,category TEXT,created_at INTEGER);
      INSERT INTO users VALUES('teacher','teacher','admin',0,0),('student','990001','student',10,0);
      INSERT INTO students VALUES('s','990001',10);`)
    migrateTeacherPoints(db)
    const req={userId:'teacher',body:{records:[{eventId:'persistent-event-0001',studentNo:'990001',amount:5,reason:'测试'}]}}
    let response
    const res={status:()=>res,json:r=>{response=r}}
    createTeacherPointsRoute(db)(req,res)
    expect(response.results[0].status).toBe('applied')
    db.close();db=new Database(file);migrateTeacherPoints(db)
    createTeacherPointsRoute(db)(req,res)
    expect(response.results[0].status).toBe('duplicate')
    expect(db.prepare("SELECT game_points FROM users WHERE id='student'").get().game_points).toBe(15)
    expect(db.prepare('SELECT COUNT(*) n FROM game_points_records').get().n).toBe(1)
  } finally { db.close();rmSync(dir,{recursive:true,force:true}) }
})
