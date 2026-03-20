<template>
  <div class="app-shell">
    <AppSidebar :currentView="currentView" :dbReady="dbReady" :initError="initError" @update:currentView="currentView = $event" />

    <main class="main-content">
      <!-- 右上角快捷按钮 -->
      <div class="top-right-actions">
        <button type="button" class="icon-btn" @click="toggleTheme" :title="isDark ? t('theme.light') : t('theme.dark')">
          <component :is="isDark ? Sun : Moon" :size="16" />
          <span class="icon-btn__label">{{ isDark ? t('theme.light') : t('theme.dark') }}</span>
        </button>
        <button type="button" class="icon-btn" @click="toggleLanguage" :title="t('language.title')">
          <Languages :size="16" />
          <span class="icon-btn__label">{{ currentLanguage === 'zh-CN' ? 'EN' : '中文' }}</span>
        </button>
      </div>

      <TodayView v-show="currentView === 'today'" ref="todayViewRef" :showToast="showToast" @openTagManager="openTagManager" />
      <UpcomingView v-show="currentView === 'upcoming'" :showToast="showToast" />
      <HistoryView  v-show="currentView === 'history'" />
      <ReviewView   v-show="currentView === 'review'"  @saveReview="handleSaveReview" />
      <ArchiveView v-show="currentView === 'archive'" :showToast="showToast" />
      <SettingsView v-show="currentView === 'settings'" />

      <button v-if="currentView === 'today'" @click="generateSummary" class="btn-fab">
        <Sparkles :size="16" />
        <span>{{ t('summary.generate') }}</span>
      </button>

      <transition name="fade-slide">
        <div v-if="archiveToastVisible" class="toast" :class="{ 'toast--with-action': toastAction }">
          <span>{{ archiveToastMessage }}</span>
          <button v-if="toastAction" @click="handleToastAction" class="toast__action">{{ toastActionText }}</button>
        </div>
      </transition>

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
    <DataSyncModal     v-if="isDataSyncModalOpen" :showToast="showToast" />
    <WebDavSettingsModal v-if="isWebDavSettingsOpen" :showToast="showToast" />
    <AutoBackupSettingsModal v-if="isAutoBackupSettingsOpen" :showToast="showToast" />
    <ThemeSettingsModal v-if="isThemeSettingsOpen" :showToast="showToast" />
    <WelcomeGuide :dbReady="dbReady" />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { Sparkles, Check, Sun, Moon, Languages } from 'lucide-vue-next';
import AppSidebar      from './components/AppSidebar.vue';
import SummaryDrawer   from './components/SummaryDrawer.vue';
import ApiSettingsModal  from './components/modals/ApiSettingsModal.vue';
import DemoDataModal     from './components/modals/DemoDataModal.vue';
import DailyPromptModal  from './components/modals/DailyPromptModal.vue';
import ReviewPromptModal from './components/modals/ReviewPromptModal.vue';
import TagManagerModal   from './components/modals/TagManagerModal.vue';
import DataSyncModal     from './components/modals/DataSyncModal.vue';
import WebDavSettingsModal from './components/modals/WebDavSettingsModal.vue';
import AutoBackupSettingsModal from './components/modals/AutoBackupSettingsModal.vue';
import ThemeSettingsModal from './components/modals/ThemeSettingsModal.vue';
import WelcomeGuide from './components/WelcomeGuide.vue';
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
import { isDataSyncModalOpen, isWebDavSettingsOpen, isAutoBackupSettingsOpen, isThemeSettingsOpen } from './composables/useDataSync.js';
import { loadAutoBackupSettings, startAutoBackup } from './composables/useAutoBackup.js';
import { loadThemeSettings } from './composables/useThemeSettings.js';
import { useI18n } from './composables/useI18n.js';
import { isDark, toggleTheme } from './composables/useTheme.js';

const { t, currentLanguage, setLanguage } = useI18n();

function toggleLanguage() {
  setLanguage(currentLanguage.value === 'zh-CN' ? 'en-US' : 'zh-CN');
}

const currentView = ref('today');
const dbReady = ref(false);
const initError = ref('');
const todayViewRef = ref(null);
const archiveToastVisible = ref(false);
const archiveToastMessage = ref('');
const toastAction = ref(null);
const toastActionText = ref('');
const snoozeToastVisible = ref(false);
const snoozeToastMessage = ref('');
let toastTimer = null;

function showToast(msg, duration = 2000, actionText = '', actionFn = null) {
  clearTimeout(toastTimer);
  archiveToastMessage.value = msg;
  archiveToastVisible.value = true;
  toastAction.value = actionFn;
  toastActionText.value = actionText;
  toastTimer = setTimeout(() => {
    archiveToastVisible.value = false;
    toastAction.value = null;
  }, duration);
}

async function handleToastAction() {
  if (toastAction.value) {
    await toastAction.value();
    archiveToastVisible.value = false;
    toastAction.value = null;
  }
}

async function initDB() {
  try {
    await openDb();
    const d = db.value;
    await d.execute(`CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, from_yesterday INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0)`);
    await d.execute(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY DEFAULT 1, api_key TEXT DEFAULT '', api_provider TEXT DEFAULT 'deepseek', api_base_url TEXT DEFAULT 'https://api.deepseek.com', api_model TEXT DEFAULT 'deepseek-chat', custom_daily_prompt TEXT DEFAULT '', custom_review_prompt TEXT DEFAULT '', auto_backup_enabled INTEGER DEFAULT 0, auto_backup_interval TEXT DEFAULT 'daily', auto_backup_mode TEXT DEFAULT 'overwrite', auto_backup_retention INTEGER DEFAULT 5, last_backup_time TEXT, theme_mode TEXT DEFAULT 'auto', dark_start_time TEXT DEFAULT '22:00', dark_end_time TEXT DEFAULT '07:00', webdav_url TEXT DEFAULT '', webdav_username TEXT DEFAULT '', webdav_password TEXT DEFAULT '', webdav_path TEXT DEFAULT '/focuslog-backup.json')`);
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
      `ALTER TABLE settings ADD COLUMN auto_backup_enabled INTEGER DEFAULT 0`,
      `ALTER TABLE settings ADD COLUMN auto_backup_interval TEXT DEFAULT 'daily'`,
      `ALTER TABLE settings ADD COLUMN auto_backup_mode TEXT DEFAULT 'overwrite'`,
      `ALTER TABLE settings ADD COLUMN auto_backup_retention INTEGER DEFAULT 5`,
      `ALTER TABLE settings ADD COLUMN last_backup_time TEXT`,
      `ALTER TABLE settings ADD COLUMN theme_mode TEXT DEFAULT 'auto'`,
      `ALTER TABLE settings ADD COLUMN dark_start_time TEXT DEFAULT '22:00'`,
      `ALTER TABLE settings ADD COLUMN dark_end_time TEXT DEFAULT '07:00'`,
      `ALTER TABLE settings ADD COLUMN webdav_url TEXT DEFAULT ''`,
      `ALTER TABLE settings ADD COLUMN webdav_username TEXT DEFAULT ''`,
      `ALTER TABLE settings ADD COLUMN webdav_password TEXT DEFAULT ''`,
      `ALTER TABLE settings ADD COLUMN webdav_path TEXT DEFAULT '/focuslog-backup.json'`,
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
    
    await loadAutoBackupSettings();
    startAutoBackup();
    
    await loadThemeSettings();
  } catch (e) {
    console.error('initDB failed:', e);
    initError.value = t('toast.error') + `: ${e.message || e}`;
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

function closeAllPopovers() {
  activeTodoTagPopoverId.value = null;
  activeTodoSnoozePopoverId.value = null;
}

onMounted(() => {
  initDB();
  document.addEventListener('click', closeAllPopovers);
  nextTick(() => todayViewRef.value?.focus());
});

onUnmounted(() => {
  document.removeEventListener('click', closeAllPopovers);
});
</script>
