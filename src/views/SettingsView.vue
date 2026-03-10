<template>
  <div style="max-width:768px; padding: 0 24px;">
    <header class="view-header">
      <h1 class="view-title">设置</h1>
      <p class="view-subtitle">配置 API 供应商及自定义 AI 提示词</p>
    </header>
    <div class="settings-grid">
      <div @click="isApiSettingsOpen = true" class="settings-card settings-card--purple">
        <div class="settings-card__icon settings-card__icon--purple"><KeyRound :size="20" color="var(--purple-400)" /></div>
        <h3 class="settings-card__title">API 设置</h3>
        <p class="settings-card__desc">配置供应商、密钥及模型名称</p>
      </div>
      <div @click="openDailyPrompt" class="settings-card settings-card--orange">
        <div class="settings-card__icon settings-card__icon--orange"><Sparkles :size="20" color="var(--orange-400)" /></div>
        <h3 class="settings-card__title">AI 日志提示词</h3>
        <p class="settings-card__desc">自定义每日总结的系统 Prompt</p>
      </div>
      <div @click="openReviewPrompt" class="settings-card settings-card--cyan">
        <div class="settings-card__icon settings-card__icon--cyan"><Archive :size="20" color="var(--cyan-400)" /></div>
        <h3 class="settings-card__title">AI 归档提示词</h3>
        <p class="settings-card__desc">自定义回顾报告的系统 Prompt</p>
      </div>
      <div @click="isDemoDataModalOpen = true" class="settings-card settings-card--green">
        <div class="settings-card__icon settings-card__icon--green"><LayoutDashboard :size="20" color="var(--green-400)" /></div>
        <h3 class="settings-card__title">体验数据</h3>
        <p class="settings-card__desc">一键生成示例任务与存档体验完整的应用工作流</p>
      </div>
    </div>
  </div>
</template>
<script setup>
import { KeyRound, Sparkles, Archive, LayoutDashboard } from 'lucide-vue-next';
import { isApiSettingsOpen, openDailyPrompt, openReviewPrompt } from '../composables/useSettings.js';
import { isDemoDataModalOpen } from '../composables/useDemoData.js';
</script>
