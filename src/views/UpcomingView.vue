<template>
  <div class="view-container">
    <header class="view-header">
      <h1 class="view-title">未来规划</h1>
      <p class="view-subtitle">查看已经推迟或预定在未来的任务</p>
    </header>
    <div v-if="upcomingGroups.length === 0" class="empty-state">
      <div class="empty-state__icon"><CalendarClock :size="40" /></div>
      <p class="empty-state__text">暂无未来规划的任务</p>
    </div>
    <div v-for="group in upcomingGroups" :key="group.date" style="margin-bottom: 40px;">
      <div class="date-divider">
        <div class="section-divider__line"></div>
        <span class="date-divider__label">{{ group.label }}</span>
        <div class="section-divider__line"></div>
      </div>
      <div class="todo-list">
        <div v-for="todo in group.todos" :key="todo.id" class="upcoming-item">
          <button class="btn-move-today" @click.stop="moveToToday(todo)" title="移回今日">移至今日</button>
          <div class="todo-body">
            <span class="todo-text">{{ todo.text }}</span>
            <div v-if="getTagsForTodo(todo).length" class="tag-badge-list">
              <span v-for="tag in getTagsForTodo(todo)" :key="tag.id" class="tag-badge" :style="{ borderColor: tag.color, color: tag.color }">{{ tag.name }}</span>
            </div>
          </div>
          <button class="todo-action-btn todo-action-btn--delete" @click.stop="handleDelete(todo.id)"><Trash2 :size="15" /></button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { Trash2, CalendarClock } from 'lucide-vue-next';
import { upcomingGroups, deleteTodo, moveToToday, getTagsForTodo } from '../composables/useTodos.js';

const props = defineProps({
  showToast: { type: Function, default: null }
});

function handleDelete(id) {
  deleteTodo(id, props.showToast);
}
</script>
