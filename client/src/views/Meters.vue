<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="page-title">电表管理</span>
          <el-button type="primary" @click="openDialog()">新增电表</el-button>
        </div>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="meter_code" label="电表编号" width="120" />
        <el-table-column prop="meter_name" label="电表名称" />
        <el-table-column prop="interface_name" label="所属接口" width="140" />
        <el-table-column prop="initial_reading" label="初始读数" width="110" />
        <el-table-column prop="current_reading" label="当前读数" width="110" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'normal' ? 'success' : 'danger'">{{ row.status === 'normal' ? '正常' : '故障' }}</el-tag>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑电表' : '新增电表'" width="520px">
      <el-form :model="form" label-width="110px" ref="formRef" :rules="rules">
        <el-form-item label="电表编号" prop="meter_code"><el-input v-model="form.meter_code" /></el-form-item>
        <el-form-item label="电表名称" prop="meter_name"><el-input v-model="form.meter_name" /></el-form-item>
        <el-form-item label="所属接口">
          <el-select v-model="form.interface_id" placeholder="请选择接口" clearable style="width:100%">
            <el-option v-for="i in interfaceList" :key="i.id" :label="`${i.interface_code} - ${i.interface_name}`" :value="i.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="初始读数"><el-input-number v-model="form.initial_reading" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="正常" value="normal" />
            <el-option label="故障" value="fault" />
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
const interfaceList = ref([])
const dialogVisible = ref(false)
const formRef = ref()
const form = reactive({ id: null, meter_code: '', meter_name: '', interface_id: null, initial_reading: 0, status: 'normal', remark: '' })
const rules = {
  meter_code: [{ required: true, message: '请输入电表编号', trigger: 'blur' }],
  meter_name: [{ required: true, message: '请输入电表名称', trigger: 'blur' }]
}

const resetForm = () => Object.assign(form, { id: null, meter_code: '', meter_name: '', interface_id: null, initial_reading: 0, status: 'normal', remark: '' })

const load = async () => {
  const [m, i] = await Promise.all([api.meters.list(), api.interfaces.list()])
  list.value = m.data
  interfaceList.value = i.data
}

const openDialog = (row) => {
  resetForm()
  if (row) Object.assign(form, row)
  dialogVisible.value = true
}

const save = async () => {
  await formRef.value.validate()
  if (form.id) {
    await api.meters.update(form.id, form)
    ElMessage.success('更新成功')
  } else {
    await api.meters.create(form)
    ElMessage.success('新增成功')
  }
  dialogVisible.value = false
  load()
}

const remove = async (row) => {
  await ElMessageBox.confirm(`确定删除电表「${row.meter_name}」吗？`, '提示', { type: 'warning' })
  await api.meters.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-title { font-size: 16px; font-weight: 600; }
</style>
