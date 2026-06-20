<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="logo">
        <el-icon :size="28" color="#fff"><Lightning /></el-icon>
        <span class="title">港区岸电接入计费系统</span>
      </div>
      <div class="nav">
        <router-link to="/">首页</router-link>
        <router-link to="/ships">船舶管理</router-link>
        <router-link to="/interfaces">供电接口</router-link>
        <router-link to="/meters">电表管理</router-link>
        <router-link to="/applications">接电申请</router-link>
        <router-link to="/records">接电登记</router-link>
        <router-link to="/bills">财务结算</router-link>
        <router-link to="/abnormal">异常处理</router-link>
        <router-link to="/renewals">续费管理</router-link>
        <router-link to="/tariffs">费率设置</router-link>
      </div>
    </el-header>
    <el-main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>
    <el-footer class="app-footer">
      <span>© 2026 港区岸电接入计费系统</span>
    </el-footer>
  </el-container>
</template>

<script setup>
import { Lightning } from '@element-plus/icons-vue'
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f0f2f5; }

.app-container { height: 100vh; }
.app-header {
  background: linear-gradient(90deg, #1e3a8a, #2563eb);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  color: #fff;
  height: 60px !important;
}
.logo { display: flex; align-items: center; gap: 10px; }
.logo .title { font-size: 18px; font-weight: 600; }
.nav { display: flex; gap: 4px; }
.nav a {
  color: rgba(255,255,255,0.85);
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.2s;
}
.nav a:hover { background: rgba(255,255,255,0.15); color: #fff; }
.nav a.router-link-active { background: rgba(255,255,255,0.22); color: #fff; }

.app-main { background: #f0f2f5; padding: 16px; overflow-y: auto; }
.app-footer {
  background: #fff;
  text-align: center;
  color: #909399;
  font-size: 12px;
  height: 40px !important;
  line-height: 40px;
  border-top: 1px solid #ebeef5;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
