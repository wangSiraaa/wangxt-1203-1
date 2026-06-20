<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="page-title">异常读数处理</span>
          <el-select v-model="statusFilter" placeholder="处理状态" style="width:130px" clearable @change="load">
            <el-option label="待处理" value="pending" />
            <el-option label="已处理" value="handled" />
          </el-select>
        </div>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="record_no" label="接电记录" width="170" />
        <el-table-column prop="ship_name" label="船舶" width="100" />
        <el-table-column prop="interface_name" label="接口" width="110" />
        <el-table-column label="异常类型" width="130">
          <template #default="{ row }">
            <el-tag type="danger">{{ typeMap[row.abnormal_type] || row.abnormal_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="读数对比" width="200">
          <template #default="{ row }">
            <div style="font-size:12px">
              <div>接电读数: <span style="color:#67c23a">{{ row.connect_reading }}</span></div>
              <div>断电读数: <span style="color:#f56c6c">{{ row.disconnect_reading }}</span></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="异常描述" min-width="200" />
        <el-table-column prop="handle_result" label="处理结果" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.handle_result" :type="resultType[row.handle_result]">{{ resultMap[row.handle_result] }}</el-tag>
            <span v-else style="color:#909399">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'pending' ? 'warning' : 'success'">{{ row.status === 'pending' ? '待处理' : '已处理' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handled_by" label="处理人" width="100" />
        <el-table-column prop="handled_at" label="处理时间" width="170" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" size="small" type="primary" @click="openHandleDialog(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="handleVisible" title="异常读数处理" width="580px">
      <el-descriptions v-if="detail" :column="2" size="small" border style="margin-bottom:16px">
        <el-descriptions-item label="记录编号" :span="2">{{ detail.record_no }}</el-descriptions-item>
        <el-descriptions-item label="船舶">{{ detail.ship_name }}</el-descriptions-item>
        <el-descriptions-item label="接口">{{ detail.interface_name }}</el-descriptions-item>
        <el-descriptions-item label="接电读数" style="color:#67c23a">{{ detail.connect_reading }}</el-descriptions-item>
        <el-descriptions-item label="断电读数" style="color:#f56c6c">{{ detail.disconnect_reading }}</el-descriptions-item>
        <el-descriptions-item label="接电时间" :span="2">{{ detail.connect_time }}</el-descriptions-item>
        <el-descriptions-item label="断电时间" :span="2">{{ detail.disconnect_time }}</el-descriptions-item>
        <el-descriptions-item label="异常描述" :span="2">{{ detail.description }}</el-descriptions-item>
      </el-descriptions>
      <el-form :model="form" label-width="120px" ref="formRef" :rules="rules">
        <el-form-item label="处理结果" prop="handle_result">
          <el-radio-group v-model="form.handle_result">
            <el-radio value="manual_correct">人工修正读数</el-radio>
            <el-radio value="confirm">按异常数据结算</el-radio>
            <el-radio value="cancel">取消该接电记录</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.handle_result === 'manual_correct'" label="修正后断电读数" prop="corrected_disconnect_reading">
          <el-input-number v-model="form.corrected_disconnect_reading" :min="0" :precision="2" @change="calcConsumption" />
          <span style="margin-left:8px; color:#909399; font-size:12px">电表实际读数</span>
        </el-form-item>
        <el-form-item v-if="form.handle_result === 'manual_correct'" label="实际用电量(kWh)">
          <el-input :model-value="autoCalcConsumption" disabled />
          <span style="margin-left:8px; color:#67c23a; font-size:12px">系统自动计算</span>
        </el-form-item>
        <el-form-item v-if="form.handle_result === 'confirm'" label="结算用电量(kWh)" prop="corrected_consumption">
          <el-input-number v-model="form.corrected_consumption" :min="0" :precision="2" :step="1" />
          <span style="margin-left:8px; color:#909399; font-size:12px">人工判定的结算电量</span>
        </el-form-item>
        <el-form-item label="处理人"><el-input v-model="form.handled_by" placeholder="如：电工班长" /></el-form-item>
        <el-form-item label="处理说明"><el-input v-model="form.handle_remark" type="textarea" rows="2" placeholder="详细说明处理情况" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">提交处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { api } from '../api'
import { ElMessage } from 'element-plus'

const list = ref([])
const statusFilter = ref('')
const typeMap = { reading_reverse: '读数反转', meter_fault: '电表故障', manual_abnormal: '人工标记' }
const resultMap = { manual_correct: '人工修正', confirm: '异常结算', cancel: '已取消' }
const resultType = { manual_correct: 'warning', confirm: 'primary', cancel: 'info' }

const handleVisible = ref(false)
const detail = ref(null)
const formRef = ref()
const form = reactive({ handle_result: '', corrected_consumption: 0, corrected_disconnect_reading: null, handled_by: '', handle_remark: '' })

const autoCalcConsumption = computed(() => {
  if (form.handle_result === 'manual_correct' && form.corrected_disconnect_reading != null && detail.value) {
    const diff = Number((form.corrected_disconnect_reading - detail.value.connect_reading).toFixed(2))
    return diff > 0 ? diff : 0
  }
  return 0
})

const calcConsumption = () => {
  if (form.handle_result === 'manual_correct') {
    form.corrected_consumption = autoCalcConsumption.value
  }
}

const rules = {
  handle_result: [{ required: true, message: '请选择处理结果', trigger: 'change' }],
  corrected_consumption: [
    {
      validator: (_rule, value, cb) => {
        if (form.handle_result === 'confirm' && (value === null || value === undefined || value <= 0)) {
          cb(new Error('请输入结算用电量（kWh）'))
        } else cb()
      }, trigger: 'blur'
    }
  ],
  corrected_disconnect_reading: [
    {
      validator: (_rule, value, cb) => {
        if (form.handle_result === 'manual_correct' && (value === null || value === undefined || value < 0)) {
          cb(new Error('请输入修正后的断电读数'))
        } else cb()
      }, trigger: 'blur'
    }
  ]
}

const load = async () => {
  const res = await api.abnormal.list({ status: statusFilter.value })
  list.value = res.data
}

const openHandleDialog = async (row) => {
  const res = await api.abnormal.get(row.id)
  detail.value = res.data
  Object.assign(form, { handle_result: '', corrected_consumption: 0, corrected_disconnect_reading: null, handled_by: '', handle_remark: '' })
  handleVisible.value = true
}

const submitHandle = async () => {
  await formRef.value.validate()
  const payload = {
    handled_by: form.handled_by,
    handle_remark: form.handle_remark
  }
  if (form.handle_result === 'manual_correct') {
    payload.new_disconnect_reading = form.corrected_disconnect_reading
    await api.abnormal.correct(detail.value.id, payload)
  } else if (form.handle_result === 'confirm') {
    payload.power_consumption = form.corrected_consumption
    await api.abnormal.settle(detail.value.id, payload)
  } else if (form.handle_result === 'cancel') {
    await api.abnormal.cancel(detail.value.id, payload)
  }
  ElMessage.success('处理完成')
  handleVisible.value = false
  load()
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-title { font-size: 16px; font-weight: 600; }
</style>
