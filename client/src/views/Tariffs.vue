<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="page-title">费率设置</span>
          <el-button type="primary" @click="openDialog()">新增费率</el-button>
        </div>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="rate_code" label="费率编号" width="130" />
        <el-table-column prop="rate_name" label="费率名称" />
        <el-table-column label="单价(元/kWh)" width="140">
          <template #default="{ row }">¥ {{ row.price_per_kwh?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="effective_date" label="生效日期" width="140" />
        <el-table-column label="默认" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.is_default" type="danger">默认</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑费率' : '新增费率'" width="500px">
      <el-form :model="form" label-width="110px" ref="formRef" :rules="rules">
        <el-form-item label="费率编号" prop="rate_code"><el-input v-model="form.rate_code" /></el-form-item>
        <el-form-item label="费率名称" prop="rate_name"><el-input v-model="form.rate_name" /></el-form-item>
        <el-form-item label="单价(元/kWh)" prop="price_per_kwh"><el-input-number v-model="form.price_per_kwh" :min="0" :precision="2" :step="0.1" /></el-form-item>
        <el-form-item label="生效日期"><el-date-picker v-model="form.effective_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="默认费率">
          <el-switch v-model="form.is_default" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { api } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const dialogVisible = ref(false)
const formRef = ref()
const form = reactive({ id: null, rate_code: '', rate_name: '', price_per_kwh: 0, effective_date: '', is_default: 0, remark: '' })
const rules = {
  rate_code: [{ required: true, message: '请输入费率编号', trigger: 'blur' }],
  rate_name: [{ required: true, message: '请输入费率名称', trigger: 'blur' }],
  price_per_kwh: [{ required: true, message: '请输入单价', trigger: 'blur' }]
}

const resetForm = () => Object.assign(form, { id: null, rate_code: '', rate_name: '', price_per_kwh: 0, effective_date: '', is_default: 0, remark: '' })

const load = async () => {
  const res = await api.tariffs.list()
  list.value = res.data
}

const openDialog = (row) => {
  resetForm()
  if (row) Object.assign(form, row)
  dialogVisible.value = true
}

const save = async () => {
  await formRef.value.validate()
  if (form.id) {
    await api.tariffs.update(form.id, form)
    ElMessage.success('更新成功')
  } else {
    await api.tariffs.create(form)
    ElMessage.success('新增成功')
  }
  dialogVisible.value = false
  load()
}

const remove = async (row) => {
  await ElMessageBox.confirm(`确定删除费率「${row.rate_name}」吗？`, '提示', { type: 'warning' })
  await api.tariffs.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-title { font-size: 16px; font-weight: 600; }
</style>
