import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('../views/Dashboard.vue'), meta: { title: '首页' } },
  { path: '/ships', component: () => import('../views/Ships.vue'), meta: { title: '船舶管理' } },
  { path: '/interfaces', component: () => import('../views/Interfaces.vue'), meta: { title: '供电接口' } },
  { path: '/meters', component: () => import('../views/Meters.vue'), meta: { title: '电表管理' } },
  { path: '/applications', component: () => import('../views/Applications.vue'), meta: { title: '接电申请' } },
  { path: '/records', component: () => import('../views/Records.vue'), meta: { title: '接电登记' } },
  { path: '/bills', component: () => import('../views/Bills.vue'), meta: { title: '财务结算' } },
  { path: '/abnormal', component: () => import('../views/Abnormal.vue'), meta: { title: '异常处理' } },
  { path: '/tariffs', component: () => import('../views/Tariffs.vue'), meta: { title: '费率设置' } }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.afterEach((to) => {
  document.title = (to.meta?.title ? to.meta.title + ' - ' : '') + '港区岸电接入计费系统'
})

export default router
