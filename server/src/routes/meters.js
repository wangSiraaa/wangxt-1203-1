const express = require('express')
const { getDB } = require('../db')

const router = express.Router()

router.get('/', (req, res) => {
  const db = getDB()
  const rows = db.prepare(`SELECT m.*, pi.interface_name, pi.location, pi.max_capacity
    FROM meters m LEFT JOIN power_interfaces pi ON m.interface_id = pi.id
    ORDER BY m.id DESC`).all()
  res.json({ code: 0, data: rows })
})

router.get('/:id', (req, res) => {
  const db = getDB()
  const row = db.prepare(`SELECT m.*, pi.interface_name FROM meters m
    LEFT JOIN power_interfaces pi ON m.interface_id = pi.id WHERE m.id = ?`).get([req.params.id])
  if (!row) return res.status(404).json({ code: 1, message: '电表不存在' })
  res.json({ code: 0, data: row })
})

router.post('/', (req, res) => {
  const db = getDB()
  const { meter_code, meter_name, interface_id, initial_reading, remark } = req.body
  if (!meter_code || !meter_name) {
    return res.status(400).json({ code: 1, message: '电表编号、名称为必填项' })
  }
  const exists = db.prepare('SELECT id FROM meters WHERE meter_code = ?').get([meter_code])
  if (exists) return res.status(400).json({ code: 1, message: '电表编号已存在' })

  const initReading = initial_reading || 0
  const info = db.prepare(`INSERT INTO meters (meter_code, meter_name, interface_id, initial_reading, current_reading, remark)
    VALUES (?, ?, ?, ?, ?, ?)`).run([meter_code, meter_name, interface_id || null, initReading, initReading, remark || null])

  res.json({ code: 0, data: { id: info.lastInsertRowid } })
})

router.put('/:id', (req, res) => {
  const db = getDB()
  const { meter_code, meter_name, interface_id, status, remark } = req.body
  const exists = db.prepare('SELECT id FROM meters WHERE id = ?').get([req.params.id])
  if (!exists) return res.status(404).json({ code: 1, message: '电表不存在' })

  db.prepare(`UPDATE meters SET meter_code=?, meter_name=?, interface_id=?, status=?, remark=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run([meter_code, meter_name, interface_id || null, status || 'normal', remark || null, req.params.id])

  res.json({ code: 0, message: '更新成功' })
})

router.delete('/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM meters WHERE id = ?').run([req.params.id])
  res.json({ code: 0, message: '删除成功' })
})

module.exports = router
