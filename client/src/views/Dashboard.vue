<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon blue"><el-icon :size="32"><Ship /></el-icon></div>
          <div class="stat-info">
            <div class="label">船舶总数</div>
            <div class="value">{{ stats.shipCount }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon green"><el-icon :size="32"><Connection /></el-icon></div>
          <div class="stat-info">
            <div class="label">可用接口</div>
            <div class="value">{{ stats.availableInterfaces }} / {{ stats.totalInterfaces }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon orange"><el-icon :size="32"><Notebook /></el-icon></div>
          <div class="stat-info">
            <div class="label">待处理申请</div>
            <div class="value">{{ stats.pendingApps }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon red"><el-icon :size="32"><Warning /></el-icon></div>
          <div class="stat-info">
            <div class="label">异常读数</div>
            <div class="value">{{ stats.abnormalCount }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近接电申请</span>
              <el-button type="primary" size="small" @click="$router.push('/applications')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentApps" size="small" stripe>
            <el-table-column prop="app_no" label="申请编号" width="160" />
            <el-table-column prop="ship_name" label="船舶" />
            <el-table-column prop="berth_time" label="靠泊时间" width="160" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="appStatusType[row.status]">{{ appStatusMap[row.status] }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近账单</span>
              <el-button type="primary" size="small" @click="$router.push('/bills')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentBills" size="small" stripe>
            <el-table-column prop="bill_no" label="账单编号" width="170" />
            <el-table-column prop="ship_name" label="船舶" />
            <el-table-column prop="power_consumption" label="用电量(kWh)" width="130" />
            <el-table-column prop="total_amount" label="金额(元)" width="110">
              <template #default="{ row }">¥ {{ row.total_amount?.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="billStatusType[row.status]">{{ billStatusMap[row.status] }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="24">
        <el-card>
          <template #header><span>业务流程说明</span></template>
          <el-steps :active="99" finish-status="success" align-center>
            <el-step title="船方提交申请" description="提交接电申请和靠泊时间" />
            <el-step title="电工班接电" description="校验容量、登记接电读数" />
            <el-step title="用电中" description="船舶正常使用岸电" />
            <el-step title="断电登记" description="记录断电读数，自动校验" />
            <el-step title="财务结算" description="生成账单，确认后锁定" />
          </el-steps>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'
import { Ship, Connection, Notebook, Warning } from '@element-plus/icons-vue'

const stats = ref({ shipCount: 0, availableInterfaces: 0, totalInterfaces: 0, pendingApps: 0, abnormalCount: 0 })
const recentApps = ref([])
const recentBills = ref([])

const appStatusMap = { pending: '待审批', approved: '已通过', rejected: '已驳回', connected: '接电中', billed: '已结算' }
const appStatusType = { pending: 'warning', approved: 'success', rejected: 'danger', connected: 'primary', billed: 'info' }
const billStatusMap = { draft: '草稿', confirmed: '已确认', void: '已作废' }
const billStatusType = { draft: 'info', confirmed: 'success', void: 'danger' }

onMounted(async () => {
  try {
    const [ships, interfaces, apps, abnormal, bills] = await Promise.all([
      api.ships.list(),
      api.interfaces.list(),
      api.applications.list(),
      api.abnormal.list({ status: 'pending' }),
      api.bills.list()
    ])
    stats.value.shipCount = ships.data.length
    stats.value.totalInterfaces = interfaces.data.length
    stats.value.availableInterfaces = interfaces.data.filter(i => i.status === 'available').length
    stats.value.pendingApps = apps.data.filter(a => a.status === 'pending').length
    stats.value.abnormalCount = abnormal.data.length
    recentApps.value = apps.data.slice(0, 5)
    recentBills.value = bills.data.slice(0, 5)
  } catch (e) {}
})
</script>

<style scoped>
.stat-card { display: flex; align-items: center; gap: 16px; }
.stat-icon {
  width: 60px; height: 60px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; color: #fff;
}
.stat-icon.blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
.stat-icon.green { background: linear-gradient(135deg, #10b981, #047857); }
.stat-icon.orange { background: linear-gradient(135deg, #f59e0b, #b45309); }
.stat-icon.red { background: linear-gradient(135deg, #ef4444, #b91c1c); }
.stat-info .label { color: #909399; font-size: 13px; }
.stat-info .value { font-size: 24px; font-weight: 600; margin-top: 4px; color: #303133; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
