<template>
  <aside class="sidebar">
    <div class="sidebar__logo">
      <img src="../assets/logo_simple_padded.png" alt="FocusLog Logo" class="logo-image" />
      <span class="logo-text">FocusLog</span>
    </div>

    <nav class="sidebar__nav">
      <div
        v-for="tab in tabs" :key="tab.id"
        @click="$emit('update:currentView', tab.id)"
        :class="['nav-item', currentView === tab.id && 'nav-item--active']"
      >
        <component :is="tab.icon" :size="18" />
        <span>{{ tab.label }}</span>
      </div>
    </nav>

    <!-- Theme toggle -->
    <button type="button" class="theme-toggle-btn" @click="toggleTheme" :title="isDark ? '切换到浅色模式' : '切换到深色模式'">
      <component :is="isDark ? Sun : Moon" :size="15" />
      <span>{{ isDark ? '浅色模式' : '深色模式' }}</span>
    </button>

    <div class="sidebar__tags">
      <div class="section-header">
        <span>标签</span>
        <button v-if="activeTagFilterId" type="button" class="section-clear" @click="clearTagFilter">清除筛选</button>
      </div>
      <div v-if="tags.length === 0" class="sidebar__empty">暂无标签，可在任务输入框标签弹窗中点击「设置」添加。</div>
      <div v-else>
        <button
          v-for="tag in tags" :key="tag.id"
          type="button"
          :class="['tag-filter-btn', activeTagFilterId === tag.id && 'tag-filter-btn--active']"
          @click="toggleTagFilter(tag.id)"
        >
          <div class="tag-filter-btn__left">
            <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
            <span>{{ tag.name }}</span>
          </div>
          <span class="tag-count">{{ tagIncompleteCount[tag.id] || 0 }}</span>
        </button>
      </div>
    </div>

    <div class="sidebar__status">
      <div class="status-row">
        <div :class="['status-dot', dbReady ? 'status-dot--ok' : 'status-dot--wait']"></div>
        <span>{{ dbReady ? 'SQLite 已连接: focus_log.db' : '正在连接数据库...' }}</span>
      </div>
      <p v-if="initError" class="status-error">{{ initError }}</p>
    </div>
  </aside>
</template>

<script setup>
import { LayoutDashboard, Calendar, Archive, Sparkles, Settings, CalendarClock, Sun, Moon } from 'lucide-vue-next';
import { tags } from '../composables/useTags.js';
import { activeTagFilterId, tagIncompleteCount, toggleTagFilter, clearTagFilter } from '../composables/useTodos.js';
import { isDark, toggleTheme } from '../composables/useTheme.js';

defineProps({ currentView: { type: String, required: true }, dbReady: { type: Boolean, default: false }, initError: { type: String, default: '' } });
defineEmits(['update:currentView']);

const tabs = [
  { id: 'today',    label: '今日待办', icon: LayoutDashboard },
  { id: 'upcoming', label: '未来规划', icon: CalendarClock },
  { id: 'history',  label: '历史回顾', icon: Calendar },
  { id: 'review',   label: '回顾中心', icon: Sparkles },
  { id: 'archive',  label: '总结存档', icon: Archive },
  { id: 'settings', label: '设置',     icon: Settings },
];
</script>
