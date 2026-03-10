<template>
  <div class="app-shell">
    <AppSidebar :currentView="currentView" :dbReady="dbReady" :initError="initError" @update:currentView="currentView = $event" />

    <main class="main-content">
      <TodayView    v-show="currentView === 'today'"    ref="todayViewRef" @openTagManager="openTagManager" />
      <UpcomingView v-show="currentView === 'upcoming'" />
      <HistoryView  v-show="currentView === 'history'" />
      <ReviewView   v-show="currentView === 'review'"  @saveReview="handleSaveReview" />
      <ArchiveView  v-show="currentView === 'archive'" />
      <SettingsView v-show="currentView === 'settings'" />

      <button v-if="currentView === 'today'" @click="generateSummary" class="btn-fab">
        <Sparkles :size="16" />
        <span>生成今日总结</span>
      </button>

      <div v-if="archiveToastVisible" class="toast">{{ archiveToastMessage }}</div>

      <transition name="fade-slide">
        <div v-if="snoozeToastVisible" class="toast--snooze">
          <Check :size="16" />
          <span>{{ snoozeToastMessage }}</span>
        </div>
      </transition>
    </main>

    <SummaryDrawer @saveArchive="handleSaveArchive" @goToSettings="currentView = 'settings'; isSummaryOpen = false" />
    <ApiSettingsModal  v-if="isApiSettingsOpen"  :showToast="showToast" />
    <DemoDataModal     v-if="isDemoDataModalOpen" />
    <DailyPromptModal  v-if="isDailyPromptOpen"  :showToast="showToast" />
    <ReviewPromptModal v-if="isReviewPromptOpen" :showToast="showToast" />
    <TagManagerModal   v-if="isTagManagerOpen" />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import { Sparkles, Check } from 'lucide-vue-next';
import AppSidebar      from './components/AppSidebar.vue';
import SummaryDrawer   from './components/SummaryDrawer.vue';
import ApiSettingsModal  from './components/modals/ApiSettingsModal.vue';
import DemoDataModal     from './components/modals/DemoDataModal.vue';
import DailyPromptModal  from './components/modals/DailyPromptModal.vue';
import ReviewPromptModal from './components/modals/ReviewPromptModal.vue';
import TagManagerModal   from './components/modals/TagManagerModal.vue';
import TodayView    from './views/TodayView.vue';
import UpcomingView from './views/UpcomingView.vue';
import HistoryView  from './views/HistoryView.vue';
import ReviewView   from './views/ReviewView.vue';
import ArchiveView  from './views/ArchiveView.vue';
import SettingsView from './views/SettingsView.vue';
import { db, openDb } from './composables/useDb.js';
import { loadTodos, loadTodoTags, rolloverTodos, activeTodoTagPopoverId, activeTodoSnoozePopoverId, activeTagFilterId } from './composables/useTodos.js';
import { loadTags, isTagManagerOpen, openTagManager } from './composables/useTags.js';
import { loadHeatmap } from './composables/useHeatmap.js';
import { loadArchives, saveArchive, saveReviewReport } from './composables/useArchives.js';
import { loadSettings, isApiSettingsOpen, isDailyPromptOpen, isReviewPromptOpen } from './composables/useSettings.js';
import { isDemoDataModalOpen } from './composables/useDemoData.js';
import { isSummaryOpen, summaryContent, generateSummary, reviewContent, reviewStartDate, reviewFileName } from './composables/useAI.js';

const currentView = ref('today');
const dbReady = ref(false);
const initError = ref('');
const todayViewRef = ref(null);
const archiveToastVisible = ref(false);
const archiveToastMessage = ref('');
const snoozeToastVisible = ref(false);
const snoozeToastMessage = ref('');

function showToast(msg, duration = 2000) {
  archiveToastMessage.value = msg;
  archiveToastVisible.value = true;
  setTimeout(() => { archiveToastVisible.value = false; }, duration);
}

async function initDB() {
  try {
    await openDb();
    const d = db.value;
    await d.execute(`CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, from_yesterday INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0)`);
    await d.execute(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY DEFAULT 1, api_key TEXT DEFAULT '', api_provider TEXT DEFAULT 'deepseek', api_base_url TEXT DEFAULT 'https://api.deepseek.com', api_model TEXT DEFAULT 'deepseek-chat', custom_daily_prompt TEXT DEFAULT '', custom_review_prompt TEXT DEFAULT '')`);
    await d.execute(`CREATE TABLE IF NOT EXISTS archives (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0)`);
    await d.execute(`CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0)`);
    await d.execute(`CREATE TABLE IF NOT EXISTS todo_tags (todo_id INTEGER NOT NULL, tag_id INTEGER NOT NULL)`);
    await d.execute(`CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id)`);
    await d.execute(`CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id)`);
    const migrations = [
      `ALTER TABLE todos ADD COLUMN from_yesterday INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE todos ADD COLUMN tag_id INTEGER`,
      `ALTER TABLE todos ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE todos ADD COLUMN rolled_count INTEGER DEFAULT 0`,
      `ALTER TABLE todos ADD COLUMN target_date TEXT`,
      `ALTER TABLE tags   ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE archives ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE settings ADD COLUMN api_provider TEXT DEFAULT 'deepseek'`,
      `ALTER TABLE settings ADD COLUMN api_base_url TEXT DEFAULT 'https://api.deepseek.com'`,
      `ALTER TABLE settings ADD COLUMN api_model TEXT DEFAULT 'deepseek-chat'`,
      `ALTER TABLE settings ADD COLUMN custom_daily_prompt TEXT DEFAULT ''`,
      `ALTER TABLE settings ADD COLUMN custom_review_prompt TEXT DEFAULT ''`,
    ];
    for (const sql of migrations) { try { await d.execute(sql); } catch (_) {} }
    dbReady.value = true;
    await rolloverTodos();
    await loadTodos();
    await loadTodoTags();
    await loadSettings();
    await loadArchives();
    await loadTags();
    await loadHeatmap(activeTagFilterId.value ?? null);
  } catch (e) {
    console.error('initDB failed:', e);
    initError.value = `数据库初始化失败: ${e.message || e}`;
  }
}

async function handleSaveArchive() {
  const ok = await saveArchive(summaryContent.value, showToast);
  if (ok) isSummaryOpen.value = false;
}

async function handleSaveReview() {
  const reviewError = ref('');
  await saveReviewReport(reviewContent.value, reviewStartDate.value, reviewFileName.value, showToast, reviewError);
}

watch(activeTagFilterId, (tagId) => { if (db.value) loadHeatmap(tagId ?? null); });
watch(currentView, (val) => { if (val === 'today') nextTick(() => todayViewRef.value?.focus()); });

onMounted(() => {
  initDB();
  document.addEventListener('click', () => {
    activeTodoTagPopoverId.value = null;
    activeTodoSnoozePopoverId.value = null;
  });
  nextTick(() => todayViewRef.value?.focus());
});
</script>
