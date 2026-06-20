<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="page-title">财务结算</span>
          <div>
            <el-select v-model="statusFilter" placeholder="账单状态" style="width:130px; margin-right:8px" clearable @change="load">
              <el-option v-for="(v, k) in billStatusMap" :key="k" :label="v" :value="k" />
            </el-select>
            <el-input v-model="keyword" placeholder="搜索账单/船舶" style="width: 240px; margin-right: 8px;" clearable @input="load" />
            <el-button type="primary" @click="openGenerateDialog">生成账单</el-button>
          </div>
        </div>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="bill_no" label="账单编号" width="180" />
        <el-table-column prop="ship_name" label="船舶" width="110" />
        <el-table-column prop="interface_name" label="接口" width="120" />
        <el-table-column label="用电时段" width="300">
          <template #default="{ row }">
            <div style="font-size:12px">
              <div>接电：{{ row.connect_time }}</div>
              <div>断电：{{ row.disconnect_time }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="读数" width="140">
          <template #default="{ row }">
            <div style="font-size:12px">
              <div>接电: {{ row.connect_reading }}</div>
              <div>断电: {{ row.disconnect_reading }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="power_consumption" label="用电量(kWh)" width="120" />
        <el-table-column label="单价" width="100">
          <template #default="{ row }">¥{{ row.price_per_kwh?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="总金额(元)" width="120">
          <template #default="{ row }">
            <span style="color:#f56c6c; font-weight:600">¥{{ row.total_amount?.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <div style="display:flex; align-items:center; gap:4px">
              <el-tag :type="billStatusType[row.status]">
                <span v-if="row.status === 'confirmed'" style="margin-right:4px">🔒</span>
                {{ billStatusMap[row.status] }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="viewDetail(row)">详情</el-button>
            <template v-if="row.status === 'draft'">
              <el-button size="small" @click="openEditDialog(row)">修改</el-button>
              <el-button size="small" type="success" @click="confirmBill(row)">确认</el-button>
              <el-button size="small" type="danger" @click="voidBill(row)">作废</el-button>
            </template>
            <template v-else-if="row.status === 'confirmed'">
              <el-button size="small" disabled>🔒 已锁定</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:12px; text-align:right; font-size:14px">
        <el-tag type="info" style="margin-right:8px">账单总数: {{ list.length }}</el-tag>
        <el-tag type="danger">总金额: ¥{{ totalAmount?.toFixed(2) }}</el-tag>
      </div>
    </el-card>

    <el-dialog v-model="generateVisible" title="生成账单" width="560px">
      <el-form :model="genForm" label-width="110px" :rules="genRules" ref="genRef">
        <el-form-item label="接电记录" prop="record_id">
          <el-select v-model="genForm.record_id" placeholder="请选择已断电的接电记录" style="width:100%" filterable @change="onRecordChange">
            <el-option v-for="r in disconnectedRecords" :key="r.id"
              :label="`${r.record_no} - ${r.ship_name} ${r.power_consumption}kWh`"
              :value="r.id" />
          </el-select>
        </el-form-item>
        <el-descriptions v-if="selectedRecord" :column="2" size="small" border style="margin-bottom:12px">
          <el-descriptions-item label="船舶">{{ selectedRecord.ship_name }}</el-descriptions-item>
          <el-descriptions-item label="接口">{{ selectedRecord.interface_name }}</el-descriptions-item>
          <el-descriptions-item label="接电读数">{{ selectedRecord.connect_reading }}</el-descriptions-item>
          <el-descriptions-item label="断电读数">{{ selectedRecord.disconnect_reading }}</el-descriptions-item>
          <el-descriptions-item label="用电量" :span="2" style="color:#f56c6c">{{ selectedRecord.power_consumption }} kWh</el-descriptions-item>
        </el-descriptions>
        <el-form-item label="费率">
          <el-select v-model="genForm.tariff_id" placeholder="请选择费率（不选使用默认）" style="width:100%" clearable>
            <el-option v-for="t in tariffList" :key="t.id"
              :label="`${t.rate_name} - ¥${t.price_per_kwh}/kWh ${t.is_default ? '(默认)' : ''}`"
              :value="t.id" />
          </el-select>
        </el-form-item>
        <div v-if="previewAmount !== null" style="text-align:center; padding:8px; background:#f0f9eb; border-radius:4px; font-size:16px">
          预计金额: <span style="color:#f56c6c; font-weight:600">¥{{ previewAmount.toFixed(2) }}</span>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="generateVisible = false">取消</el-button>
        <el-button type="primary" @click="generateBill">生成账单</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="修改账单" width="500px">
      <el-form :model="editForm" label-width="110px" ref="editRef">
        <el-form-item label="用电量(kWh)"><el-input-number v-model="editForm.power_consumption" :min="0" :precision="2" @change="calcEditTotal" /></el-form-item>
        <el-form-item label="单价(元/kWh)"><el-input-number v-model="editForm.price_per_kwh" :min="0" :precision="2" :step="0.1" @change="calcEditTotal" /></el-form-item>
        <el-form-item label="总金额(元)">
          <el-input-number v-model="editForm.total_amount" :min="0" :precision="2" disabled style="background:#f5f7fa" />
          <span style="margin-left:8px; color:#67c23a; font-size:12px">系统自动计算</span>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="editForm.remark" type="textarea" rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="账单详情" width="640px">
      <el-descriptions v-if="detailData" :column="2" border>
        <el-descriptions-item label="账单编号" :span="2">{{ detailData.bill_no }}</el-descriptions-item>
        <el-descriptions-item label="船舶">{{ detailData.ship_name }} ({{ detailData.ship_code }})</el-descriptions-item>
        <el-descriptions-item label="接口">{{ detailData.interface_name }} ({{ detailData.location }})</el-descriptions-item>
        <el-descriptions-item label="电表">{{ detailData.meter_name }} ({{ detailData.meter_code }})</el-descriptions-item>
        <el-descriptions-item label="操作员">{{ detailData.operator }}</el-descriptions-item>
        <el-descriptions-item label="接电时间" :span="2">{{ detailData.connect_time }}</el-descriptions-item>
        <el-descriptions-item label="断电时间" :span="2">{{ detailData.disconnect_time }}</el-descriptions-item>
        <el-descriptions-item label="接电读数">{{ detailData.connect_reading }}</el-descriptions-item>
        <el-descriptions-item label="断电读数">{{ detailData.disconnect_reading }}</el-descriptions-item>
        <el-descriptions-item label="用电量(kWh)" style="color:#f56c6c">{{ detailData.power_consumption }}</el-descriptions-item>
        <el-descriptions-item label="单价(元/kWh)">¥{{ detailData.price_per_kwh?.toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="总金额" :span="2" style="color:#f56c6c; font-size:18px; font-weight:600">¥{{ detailData.total_amount?.toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="billStatusType[detailData.status]">
            <span v-if="detailData.status === 'confirmed'" style="margin-right:4px">🔒</span>
            {{ billStatusMap[detailData.status] }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="确认人">{{ detailData.confirmed_by || '-' }}</el-descriptions-item>
        <el-descriptions-item label="确认时间" :span="2">{{ detailData.confirmed_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detailData.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed, watch } from 'vue'
import { api } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const disconnectedRecords = ref([])
const tariffList = ref([])
const keyword = ref('')
const statusFilter = ref('')
const billStatusMap = { draft: '草稿', confirmed: '已确认', void: '已作废' }
const billStatusType = { draft: 'info', confirmed: 'success', void: 'danger' }

const generateVisible = ref(false)
const editVisible = ref(false)
const detailVisible = ref(false)
const selectedRecord = ref(null)
const detailData = ref(null)
const genRef = ref()
const editRef = ref()
const genForm = reactive({ record_id: null, tariff_id: null })
const editForm = reactive({ id: null, power_consumption: 0, price_per_kwh: 0, total_amount: 0, remark: '' })
const genRules = { record_id: [{ required: true, message: '请选择接电记录', trigger: 'change' }] }

const totalAmount = computed(() => list.value.filter(b => b.status !== 'void').reduce((sum, b) => sum + (b.total_amount || 0), 0))

const calcEditTotal = () => {
  if (editForm.power_consumption != null && editForm.price_per_kwh != null) {
    editForm.total_amount = Number((editForm.power_consumption * editForm.price_per_kwh).toFixed(2))
  }
}

const previewAmount = computed(() => {
  if (!selectedRecord.value) return null
  const tariff = genForm.tariff_id ? tariffList.value.find(t => t.id === genForm.tariff_id) : tariffList.value.find(t => t.is_default === 1)
  if (!tariff) return null
  return Number((selectedRecord.value.power_consumption * tariff.price_per_kwh).toFixed(2))
})

const load = async () => {
  const [b, r, t] = await Promise.all([
    api.bills.list({ keyword: keyword.value, status: statusFilter.value }),
    api.records.list({ status: 'disconnected' }),
    api.tariffs.list()
  ])
  list.value = b.data
  const billed = b.data.map(x => x.record_id)
  disconnectedRecords.value = r.data.filter(x => !billed.includes(x.id))
  tariffList.value = t.data
}

const onRecordChange = (id) => {
  selectedRecord.value = disconnectedRecords.value.find(r => r.id === id)
}

const openGenerateDialog = () => {
  Object.assign(genForm, { record_id: null, tariff_id: null })
  selectedRecord.value = null
  generateVisible.value = true
}

const generateBill = async () => {
  await genRef.value.validate()
  const res = await api.bills.generate(genForm)
  ElMessage.success(`账单生成成功，金额 ¥${res.data.total_amount.toFixed(2)}`)
  generateVisible.value = false
  load()
}

const openEditDialog = (row) => {
  Object.assign(editForm, { id: row.id, power_consumption: row.power_consumption, price_per_kwh: row.price_per_kwh, total_amount: row.total_amount, remark: row.remark })
  editVisible.value = true
}

const saveEdit = async () => {
  await api.bills.update(editForm.id, editForm)
  ElMessage.success('修改成功')
  editVisible.value = false
  load()
}

const confirmBill = async (row) => {
  await ElMessageBox.confirm(
    `确认账单「${row.bill_no}」吗？确认后账单的读数和金额将被锁定，不可再修改。`,
    '确认账单',
    { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
  )
  await api.bills.confirm(row.id, { confirmed_by: '财务' })
  ElMessage.success('账单已确认，已锁定')
  load()
}

const voidBill = async (row) => {
  await ElMessageBox.confirm(`确定作废账单「${row.bill_no}」吗？`, '提示', { type: 'warning' })
  try {
    await api.bills.void(row.id, { remark: '作废' })
    ElMessage.success('已作废')
    load()
  } catch (e) {}
}

const viewDetail = async (row) => {
  const res = await api.bills.get(row.id)
  detailData.value = res.data
  detailVisible.value = true
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-title { font-size: 16px; font-weight: 600; }
</style>
