const express = require('express')
const dayjs = require('dayjs')
const { getDB } = require('../db')

const router = express.Router()

function genRecordNo() {
  return 'REC' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000)
}

router.get('/', (req, res) => {
  const db = getDB()
  const { status, app_id } = req.query
  let sql = `SELECT pr.*, a.app_no, a.berth_time, s.ship_code, s.ship_name, s.capacity,
    pi.interface_code, pi.interface_name, pi.max_capacity, pi.location,
    m.meter_code, m.meter_name
    FROM power_records pr
    LEFT JOIN applications a ON pr.app_id = a.id
    LEFT JOIN ships s ON a.ship_id = s.id
    LEFT JOIN power_interfaces pi ON pr.interface_id = pi.id
    LEFT JOIN meters m ON pr.meter_id = m.id WHERE 1=1`
  const params = []
  if (status) { sql += ' AND pr.status = ?'; params.push(status) }
  if (app_id) { sql += ' AND pr.app_id = ?'; params.push(app_id) }
  sql += ' ORDER BY pr.id DESC'
  const rows = db.prepare(sql).all(params)
  res.json({ code: 0, data: rows })
})

router.get('/:id', (req, res) => {
  const db = getDB()
  const row = db.prepare(`SELECT pr.*, a.app_no, a.berth_time, s.ship_code, s.ship_name, s.capacity,
    pi.interface_code, pi.interface_name, pi.max_capacity, pi.location,
    m.meter_code, m.meter_name
    FROM power_records pr
    LEFT JOIN applications a ON pr.app_id = a.id
    LEFT JOIN ships s ON a.ship_id = s.id
    LEFT JOIN power_interfaces pi ON pr.interface_id = pi.id
    LEFT JOIN meters m ON pr.meter_id = m.id
    WHERE pr.id = ?`).get([req.params.id])
  if (!row) return res.status(404).json({ code: 1, message: '接电记录不存在' })
  res.json({ code: 0, data: row })
})

router.post('/connect', (req, res) => {
  const db = getDB()
  const { app_id, interface_id, meter_id, connect_reading, operator, remark } = req.body

  if (!app_id || !interface_id || !meter_id || connect_reading == null) {
    return res.status(400).json({ code: 1, message: '申请、接口、电表、接电读数为必填项' })
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get([app_id])
  if (!app) return res.status(400).json({ code: 1, message: '申请不存在' })
  if (app.status !== 'approved') return res.status(400).json({ code: 1, message: '申请状态不是已审批，无法接电' })

  const ship = db.prepare('SELECT * FROM ships WHERE id = ?').get([app.ship_id])
  const pi = db.prepare('SELECT * FROM power_interfaces WHERE id = ?').get([interface_id])
  if (!pi) return res.status(400).json({ code: 1, message: '接口不存在' })

  // 业务规则1：校验靠泊时间 - 当前时间必须在靠泊时间之后
  const now = dayjs()
  const berthTime = dayjs(app.berth_time)
  if (now.isBefore(berthTime)) {
    return res.status(400).json({
      code: 1,
      message: `未到靠泊时间，当前时间(${now.format('YYYY-MM-DD HH:mm')})早于靠泊时间(${berthTime.format('YYYY-MM-DD HH:mm')})，请在靠泊后再接电`
    })
  }

  // 业务规则2：校验靠泊结束时间（如果有）- 不能超过预计离港时间
  if (app.berth_end_time) {
    const berthEndTime = dayjs(app.berth_end_time)
    if (now.isAfter(berthEndTime)) {
      return res.status(400).json({
        code: 1,
        message: `已超过预计离港时间(${berthEndTime.format('YYYY-MM-DD HH:mm')})，请先申请靠泊延期后再接电`,
        need_extension: true
      })
    }
  }

  // 业务规则3：船舶容量超过接口上限，阻断接电并推荐其他可用接口
  if (ship.capacity > pi.max_capacity) {
    const availableInterfaces = db.prepare(`
      SELECT pi.*, m.id as meter_id, m.meter_code, m.meter_name, m.current_reading
      FROM power_interfaces pi 
      LEFT JOIN meters m ON m.interface_id = pi.id
      WHERE pi.status = 'available' 
        AND pi.max_capacity >= ?
        AND pi.id != ?
      ORDER BY pi.max_capacity ASC
    `).all([ship.capacity, interface_id])

    return res.status(400).json({
      code: 1,
      message: `船舶容量(${ship.capacity}kW) 超过接口最大容量(${pi.max_capacity}kW)，禁止接电！`,
      capacity_exceeded: true,
      ship_capacity: ship.capacity,
      interface_capacity: pi.max_capacity,
      recommended_interfaces: availableInterfaces,
      suggestion: availableInterfaces.length > 0 
        ? `推荐以下容量充足的接口：${availableInterfaces.map(i => `${i.interface_name}(${i.max_capacity}kW)`).join('、')}`
        : '当前没有容量充足的可用接口，请稍后再试或联系调度中心'
    })
  }

  // 业务规则4：校验接口是否被占用
  if (pi.status !== 'available') {
    const availableInterfaces = db.prepare(`
      SELECT pi.*, m.id as meter_id, m.meter_code, m.meter_name, m.current_reading
      FROM power_interfaces pi 
      LEFT JOIN meters m ON m.interface_id = pi.id
      WHERE pi.status = 'available' 
        AND pi.max_capacity >= ?
      ORDER BY pi.max_capacity ASC
    `).all([ship.capacity])

    return res.status(400).json({
      code: 1,
      message: `接口(${pi.interface_name})当前状态为${pi.status === 'occupied' ? '已占用' : pi.status}，无法接电`,
      interface_occupied: true,
      recommended_interfaces: availableInterfaces,
      suggestion: availableInterfaces.length > 0 
        ? `推荐以下可用接口：${availableInterfaces.map(i => `${i.interface_name}(${i.max_capacity}kW)`).join('、')}`
        : '当前没有可用接口，请稍后再试或联系调度中心'
    })
  }

  const meter = db.prepare('SELECT * FROM meters WHERE id = ?').get([meter_id])
  if (!meter) return res.status(400).json({ code: 1, message: '电表不存在' })
  if (meter.interface_id != interface_id) {
    return res.status(400).json({ code: 1, message: '电表未绑定到此接口' })
  }
  if (connect_reading < meter.current_reading) {
    return res.status(400).json({ code: 1, message: `接电读数(${connect_reading})不能小于电表当前读数(${meter.current_reading})` })
  }

  const existing = db.prepare("SELECT id FROM power_records WHERE app_id = ? AND status IN ('connected','disconnected','abnormal')").get([app_id])
  if (existing) return res.status(400).json({ code: 1, message: '该申请已存在接电记录' })

  const recordNo = genRecordNo()
  const info = db.prepare(`INSERT INTO power_records (record_no, app_id, interface_id, meter_id, connect_time, connect_reading, operator, status, remark)
    VALUES (?, ?, ?, ?, datetime('now','localtime'), ?, ?, 'connected', ?)`).run([
    recordNo, app_id, interface_id, meter_id, connect_reading, operator || null, remark || null
  ])

  db.prepare(`UPDATE power_interfaces SET status='occupied', updated_at=datetime('now','localtime') WHERE id=?`).run([interface_id])
  db.prepare(`UPDATE applications SET status='connected', updated_at=datetime('now','localtime') WHERE id=?`).run([app_id])
  db.prepare(`UPDATE meters SET current_reading=?, updated_at=datetime('now','localtime') WHERE id=?`).run([connect_reading, meter_id])

  res.json({ code: 0, data: { id: info.lastInsertRowid, record_no: recordNo }, message: '接电登记成功' })
})

router.post('/:id/disconnect', (req, res) => {
  const db = getDB()
  const { disconnect_reading, remark } = req.body
  if (disconnect_reading == null) return res.status(400).json({ code: 1, message: '断电读数为必填项' })

  const record = db.prepare('SELECT * FROM power_records WHERE id = ?').get([req.params.id])
  if (!record) return res.status(404).json({ code: 1, message: '接电记录不存在' })
  if (record.status !== 'connected') return res.status(400).json({ code: 1, message: '仅已接电记录可断电' })

  const meter = db.prepare('SELECT * FROM meters WHERE id = ?').get([record.meter_id])

  let status = 'disconnected'
  let consumption = disconnect_reading - record.connect_reading
  let abnormalType = null
  let abnormalDesc = null

  if (disconnect_reading < record.connect_reading || disconnect_reading < meter.current_reading) {
    status = 'abnormal'
    consumption = 0
    if (disconnect_reading < record.connect_reading) {
      abnormalType = 'reading_reverse'
      abnormalDesc = `断电读数(${disconnect_reading})小于接电读数(${record.connect_reading})，需要人工处理后才能结算`
    } else {
      abnormalType = 'reading_below_meter'
      abnormalDesc = `断电读数(${disconnect_reading})小于电表当前读数(${meter.current_reading})，需要人工处理后才能结算`
    }
    db.prepare(`INSERT INTO abnormal_readings (record_id, connect_reading, disconnect_reading, abnormal_type, description, status)
      VALUES (?, ?, ?, ?, ?, 'pending')`).run([record.id, record.connect_reading, disconnect_reading, abnormalType, abnormalDesc])
  }

  db.prepare(`UPDATE power_records SET disconnect_time=datetime('now','localtime'), disconnect_reading=?,
    power_consumption=?, status=?, remark=COALESCE(?, remark), updated_at=datetime('now','localtime')
    WHERE id=?`).run([disconnect_reading, consumption, status, remark || null, record.id])

  db.prepare(`UPDATE power_interfaces SET status='available', updated_at=datetime('now','localtime') WHERE id=?`).run([record.interface_id])

  if (status === 'abnormal') {
    db.prepare(`UPDATE applications SET status='abnormal', updated_at=datetime('now','localtime') WHERE id=?`).run([record.app_id])
    res.json({ code: 0, message: '断电登记完成，但读数异常，已转入异常处理流程，请在异常处理中修正后再结算', data: { status: 'abnormal', abnormal: true, power_consumption: 0, abnormal_desc: abnormalDesc } })
  } else {
    db.prepare(`UPDATE meters SET current_reading=?, updated_at=datetime('now','localtime') WHERE id=?`).run([disconnect_reading, record.meter_id])
    db.prepare(`UPDATE applications SET status='disconnected', updated_at=datetime('now','localtime') WHERE id=?`).run([record.app_id])
    res.json({ code: 0, data: { status: 'disconnected', abnormal: false, power_consumption: consumption }, message: '断电登记成功，可生成账单' })
  }
})

router.delete('/:id', (req, res) => {
  const db = getDB()
  const record = db.prepare('SELECT * FROM power_records WHERE id = ?').get([req.params.id])
  if (!record) return res.status(404).json({ code: 1, message: '记录不存在' })
  if (record.status === 'billed') return res.status(400).json({ code: 1, message: '已生成账单的记录不可删除' })

  db.prepare(`UPDATE power_interfaces SET status='available' WHERE id=? AND status='occupied'`).run([record.interface_id])
  if (record.status === 'connected' && record.app_id) {
    db.prepare(`UPDATE applications SET status='approved' WHERE id=?`).run([record.app_id])
  }
  db.prepare('DELETE FROM power_records WHERE id = ?').run([req.params.id])
  db.prepare('DELETE FROM abnormal_readings WHERE record_id = ?').run([req.params.id])
  res.json({ code: 0, message: '删除成功' })
})

module.exports = router
