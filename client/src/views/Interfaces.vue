<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="page-title">供电接口管理</span>
          <div>
            <el-select v-model="statusFilter" placeholder="状态" style="width:130px; margin-right:8px" clearable @change="load">
              <el-option label="可用" value="available" />
              <el-option label="使用中" value="in_use" />
              <el-option label="停用" value="disabled" />
            </el-select>
            <el-input v-model="keyword" placeholder="搜索编号/名称/位置" style="width: 220px; margin-right: 8px;" clearable @input="load" />
            <el-button type="primary" @click="openDialog()">新增接口</el-button>
          </div>
        </div>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="interface_code" label="接口编号" width="120" />
        <el-table-column prop="interface_name" label="接口名称" />
        <el-table-column prop="location" label="位置" width="140" />
        <el-table-column prop="max_capacity" label="最大容量(kW)" width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType[row.status]">{{ statusMap[row.status] }}</el-tag>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑接口' : '新增接口'" width="520px">
      <el-form :model="form" label-width="110px" ref="formRef" :rules="rules">
        <el-form-item label="接口编号" prop="interface_code"><el-input v-model="form.interface_code" /></el-form-item>
        <el-form-item label="接口名称" prop="interface_name"><el-input v-model="form.interface_name" /></el-form-item>
        <el-form-item label="位置"><el-input v-model="form.location" placeholder="如：A泊位" /></el-form-item>
        <el-form-item label="最大容量(kW)" prop="max_capacity"><el-input-number v-model="form.max_capacity" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="可用" value="available" />
            <el-option label="使用中" value="in_use" />
            <el-option label="停用" value="disabled" />
          </el-select>
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
const keyword = ref('')
const statusFilter = ref('')
const dialogVisible = ref(false)
const formRef = ref()
const form = reactive({ id: null, interface_code: '', interface_name: '', location: '', max_capacity: 0, status: 'available', remark: '' })
const statusMap = { available: '可用', in_use: '使用中', disabled: '停用' }
const statusType = { available: 'success', in_use: 'primary', disabled: 'info' }
const rules = {
  interface_code: [{ required: true, message: '请输入接口编号', trigger: 'blur' }],
  interface_name: [{ required: true, message: '请输入接口名称', trigger: 'blur' }],
  max_capacity: [{ required: true, message: '请输入最大容量', trigger: 'blur' }]
}

const resetForm = () => Object.assign(form, { id: null, interface_code: '', interface_name: '', location: '', max_capacity: 0, status: 'available', remark: '' })

const load = async () => {
  const res = await api.interfaces.list({ keyword: keyword.value, status: statusFilter.value })
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
    await api.interfaces.update(form.id, form)
    ElMessage.success('更新成功')
  } else {
    await api.interfaces.create(form)
    ElMessage.success('新增成功')
  }
  dialogVisible.value = false
  load()
}

const remove = async (row) => {
  await ElMessageBox.confirm(`确定删除接口「${row.interface_name}」吗？`, '提示', { type: 'warning' })
  await api.interfaces.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-title { font-size: 16px; font-weight: 600; }
</style>
