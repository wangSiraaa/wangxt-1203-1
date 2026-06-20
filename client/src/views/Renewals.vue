<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="page-title">续费管理</span>
          <div>
            <el-select v-model="statusFilter" placeholder="状态" style="width:130px; margin-right:8px" clearable @change="load">
              <el-option label="未锁定" :value="0" />
              <el-option label="已锁定" :value="1" />
            </el-select>
            <el-button type="primary" @click="openExtensionDialog">靠泊延期</el-button>
            <el-button type="success" @click="openRenewalDialog">新增续费</el-button>
          </div>
        </div>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="renewal_no" label="续费编号" width="180" />
        <el-table-column prop="ship_name" label="船舶" width="110" />
        <el-table-column prop="app_no" label="申请编号" width="150" />
        <el-table-column label="靠泊时间" width="280">
          <template #default="{ row }">
            <div style="font-size:12px">
              <div>原结束: {{ row.original_berth_end_time || '-' }}</div>
              <div>延期至: {{ row.extended_end_time }}</div>
              <div>延长: {{ row.extended_hours?.toFixed(1) }} 小时</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="power_consumption" label="电量(kWh)" width="110" />
        <el-table-column label="单价" width="90">
          <template #default="{ row }">¥{{ row.price_per_kwh?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="金额(元)" width="110">
          <template #default="{ row }">
            <span style="color:#f56c6c; font-weight:600">¥{{ row.total_amount?.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_locked ? 'success' : 'info'">
              <span v-if="row.is_locked" style="margin-right:4px">🔒</span>
              {{ row.is_locked ? '已锁定' : '未锁定' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="90" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="viewDetail(row)">详情</el-button>
            <template v-if="!row.is_locked">
              <el-button size="small" @click="openEditDialog(row)">修改</el-button>
              <el-button size="small" type="success" @click="confirmRenewal(row)">确认</el-button>
              <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
            </template>
            <template v-else>
              <el-button size="small" disabled>🔒 已锁定</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:12px; text-align:right; font-size:14px">
        <el-tag type="info" style="margin-right:8px">续费记录: {{ list.length }} 条</el-tag>
        <el-tag type="danger">总金额: ¥{{ totalAmount?.toFixed(2) }}</el-tag>
      </div>
    </el-card>

    <el-dialog v-model="extensionVisible" title="靠泊延期申请" width="520px">
      <el-form :model="extForm" label-width="110px" :rules="extRules" ref="extRef">
        <el-form-item label="接电申请" prop="app_id">
          <el-select v-model="extForm.app_id" placeholder="请选择申请" style="width:100%" filterable>
            <el-option v-for="a in appList" :key="a.id"
              :label="`${a.app_no} - ${a.ship_name}`"
              :value="a.id" />
          </el-select>
        </el-form-item>
        <el-descriptions v-if="selectedApp" :column="2" size="small" border style="margin-bottom:12px">
          <el-descriptions-item label="船舶">{{ selectedApp.ship_name }}</el-descriptions-item>
          <el-descriptions-item label="容量">{{ selectedApp.capacity }} kW</el-descriptions-item>
          <el-descriptions-item label="靠泊开始">{{ selectedApp.berth_time }}</el-descriptions-item>
          <el-descriptions-item label="预计结束">{{ selectedApp.berth_end_time || '未设置' }}</el-descriptions-item>
        </el-descriptions>
        <el-form-item label="新结束时间" prop="new_berth_end_time">
          <el-date-picker v-model="extForm.new_berth_end_time" type="datetime"
            placeholder="选择新的靠泊结束时间" style="width:100%" />
        </el-form-item>
        <el-form-item label="延期原因">
          <el-input v-model="extForm.extension_reason" type="textarea" :rows="2" placeholder="请输入延期原因" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="extForm.operator" placeholder="请输入操作人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="extensionVisible = false">取消</el-button>
        <el-button type="primary" @click="submitExtension">确认延期</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="renewalVisible" title="新增续费记录" width="560px">
      <el-form :model="renForm" label-width="110px" :rules="renRules" ref="renRef">
        <el-form-item label="接电申请" prop="app_id">
          <el-select v-model="renForm.app_id" placeholder="请选择申请" style="width:100%" filterable @change="onAppChange">
            <el-option v-for="a in appList" :key="a.id"
              :label="`${a.app_no} - ${a.ship_name}`"
              :value="a.id" />
          </el-select>
        </el-form-item>
        <el-descriptions v-if="selectedAppForRenew" :column="2" size="small" border style="margin-bottom:12px">
          <el-descriptions-item label="船舶">{{ selectedAppForRenew.ship_name }}</el-descriptions-item>
          <el-descriptions-item label="容量">{{ selectedAppForRenew.capacity }} kW</el-descriptions-item>
          <el-descriptions-item label="靠泊开始">{{ selectedAppForRenew.berth_time }}</el-descriptions-item>
          <el-descriptions-item label="当前结束">{{ selectedAppForRenew.berth_end_time || '未设置' }}</el-descriptions-item>
          <el-descriptions-item v-if="selectedAppForRenew.is_extended" label="延期次数" :span="2" type="warning">
            已延期 {{ selectedAppForRenew.extension_count || 0 }} 次
          </el-descriptions-item>
        </el-descriptions>
        <el-form-item label="原结束时间" prop="original_berth_end_time">
          <el-date-picker v-model="renForm.original_berth_end_time" type="datetime"
            placeholder="选择原靠泊结束时间" style="width:100%" />
        </el-form-item>
        <el-form-item label="延期至" prop="extended_end_time">
          <el-date-picker v-model="renForm.extended_end_time" type="datetime"
            placeholder="选择新的靠泊结束时间" style="width:100%" @change="calcHours" />
        </el-form-item>
        <el-form-item label="延时时长(小时)" prop="extended_hours">
          <el-input-number v-model="renForm.extended_hours" :min="0.1" :step="0.5" :precision="1" style="width:100%" @change="calcAmount" />
        </el-form-item>
        <el-form-item label="功率(kW)">
          <el-input-number v-model="renForm.extend_power" :min="0" :step="10" :precision="0" style="width:100%" @change="calcAmount" />
        </el-form-item>
        <el-form-item label="结算电量(kWh)">
          <el-input-number v-model="renForm.power_consumption" :min="0" :step="1" :precision="2" style="width:100%" @change="calcAmount" />
        </el-form-item>
        <el-form-item label="单价(元/kWh)">
          <el-input-number v-model="renForm.price_per_kwh" :min="0" :step="0.1" :precision="2" style="width:100%" @change="calcAmount" />
        </el-form-item>
        <div v-if="previewAmount !== null" style="text-align:center; padding:10px; background:#f0f9eb; border-radius:4px; font-size:16px">
          预计金额: <span style="color:#f56c6c; font-weight:600">¥{{ previewAmount.toFixed(2) }}</span>
        </div>
        <el-form-item label="操作人">
          <el-input v-model="renForm.operator" placeholder="请输入操作人姓名" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="renForm.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renewalVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRenewal">创建续费</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="修改续费记录" width="520px">
      <el-form :model="editForm" label-width="110px" ref="editRef">
        <el-form-item label="延期至">
          <el-date-picker v-model="editForm.extended_end_time" type="datetime"
            placeholder="选择新的靠泊结束时间" style="width:100%" />
        </el-form-item>
        <el-form-item label="延时时长(小时)">
          <el-input-number v-model="editForm.extended_hours" :min="0.1" :step="0.5" :precision="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="结算电量(kWh)">
          <el-input-number v-model="editForm.power_consumption" :min="0" :step="1" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="单价(元/kWh)">
          <el-input-number v-model="editForm.price_per_kwh" :min="0" :step="0.1" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存修改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="续费记录详情" width="600px">
      <el-descriptions v-if="currentDetail" :column="2" border>
        <el-descriptions-item label="续费编号">{{ currentDetail.renewal_no }}</el-descriptions-item>
        <el-descriptions-item label="船舶">{{ currentDetail.ship_name }}</el-descriptions-item>
        <el-descriptions-item label="申请编号">{{ currentDetail.app_no }}</el-descriptions-item>
        <el-descriptions-item label="接口">{{ currentDetail.interface_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="原结束时间">{{ currentDetail.original_berth_end_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="延期至">{{ currentDetail.extended_end_time }}</el-descriptions-item>
        <el-descriptions-item label="延时时长">{{ currentDetail.extended_hours?.toFixed(1) }} 小时</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentDetail.is_locked ? 'success' : 'info'">
            {{ currentDetail.is_locked ? '🔒 已锁定' : '未锁定' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="结算电量">{{ currentDetail.power_consumption }} kWh</el-descriptions-item>
        <el-descriptions-item label="单价">¥{{ currentDetail.price_per_kwh?.toFixed(2) }}/kWh</el-descriptions-item>
        <el-descriptions-item label="总金额" :span="2">
          <span style="color:#f56c6c; font-size:18px; font-weight:600">¥{{ currentDetail.total_amount?.toFixed(2) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="操作人">{{ currentDetail.operator || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ currentDetail.created_at }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentDetail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api'
import dayjs from 'dayjs'

const list = ref([])
const statusFilter = ref(null)
const totalAmount = computed(() => list.value.reduce((sum, r) => sum + (r.total_amount || 0), 0))

const extensionVisible = ref(false)
const renewalVisible = ref(false)
const editVisible = ref(false)
const detailVisible = ref(false)
const currentDetail = ref(null)

const appList = ref([])
const selectedApp = ref(null)
const selectedAppForRenew = ref(null)

const extForm = ref({ app_id: null, new_berth_end_time: null, extension_reason: '', operator: '' })
const renForm = ref({
  app_id: null, original_berth_end_time: null, extended_end_time: null,
  extended_hours: null, extend_power: null, power_consumption: null,
  price_per_kwh: null, operator: '', remark: ''
})
const editForm = ref({})
const previewAmount = computed(() => {
  if (renForm.value.power_consumption != null && renForm.value.price_per_kwh != null) {
    return Number((renForm.value.power_consumption * renForm.value.price_per_kwh).toFixed(2))
  }
  if (renForm.value.extend_power != null && renForm.value.extended_hours != null && renForm.value.price_per_kwh != null) {
    return Number((renForm.value.extend_power * renForm.value.extended_hours * renForm.value.price_per_kwh).toFixed(2))
  }
  return null
})

const extRules = {
  app_id: [{ required: true, message: '请选择申请', trigger: 'change' }],
  new_berth_end_time: [{ required: true, message: '请选择新的结束时间', trigger: 'change' }]
}
const renRules = {
  app_id: [{ required: true, message: '请选择申请', trigger: 'change' }],
  extended_end_time: [{ required: true, message: '请选择延期至', trigger: 'change' }],
  extended_hours: [{ required: true, message: '请输入延时时长', trigger: 'blur' }]
}

async function load() {
  const params = {}
  if (statusFilter.value != null) params.status = statusFilter.value === 1 ? 'locked' : 'unlocked'
  const res = await api.renewals.list(params)
  list.value = res.data
}

async function loadApps() {
  const res = await api.applications.list()
  appList.value = res.data
}

function onAppChange(appId) {
  selectedAppForRenew.value = appList.value.find(a => a.id === appId)
  if (selectedAppForRenew.value?.berth_end_time) {
    renForm.value.original_berth_end_time = dayjs(selectedAppForRenew.value.berth_end_time).toDate()
  }
}

function calcHours() {
  if (renForm.value.original_berth_end_time && renForm.value.extended_end_time) {
    const hours = dayjs(renForm.value.extended_end_time).diff(dayjs(renForm.value.original_berth_end_time), 'hour', true)
    renForm.value.extended_hours = Number(hours.toFixed(1))
    calcAmount()
  }
}

function calcAmount() {
}

async function openExtensionDialog() {
  await loadApps()
  extForm.value = { app_id: null, new_berth_end_time: null, extension_reason: '', operator: '' }
  selectedApp.value = null
  extensionVisible.value = true
}

async function submitExtension() {
  try {
    await api.renewals.applyExtension({
      app_id: extForm.value.app_id,
      new_berth_end_time: dayjs(extForm.value.new_berth_end_time).format('YYYY-MM-DD HH:mm:ss'),
      extension_reason: extForm.value.extension_reason,
      operator: extForm.value.operator
    })
    ElMessage.success('靠泊延期成功')
    extensionVisible.value = false
    loadApps()
  } catch (e) {}
}

async function openRenewalDialog() {
  await loadApps()
  const tariffRes = await api.tariffs.list()
  const defaultTariff = tariffRes.data.find(t => t.is_default) || tariffRes.data[0]
  renForm.value = {
    app_id: null, original_berth_end_time: null, extended_end_time: null,
    extended_hours: null, extend_power: null, power_consumption: null,
    price_per_kwh: defaultTariff?.price_per_kwh || 1.2, operator: '', remark: ''
  }
  selectedAppForRenew.value = null
  renewalVisible.value = true
}

async function submitRenewal() {
  try {
    await api.renewals.create({
      ...renForm.value,
      original_berth_end_time: renForm.value.original_berth_end_time 
        ? dayjs(renForm.value.original_berth_end_time).format('YYYY-MM-DD HH:mm:ss') : null,
      extended_end_time: dayjs(renForm.value.extended_end_time).format('YYYY-MM-DD HH:mm:ss')
    })
    ElMessage.success('续费记录创建成功')
    renewalVisible.value = false
    load()
  } catch (e) {}
}

async function openEditDialog(row) {
  editForm.value = { ...row }
  editForm.value.extended_end_time = dayjs(row.extended_end_time).toDate()
  editVisible.value = true
}

async function submitEdit() {
  try {
    await api.renewals.update(currentDetail.value.id, {
      ...editForm.value,
      extended_end_time: dayjs(editForm.value.extended_end_time).format('YYYY-MM-DD HH:mm:ss')
    })
    ElMessage.success('修改成功')
    editVisible.value = false
    load()
  } catch (e) {}
}

async function confirmRenewal(row) {
  await ElMessageBox.confirm('确认后该续费记录将被锁定，无法修改。是否继续？', '确认锁定', { type: 'warning' })
  try {
    await api.renewals.confirm(row.id, { confirmed_by: '财务' })
    ElMessage.success('续费记录已确认锁定')
    load()
  } catch (e) {}
}

async function viewDetail(row) {
  const res = await api.renewals.get(row.id)
  currentDetail.value = res.data
  detailVisible.value = true
}

async function remove(row) {
  await ElMessageBox.confirm('确定要删除该续费记录吗？', '删除确认', { type: 'warning' })
  try {
    await api.renewals.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {}
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.page { max-width: 1400px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-title { font-size: 16px; font-weight: 600; color: #303133; }
</style>
