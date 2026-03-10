<template>
  <div v-if="isSummaryOpen" class="drawer-overlay" @click="isSummaryOpen = false"></div>
  <div :class="['drawer', isSummaryOpen ? 'drawer--open' : 'drawer--closed']">
    <div class="drawer__header">
      <h2 class="drawer__title"><Sparkles :size="20" color="var(--purple-500)" /><span>AI 日志生成</span></h2>
      <button @click="isSummaryOpen = false" class="drawer__close">✕</button>
    </div>
    <div class="drawer__body">
      <div v-if="summaryLoading" class="drawer__center">
        <Loader2 :size="24" class="spinner" />
        <p class="drawer__loading">AI 正在生成工作日志...</p>
      </div>
      <div v-else-if="summaryError" class="drawer__center">
        <p class="drawer__error">{{ summaryError }}</p>
        <button v-if="!apiKey" @click="$emit('goToSettings')" class="btn-text" style="font-size:.75rem;color:var(--purple-400);text-decoration:underline;">前往设置</button>
      </div>
      <div v-else-if="summaryContent" class="drawer__content">{{ summaryContent }}</div>
      <div v-else class="drawer__center"><p class="drawer__placeholder">点击下方按钮生成今日总结</p></div>
    </div>
    <button v-if="summaryContent && !summaryLoading" @click="$emit('saveArchive')" class="btn-purple btn-purple--lg" style="margin-top:24px;">
      <span>保存为 Markdown 存档</span>
    </button>
  </div>
</template>
<script setup>
import { Sparkles, Loader2 } from 'lucide-vue-next';
import { isSummaryOpen, summaryContent, summaryLoading, summaryError } from '../composables/useAI.js';
import { apiKey } from '../composables/useSettings.js';
defineEmits(['saveArchive', 'goToSettings']);
</script>
