<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="page-title">船舶管理</span>
          <div>
            <el-input v-model="keyword" placeholder="搜索编号/名称/IMO" style="width: 220px; margin-right: 8px;" clearable @input="load" />
            <el-button type="primary" @click="openDialog()">新增船舶</el-button>
          </div>
        </div>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="ship_code" label="船舶编号" width="120" />
        <el-table-column prop="ship_name" label="船舶名称" />
        <el-table-column prop="ship_type" label="船舶类型" width="110" />
        <el-table-column prop="capacity" label="容量(kW)" width="110" />
        <el-table-column prop="imo" label="IMO编号" width="130" />
        <el-table-column prop="contact_person" label="联系人" width="100" />
        <el-table-column prop="contact_phone" label="联系电话" width="130" />
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑船舶' : '新增船舶'" width="540px">
      <el-form :model="form" label-width="100px" ref="formRef" :rules="rules">
        <el-form-item label="船舶编号" prop="ship_code"><el-input v-model="form.ship_code" /></el-form-item>
        <el-form-item label="船舶名称" prop="ship_name"><el-input v-model="form.ship_name" /></el-form-item>
        <el-form-item label="船舶类型">
          <el-select v-model="form.ship_type" placeholder="请选择" clearable style="width:100%">
            <el-option label="货轮" value="货轮" />
            <el-option label="邮轮" value="邮轮" />
            <el-option label="集装箱船" value="集装箱船" />
            <el-option label="油轮" value="油轮" />
            <el-option label="散货船" value="散货船" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="容量(kW)" prop="capacity"><el-input-number v-model="form.capacity" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="IMO编号"><el-input v-model="form.imo" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="form.contact_person" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.contact_phone" /></el-form-item>
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
const dialogVisible = ref(false)
const formRef = ref()
const form = reactive({ id: null, ship_code: '', ship_name: '', ship_type: '', capacity: 0, imo: '', contact_person: '', contact_phone: '', remark: '' })
const rules = {
  ship_code: [{ required: true, message: '请输入船舶编号', trigger: 'blur' }],
  ship_name: [{ required: true, message: '请输入船舶名称', trigger: 'blur' }],
  capacity: [{ required: true, message: '请输入容量', trigger: 'blur' }]
}

const resetForm = () => Object.assign(form, { id: null, ship_code: '', ship_name: '', ship_type: '', capacity: 0, imo: '', contact_person: '', contact_phone: '', remark: '' })

const load = async () => {
  const res = await api.ships.list({ keyword: keyword.value })
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
    await api.ships.update(form.id, form)
    ElMessage.success('更新成功')
  } else {
    await api.ships.create(form)
    ElMessage.success('新增成功')
  }
  dialogVisible.value = false
  load()
}

const remove = async (row) => {
  await ElMessageBox.confirm(`确定删除船舶「${row.ship_name}」吗？`, '提示', { type: 'warning' })
  await api.ships.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-title { font-size: 16px; font-weight: 600; }
</style>
