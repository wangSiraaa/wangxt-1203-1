const express = require('express')
const { getDB } = require('../db')

const router = express.Router()

router.get('/', (req, res) => {
  const db = getDB()
  const { status, keyword } = req.query
  let sql = 'SELECT * FROM power_interfaces WHERE 1=1'
  const params = []
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (keyword) {
    sql += ' AND (interface_code LIKE ? OR interface_name LIKE ? OR location LIKE ?)'
    const k = `%${keyword}%`
    params.push(k, k, k)
  }
  sql += ' ORDER BY id DESC'
  const rows = db.prepare(sql).all(params)
  res.json({ code: 0, data: rows })
})

router.get('/available', (req, res) => {
  const db = getDB()
  const rows = db.prepare(`SELECT pi.*, m.id as meter_id, m.meter_code, m.meter_name, m.current_reading
    FROM power_interfaces pi LEFT JOIN meters m ON m.interface_id = pi.id
    WHERE pi.status = 'available'`).all()
  res.json({ code: 0, data: rows })
})

router.get('/:id', (req, res) => {
  const db = getDB()
  const row = db.prepare('SELECT * FROM power_interfaces WHERE id = ?').get([req.params.id])
  if (!row) return res.status(404).json({ code: 1, message: '接口不存在' })
  res.json({ code: 0, data: row })
})

router.post('/', (req, res) => {
  const db = getDB()
  const { interface_code, interface_name, location, max_capacity, remark } = req.body
  if (!interface_code || !interface_name || !max_capacity) {
    return res.status(400).json({ code: 1, message: '接口编号、名称、最大容量为必填项' })
  }
  const exists = db.prepare('SELECT id FROM power_interfaces WHERE interface_code = ?').get([interface_code])
  if (exists) return res.status(400).json({ code: 1, message: '接口编号已存在' })

  const info = db.prepare(`INSERT INTO power_interfaces (interface_code, interface_name, location, max_capacity, remark)
    VALUES (?, ?, ?, ?, ?)`).run([interface_code, interface_name, location || null, max_capacity, remark || null])

  res.json({ code: 0, data: { id: info.lastInsertRowid } })
})

router.put('/:id', (req, res) => {
  const db = getDB()
  const { interface_code, interface_name, location, max_capacity, status, remark } = req.body
  const exists = db.prepare('SELECT id FROM power_interfaces WHERE id = ?').get([req.params.id])
  if (!exists) return res.status(404).json({ code: 1, message: '接口不存在' })

  db.prepare(`UPDATE power_interfaces SET interface_code=?, interface_name=?, location=?, max_capacity=?, status=?, remark=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run([interface_code, interface_name, location || null, max_capacity, status || 'available', remark || null, req.params.id])

  res.json({ code: 0, message: '更新成功' })
})

router.delete('/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM power_interfaces WHERE id = ?').run([req.params.id])
  res.json({ code: 0, message: '删除成功' })
})

module.exports = router
