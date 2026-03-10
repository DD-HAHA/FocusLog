<template>
  <div class="view-container">
    <header class="view-header">
      <h1 class="view-title">总结存档</h1>
      <p class="view-subtitle">AI 生成的工作日志存档</p>
    </header>
    <div v-if="archives.length === 0" class="empty-state">
      <div class="empty-state__icon"><Sparkles :size="40" /></div>
      <p class="empty-state__text">暂无存档，请先生成今日总结并保存</p>
    </div>
    <div v-for="arc in archives" :key="arc.id" class="archive-item">
      <div class="archive-item__header">
        <span class="archive-item__date">{{ arc.date }}</span>
        <button @click="deleteArchive(arc.id)" class="todo-action-btn todo-action-btn--delete"><Trash2 :size="14" /></button>
      </div>
      <div class="archive-item__content">{{ arc.content }}</div>
    </div>
  </div>
</template>
<script setup>
import { Sparkles, Trash2 } from 'lucide-vue-next';
import { archives, deleteArchive } from '../composables/useArchives.js';
</script>
