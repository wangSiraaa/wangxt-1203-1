const express = require('express')
const dayjs = require('dayjs')
const { getDB } = require('../db')

const router = express.Router()

function genRenewalNo() {
  return 'REN' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000)
}

router.get('/', (req, res) => {
  const db = getDB()
  const { app_id, status } = req.query
  let sql = `SELECT rr.*, a.app_no, s.ship_code, s.ship_name,
    pi.interface_name, b.bill_no
    FROM renewal_records rr
    LEFT JOIN applications a ON rr.app_id = a.id
    LEFT JOIN ships s ON a.ship_id = s.id
    LEFT JOIN power_interfaces pi ON (SELECT interface_id FROM power_records WHERE id = rr.record_id) = pi.id
    LEFT JOIN bills b ON rr.bill_id = b.id
    WHERE 1=1`
  const params = []
  if (app_id) { sql += ' AND rr.app_id = ?'; params.push(app_id) }
  if (status) { sql += ' AND rr.is_locked = ?'; params.push(status === 'locked' ? 1 : 0) }
  sql += ' ORDER BY rr.id DESC'
  const rows = db.prepare(sql).all(params)
  res.json({ code: 0, data: rows })
})

router.get('/:id', (req, res) => {
  const db = getDB()
  const row = db.prepare(`SELECT rr.*, a.app_no, a.berth_time, a.berth_end_time,
    s.ship_code, s.ship_name, s.capacity,
    pi.interface_code, pi.interface_name, pi.max_capacity,
    pr.record_no, pr.connect_reading, pr.connect_time,
    b.bill_no, b.total_amount as bill_total
    FROM renewal_records rr
    LEFT JOIN applications a ON rr.app_id = a.id
    LEFT JOIN ships s ON a.ship_id = s.id
    LEFT JOIN power_records pr ON rr.record_id = pr.id
    LEFT JOIN power_interfaces pi ON pr.interface_id = pi.id
    LEFT JOIN bills b ON rr.bill_id = b.id
    WHERE rr.id = ?`).get([req.params.id])
  if (!row) return res.status(404).json({ code: 1, message: '续费记录不存在' })
  res.json({ code: 0, data: row })
})

router.post('/apply-extension', (req, res) => {
  const db = getDB()
  const { app_id, new_berth_end_time, extension_reason, operator } = req.body

  if (!app_id || !new_berth_end_time) {
    return res.status(400).json({ code: 1, message: '申请和新的靠泊结束时间为必填项' })
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get([app_id])
  if (!app) return res.status(404).json({ code: 1, message: '申请不存在' })

  const currentEndTime = app.berth_end_time || app.berth_time
  const newEndTime = dayjs(new_berth_end_time)
  const originalEndTime = dayjs(currentEndTime)

  if (newEndTime.isBefore(originalEndTime)) {
    return res.status(400).json({ code: 1, message: '延期结束时间不能早于原靠泊结束时间' })
  }

  const extendedHours = newEndTime.diff(originalEndTime, 'hour', true)
  if (extendedHours <= 0) {
    return res.status(400).json({ code: 1, message: '延期时长必须大于0' })
  }

  db.prepare(`INSERT INTO berth_extensions (app_id, original_berth_time, new_berth_time, extension_reason, operator, status)
    VALUES (?, ?, ?, ?, ?, 'approved')`).run([
    app_id, currentEndTime, new_berth_end_time, extension_reason || null, operator || null
  ])

  db.prepare(`UPDATE applications SET 
    berth_end_time=?, 
    is_extended=1, 
    extension_count=COALESCE(extension_count, 0) + 1,
    updated_at=datetime('now','localtime')
    WHERE id=?`).run([new_berth_end_time, app_id])

  res.json({ 
    code: 0, 
    message: '靠泊延期申请已批准',
    data: {
      original_end_time: currentEndTime,
      new_end_time: new_berth_end_time,
      extended_hours: extendedHours.toFixed(2)
    }
  })
})

router.post('/', (req, res) => {
  const db = getDB()
  const { app_id, record_id, bill_id, extended_end_time, 
          extended_hours, extend_power, power_consumption, 
          price_per_kwh, operator, remark } = req.body

  if (!app_id || !extended_end_time || !extended_hours) {
    return res.status(400).json({ code: 1, message: '申请、延期结束时间、延时时长为必填项' })
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get([app_id])
  if (!app) return res.status(404).json({ code: 1, message: '申请不存在' })

  let record = null
  if (record_id) {
    record = db.prepare('SELECT * FROM power_records WHERE id = ?').get([record_id])
    if (!record) return res.status(400).json({ code: 1, message: '接电记录不存在' })
    if (record.is_locked) {
      return res.status(400).json({ 
        code: 1, 
        message: '该接电记录已锁定，不能直接修改。如需继续供电，请创建新的续费记录。',
        locked: true,
        can_create_renewal: true
      })
    }
  }

  let bill = null
  if (bill_id) {
    bill = db.prepare('SELECT * FROM bills WHERE id = ?').get([bill_id])
    if (!bill) return res.status(400).json({ code: 1, message: '账单不存在' })
    if (bill.status === 'confirmed' || bill.is_reading_locked) {
      return res.status(400).json({ 
        code: 1, 
        message: '原账单已确认锁定，不能修改。靠泊延期只能追加新的续费记录。',
        locked: true,
        can_create_renewal: true
      })
    }
  }

  let tariff = null
  if (price_per_kwh) {
    tariff = { price_per_kwh: price_per_kwh }
  } else {
    tariff = db.prepare('SELECT * FROM tariff_rates WHERE is_default = 1').get()
  }
  if (!tariff) return res.status(400).json({ code: 1, message: '未配置费率' })

  const ppk = tariff.price_per_kwh
  const pc = power_consumption != null ? power_consumption : (extend_power || 0) * extended_hours
  const total = Number((pc * ppk).toFixed(2))

  const renewalNo = genRenewalNo()

  const info = db.prepare(`INSERT INTO renewal_records (
    renewal_no, app_id, record_id, bill_id, original_berth_end_time, 
    extended_end_time, extended_hours, extend_power, power_consumption, 
    price_per_kwh, total_amount, operator, remark
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run([
    renewalNo, app_id, record_id || null, bill_id || null, 
    app.berth_end_time || app.berth_time,
    extended_end_time, extended_hours, extend_power || null, 
    pc, ppk, total, operator || null, remark || null
  ])

  db.prepare(`UPDATE applications SET 
    is_extended=1,
    extension_count=COALESCE(extension_count, 0) + 1,
    updated_at=datetime('now','localtime')
    WHERE id=?`).run([app_id])

  res.json({ 
    code: 0, 
    data: { 
      id: info.lastInsertRowid, 
      renewal_no: renewalNo, 
      total_amount: total,
      power_consumption: pc,
      price_per_kwh: ppk
    }, 
    message: '续费记录已创建，靠泊延期成功' 
  })
})

router.post('/:id/confirm', (req, res) => {
  const db = getDB()
  const { confirmed_by } = req.body
  const renewal = db.prepare('SELECT * FROM renewal_records WHERE id = ?').get([req.params.id])
  if (!renewal) return res.status(404).json({ code: 1, message: '续费记录不存在' })
  if (renewal.is_locked) return res.status(400).json({ code: 1, message: '该续费记录已确认锁定' })

  db.prepare(`UPDATE renewal_records SET 
    is_locked=1, 
    updated_at=datetime('now','localtime')
    WHERE id=?`).run([req.params.id])

  res.json({ 
    code: 0, 
    message: '续费记录已确认锁定',
    locked: true
  })
})

router.put('/:id', (req, res) => {
  const db = getDB()
  const renewal = db.prepare('SELECT * FROM renewal_records WHERE id = ?').get([req.params.id])
  if (!renewal) return res.status(404).json({ code: 1, message: '续费记录不存在' })
  if (renewal.is_locked) {
    return res.status(400).json({ 
      code: 1, 
      message: '续费记录已锁定，不能修改。如需继续延期，请创建新的续费记录。' 
    })
  }

  const { extended_end_time, extended_hours, extend_power, 
          power_consumption, price_per_kwh, remark } = req.body

  const ppk = price_per_kwh != null ? price_per_kwh : renewal.price_per_kwh
  const pc = power_consumption != null ? power_consumption : renewal.power_consumption
  const total = Number((pc * ppk).toFixed(2))

  db.prepare(`UPDATE renewal_records SET 
    extended_end_time=?, extended_hours=?, extend_power=?, 
    power_consumption=?, price_per_kwh=?, total_amount=?, 
    remark=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run([
    extended_end_time || renewal.extended_end_time,
    extended_hours || renewal.extended_hours,
    extend_power != null ? extend_power : renewal.extend_power,
    pc, ppk, total, remark != null ? remark : renewal.remark, req.params.id
  ])

  res.json({ code: 0, data: { total_amount: total }, message: '续费记录已更新' })
})

router.delete('/:id', (req, res) => {
  const db = getDB()
  const renewal = db.prepare('SELECT * FROM renewal_records WHERE id = ?').get([req.params.id])
  if (!renewal) return res.status(404).json({ code: 1, message: '续费记录不存在' })
  if (renewal.is_locked) return res.status(400).json({ code: 1, message: '已锁定的续费记录不能删除' })

  db.prepare('DELETE FROM renewal_records WHERE id = ?').run([req.params.id])
  res.json({ code: 0, message: '续费记录已删除' })
})

module.exports = router
