const express = require('express')
const dayjs = require('dayjs')
const { getDB } = require('../db')

const router = express.Router()

function genBillNo() {
  return 'BIL' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000)
}

router.get('/', (req, res) => {
  const db = getDB()
  const { status, keyword } = req.query
  let sql = `SELECT b.*, pr.record_no, pr.connect_time, pr.disconnect_time, pr.power_consumption as record_power,
    pr.connect_reading, pr.disconnect_reading,
    a.app_no, s.ship_code, s.ship_name, pi.interface_name, m.meter_code
    FROM bills b
    LEFT JOIN power_records pr ON b.record_id = pr.id
    LEFT JOIN applications a ON pr.app_id = a.id
    LEFT JOIN ships s ON a.ship_id = s.id
    LEFT JOIN power_interfaces pi ON pr.interface_id = pi.id
    LEFT JOIN meters m ON pr.meter_id = m.id WHERE 1=1`
  const params = []
  if (status) { sql += ' AND b.status = ?'; params.push(status) }
  if (keyword) {
    sql += ' AND (b.bill_no LIKE ? OR pr.record_no LIKE ? OR a.app_no LIKE ? OR s.ship_name LIKE ?)'
    const k = `%${keyword}%`
    params.push(k, k, k, k)
  }
  sql += ' ORDER BY b.id DESC'
  const rows = db.prepare(sql).all(params)
  res.json({ code: 0, data: rows })
})

router.get('/:id', (req, res) => {
  const db = getDB()
  const row = db.prepare(`SELECT b.*, pr.record_no, pr.connect_time, pr.disconnect_time,
    pr.connect_reading, pr.disconnect_reading,
    a.app_no, a.berth_time, s.ship_code, s.ship_name, s.capacity, s.contact_person, s.contact_phone,
    pi.interface_code, pi.interface_name, pi.max_capacity, pi.location, m.meter_code, m.meter_name
    FROM bills b
    LEFT JOIN power_records pr ON b.record_id = pr.id
    LEFT JOIN applications a ON pr.app_id = a.id
    LEFT JOIN ships s ON a.ship_id = s.id
    LEFT JOIN power_interfaces pi ON pr.interface_id = pi.id
    LEFT JOIN meters m ON pr.meter_id = m.id
    WHERE b.id = ?`).get([req.params.id])
  if (!row) return res.status(404).json({ code: 1, message: '账单不存在' })
  res.json({ code: 0, data: row })
})

router.post('/', (req, res) => {
  const db = getDB()
  const { record_id, tariff_id } = req.body
  if (!record_id) return res.status(400).json({ code: 1, message: '接电记录为必填项' })

  const record = db.prepare('SELECT * FROM power_records WHERE id = ?').get([record_id])
  if (!record) return res.status(404).json({ code: 1, message: '接电记录不存在' })
  if (record.status !== 'disconnected') {
    if (record.status === 'abnormal') return res.status(400).json({ code: 1, message: '读数异常，请先在异常处理中修正后再结算' })
    if (record.status === 'connected') return res.status(400).json({ code: 1, message: '尚未断电，不能生成账单' })
    if (record.status === 'billed') return res.status(400).json({ code: 1, message: '该记录已生成账单' })
    return res.status(400).json({ code: 1, message: '记录状态不正确，不能生成账单' })
  }

  const pendingAbnormal = db.prepare('SELECT id, description FROM abnormal_readings WHERE record_id = ? AND status = ?').get([record_id, 'pending'])
  if (pendingAbnormal) return res.status(400).json({ code: 1, message: `存在未处理的异常读数：${pendingAbnormal.description}，请先在异常处理中修正后再结算` })

  const existingBill = db.prepare('SELECT id FROM bills WHERE record_id = ? AND status != ?').get([record_id, 'void'])
  if (existingBill) return res.status(400).json({ code: 1, message: '该记录已生成有效账单' })

  let tariff
  if (tariff_id) {
    tariff = db.prepare('SELECT * FROM tariff_rates WHERE id = ?').get([tariff_id])
  }
  if (!tariff) tariff = db.prepare('SELECT * FROM tariff_rates WHERE is_default = 1').get()
  if (!tariff) return res.status(400).json({ code: 1, message: '未配置费率' })

  const consumption = record.power_consumption
  const total = Number((consumption * tariff.price_per_kwh).toFixed(2))
  const billNo = genBillNo()

  const info = db.prepare(`INSERT INTO bills (bill_no, record_id, power_consumption, price_per_kwh, total_amount)
    VALUES (?, ?, ?, ?, ?)`).run([billNo, record_id, consumption, tariff.price_per_kwh, total])

  db.prepare(`UPDATE power_records SET status='billed', updated_at=datetime('now','localtime') WHERE id=?`).run([record_id])
  db.prepare(`UPDATE applications SET status='billed', updated_at=datetime('now','localtime') WHERE id=?`).run([record.app_id])

  res.json({ code: 0, data: { id: info.lastInsertRowid, bill_no: billNo, total_amount: total }, message: '账单生成成功' })
})

router.put('/:id', (req, res) => {
  const db = getDB()
  // 核心业务规则3：账单确认后不能修改读数
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get([req.params.id])
  if (!bill) return res.status(404).json({ code: 1, message: '账单不存在' })
  if (bill.status === 'confirmed') return res.status(400).json({ code: 1, message: '账单已确认，禁止修改读数或金额！' })
  if (bill.status === 'void') return res.status(400).json({ code: 1, message: '账单已作废' })

  const { power_consumption, price_per_kwh, remark } = req.body
  const pc = power_consumption != null ? power_consumption : bill.power_consumption
  const ppk = price_per_kwh != null ? price_per_kwh : bill.price_per_kwh
  const total = Number((pc * ppk).toFixed(2))

  db.prepare(`UPDATE bills SET power_consumption=?, price_per_kwh=?, total_amount=?, remark=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run([pc, ppk, total, remark != null ? remark : bill.remark, req.params.id])

  // 同步更新接电记录的电量（若修改了耗电量）
  if (power_consumption != null) {
    const record = db.prepare('SELECT status FROM power_records WHERE id = ?').get([bill.record_id])
    if (record && record.status !== 'abnormal') {
      db.prepare(`UPDATE power_records SET power_consumption=? WHERE id=?`).run([pc, bill.record_id])
    }
  }

  res.json({ code: 0, data: { total_amount: total }, message: '账单已更新' })
})

router.post('/:id/confirm', (req, res) => {
  const db = getDB()
  const { confirmed_by } = req.body
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get([req.params.id])
  if (!bill) return res.status(404).json({ code: 1, message: '账单不存在' })
  if (bill.status !== 'draft') return res.status(400).json({ code: 1, message: '仅草稿状态账单可确认' })

  db.prepare(`UPDATE bills SET status='confirmed', confirmed_by=?, confirmed_at=datetime('now','localtime'), updated_at=datetime('now','localtime')
    WHERE id=?`).run([confirmed_by || '财务', req.params.id])

  res.json({ code: 0, message: '账单已确认，读数和金额已锁定' })
})

router.post('/:id/void', (req, res) => {
  const db = getDB()
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get([req.params.id])
  if (!bill) return res.status(404).json({ code: 1, message: '账单不存在' })
  if (bill.status === 'void') return res.status(400).json({ code: 1, message: '账单已作废' })

  db.prepare(`UPDATE bills SET status='void', updated_at=datetime('now','localtime') WHERE id=?`).run([req.params.id])
  const record = db.prepare('SELECT status FROM power_records WHERE id = ?').get([bill.record_id])
  if (record && record.status === 'billed') {
    db.prepare(`UPDATE power_records SET status='disconnected', updated_at=datetime('now','localtime') WHERE id=?`).run([bill.record_id])
    db.prepare(`UPDATE applications SET status='disconnected', updated_at=datetime('now','localtime')
      WHERE id=(SELECT app_id FROM power_records WHERE id=?)`).run([bill.record_id])
  }

  res.json({ code: 0, message: '账单已作废' })
})

module.exports = router
