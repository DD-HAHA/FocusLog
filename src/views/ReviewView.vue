<template>
  <div class="view-container">
    <header class="view-header">
      <h1 class="view-title">回顾中心</h1>
      <p class="view-subtitle">选择时间范围，基于任务与日记生成周报 / 月报回顾</p>
    </header>
    <div style="display:flex;flex-direction:column;gap:24px;">
      <div class="review-grid">
        <div class="form-group">
          <label class="form-label">开始日期</label>
          <input type="date" v-model="reviewStartDate" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">结束日期</label>
          <input type="date" v-model="reviewEndDate" class="form-input" />
        </div>
      </div>
      <div class="review-actions">
        <button @click="generateReviewReport" class="btn-white">
          <Sparkles :size="16" />
          生成回顾报告
        </button>
        <span v-if="reviewStatsText" class="review-stats">{{ reviewStatsText }}</span>
      </div>
      <div class="review-box">
        <div v-if="reviewLoading" class="review-loading">
          <Loader2 :size="22" class="spinner" />
          <p style="color:var(--text-500);">AI 正在生成阶段性回顾...</p>
        </div>
        <div v-else-if="reviewError"       class="review-error">{{ reviewError }}</div>
        <div v-else-if="reviewContent"     class="review-content">{{ reviewContent }}</div>
        <div v-else                         class="review-placeholder">请选择日期范围并点击「生成回顾报告」。</div>
      </div>
      <div v-if="reviewContent" class="review-save-row">
        <div class="form-group" style="flex:1;">
          <label class="form-label">保存为文件名</label>
          <input type="text" v-model="reviewFileName" placeholder="例如：Weekly_2024_W43.md（留空则自动生成）" class="form-input" />
        </div>
        <button @click="$emit('saveReview')" class="btn-purple">保存为 Markdown</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { Sparkles, Loader2 } from 'lucide-vue-next';
import { reviewStartDate, reviewEndDate, reviewLoading, reviewError, reviewContent, reviewFileName, reviewStatsText, generateReviewReport } from '../composables/useAI.js';
defineEmits(['saveReview']);
</script>
