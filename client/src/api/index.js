import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

request.interceptors.response.use(
  (res) => {
    const data = res.data
    if (data.code !== undefined && data.code !== 0) {
      ElMessage.error(data.message || '请求失败')
      return Promise.reject(data)
    }
    return data
  },
  (err) => {
    const msg = err.response?.data?.message || err.message || '网络错误'
    ElMessage.error(msg)
    return Promise.reject(err)
  }
)

export const api = {
  ships: {
    list: (params) => request.get('/ships', { params }),
    get: (id) => request.get(`/ships/${id}`),
    create: (data) => request.post('/ships', data),
    update: (id, data) => request.put(`/ships/${id}`, data),
    remove: (id) => request.delete(`/ships/${id}`)
  },
  interfaces: {
    list: (params) => request.get('/interfaces', { params }),
    available: () => request.get('/interfaces/available'),
    get: (id) => request.get(`/interfaces/${id}`),
    create: (data) => request.post('/interfaces', data),
    update: (id, data) => request.put(`/interfaces/${id}`, data),
    remove: (id) => request.delete(`/interfaces/${id}`)
  },
  meters: {
    list: () => request.get('/meters'),
    get: (id) => request.get(`/meters/${id}`),
    create: (data) => request.post('/meters', data),
    update: (id, data) => request.put(`/meters/${id}`, data),
    remove: (id) => request.delete(`/meters/${id}`)
  },
  applications: {
    list: (params) => request.get('/applications', { params }),
    get: (id) => request.get(`/applications/${id}`),
    create: (data) => request.post('/applications', data),
    update: (id, data) => request.put(`/applications/${id}`, data),
    approve: (id) => request.post(`/applications/${id}/approve`),
    reject: (id, data) => request.post(`/applications/${id}/reject`, data),
    remove: (id) => request.delete(`/applications/${id}`)
  },
  records: {
    list: (params) => request.get('/records', { params }),
    get: (id) => request.get(`/records/${id}`),
    connect: (data) => request.post('/records/connect', data),
    disconnect: (id, data) => request.post(`/records/${id}/disconnect`, data),
    remove: (id) => request.delete(`/records/${id}`)
  },
  bills: {
    list: (params) => request.get('/bills', { params }),
    get: (id) => request.get(`/bills/${id}`),
    generate: (data) => request.post('/bills', data),
    update: (id, data) => request.put(`/bills/${id}`, data),
    confirm: (id, data) => request.post(`/bills/${id}/confirm`, data),
    void: (id, data) => request.post(`/bills/${id}/void`, data)
  },
  abnormal: {
    list: (params) => request.get('/abnormal', { params }),
    get: (id) => request.get(`/abnormal/${id}`),
    correct: (id, data) => request.post(`/abnormal/${id}/correct`, data),
    settle: (id, data) => request.post(`/abnormal/${id}/settle`, data),
    cancel: (id, data) => request.post(`/abnormal/${id}/cancel`, data)
  },
  tariffs: {
    list: () => request.get('/tariffs'),
    getDefault: () => request.get('/tariffs/default'),
    create: (data) => request.post('/tariffs', data),
    update: (id, data) => request.put(`/tariffs/${id}`, data),
    remove: (id) => request.delete(`/tariffs/${id}`)
  },
  renewals: {
    list: (params) => request.get('/renewals', { params }),
    get: (id) => request.get(`/renewals/${id}`),
    create: (data) => request.post('/renewals', data),
    update: (id, data) => request.put(`/renewals/${id}`, data),
    confirm: (id, data) => request.post(`/renewals/${id}/confirm`, data),
    applyExtension: (data) => request.post('/renewals/apply-extension', data),
    remove: (id) => request.delete(`/renewals/${id}`)
  }
}

export default request
