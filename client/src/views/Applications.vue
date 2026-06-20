<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="page-title">接电申请</span>
          <div>
            <el-select v-model="statusFilter" placeholder="状态" style="width:130px; margin-right:8px" clearable @change="load">
              <el-option v-for="(v, k) in appStatusMap" :key="k" :label="v" :value="k" />
            </el-select>
            <el-input v-model="keyword" placeholder="搜索申请编号/船舶" style="width: 220px; margin-right: 8px;" clearable @input="load" />
            <el-button type="primary" @click="openDialog()">提交申请</el-button>
          </div>
        </div>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="app_no" label="申请编号" width="170" />
        <el-table-column prop="ship_name" label="船舶" width="120" />
        <el-table-column label="船舶容量(kW)" width="120" prop="ship_capacity" />
        <el-table-column prop="berth_time" label="靠泊时间" width="170" />
        <el-table-column prop="expected_power" label="预计用电(kWh)" width="130" />
        <el-table-column prop="applicant" label="申请人" width="100" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="appStatusType[row.status]">{{ appStatusMap[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button size="small" type="primary" @click="openDialog(row)">编辑</el-button>
              <el-button size="small" type="success" @click="approve(row)">通过</el-button>
              <el-button size="small" type="warning" @click="reject(row)">驳回</el-button>
            </template>
            <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑申请' : '提交接电申请'" width="560px">
      <el-form :model="form" label-width="110px" ref="formRef" :rules="rules">
        <el-form-item label="选择船舶" prop="ship_id">
          <el-select v-model="form.ship_id" placeholder="请选择船舶" style="width:100%" filterable @change="onShipChange">
            <el-option v-for="s in shipList" :key="s.id" :label="`${s.ship_code} - ${s.ship_name} (${s.capacity}kW)`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="靠泊时间" prop="berth_time">
          <el-date-picker v-model="form.berth_time" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" />
        </el-form-item>
        <el-form-item label="预计用电(kWh)">
          <el-input-number v-model="form.expected_power" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="预计时长(小时)">
          <el-input-number v-model="form.expected_duration" :min="0" :precision="1" />
        </el-form-item>
        <el-form-item label="申请人"><el-input v-model="form.applicant" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.applicant_phone" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { api } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const shipList = ref([])
const keyword = ref('')
const statusFilter = ref('')
const dialogVisible = ref(false)
const formRef = ref()
const form = reactive({ id: null, ship_id: null, berth_time: '', expected_power: 0, expected_duration: 0, applicant: '', applicant_phone: '', remark: '' })

const appStatusMap = { pending: '待审批', approved: '已通过', rejected: '已驳回', connected: '接电中', billed: '已结算' }
const appStatusType = { pending: 'warning', approved: 'success', rejected: 'danger', connected: 'primary', billed: 'info' }

const rules = {
  ship_id: [{ required: true, message: '请选择船舶', trigger: 'change' }],
  berth_time: [{ required: true, message: '请选择靠泊时间', trigger: 'change' }]
}

const resetForm = () => Object.assign(form, { id: null, ship_id: null, berth_time: '', expected_power: 0, expected_duration: 0, applicant: '', applicant_phone: '', remark: '' })
const onShipChange = () => {}

const load = async () => {
  const [a, s] = await Promise.all([api.applications.list({ keyword: keyword.value, status: statusFilter.value }), api.ships.list()])
  list.value = a.data
  shipList.value = s.data
}

const openDialog = (row) => {
  resetForm()
  if (row) Object.assign(form, row)
  dialogVisible.value = true
}

const save = async () => {
  await formRef.value.validate()
  if (form.id) {
    await api.applications.update(form.id, form)
    ElMessage.success('更新成功')
  } else {
    await api.applications.create(form)
    ElMessage.success('申请提交成功')
  }
  dialogVisible.value = false
  load()
}

const approve = async (row) => {
  await ElMessageBox.confirm(`确定通过申请「${row.app_no}」吗？`, '审批通过', { type: 'success' })
  await api.applications.approve(row.id)
  ElMessage.success('已通过')
  load()
}

const reject = async (row) => {
  const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回申请', { confirmButtonText: '确定', cancelButtonText: '取消', inputPlaceholder: '驳回原因' })
  await api.applications.reject(row.id, { remark: value })
  ElMessage.success('已驳回')
  load()
}

const remove = async (row) => {
  await ElMessageBox.confirm(`确定删除申请「${row.app_no}」吗？`, '提示', { type: 'warning' })
  try {
    await api.applications.remove(row.id)
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
