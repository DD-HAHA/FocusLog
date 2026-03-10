<template>
  <div class="view-container">
    <header class="view-header">
      <h1 class="view-title">历史回顾</h1>
      <p class="view-subtitle">查看所有已完成的任务</p>
    </header>
    <div v-if="historyGroups.length === 0" class="empty-state">
      <div class="empty-state__icon"><Archive :size="40" /></div>
      <p class="empty-state__text">暂无历史记录</p>
    </div>
    <div v-for="group in historyGroups" :key="group.date" style="margin-bottom: 40px;">
      <div class="date-divider">
        <div class="section-divider__line"></div>
        <span class="date-divider__label">{{ group.label }}</span>
        <div class="section-divider__line"></div>
      </div>
      <div class="todo-list">
        <div v-for="todo in group.todos" :key="todo.id" :class="['history-item', todo.completed ? 'history-item--done' : 'history-item--active']">
          <div :class="['history-tick', todo.completed ? 'history-tick--checked' : 'history-tick--unchecked']">
            <Check v-if="todo.completed" :size="12" color="white" />
          </div>
          <span :class="['history-text', todo.completed ? 'history-text--done' : 'history-text--active']">{{ todo.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { Archive, Check } from 'lucide-vue-next';
import { todos } from '../composables/useTodos.js';
import { formatDateLabel } from '../composables/useDateHelpers.js';

const historyGroups = computed(() => {
  const groups = {};
  for (const t of todos.value) {
    const date = t.created_at.slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(t);
  }
  return Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(date => ({ date, label: formatDateLabel(date), todos: groups[date] }));
});
</script>
