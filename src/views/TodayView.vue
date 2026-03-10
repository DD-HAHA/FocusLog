<template>
  <div class="view-container">
    <header class="view-header--today">
      <h1 class="view-title">Focus.</h1>
      <p class="view-subtitle">今天是 {{ todayStr }}</p>
    </header>

    <!-- Heatmap -->
    <section class="heatmap-section">
      <div class="heatmap-header">
        <span class="heatmap-label">
          过去一年的完成记录
          <span v-if="activeTagFilterId" class="heatmap-tag">
            （仅「{{ (tags.find(t => t.id === activeTagFilterId) || {}).name || '' }}」）
          </span>
        </span>
        <span v-if="!heatmapLoading && heatmapWeeks.length" class="heatmap-range">最近 52 周</span>
      </div>
      <div class="heatmap-scroll" ref="heatmapScrollEl">
        <div class="heatmap-grid">
          <div v-for="(week, wIndex) in heatmapWeeks" :key="wIndex" class="heatmap-week">
            <div
              v-for="day in week" :key="day.date"
              :class="['heatmap-cell', getCellClass(day), !day.isFuture && 'heatmap-cell--clickable', heatmapSelectedDate === day.date && !day.isFuture && 'heatmap-cell--selected']"
              @mouseenter="!day.isFuture && showHeatmapTooltip(day, $event)"
              @mouseleave="hideHeatmapTooltip"
              @click="!day.isFuture && selectHeatmapDate(day.date)"
            ></div>
          </div>
        </div>
      </div>
      <div v-if="heatmapTooltip.visible" class="heatmap-tooltip" :style="{ left: heatmapTooltip.x + 'px', top: heatmapTooltip.y + 'px' }">
        <div class="heatmap-tooltip__date">{{ heatmapTooltip.date }}</div>
        <div class="heatmap-tooltip__count">完成 {{ heatmapTooltip.count }} 个任务</div>
      </div>
    </section>

    <!-- Readonly banner -->
    <div v-if="heatmapSelectedDate" class="readonly-banner">
      <span class="readonly-banner__text">正在查看 <span class="readonly-banner__date">{{ heatmapSelectedDate }}</span> 的历史记录（只读模式）</span>
      <button type="button" class="readonly-banner__exit" @click="clearHeatmapDate">退出只读模式 · 查看今日</button>
    </div>

    <!-- Input -->
    <div v-if="!heatmapSelectedDate" class="todo-input-wrap">
      <div class="todo-input-icon"><Plus :size="18" /></div>
      <input
        ref="newTodoInput" type="text" v-model="newTodoText"
        @input="handleTodoInput" @keydown="handleTodoKeydown"
        placeholder="添加一项任务... (支持 #标签名 快捷选择，Enter 保存)"
        class="todo-input"
      />

      <!-- Mention dropdown -->
      <div v-if="mentionState.visible" class="dropdown dropdown--mention" @mousedown.prevent>
        <div v-if="filteredMentionTags.length === 0" class="dropdown__empty">按 Enter 回车可直接新建名为 "{{ mentionState.query }}" 的标签</div>
        <div v-else class="dropdown__scroll">
          <button
            v-for="(tag, index) in filteredMentionTags" :key="tag.id" type="button"
            :class="['dropdown-item', mentionState.selectedIndex === index && 'dropdown-item--selected']"
            @mousedown.prevent="selectMentionTag(tag)"
          >
            <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
            <span>{{ tag.name }}</span>
          </button>
        </div>
      </div>

      <!-- Tag picker button -->
      <button type="button" class="todo-input-tag-btn" @click.stop="createTagPopoverOpen = !createTagPopoverOpen">
        <div style="position: relative; display: flex; align-items: center;">
          <Tags :size="18" />
          <span v-if="selectedTagsForNewTodo.length" class="todo-input-tag-dot"></span>
        </div>
      </button>

      <!-- Tag picker popover -->
      <div v-if="createTagPopoverOpen" class="dropdown dropdown--tag-picker">
        <div class="dropdown__header" style="padding: 0 0 8px; margin-bottom: 8px;">
          <span class="dropdown__header-label">为新任务选择标签</span>
          <div class="dropdown__header-actions">
            <button type="button" class="dropdown__close" style="color: var(--purple-400);" @click.stop="$emit('openTagManager'); createTagPopoverOpen = false">设置</button>
            <button type="button" class="dropdown__close" @click.stop="createTagPopoverOpen = false">关闭</button>
          </div>
        </div>
        <div v-if="tags.length === 0" class="dropdown__empty">还没有标签，可以点击右上角「设置」先创建。</div>
        <div v-else class="dropdown__scroll dropdown__scroll--lg">
          <button v-for="tag in tags" :key="tag.id" type="button" class="dropdown-item dropdown-item--between" @click.stop="toggleNewTodoTag(tag.id)">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="tag-dot" style="width:12px;height:12px;" :style="{ backgroundColor: tag.color }"></span>
              <span>{{ tag.name }}</span>
            </div>
            <span v-if="newTodoSelectedTagIds.includes(tag.id)" style="font-size:10px; color: var(--purple-400);">已选</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Selected tags preview -->
    <div v-if="selectedTagsForNewTodo.length" class="selected-tags-preview">
      <span>已选中：</span>
      <div class="selected-tags-list">
        <button v-for="tag in selectedTagsForNewTodo" :key="tag.id" type="button"
          class="selected-tag-chip" :style="{ borderColor: tag.color, color: tag.color }"
          @click="toggleNewTodoTag(tag.id)" title="点击移除标签">
          <span>{{ tag.name }}</span>
          <span class="selected-tag-chip__remove">&times;</span>
        </button>
      </div>
    </div>

    <!-- Todo list -->
    <div class="todo-list">
      <!-- Active todos -->
      <div v-for="todo in displayedActiveTodos" :key="todo.id" class="todo-item">
        <div :class="['checkbox', todo.completed && 'checkbox--checked']" @click.stop="toggleTodo(todo)">
          <Check v-if="todo.completed" :size="12" color="white" />
        </div>
        <div class="todo-body">
          <input v-if="editingTodoId === todo.id" v-model="editingText" class="todo-edit-input"
            @keyup.enter="saveEdit(todo)" @blur="saveEdit(todo)" @keydown.esc="cancelEdit" />
          <div v-else>
            <span class="todo-text" @dblclick.stop="startEdit(todo)">{{ todo.text }}</span>
            <div v-if="getTagsForTodo(todo).length" class="tag-badge-list">
              <span v-for="tag in getTagsForTodo(todo)" :key="tag.id" class="tag-badge" :style="{ borderColor: tag.color, color: tag.color }">{{ tag.name }}</span>
            </div>
          </div>
        </div>
        <span v-if="todo.from_yesterday" class="todo-badge-yesterday">昨日延宕</span>
        <span v-if="(todo.rolled_count||0)>3" class="todo-badge-flame" :title="`已拖延 ${todo.rolled_count} 天`"><Flame :size="14" /></span>
        <div class="todo-actions">
          <!-- Snooze -->
          <div class="todo-action-wrap">
            <button class="todo-action-btn todo-action-btn--snooze" @click.stop="toggleSnoozePopoverForTodo(todo.id)" title="推迟任务"><Clock :size="15" /></button>
            <div v-if="activeTodoSnoozePopoverId === todo.id" class="dropdown dropdown--snooze">
              <div class="dropdown__header"><span class="dropdown__header-label">推迟至...</span><button class="dropdown__close" @click.stop="activeTodoSnoozePopoverId = null">关闭</button></div>
              <div style="padding: 0 6px;">
                <button type="button" class="dropdown-item" @click.stop="snoozeTodo(todo, 1, snoozeMsg, snoozeVisible)">🌞 明天</button>
                <button type="button" class="dropdown-item" @click.stop="snoozeTodo(todo, 7, snoozeMsg, snoozeVisible)">📆 下周</button>
              </div>
            </div>
          </div>
          <!-- Tag edit -->
          <div class="todo-action-wrap">
            <button class="todo-action-btn todo-action-btn--tags" @click.stop="toggleTagPopoverForTodo(todo.id)" title="修改标签"><Tags :size="15" /></button>
            <div v-if="activeTodoTagPopoverId === todo.id" class="dropdown dropdown--tag-edit">
              <div class="dropdown__header"><span class="dropdown__header-label">修改标签</span><button class="dropdown__close" @click.stop="activeTodoTagPopoverId = null">关闭</button></div>
              <div v-if="tags.length === 0" class="dropdown__empty">暂无标签项</div>
              <div v-else class="dropdown__scroll">
                <button v-for="tag in tags" :key="tag.id" type="button" class="dropdown-item dropdown-item--between" @click.stop="toggleExistingTodoTag(todo, tag.id)">
                  <div style="display:flex;align-items:center;gap:8px;"><span class="tag-dot" style="width:8px;height:8px;" :style="{backgroundColor:tag.color}"></span><span>{{ tag.name }}</span></div>
                  <Check v-if="(todoTagsByTodoId[todo.id]||[]).includes(tag.id)" :size="12" color="var(--purple-400)" />
                </button>
              </div>
            </div>
          </div>
          <button class="todo-action-btn todo-action-btn--edit"   @click.stop="startEdit(todo)" title="编辑"><Pencil :size="15" /></button>
          <button class="todo-action-btn todo-action-btn--delete" @click.stop="deleteTodo(todo.id)" title="删除"><Trash2 :size="15" /></button>
        </div>
      </div>

      <!-- Separator -->
      <div v-if="displayedCompletedTodos.length" class="section-divider">
        <div class="section-divider__line"></div>
        <span class="section-divider__label">已完成</span>
        <div class="section-divider__line"></div>
      </div>

      <!-- Completed todos -->
      <div v-for="todo in displayedCompletedTodos" :key="todo.id" class="todo-item--done">
        <div class="checkbox checkbox--checked" @click="toggleTodo(todo)"><Check :size="12" color="white" /></div>
        <div class="todo-body">
          <input v-if="editingTodoId === todo.id" v-model="editingText" class="todo-edit-input todo-edit-input--done"
            @keyup.enter="saveEdit(todo)" @blur="saveEdit(todo)" @keydown.esc="cancelEdit" />
          <div v-else>
            <span class="todo-text--done" @dblclick.stop="startEdit(todo)">{{ todo.text }}</span>
            <div v-if="getTagsForTodo(todo).length" class="tag-badge-list">
              <span v-for="tag in getTagsForTodo(todo)" :key="tag.id" class="tag-badge" :style="{ borderColor: tag.color, color: tag.color }">{{ tag.name }}</span>
            </div>
          </div>
        </div>
        <button class="todo-action-btn todo-action-btn--delete" style="opacity:0;" @click.stop="deleteTodo(todo.id)"><Trash2 :size="15" /></button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { Plus, Check, Trash2, Tags, Flame, Pencil, Clock } from 'lucide-vue-next';
import { todayStr } from '../composables/useDateHelpers.js';
import {
  todos, todoTagsByTodoId, newTodoSelectedTagIds, selectedTagsForNewTodo,
  displayedActiveTodos, displayedCompletedTodos, activeTagFilterId,
  activeTodoTagPopoverId, activeTodoSnoozePopoverId, editingTodoId, editingText,
  heatmapSelectedDate, selectHeatmapDate, clearHeatmapDate, getTodoTagIds, getTagsForTodo,
  toggleNewTodoTag, toggleTagPopoverForTodo, toggleSnoozePopoverForTodo,
  addTodo, deleteTodo, toggleTodo, startEdit, cancelEdit, saveEdit, snoozeTodo, toggleExistingTodoTag,
} from '../composables/useTodos.js';
import { tags, tagColorPresets } from '../composables/useTags.js';
import { heatmapWeeks, heatmapLoading, heatmapTooltip, heatmapScrollEl, showHeatmapTooltip, hideHeatmapTooltip } from '../composables/useHeatmap.js';
import { db } from '../composables/useDb.js';

const emit = defineEmits(['openTagManager']);
const newTodoText = ref('');
const createTagPopoverOpen = ref(false);
const newTodoInput = ref(null);
const snoozeMsg = ref('');
const snoozeVisible = ref(false);
const mentionState = ref({ visible: false, query: '', startIndex: -1, selectedIndex: 0 });

const filteredMentionTags = computed(() => {
  if (!mentionState.value.query) return tags.value;
  const q = mentionState.value.query.toLowerCase();
  return tags.value.filter(t => t.name.toLowerCase().includes(q));
});

function getCellClass(day) {
  if (day.isFuture) return 'heatmap-cell--future';
  const c = day.count || 0;
  if (c === 0) return 'heatmap-cell--empty';
  if (c <= 2)  return 'heatmap-cell--low';
  if (c <= 5)  return 'heatmap-cell--medium';
  return 'heatmap-cell--high';
}

function handleTodoInput(e) {
  const text = newTodoText.value, cursor = e.target.selectionStart;
  const lastHash = text.lastIndexOf('#', cursor - 1);
  if (lastHash !== -1 && (lastHash === 0 || text[lastHash - 1] === ' ')) {
    const query = text.substring(lastHash + 1, cursor);
    if (!query.includes(' ')) { mentionState.value = { visible: true, query, startIndex: lastHash, selectedIndex: 0 }; return; }
  }
  mentionState.value.visible = false;
}

function handleTodoKeydown(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (mentionState.value.visible) {
    if (e.key === 'ArrowDown') { e.preventDefault(); const max = filteredMentionTags.value.length; if (max > 0) mentionState.value.selectedIndex = (mentionState.value.selectedIndex + 1) % max; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const max = filteredMentionTags.value.length; if (max > 0) mentionState.value.selectedIndex = (mentionState.value.selectedIndex - 1 + max) % max; }
    else if (e.key === 'Enter') { e.preventDefault(); if (filteredMentionTags.value.length > 0) selectMentionTag(filteredMentionTags.value[mentionState.value.selectedIndex]); else if (mentionState.value.query) createNewMentionTag(mentionState.value.query); }
    else if (e.key === 'Escape') mentionState.value.visible = false;
  } else if (e.key === 'Enter') { e.preventDefault(); submitTodo(); }
}

async function createNewMentionTag(tagName) {
  if (!db.value) return;
  try {
    const color = tagColorPresets[Math.floor(Math.random() * tagColorPresets.length)];
    const result = await db.value.execute('INSERT INTO tags (name, color) VALUES (?, ?)', [tagName, color]);
    const newTag = { id: result.lastInsertId, name: tagName, color };
    tags.value.unshift(newTag);
    selectMentionTag(newTag);
  } catch (e) { console.error(e); }
}

function selectMentionTag(tag) {
  const text = newTodoText.value, start = mentionState.value.startIndex;
  newTodoText.value = text.substring(0, start) + text.substring(start + 1 + mentionState.value.query.length);
  if (!newTodoSelectedTagIds.value.includes(tag.id)) newTodoSelectedTagIds.value.push(tag.id);
  mentionState.value.visible = false;
  nextTick(() => newTodoInput.value?.focus());
}

async function submitTodo() {
  const ok = await addTodo(newTodoText.value, [...newTodoSelectedTagIds.value], createTagPopoverOpen);
  if (ok) newTodoText.value = '';
}

defineExpose({ focus: () => newTodoInput.value?.focus() });
</script>
