const express = require('express')
const { getDB } = require('../db')

const router = express.Router()

router.get('/', (req, res) => {
  const db = getDB()
  const { status } = req.query
  let sql = `SELECT ab.*, pr.record_no, pr.connect_time, a.app_no, s.ship_code, s.ship_name,
    pi.interface_name, m.meter_code
    FROM abnormal_readings ab
    LEFT JOIN power_records pr ON ab.record_id = pr.id
    LEFT JOIN applications a ON pr.app_id = a.id
    LEFT JOIN ships s ON a.ship_id = s.id
    LEFT JOIN power_interfaces pi ON pr.interface_id = pi.id
    LEFT JOIN meters m ON pr.meter_id = m.id WHERE 1=1`
  const params = []
  if (status) { sql += ' AND ab.status = ?'; params.push(status) }
  sql += ' ORDER BY ab.id DESC'
  const rows = db.prepare(sql).all(params)
  res.json({ code: 0, data: rows })
})

router.get('/:id', (req, res) => {
  const db = getDB()
  const row = db.prepare(`SELECT ab.*, pr.*, a.app_no, s.ship_code, s.ship_name,
    pi.interface_code, pi.interface_name, m.meter_code, m.meter_name
    FROM abnormal_readings ab
    LEFT JOIN power_records pr ON ab.record_id = pr.id
    LEFT JOIN applications a ON pr.app_id = a.id
    LEFT JOIN ships s ON a.ship_id = s.id
    LEFT JOIN power_interfaces pi ON pr.interface_id = pi.id
    LEFT JOIN meters m ON pr.meter_id = m.id
    WHERE ab.id = ?`).get([req.params.id])
  if (!row) return res.status(404).json({ code: 1, message: '异常记录不存在' })
  res.json({ code: 0, data: row })
})

// 处理方式1：人工修正读数
router.post('/:id/correct', (req, res) => {
  const db = getDB()
  const { new_disconnect_reading, new_connect_reading, handled_by, handle_remark } = req.body
  if (new_disconnect_reading == null) return res.status(400).json({ code: 1, message: '修正后的断电读数为必填项' })

  const ab = db.prepare('SELECT * FROM abnormal_readings WHERE id = ?').get([req.params.id])
  if (!ab) return res.status(404).json({ code: 1, message: '异常记录不存在' })
  if (ab.status !== 'pending') return res.status(400).json({ code: 1, message: '仅待处理异常可修正' })

  const cr = new_connect_reading != null ? new_connect_reading : ab.connect_reading
  const dr = new_disconnect_reading
  if (dr < cr) return res.status(400).json({ code: 1, message: '修正后的断电读数仍小于接电读数，请检查' })
  const consumption = dr - cr

  db.prepare(`UPDATE power_records SET connect_reading=?, disconnect_reading=?, power_consumption=?, status='disconnected',
    remark=COALESCE(remark,'') || ' [读数已人工修正]', updated_at=datetime('now','localtime')
    WHERE id=?`).run([cr, dr, consumption, ab.record_id])

  db.prepare(`UPDATE meters SET current_reading=?, updated_at=datetime('now','localtime')
    WHERE id=(SELECT meter_id FROM power_records WHERE id=?)`).run([dr, ab.record_id])

  db.prepare(`UPDATE applications SET status='disconnected', updated_at=datetime('now','localtime')
    WHERE id=(SELECT app_id FROM power_records WHERE id=?)`).run([ab.record_id])

  db.prepare(`UPDATE abnormal_readings SET status='handled', handled_by=?, handle_result='人工修正读数',
    handle_remark=?, handled_at=datetime('now','localtime') WHERE id=?`).run([
    handled_by || '电工班', handle_remark || `修正为: 接电${cr} 断电${dr}`, req.params.id
  ])

  res.json({ code: 0, data: { power_consumption: consumption }, message: '读数已修正，可生成账单' })
})

// 处理方式2：按异常金额结算（使用接电读数和人工判定的电量）
router.post('/:id/settle', (req, res) => {
  const db = getDB()
  const { power_consumption, handled_by, handle_remark } = req.body
  if (!power_consumption || power_consumption <= 0) return res.status(400).json({ code: 1, message: '请输入判定的结算电量（kWh）' })

  const ab = db.prepare('SELECT * FROM abnormal_readings WHERE id = ?').get([req.params.id])
  if (!ab) return res.status(404).json({ code: 1, message: '异常记录不存在' })
  if (ab.status !== 'pending') return res.status(400).json({ code: 1, message: '仅待处理异常可结算' })

  db.prepare(`UPDATE power_records SET power_consumption=?, status='disconnected',
    remark=COALESCE(remark,'') || ' [异常电量结算]', updated_at=datetime('now','localtime')
    WHERE id=?`).run([power_consumption, ab.record_id])

  db.prepare(`UPDATE applications SET status='disconnected', updated_at=datetime('now','localtime')
    WHERE id=(SELECT app_id FROM power_records WHERE id=?)`).run([ab.record_id])

  db.prepare(`UPDATE abnormal_readings SET status='handled', handled_by=?, handle_result='异常电量结算',
    handle_remark=?, handled_at=datetime('now','localtime') WHERE id=?`).run([
    handled_by || '财务', handle_remark || `按 ${power_consumption} kWh 结算`, req.params.id
  ])

  res.json({ code: 0, message: '已按异常电量结算，可生成账单' })
})

// 处理方式3：取消本次接电记录（读数作废）
router.post('/:id/cancel', (req, res) => {
  const db = getDB()
  const { handled_by, handle_remark } = req.body

  const ab = db.prepare('SELECT * FROM abnormal_readings WHERE id = ?').get([req.params.id])
  if (!ab) return res.status(404).json({ code: 1, message: '异常记录不存在' })
  if (ab.status !== 'pending') return res.status(400).json({ code: 1, message: '仅待处理异常可取消' })

  const record = db.prepare('SELECT * FROM power_records WHERE id = ?').get([ab.record_id])

  db.prepare(`UPDATE power_interfaces SET status='available', updated_at=datetime('now','localtime') WHERE id=?`).run([record.interface_id])
  db.prepare(`UPDATE applications SET status='approved', updated_at=datetime('now','localtime') WHERE id=?`).run([record.app_id])

  db.prepare(`UPDATE power_records SET status='cancelled',
    remark=COALESCE(remark,'') || ' [异常已取消]', updated_at=datetime('now','localtime') WHERE id=?`).run([ab.record_id])

  db.prepare(`UPDATE abnormal_readings SET status='handled', handled_by=?, handle_result='取消本次记录',
    handle_remark=?, handled_at=datetime('now','localtime') WHERE id=?`).run([
    handled_by || '管理员', handle_remark || '记录已取消', req.params.id
  ])

  res.json({ code: 0, message: '本次接电记录已取消' })
})

module.exports = router
