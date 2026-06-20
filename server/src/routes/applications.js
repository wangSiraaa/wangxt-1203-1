const express = require('express')
const dayjs = require('dayjs')
const { getDB } = require('../db')

const router = express.Router()

function genAppNo() {
  return 'APP' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000)
}

router.get('/', (req, res) => {
  const db = getDB()
  const { status, keyword } = req.query
  let sql = `SELECT a.*, s.ship_code, s.ship_name, s.capacity FROM applications a
    LEFT JOIN ships s ON a.ship_id = s.id WHERE 1=1`
  const params = []
  if (status) { sql += ' AND a.status = ?'; params.push(status) }
  if (keyword) {
    sql += ' AND (a.app_no LIKE ? OR s.ship_code LIKE ? OR s.ship_name LIKE ?)'
    const k = `%${keyword}%`
    params.push(k, k, k)
  }
  sql += ' ORDER BY a.id DESC'
  const rows = db.prepare(sql).all(params)
  res.json({ code: 0, data: rows })
})

router.get('/:id', (req, res) => {
  const db = getDB()
  const row = db.prepare(`SELECT a.*, s.ship_code, s.ship_name, s.capacity, s.contact_person, s.contact_phone
    FROM applications a LEFT JOIN ships s ON a.ship_id = s.id WHERE a.id = ?`).get([req.params.id])
  if (!row) return res.status(404).json({ code: 1, message: '申请不存在' })
  res.json({ code: 0, data: row })
})

router.post('/', (req, res) => {
  const db = getDB()
  const { ship_id, berth_time, berth_end_time, expected_power, expected_duration, applicant, applicant_phone, remark } = req.body
  if (!ship_id || !berth_time) {
    return res.status(400).json({ code: 1, message: '船舶和靠泊时间为必填项' })
  }
  const ship = db.prepare('SELECT id FROM ships WHERE id = ?').get([ship_id])
  if (!ship) return res.status(400).json({ code: 1, message: '船舶不存在' })

  if (berth_end_time) {
    const bt = dayjs(berth_time)
    const bet = dayjs(berth_end_time)
    if (bet.isBefore(bt)) {
      return res.status(400).json({ code: 1, message: '靠泊结束时间不能早于靠泊开始时间' })
    }
  }

  const appNo = genAppNo()
  const info = db.prepare(`INSERT INTO applications (app_no, ship_id, berth_time, berth_end_time, expected_power, expected_duration, applicant, applicant_phone, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run([appNo, ship_id, berth_time, berth_end_time || null, expected_power || null, expected_duration || null, applicant || null, applicant_phone || null, remark || null])

  res.json({ code: 0, data: { id: info.lastInsertRowid, app_no: appNo } })
})

router.put('/:id', (req, res) => {
  const db = getDB()
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get([req.params.id])
  if (!app) return res.status(404).json({ code: 1, message: '申请不存在' })
  
  if (app.status === 'confirmed' || app.status === 'billed') {
    return res.status(400).json({ 
      code: 1, 
      message: '该申请已生成账单并确认，不能直接修改。如需靠泊延期，请使用追加续费记录功能。',
      can_renewal: true
    })
  }

  if (app.status !== 'pending') return res.status(400).json({ code: 1, message: '仅待审批申请可编辑' })

  const { berth_time, berth_end_time, expected_power, expected_duration, applicant, applicant_phone, remark } = req.body
  
  if (berth_end_time && berth_time) {
    const bt = dayjs(berth_time)
    const bet = dayjs(berth_end_time)
    if (bet.isBefore(bt)) {
      return res.status(400).json({ code: 1, message: '靠泊结束时间不能早于靠泊开始时间' })
    }
  }

  db.prepare(`UPDATE applications SET berth_time=?, berth_end_time=?, expected_power=?, expected_duration=?, applicant=?, applicant_phone=?, remark=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run([berth_time, berth_end_time || null, expected_power || null, expected_duration || null, applicant || null, applicant_phone || null, remark || null, req.params.id])

  res.json({ code: 0, message: '更新成功' })
})

router.post('/:id/approve', (req, res) => {
  const db = getDB()
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get([req.params.id])
  if (!app) return res.status(404).json({ code: 1, message: '申请不存在' })
  if (app.status !== 'pending') return res.status(400).json({ code: 1, message: '仅待审批申请可审批' })

  db.prepare(`UPDATE applications SET status='approved', updated_at=datetime('now','localtime') WHERE id=?`).run([req.params.id])
  res.json({ code: 0, message: '审批通过' })
})

router.post('/:id/reject', (req, res) => {
  const db = getDB()
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get([req.params.id])
  if (!app) return res.status(404).json({ code: 1, message: '申请不存在' })
  if (app.status !== 'pending') return res.status(400).json({ code: 1, message: '仅待审批申请可驳回' })

  db.prepare(`UPDATE applications SET status='rejected', updated_at=datetime('now','localtime') WHERE id=?`).run([req.params.id])
  res.json({ code: 0, message: '已驳回' })
})

router.delete('/:id', (req, res) => {
  const db = getDB()
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get([req.params.id])
  if (!app) return res.status(404).json({ code: 1, message: '申请不存在' })
  if (app.status !== 'pending' && app.status !== 'rejected') {
    return res.status(400).json({ code: 1, message: '仅待审批或已驳回申请可删除' })
  }
  db.prepare('DELETE FROM applications WHERE id = ?').run([req.params.id])
  res.json({ code: 0, message: '删除成功' })
})

module.exports = router
