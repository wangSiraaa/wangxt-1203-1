const express = require('express')
const { getDB } = require('../db')

const router = express.Router()

router.get('/', (req, res) => {
  const db = getDB()
  const { keyword } = req.query
  let sql = 'SELECT * FROM ships WHERE 1=1'
  const params = []
  if (keyword) {
    sql += ' AND (ship_code LIKE ? OR ship_name LIKE ? OR imo LIKE ?)'
    const k = `%${keyword}%`
    params.push(k, k, k)
  }
  sql += ' ORDER BY id DESC'
  const rows = db.prepare(sql).all(params)
  res.json({ code: 0, data: rows })
})

router.get('/:id', (req, res) => {
  const db = getDB()
  const row = db.prepare('SELECT * FROM ships WHERE id = ?').get([req.params.id])
  if (!row) return res.status(404).json({ code: 1, message: '船舶不存在' })
  res.json({ code: 0, data: row })
})

router.post('/', (req, res) => {
  const db = getDB()
  const { ship_code, ship_name, ship_type, capacity, imo, contact_person, contact_phone, remark } = req.body
  if (!ship_code || !ship_name || !capacity) {
    return res.status(400).json({ code: 1, message: '船舶编号、名称、容量为必填项' })
  }
  const exists = db.prepare('SELECT id FROM ships WHERE ship_code = ?').get([ship_code])
  if (exists) return res.status(400).json({ code: 1, message: '船舶编号已存在' })

  const info = db.prepare(`INSERT INTO ships (ship_code, ship_name, ship_type, capacity, imo, contact_person, contact_phone, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run([ship_code, ship_name, ship_type || null, capacity, imo || null, contact_person || null, contact_phone || null, remark || null])

  res.json({ code: 0, data: { id: info.lastInsertRowid } })
})

router.put('/:id', (req, res) => {
  const db = getDB()
  const { ship_code, ship_name, ship_type, capacity, imo, contact_person, contact_phone, remark } = req.body
  const exists = db.prepare('SELECT id FROM ships WHERE id = ?').get([req.params.id])
  if (!exists) return res.status(404).json({ code: 1, message: '船舶不存在' })

  db.prepare(`UPDATE ships SET ship_code=?, ship_name=?, ship_type=?, capacity=?, imo=?, contact_person=?, contact_phone=?, remark=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run([ship_code, ship_name, ship_type || null, capacity, imo || null, contact_person || null, contact_phone || null, remark || null, req.params.id])

  res.json({ code: 0, message: '更新成功' })
})

router.delete('/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM ships WHERE id = ?').run([req.params.id])
  res.json({ code: 0, message: '删除成功' })
})

module.exports = router
