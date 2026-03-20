// ── Todos composable ───────────────────────────────────────────
import { ref, computed } from 'vue';
import { db } from './useDb.js';
import { tags } from './useTags.js';
import { localNow, getTodayDate, pad } from './useDateHelpers.js';
import { sendNotification } from './useDataSync.js';
import i18n from '../locales/index.js';

const t = i18n.global.t.bind(i18n.global);

export const todos = ref([]);
export const todoTagsByTodoId = ref({});

export const activeTagFilterId = ref(null);
export const activeTodoTagPopoverId = ref(null);
export const activeTodoSnoozePopoverId = ref(null);

export const editingTodoId = ref(null);
export const editingText = ref('');

export const newTodoSelectedTagIds = ref([]);

// ── Computed ──────────────────────────────────────────────────

export const activeTodos = computed(() => todos.value.filter(t => !t.completed));
export const completedTodos = computed(() => todos.value.filter(t => t.completed));

export const selectedTagsForNewTodo = computed(() =>
  tags.value.filter(t => newTodoSelectedTagIds.value.includes(t.id))
);

export const filteredActiveTodos = computed(() => {
  if (!activeTagFilterId.value) return activeTodos.value;
  return activeTodos.value.filter(t => getTodoTagIds(t).includes(activeTagFilterId.value));
});

export const filteredCompletedTodos = computed(() => {
  if (!activeTagFilterId.value) return completedTodos.value;
  return completedTodos.value.filter(t => getTodoTagIds(t).includes(activeTagFilterId.value));
});

export const displayedActiveTodos = computed(() => {
  const list = filteredActiveTodos.value;
  const date = heatmapSelectedDate.value;
  if (!date) return list.filter(t => (t.target_date || t.created_at.slice(0, 10)) <= getTodayDate());
  return list.filter(t => (t.created_at || '').slice(0, 10) === date);
});

export const displayedCompletedTodos = computed(() => {
  const list = filteredCompletedTodos.value;
  const date = heatmapSelectedDate.value;
  if (!date) return list.filter(t =>
    (t.updated_at || '').slice(0, 10) === getTodayDate() ||
    t.target_date === getTodayDate() ||
    t.created_at.slice(0, 10) === getTodayDate()
  );
  return list.filter(t => (t.created_at || '').slice(0, 10) === date);
});

export const displayedUpcomingTodos = computed(() =>
  filteredActiveTodos.value
    .filter(t => t.target_date && t.target_date > getTodayDate())
    .sort((a, b) => a.target_date.localeCompare(b.target_date))
);

export const upcomingGroups = computed(() => {
  const groups = {};
  displayedUpcomingTodos.value.forEach(todo => {
    const d = todo.target_date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(todo);
  });
  const dObj = new Date();
  dObj.setDate(dObj.getDate() + 1);
  const tomorrowStr = `${dObj.getFullYear()}-${pad(dObj.getMonth() + 1)}-${pad(dObj.getDate())}`;
  return Object.keys(groups).sort().map(date => ({
    date,
    label: date === tomorrowStr ? '🌞 明天' : '📆 ' + date,
    todos: groups[date],
  }));
});

export const tagIncompleteCount = computed(() => {
  const counts = {};
  for (const tag of tags.value) counts[tag.id] = 0;
  for (const t of todos.value) {
    if (t.completed) continue;
    for (const id of getTodoTagIds(t)) {
      if (counts[id] === undefined) counts[id] = 0;
      counts[id]++;
    }
  }
  return counts;
});

// ── Heatmap date selection (shared with heatmap composable) ───
// We keep this here to avoid circular imports
export const heatmapSelectedDate = ref(null);
export function selectHeatmapDate(dayDate) {
  heatmapSelectedDate.value = heatmapSelectedDate.value === dayDate ? null : dayDate;
}
export function clearHeatmapDate() {
  heatmapSelectedDate.value = null;
}

// ── Tag helpers ───────────────────────────────────────────────

export function getTodoTagIds(todo) {
  const ids = todoTagsByTodoId.value[todo.id] || [];
  if (ids.length > 0) return ids;
  if (todo.tag_id) return [todo.tag_id];
  return [];
}

export function getTagsForTodo(todo) {
  const ids = getTodoTagIds(todo);
  if (!ids.length) return [];
  return ids.map(id => tags.value.find(t => t.id === id)).filter(Boolean);
}

export function toggleTagFilter(tagId) {
  activeTagFilterId.value = activeTagFilterId.value === tagId ? null : tagId;
}

export function clearTagFilter() {
  activeTagFilterId.value = null;
}

export function toggleNewTodoTag(tagId) {
  const idx = newTodoSelectedTagIds.value.indexOf(tagId);
  if (idx === -1) {
    newTodoSelectedTagIds.value = [...newTodoSelectedTagIds.value, tagId];
  } else {
    const next = [...newTodoSelectedTagIds.value];
    next.splice(idx, 1);
    newTodoSelectedTagIds.value = next;
  }
}

export function toggleTagPopoverForTodo(todoId) {
  activeTodoTagPopoverId.value = activeTodoTagPopoverId.value === todoId ? null : todoId;
}

export function toggleSnoozePopoverForTodo(todoId) {
  activeTodoSnoozePopoverId.value = activeTodoSnoozePopoverId.value === todoId ? null : todoId;
}

// ── DB operations ─────────────────────────────────────────────

export async function loadTodos() {
  const rows = await db.value.select('SELECT * FROM todos ORDER BY created_at DESC');
  todos.value = rows.map(r => ({
    ...r,
    completed: !!r.completed,
    from_yesterday: !!r.from_yesterday,
    rolled_count: r.rolled_count != null ? Number(r.rolled_count) : 0,
  }));
}

export async function loadTodoTags() {
  if (!db.value) return;
  const rows = await db.value.select('SELECT * FROM todo_tags');
  const map = {};
  for (const r of rows) {
    if (!map[r.todo_id]) map[r.todo_id] = [];
    map[r.todo_id].push(r.tag_id);
  }
  todoTagsByTodoId.value = map;
}

export async function rolloverTodos() {
  const ts = localNow();
  await db.value.execute(
    `UPDATE todos SET created_at=?, updated_at=?, from_yesterday=1,
     rolled_count=COALESCE(rolled_count,0)+1
     WHERE completed=0 AND date(created_at)<date(?)`,
    [ts, ts, getTodayDate()]
  );
}

export async function addTodo(text, selectedIds, createTagPopoverOpen) {
  let cleanText = text.trim();
  if (!cleanText || !db.value) return false;
  try {
    const ts = localNow();
    const matches = cleanText.match(/#(\S+)/g);
    if (matches) {
      for (const match of matches) {
        const tagName = match.slice(1);
        const tagObj = tags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        if (tagObj && !selectedIds.includes(tagObj.id)) selectedIds.push(tagObj.id);
      }
      cleanText = cleanText.replace(/#(\S+)/g, (match) => {
        const tagName = match.slice(1);
        const tagObj = tags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        return tagObj ? '' : match;
      }).trim();
    }
    if (!cleanText) return false;

    const primaryTagId = selectedIds.length > 0 ? selectedIds[0] : null;
    const result = await db.value.execute(
      'INSERT INTO todos (text, completed, from_yesterday, created_at, updated_at, tag_id, rolled_count, target_date) VALUES (?, 0, 0, ?, ?, ?, 0, ?)',
      [cleanText, ts, ts, primaryTagId, getTodayDate()]
    );
    const todoId = result.lastInsertId;
    for (const tagId of selectedIds) {
      await db.value.execute('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)', [todoId, tagId]);
    }
    todoTagsByTodoId.value = { ...todoTagsByTodoId.value, [todoId]: [...selectedIds] };
    todos.value.unshift({
      id: todoId, text: cleanText, completed: false, from_yesterday: false,
      created_at: ts, updated_at: ts, target_date: getTodayDate(), tag_id: primaryTagId, rolled_count: 0,
    });
    newTodoSelectedTagIds.value = [];
    if (createTagPopoverOpen) createTagPopoverOpen.value = false;
    return true;
  } catch (e) {
    console.error('addTodo failed:', e);
    return false;
  }
}

// ── Delete with undo support ──────────────────────────────────
let deleteUndoTimer = null;
let deletedTodoCache = null;

export async function deleteTodo(id, showToast, undoText = '撤销') {
  if (!db.value) return;
  try {
    // Cache for undo
    deletedTodoCache = todos.value.find(t => t.id === id);
    if (!deletedTodoCache) return;

    await db.value.execute('DELETE FROM todos WHERE id = ?', [id]);
    todos.value = todos.value.filter(t => t.id !== id);

    // Show undo toast
    if (showToast) {
      const deletedTodo = { ...deletedTodoCache };
      clearTimeout(deleteUndoTimer);
      showToast('已删除', 5000, undoText, async () => {
        await restoreDeletedTodo(deletedTodo);
      });
      deleteUndoTimer = setTimeout(() => { deletedTodoCache = null; }, 5000);
    }
  } catch (e) {
    console.error('deleteTodo failed:', e);
  }
}

async function restoreDeletedTodo(todo) {
  if (!db.value || !todo) return;
  try {
    const result = await db.value.execute(
      'INSERT INTO todos (text, completed, from_yesterday, created_at, updated_at, tag_id, rolled_count, target_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [todo.text, todo.completed ? 1 : 0, todo.from_yesterday ? 1 : 0, todo.created_at, todo.updated_at, todo.tag_id, todo.rolled_count, todo.target_date]
    );
    const newId = result.lastInsertId;
    // Restore tags
    const tagIds = todoTagsByTodoId.value[todo.id] || [];
    for (const tagId of tagIds) {
      await db.value.execute('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)', [newId, tagId]);
    }
    if (tagIds.length > 0) {
      todoTagsByTodoId.value = { ...todoTagsByTodoId.value, [newId]: tagIds };
    }
    todos.value.unshift({ ...todo, id: newId });
    deletedTodoCache = null;
  } catch (e) {
    console.error('restoreDeletedTodo failed:', e);
  }
}

export async function toggleTodo(todo) {
  if (!db.value) return;
  try {
    const newCompleted = !todo.completed;
    const ts = localNow();
    await db.value.execute(
      'UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?',
      [newCompleted ? 1 : 0, ts, todo.id]
    );
    todo.completed = newCompleted;
    todo.updated_at = ts;
    
    if (newCompleted) {
      sendNotification(t('notification.taskCompleted'), `"${todo.text}" ` + t('todo.completed'));
    }
  } catch (e) {
    console.error('toggleTodo failed:', e);
  }
}

export function startEdit(todo) {
  editingTodoId.value = todo.id;
  editingText.value = todo.text;
}

export function cancelEdit() {
  editingTodoId.value = null;
  editingText.value = '';
}

export async function saveEdit(todo) {
  if (!db.value) return;
  const text = editingText.value.trim();
  if (!text) { cancelEdit(); return; }
  try {
    const ts = localNow();
    await db.value.execute('UPDATE todos SET text = ?, updated_at = ? WHERE id = ?', [text, ts, todo.id]);
    todo.text = text;
    todo.updated_at = ts;
  } catch (e) {
    console.error('saveEdit failed:', e);
  } finally {
    cancelEdit();
  }
}

export async function toggleExistingTodoTag(todo, tagId) {
  if (!db.value) return;
  const currentIds = todoTagsByTodoId.value[todo.id] || [];
  const idx = currentIds.indexOf(tagId);
  const isAdding = idx === -1;
  try {
    if (isAdding) {
      await db.value.execute('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)', [todo.id, tagId]);
      todoTagsByTodoId.value[todo.id] = [...currentIds, tagId];
    } else {
      await db.value.execute('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?', [todo.id, tagId]);
      const next = [...currentIds];
      next.splice(idx, 1);
      todoTagsByTodoId.value[todo.id] = next;
    }
  } catch (e) {
    console.error('toggleExistingTodoTag failed:', e);
  }
}

export async function snoozeTodo(todo, days, snoozeToastMessage, snoozeToastVisible) {
  if (!db.value) return;
  try {
    const ts = localNow();
    const target = new Date();
    target.setDate(target.getDate() + days);
    const targetStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    await db.value.execute(
      'UPDATE todos SET target_date = ?, updated_at = ? WHERE id = ?',
      [targetStr, ts, todo.id]
    );
    todo.target_date = targetStr;
    todo.updated_at = ts;
    activeTodoSnoozePopoverId.value = null;
    snoozeToastMessage.value = '已转移至未来规划';
    snoozeToastVisible.value = true;
    setTimeout(() => { snoozeToastVisible.value = false; }, 2000);
  } catch (e) {
    console.error('snoozeTodo failed:', e);
  }
}

export async function moveToToday(todo) {
  if (!db.value) return;
  try {
    const ts = localNow();
    const today = getTodayDate();
    await db.value.execute(
      'UPDATE todos SET target_date = ?, updated_at = ? WHERE id = ?',
      [today, ts, todo.id]
    );
    todo.target_date = today;
    todo.updated_at = ts;
  } catch (e) {
    console.error('moveToToday failed:', e);
  }
}
