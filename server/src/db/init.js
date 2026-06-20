const { initDB, getDB } = require('./index')
const fs = require('fs')
const path = require('path')

async function runInit() {
  const db = await initDB()

  db.exec(`
CREATE TABLE IF NOT EXISTS ships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ship_code TEXT UNIQUE NOT NULL,
  ship_name TEXT NOT NULL,
  ship_type TEXT,
  capacity REAL NOT NULL,
  imo TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS power_interfaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interface_code TEXT UNIQUE NOT NULL,
  interface_name TEXT NOT NULL,
  location TEXT,
  max_capacity REAL NOT NULL,
  status TEXT DEFAULT 'available',
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS meters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meter_code TEXT UNIQUE NOT NULL,
  meter_name TEXT NOT NULL,
  interface_id INTEGER,
  initial_reading REAL DEFAULT 0,
  current_reading REAL DEFAULT 0,
  status TEXT DEFAULT 'normal',
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (interface_id) REFERENCES power_interfaces(id)
);

CREATE TABLE IF NOT EXISTS tariff_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate_code TEXT UNIQUE NOT NULL,
  rate_name TEXT NOT NULL,
  price_per_kwh REAL NOT NULL,
  effective_date TEXT,
  is_default INTEGER DEFAULT 0,
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_no TEXT UNIQUE NOT NULL,
  ship_id INTEGER NOT NULL,
  berth_time TEXT NOT NULL,
  expected_power REAL,
  expected_duration REAL,
  applicant TEXT,
  applicant_phone TEXT,
  status TEXT DEFAULT 'pending',
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (ship_id) REFERENCES ships(id)
);

CREATE TABLE IF NOT EXISTS power_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_no TEXT UNIQUE NOT NULL,
  app_id INTEGER NOT NULL,
  interface_id INTEGER NOT NULL,
  meter_id INTEGER NOT NULL,
  connect_time TEXT,
  connect_reading REAL,
  disconnect_time TEXT,
  disconnect_reading REAL,
  power_consumption REAL,
  operator TEXT,
  status TEXT DEFAULT 'connected',
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (app_id) REFERENCES applications(id),
  FOREIGN KEY (interface_id) REFERENCES power_interfaces(id),
  FOREIGN KEY (meter_id) REFERENCES meters(id)
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_no TEXT UNIQUE NOT NULL,
  record_id INTEGER NOT NULL,
  power_consumption REAL NOT NULL,
  price_per_kwh REAL NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT DEFAULT 'draft',
  confirmed_by TEXT,
  confirmed_at TEXT,
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (record_id) REFERENCES power_records(id)
);

CREATE TABLE IF NOT EXISTS abnormal_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL,
  connect_reading REAL,
  disconnect_reading REAL,
  abnormal_type TEXT,
  description TEXT,
  handled_by TEXT,
  handle_result TEXT,
  handle_remark TEXT,
  status TEXT DEFAULT 'pending',
  handled_at TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (record_id) REFERENCES power_records(id)
);

CREATE TABLE IF NOT EXISTS renewal_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  renewal_no TEXT UNIQUE NOT NULL,
  app_id INTEGER NOT NULL,
  record_id INTEGER,
  bill_id INTEGER,
  original_berth_end_time TEXT,
  extended_end_time TEXT NOT NULL,
  extended_hours REAL NOT NULL,
  extend_power REAL,
  power_consumption REAL,
  price_per_kwh REAL,
  total_amount REAL NOT NULL,
  is_locked INTEGER DEFAULT 0,
  operator TEXT,
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (app_id) REFERENCES applications(id),
  FOREIGN KEY (record_id) REFERENCES power_records(id),
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

CREATE TABLE IF NOT EXISTS berth_extensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  original_berth_time TEXT,
  new_berth_time TEXT,
  extension_reason TEXT,
  operator TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (app_id) REFERENCES applications(id)
);
`)

  function safeAlter(sql) {
    try {
      db.exec(sql)
    } catch (e) {}
  }

  safeAlter('ALTER TABLE applications ADD COLUMN berth_end_time TEXT')
  safeAlter('ALTER TABLE applications ADD COLUMN actual_berth_end_time TEXT')
  safeAlter('ALTER TABLE applications ADD COLUMN is_extended INTEGER DEFAULT 0')
  safeAlter('ALTER TABLE applications ADD COLUMN extension_count INTEGER DEFAULT 0')

  safeAlter('ALTER TABLE power_records ADD COLUMN is_locked INTEGER DEFAULT 0')
  safeAlter('ALTER TABLE power_records ADD COLUMN locked_at TEXT')
  safeAlter('ALTER TABLE power_records ADD COLUMN locked_by TEXT')

  safeAlter('ALTER TABLE power_interfaces ADD COLUMN locked_by_record_id INTEGER')

  safeAlter('ALTER TABLE bills ADD COLUMN is_reading_locked INTEGER DEFAULT 0')
  safeAlter('ALTER TABLE bills ADD COLUMN is_interface_locked INTEGER DEFAULT 0')
  safeAlter('ALTER TABLE bills ADD COLUMN is_amount_locked INTEGER DEFAULT 0')

  const rateCount = db.prepare('SELECT COUNT(*) as cnt FROM tariff_rates').get().cnt
  if (rateCount === 0) {
    db.prepare(`INSERT INTO tariff_rates (rate_code, rate_name, price_per_kwh, is_default) VALUES (?, ?, ?, ?)`).run(['DEFAULT', '默认费率', 1.2, 1])
  }

  const shipCount = db.prepare('SELECT COUNT(*) as cnt FROM ships').get().cnt
  if (shipCount === 0) {
    const insertShip = db.prepare(`INSERT INTO ships (ship_code, ship_name, ship_type, capacity, contact_person, contact_phone) VALUES (?, ?, ?, ?, ?, ?)`)
    insertShip.run(['SHIP001', '远洋号', '货轮', 500, '张三', '13800000001'])
    insertShip.run(['SHIP002', '蓝鲸号', '邮轮', 800, '李四', '13800000002'])
    insertShip.run(['SHIP003', '东方之星', '集装箱船', 600, '王五', '13800000003'])
  }

  const ifCount = db.prepare('SELECT COUNT(*) as cnt FROM power_interfaces').get().cnt
  if (ifCount === 0) {
    const insertIf = db.prepare(`INSERT INTO power_interfaces (interface_code, interface_name, location, max_capacity) VALUES (?, ?, ?, ?)`)
    insertIf.run(['IF001', '1号岸电接口', 'A泊位', 600])
    insertIf.run(['IF002', '2号岸电接口', 'A泊位', 700])
    insertIf.run(['IF003', '3号岸电接口', 'B泊位', 500])
  }

  const meterCount = db.prepare('SELECT COUNT(*) as cnt FROM meters').get().cnt
  if (meterCount === 0) {
    const insertMeter = db.prepare(`INSERT INTO meters (meter_code, meter_name, interface_id, initial_reading, current_reading) VALUES (?, ?, ?, ?, ?)`)
    insertMeter.run(['M001', '1号电表', 1, 1000, 1000])
    insertMeter.run(['M002', '2号电表', 2, 2000, 2000])
    insertMeter.run(['M003', '3号电表', 3, 1500, 1500])
  }

  console.log('插入后查询:')
  console.log('  船舶:', db.prepare('SELECT COUNT(*) as cnt FROM ships').get().cnt)
  console.log('  接口:', db.prepare('SELECT COUNT(*) as cnt FROM power_interfaces').get().cnt)
  console.log('  电表:', db.prepare('SELECT COUNT(*) as cnt FROM meters').get().cnt)
  console.log('  费率:', db.prepare('SELECT COUNT(*) as cnt FROM tariff_rates').get().cnt)

  console.log('数据库初始化完成！')
  console.log('已插入示例数据：3艘船舶、3个接口、3块电表、默认费率')
}

runInit().catch(console.error)
