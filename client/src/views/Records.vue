<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="page-title">接电登记（电工班）</span>
          <div>
            <el-select v-model="statusFilter" placeholder="状态" style="width:130px; margin-right:8px" clearable @change="load">
              <el-option v-for="(v, k) in recordStatusMap" :key="k" :label="v" :value="k" />
            </el-select>
            <el-input v-model="keyword" placeholder="搜索记录/申请/船舶" style="width: 240px; margin-right: 8px;" clearable @input="load" />
            <el-button type="primary" @click="openConnectDialog">登记接电</el-button>
          </div>
        </div>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="record_no" label="记录编号" width="170" />
        <el-table-column prop="app_no" label="申请编号" width="170" />
        <el-table-column prop="ship_name" label="船舶" width="100" />
        <el-table-column label="接口/位置" width="180">
          <template #default="{ row }">{{ row.interface_name }} ({{ row.location }})</template>
        </el-table-column>
        <el-table-column prop="meter_code" label="电表" width="100" />
        <el-table-column prop="connect_time" label="接电时间" width="160" />
        <el-table-column prop="connect_reading" label="接电读数" width="100" />
        <el-table-column prop="disconnect_time" label="断电时间" width="160" />
        <el-table-column prop="disconnect_reading" label="断电读数" width="100" />
        <el-table-column prop="power_consumption" label="用电量(kWh)" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="recordStatusType[row.status]">{{ recordStatusMap[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'connected'">
              <el-button size="small" type="warning" @click="openDisconnectDialog(row)">登记断电</el-button>
            </template>
            <template v-if="row.status === 'connected' || row.status === 'disconnected'">
              <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="connectVisible" title="登记接电" width="600px">
      <el-form :model="connectForm" label-width="110px" ref="connectRef" :rules="connectRules">
        <el-form-item label="申请单" prop="app_id">
          <el-select v-model="connectForm.app_id" placeholder="请选择已通过的申请" style="width:100%" filterable @change="onAppChange">
            <el-option v-for="a in approvedApps" :key="a.id"
              :label="`${a.app_no} - ${a.ship_name} (${a.ship_capacity}kW) 靠泊:${a.berth_time}`"
              :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="供电接口" prop="interface_id">
          <el-select v-model="connectForm.interface_id" placeholder="请选择接口" style="width:100%" @change="onInterfaceChange">
            <el-option v-for="i in availableInterfaces" :key="i.id"
              :label="`${i.interface_code} - ${i.interface_name} (${i.location}) 上限:${i.max_capacity}kW`"
              :value="i.id">
              <span style="float:left">{{ i.interface_code }} - {{ i.interface_name }}</span>
              <span style="float:right; color:#8492a6; font-size:13px">{{ i.location }} | 上限:{{ i.max_capacity }}kW</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="电表" prop="meter_id">
          <el-select v-model="connectForm.meter_id" placeholder="请选择电表" style="width:100%">
            <el-option v-for="m in availableMeters" :key="m.id"
              :label="`${m.meter_code} - ${m.meter_name} 当前读数:${m.current_reading}`" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="接电读数">
          <el-input-number v-model="connectForm.connect_reading" :min="0" :precision="2" />
          <el-input type="text" v-if="selectedMeter" style="margin-left:10px; width:200px"
            :model-value="`电表当前读数: ${selectedMeter.current_reading}`" disabled />
        </el-form-item>
        <el-form-item label="操作员"><el-input v-model="connectForm.operator" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="connectForm.remark" type="textarea" rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="connectVisible = false">取消</el-button>
        <el-button type="primary" @click="doConnect">确认接电</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="disconnectVisible" title="登记断电" width="520px">
      <el-descriptions v-if="currentRecord" :column="2" size="small" border style="margin-bottom:16px">
        <el-descriptions-item label="记录编号">{{ currentRecord.record_no }}</el-descriptions-item>
        <el-descriptions-item label="船舶">{{ currentRecord.ship_name }}</el-descriptions-item>
        <el-descriptions-item label="接口">{{ currentRecord.interface_name }}</el-descriptions-item>
        <el-descriptions-item label="电表">{{ currentRecord.meter_code }}</el-descriptions-item>
        <el-descriptions-item label="接电时间">{{ currentRecord.connect_time }}</el-descriptions-item>
        <el-descriptions-item label="接电读数" :span="2">{{ currentRecord.connect_reading }}</el-descriptions-item>
      </el-descriptions>
      <el-form :model="disconnectForm" label-width="110px" ref="disconnectRef" :rules="disconnectRules">
        <el-form-item label="断电读数" prop="disconnect_reading">
          <el-input-number v-model="disconnectForm.disconnect_reading" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="操作员"><el-input v-model="disconnectForm.operator" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="disconnectForm.remark" type="textarea" rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="disconnectVisible = false">取消</el-button>
        <el-button type="primary" @click="doDisconnect">确认断电</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { api } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const approvedApps = ref([])
const availableInterfaces = ref([])
const keyword = ref('')
const statusFilter = ref('')
const selectedApp = ref(null)
const selectedInterface = ref(null)
const selectedMeter = ref(null)

const recordStatusMap = { connected: '接电中', disconnected: '已断电', abnormal: '读数异常', billed: '已结算', cancelled: '已取消' }
const recordStatusType = { connected: 'primary', disconnected: 'success', abnormal: 'danger', billed: 'info', cancelled: 'info' }

const connectVisible = ref(false)
const disconnectVisible = ref(false)
const currentRecord = ref(null)
const connectRef = ref()
const disconnectRef = ref()
const connectForm = reactive({ app_id: null, interface_id: null, meter_id: null, connect_reading: 0, operator: '', remark: '' })
const disconnectForm = reactive({ disconnect_reading: 0, operator: '', remark: '' })

const connectRules = {
  app_id: [{ required: true, message: '请选择申请单', trigger: 'change' }],
  interface_id: [{ required: true, message: '请选择接口', trigger: 'change' }],
  meter_id: [{ required: true, message: '请选择电表', trigger: 'change' }]
}
const disconnectRules = {
  disconnect_reading: [{ required: true, message: '请输入断电读数', trigger: 'blur' }]
}

const availableMeters = computed(() => {
  if (!connectForm.interface_id) return []
  return availableInterfaces.value.filter(i => i.id === connectForm.interface_id && i.meter_id).map(i => ({
    id: i.meter_id, meter_code: i.meter_code, meter_name: i.meter_name, current_reading: i.current_reading
  }))
})

const onAppChange = (id) => {
  selectedApp.value = approvedApps.value.find(a => a.id === id)
}
const onInterfaceChange = (id) => {
  selectedInterface.value = availableInterfaces.value.find(i => i.id === id)
  connectForm.meter_id = null
  if (selectedInterface.value?.meter_id) {
    connectForm.meter_id = selectedInterface.value.meter_id
    connectForm.connect_reading = selectedInterface.value.current_reading || 0
    selectedMeter.value = { current_reading: selectedInterface.value.current_reading }
  }
}

const load = async () => {
  const [r, a, i] = await Promise.all([
    api.records.list({ keyword: keyword.value, status: statusFilter.value }),
    api.applications.list({ status: 'approved' }),
    api.interfaces.available()
  ])
  list.value = r.data
  approvedApps.value = a.data.filter(x => {
    const used = r.data.find(y => y.app_id === x.id && y.status !== 'billed' && y.status !== 'cancelled')
    return !used
  })
  availableInterfaces.value = i.data
}

const openConnectDialog = () => {
  Object.assign(connectForm, { app_id: null, interface_id: null, meter_id: null, connect_reading: 0, operator: '', remark: '' })
  selectedApp.value = null
  selectedInterface.value = null
  selectedMeter.value = null
  connectVisible.value = true
}

const doConnect = async () => {
  await connectRef.value.validate()
  if (selectedApp.value && selectedInterface.value && selectedApp.value.ship_capacity > selectedInterface.value.max_capacity) {
    ElMessage.warning(`船舶容量(${selectedApp.value.ship_capacity}kW)超过接口上限(${selectedInterface.value.max_capacity}kW)，不能接电`)
    return
  }
  await api.records.connect(connectForm)
  ElMessage.success('接电登记成功')
  connectVisible.value = false
  load()
}

const openDisconnectDialog = (row) => {
  currentRecord.value = row
  Object.assign(disconnectForm, { disconnect_reading: row.connect_reading + 100, operator: row.operator || '', remark: '' })
  disconnectVisible.value = true
}

const doDisconnect = async () => {
  await disconnectRef.value.validate()
  if (disconnectForm.disconnect_reading < currentRecord.value.connect_reading) {
    try {
      await ElMessageBox.confirm(
        `断电读数(${disconnectForm.disconnect_reading})小于接电读数(${currentRecord.value.connect_reading})，系统将自动转入异常处理流程，是否继续？`,
        '读数异常提示',
        { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }
  const res = await api.records.disconnect(currentRecord.value.id, disconnectForm)
  ElMessage.success(res.message || '断电登记成功')
  if (res.data?.abnormal || res.data?.status === 'abnormal') {
    ElMessage.warning('读数异常，已自动转入异常处理流程')
  }
  disconnectVisible.value = false
  load()
}

const remove = async (row) => {
  await ElMessageBox.confirm(`确定删除记录「${row.record_no}」吗？`, '提示', { type: 'warning' })
  try {
    await api.records.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {}
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-title { font-size: 16px; font-weight: 600; }
</style>
