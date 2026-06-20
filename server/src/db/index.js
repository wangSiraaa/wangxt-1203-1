const initSqlJs = require('sql.js')
const path = require('path')
const fs = require('fs')

const dbDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}
const dbPath = path.join(dbDir, 'shorepower.db')

let dbInstance = null
let SQL = null
let initPromise = null

function saveToDisk() {
  if (!dbInstance) return
  const data = dbInstance.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

function resultToObjects(results) {
  if (!results || results.length === 0) return []
  const { columns, values } = results[0]
  return values.map(row => {
    const obj = {}
    columns.forEach((col, i) => obj[col] = row[i])
    return obj
  })
}

function rowToObject(columns, row) {
  const obj = {}
  columns.forEach((col, i) => obj[col] = row[i])
  return obj
}

async function initDB() {
  if (dbInstance) return dbInstance
  if (initPromise) return initPromise
  
  initPromise = (async () => {
    SQL = await initSqlJs()

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath)
      dbInstance = new SQL.Database(new Uint8Array(buffer))
    } else {
      dbInstance = new SQL.Database()
    }

    const _origExec = dbInstance.exec.bind(dbInstance)
    const _origPrepare = dbInstance.prepare.bind(dbInstance)
    const _origRun = dbInstance.run.bind(dbInstance)

    dbInstance.exec = function (sql, params) {
      if (!params || params.length === 0) {
        return resultToObjects(_origExec(sql))
      }
      
      const stmt = _origPrepare(sql)
      const _stmtGet = stmt.get.bind(stmt)
      const _stmtStep = stmt.step.bind(stmt)
      const _stmtFree = stmt.free.bind(stmt)
      
      stmt.bind(params)
      const columns = stmt.getColumnNames()
      const rows = []
      while (_stmtStep()) {
        const row = _stmtGet()
        rows.push(rowToObject(columns, row))
      }
      _stmtFree()
      return rows
    }

    dbInstance.prepare = function (sql) {
      let stmt = _origPrepare(sql)
      let columns = stmt.getColumnNames()
      let _stmtGet = stmt.get.bind(stmt)
      let _stmtStep = stmt.step.bind(stmt)
      let _stmtBind = stmt.bind.bind(stmt)
      let _stmtReset = stmt.reset.bind(stmt)
      let _stmtFree = stmt.free.bind(stmt)
      
      function reprepare() {
        try {
          stmt.free()
        } catch (e) {}
        stmt = _origPrepare(sql)
        columns = stmt.getColumnNames()
        _stmtGet = stmt.get.bind(stmt)
        _stmtStep = stmt.step.bind(stmt)
        _stmtBind = stmt.bind.bind(stmt)
        _stmtReset = stmt.reset.bind(stmt)
        _stmtFree = stmt.free.bind(stmt)
      }
      
      const wrapper = {
        _stmt: stmt,
        _sql: sql,
        _columns: columns,
        _reprepare: reprepare,
        
        bind: function (...args) { return _stmtBind(...args) },
        reset: function (...args) { return _stmtReset(...args) },
        free: function (...args) { return _stmtFree(...args) },
        step: function (...args) { return _stmtStep(...args) },
        getColumnNames: () => columns,
        
        all: function (params) {
          try {
            if (params && params.length > 0) {
              _stmtBind(params)
            }
            const rows = []
            while (_stmtStep()) {
              const row = _stmtGet()
              rows.push(rowToObject(columns, row))
            }
            _stmtReset()
            return rows
          } catch (e) {
            if (e === 'Statement closed') {
              reprepare()
              return wrapper.all(params)
            }
            throw e
          }
        },
        
        get: function (params) {
          try {
            if (params && params.length > 0) {
              _stmtBind(params)
            }
            if (_stmtStep()) {
              const row = _stmtGet()
              const obj = rowToObject(columns, row)
              _stmtReset()
              return obj
            }
            _stmtReset()
            return undefined
          } catch (e) {
            if (e === 'Statement closed') {
              reprepare()
              return wrapper.get(params)
            }
            throw e
          }
        },
        
        run: function (params) {
          try {
            if (params && params.length > 0) {
              _stmtBind(params)
            }
            _stmtStep()
            const idResult = resultToObjects(_origExec('SELECT last_insert_rowid() AS id'))
            const changesResult = resultToObjects(_origExec('SELECT changes() AS c'))
            _stmtReset()
            saveToDisk()
            return {
              lastInsertRowid: idResult[0]?.id,
              changes: changesResult[0]?.c
            }
          } catch (e) {
            if (e === 'Statement closed') {
              reprepare()
              return wrapper.run(params)
            }
            throw e
          }
        }
      }
      
      return wrapper
    }

    dbInstance.run = function (sql, params) {
      const stmt = _origPrepare(sql)
      const _stmtBind = stmt.bind.bind(stmt)
      const _stmtStep = stmt.step.bind(stmt)
      const _stmtReset = stmt.reset.bind(stmt)
      const _stmtFree = stmt.free.bind(stmt)
      
      if (params && params.length > 0) {
        _stmtBind(params)
      }
      _stmtStep()
      const idResult = resultToObjects(_origExec('SELECT last_insert_rowid() AS id'))
      const changesResult = resultToObjects(_origExec('SELECT changes() AS c'))
      _stmtReset()
      _stmtFree()
      saveToDisk()
      return {
        lastInsertRowid: idResult[0]?.id,
        changes: changesResult[0]?.c
      }
    }

    dbInstance.pragma = function () {}
    dbInstance.transaction = function (fn) {
      return function (...args) {
        dbInstance.run('BEGIN TRANSACTION')
        try {
          const result = fn(...args)
          dbInstance.run('COMMIT')
          saveToDisk()
          return result
        } catch (e) {
          dbInstance.run('ROLLBACK')
          throw e
        }
      }
    }

    return dbInstance
  })()
  
  return initPromise
}

module.exports = { initDB, getDB: () => dbInstance }
