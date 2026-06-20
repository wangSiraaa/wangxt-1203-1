const express = require('express')
const cors = require('cors')

const { initDB } = require('./db')

async function start() {
  await initDB()

  const shipsRouter = require('./routes/ships')
  const interfacesRouter = require('./routes/interfaces')
  const metersRouter = require('./routes/meters')
  const applicationsRouter = require('./routes/applications')
  const recordsRouter = require('./routes/records')
  const billsRouter = require('./routes/bills')
  const tariffsRouter = require('./routes/tariffs')
  const abnormalRouter = require('./routes/abnormal')
  const renewalsRouter = require('./routes/renewals')

  const app = express()
  const PORT = process.env.PORT || 19503

  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (req, res) => {
    res.json({ code: 0, message: 'ok', data: { time: new Date().toISOString() } })
  })

  app.use('/api/ships', shipsRouter)
  app.use('/api/interfaces', interfacesRouter)
  app.use('/api/meters', metersRouter)
  app.use('/api/applications', applicationsRouter)
  app.use('/api/records', recordsRouter)
  app.use('/api/bills', billsRouter)
  app.use('/api/tariffs', tariffsRouter)
  app.use('/api/abnormal', abnormalRouter)
  app.use('/api/renewals', renewalsRouter)

  app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ code: 1, message: err.message || '服务器错误' })
  })

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`港区岸电接入计费系统 - 后端服务启动成功，端口: ${PORT}`)
  })
}

start().catch(err => {
  console.error('启动失败:', err)
  process.exit(1)
})
