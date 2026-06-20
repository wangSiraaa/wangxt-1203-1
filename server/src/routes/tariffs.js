const express = require('express')
const { getDB } = require('../db')

const router = express.Router()

router.get('/', (req, res) => {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM tariff_rates ORDER BY id DESC').all()
  res.json({ code: 0, data: rows })
})

router.get('/default', (req, res) => {
  const db = getDB()
  const row = db.prepare('SELECT * FROM tariff_rates WHERE is_default = 1').get()
  res.json({ code: 0, data: row })
})

router.post('/', (req, res) => {
  const db = getDB()
  const { rate_code, rate_name, price_per_kwh, effective_date, is_default, remark } = req.body
  if (!rate_code || !rate_name || !price_per_kwh) {
    return res.status(400).json({ code: 1, message: '费率编号、名称、单价为必填项' })
  }
  if (is_default === 1) {
    db.prepare('UPDATE tariff_rates SET is_default = 0 WHERE is_default = 1').run([])
  }
  const info = db.prepare(`INSERT INTO tariff_rates (rate_code, rate_name, price_per_kwh, effective_date, is_default, remark)
    VALUES (?, ?, ?, ?, ?, ?)`).run([rate_code, rate_name, price_per_kwh, effective_date || null, is_default || 0, remark || null])
  res.json({ code: 0, data: { id: info.lastInsertRowid } })
})

router.put('/:id', (req, res) => {
  const db = getDB()
  const { rate_code, rate_name, price_per_kwh, effective_date, is_default, remark } = req.body
  if (is_default === 1) {
    db.prepare('UPDATE tariff_rates SET is_default = 0 WHERE id != ? AND is_default = 1').run([req.params.id])
  }
  db.prepare(`UPDATE tariff_rates SET rate_code=?, rate_name=?, price_per_kwh=?, effective_date=?, is_default=?, remark=?
    WHERE id=?`).run([rate_code, rate_name, price_per_kwh, effective_date || null, is_default || 0, remark || null, req.params.id])
  res.json({ code: 0, message: '更新成功' })
})

router.delete('/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM tariff_rates WHERE id = ?').run([req.params.id])
  res.json({ code: 0, message: '删除成功' })
})

module.exports = router
