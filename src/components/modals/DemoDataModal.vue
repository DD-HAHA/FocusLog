<template>
  <div class="modal-overlay" @click.self="isDemoDataModalOpen = false">
    <div class="modal modal--sm">
      <header class="modal__header">
        <h2 class="modal__title modal__title--mb-sm"><LayoutDashboard :size="18" color="var(--green-500)" /><span>体验数据</span></h2>
        <button type="button" class="modal__close" @click="isDemoDataModalOpen = false" aria-label="关闭">&times;</button>
      </header>
      <p class="modal__desc">一键生成过去半年的 PM 示例任务与存档。</p>
      <div style="display:flex;flex-direction:column;gap:16px;">
        <button type="button" :disabled="seedDemoLoading || clearDemoLoading" @click="seedDemoData" class="demo-btn demo-btn--seed">
          {{ seedDemoLoading ? '生成中...' : '生成示例数据' }}
        </button>
        <button type="button" :disabled="seedDemoLoading || clearDemoLoading" @click="clearDemoData" class="demo-btn demo-btn--clear">
          {{ clearDemoLoading ? '清除中...' : '一键清除体验数据' }}
        </button>
        <p v-if="seedDemoMessage" :class="['demo-msg', seedDemoMessage.includes('失败') ? 'demo-msg--err' : 'demo-msg--ok']">{{ seedDemoMessage }}</p>
      </div>
    </div>
  </div>
</template>
<script setup>
import { LayoutDashboard } from 'lucide-vue-next';
import { isDemoDataModalOpen, seedDemoLoading, clearDemoLoading, seedDemoMessage, seedDemoData, clearDemoData } from '../../composables/useDemoData.js';
</script>
