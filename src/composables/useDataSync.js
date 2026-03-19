import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { db } from './useDb.js';
import { open, save } from '@tauri-apps/plugin-dialog';
import { documentDir, join } from '@tauri-apps/api/path';
import i18n from '../locales/index.js';

// 使用 i18n.global.t 避免在模块顶层调用 useI18n（必须在 setup 中）
const t = (...args) => i18n.global.t(...args);

export const isDataSyncModalOpen = ref(false);
export const isWebDavSettingsOpen = ref(false);
export const isAutoBackupSettingsOpen = ref(false);

export const isThemeSettingsOpen = ref(false);
export const themeMode = ref('auto');
export const darkStartTime = ref('22:00');
export const darkEndTime = ref('07:00');

export const webdavUrl = ref('');
export const webdavUsername = ref('');
export const webdavPassword = ref('');
export const webdavPath = ref('/focuslog-backup.json');

export const syncStatus = ref('');
export const isSyncing = ref(false);

export function openDataSyncModal() {
  isDataSyncModalOpen.value = true;
}

function normalizeLegacySettings(rows) {
  const map = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
  return {
    api_key: map.api_key || map.deepseek_api_key || '',
    api_provider: map.api_provider || 'deepseek',
    api_base_url: map.api_base_url || 'https://api.deepseek.com',
    api_model: map.api_model || 'deepseek-chat',
    custom_daily_prompt: map.custom_daily_prompt || '',
    custom_review_prompt: map.custom_review_prompt || '',
    webdav_url: map.webdav_url || '',
    webdav_username: map.webdav_username || '',
    webdav_password: map.webdav_password || '',
    webdav_path: map.webdav_path || '/focuslog-backup.json',
  };
}

async function getSettingsRow() {
  if (!db.value) return null;
  let firstError = null;
  try {
    const rows = await db.value.select('SELECT * FROM settings WHERE id = 1');
    return rows.length ? rows[0] : null;
  } catch (e) {
    firstError = e;
  }

  // Fallback for legacy key/value schema (without id column).
  try {
    const legacyRows = await db.value.select('SELECT key, value FROM settings');
    return legacyRows.length ? normalizeLegacySettings(legacyRows) : null;
  } catch (legacyErr) {
    throw firstError || legacyErr;
  }
}

export async function loadWebDavSettingsFromDb() {
  if (!db.value) return;
  try {
    const row = await getSettingsRow();
    if (!row) return;
    webdavUrl.value = row.webdav_url || '';
    webdavUsername.value = row.webdav_username || '';
    webdavPassword.value = row.webdav_password || '';
    webdavPath.value = row.webdav_path || '/focuslog-backup.json';
  } catch (e) {
    console.error('Load WebDAV settings failed:', e);
  }
}

async function ensureWebDavConfigInBackend() {
  if (!db.value) return;

  try {
    const row = await getSettingsRow();
    if (!row) return;
    const config = {
      url: (row.webdav_url || '').trim(),
      username: (row.webdav_username || '').trim(),
      password: row.webdav_password || '',
      path: (row.webdav_path || '/focuslog-backup.json').trim() || '/focuslog-backup.json',
    };

    if (!config.url || !config.username || !config.password) return;
    await invoke('set_webdav_config', { config });
  } catch (e) {
    console.error('Ensure WebDAV backend config failed:', e);
  }
}

export async function openWebDavSettings() {
  isWebDavSettingsOpen.value = true;
  await loadWebDavSettingsFromDb();
}

export async function exportToJson(showToast) {
  if (!db.value) return;
  try {
    const defaultExportPath = await join(await documentDir(), 'focuslog-backup.json');
    const filePath = await save({
      title: 'Export Data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: defaultExportPath,
    });
    
    if (filePath) {
      const todos = await db.value.select('SELECT * FROM todos');
      const tags = await db.value.select('SELECT * FROM tags');
      const todoTags = await db.value.select('SELECT * FROM todo_tags');
      const archives = await db.value.select('SELECT * FROM archives');
      const settingsRow = await getSettingsRow();
      
      const data = {
        version: '0.1.2',
        exportDate: new Date().toISOString(),
        todos,
        tags,
        todoTags,
        archives,
        settings: settingsRow,
      };
      
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const payload = JSON.stringify(data, null, 2);
      try {
        await writeTextFile(filePath, payload);
        showToast(t('dataSync.messages.exportSuccess'), 2000);
        sendNotification(t('dataSync.notifications.exportSuccess'), t('dataSync.notifications.exportSuccessDetail'));
      } catch (writeErr) {
        // Fallback to a known writable location to avoid silent export failure.
        const fallbackPath = await join(await documentDir(), 'focuslog-backup.json');
        await writeTextFile(fallbackPath, payload);
        const writeErrMsg = writeErr?.message || String(writeErr);
        syncStatus.value = `${t('dataSync.status.failed')}: ${writeErrMsg}`;
        showToast(`选定位置写入失败，已保存到文稿目录：${fallbackPath}`, 3500);
      }
    }
  } catch (e) {
    console.error('Export failed:', e);
    const msg = e?.message || String(e);
    syncStatus.value = t('dataSync.status.failed') + ': ' + msg;
    showToast(t('dataSync.status.failed') + ': ' + msg, 3000);
  }
}

export async function importFromJson(showToast) {
  if (!db.value) return;
  try {
    const filePath = await open({
      title: 'Import Data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      multiple: false,
    });
    
    if (filePath) {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const content = await readFile(filePath);
      const data = JSON.parse(new TextDecoder().decode(content));
      
      syncStatus.value = t('dataSync.status.preparing');
      isSyncing.value = true;
      
      await db.value.execute('DELETE FROM todo_tags');
      await db.value.execute('DELETE FROM tags');
      await db.value.execute('DELETE FROM archives');
      await db.value.execute('DELETE FROM todos');
      
      if (data.todos && data.todos.length > 0) {
        for (const todo of data.todos) {
          await db.value.execute(
            'INSERT INTO todos (id, text, completed, from_yesterday, created_at, updated_at, tag_id, rolled_count, target_date, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [todo.id, todo.text, todo.completed ? 1 : 0, todo.from_yesterday ? 1 : 0, todo.created_at, todo.updated_at, todo.tag_id, todo.rolled_count || 0, todo.target_date, todo.is_demo || 0]
          );
        }
      }
      
      if (data.tags && data.tags.length > 0) {
        for (const tag of data.tags) {
          await db.value.execute(
            'INSERT INTO tags (id, name, color, is_demo) VALUES (?, ?, ?, ?)',
            [tag.id, tag.name, tag.color, tag.is_demo || 0]
          );
        }
      }
      
      if (data.todoTags && data.todoTags.length > 0) {
        for (const tt of data.todoTags) {
          await db.value.execute(
            'INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)',
            [tt.todo_id, tt.tag_id]
          );
        }
      }
      
      if (data.archives && data.archives.length > 0) {
        for (const archive of data.archives) {
          await db.value.execute(
            'INSERT INTO archives (id, date, content, created_at, is_demo) VALUES (?, ?, ?, ?, ?)',
            [archive.id, archive.date, archive.content, archive.created_at, archive.is_demo || 0]
          );
        }
      }
      
      if (data.settings) {
        await db.value.execute(
          'INSERT OR REPLACE INTO settings (id, api_key, api_provider, api_base_url, api_model, custom_daily_prompt, custom_review_prompt) VALUES (1, ?, ?, ?, ?, ?, ?)',
          [
            data.settings.api_key || '',
            data.settings.api_provider || 'deepseek',
            data.settings.api_base_url || 'https://api.deepseek.com',
            data.settings.api_model || 'deepseek-chat',
            data.settings.custom_daily_prompt || '',
            data.settings.custom_review_prompt || ''
          ]
        );
      }
      
      syncStatus.value = t('dataSync.status.importSuccess');
      isSyncing.value = false;
      showToast(t('dataSync.messages.importSuccess'), 3000);
      sendNotification(t('dataSync.notifications.importSuccess'), t('dataSync.notifications.importSuccessDetail'));
    }
  } catch (e) {
    console.error('Import failed:', e);
    syncStatus.value = t('dataSync.status.failed') + ': ' + e.message;
    isSyncing.value = false;
    showToast(t('dataSync.status.failed') + ': ' + e.message, 3000);
  }
}

export async function saveWebDavSettings(showToast) {
  try {
    const config = {
      url: webdavUrl.value.trim(),
      username: webdavUsername.value.trim(),
      password: webdavPassword.value,
      path: webdavPath.value.trim() || '/focuslog-backup.json',
    };
    
    if (db.value) {
      await db.value.execute(
        `INSERT OR REPLACE INTO settings (id, webdav_url, webdav_username, webdav_password, webdav_path)
         VALUES (1, ?, ?, ?, ?)`,
        [config.url, config.username, config.password, config.path]
      );
    }

    await invoke('set_webdav_config', { config });
    showToast('WebDAV ' + t('dataSync.settings.save') + ' OK', 2000);
    isWebDavSettingsOpen.value = false;
  } catch (e) {
    console.error('Save WebDAV settings failed:', e);
    showToast(t('dataSync.status.failed') + ': ' + e.message, 3000);
  }
}

export async function backupToWebDav(showToast) {
  if (!db.value) return;
  try {
    isSyncing.value = true;
    syncStatus.value = t('dataSync.status.preparing');
    
    await ensureWebDavConfigInBackend();

    const todos = await db.value.select('SELECT * FROM todos');
    const tags = await db.value.select('SELECT * FROM tags');
    const todoTags = await db.value.select('SELECT * FROM todo_tags');
    const archives = await db.value.select('SELECT * FROM archives');
    const settingsRow = await getSettingsRow();
    
    const data = {
      version: '0.1.2',
      exportDate: new Date().toISOString(),
      todos,
      tags,
      todoTags,
      archives,
      settings: settingsRow,
    };
    
    syncStatus.value = t('dataSync.status.uploading');
    const result = await invoke('backup_to_webdav', { data: JSON.stringify(data, null, 2) });
    
    syncStatus.value = t('dataSync.status.backupSuccess');
    isSyncing.value = false;
    showToast(t('dataSync.messages.backupSuccess'), 2000);
    sendNotification(t('dataSync.notifications.backupSuccess'), t('dataSync.notifications.backupSuccessDetail'));
  } catch (e) {
    console.error('WebDAV backup failed:', e);
    syncStatus.value = t('dataSync.status.failed') + ': ' + e;
    isSyncing.value = false;
    showToast(t('dataSync.status.failed') + ': ' + e, 3000);
  }
}

export async function restoreFromWebDav(showToast) {
  if (!db.value) return;
  try {
    isSyncing.value = true;
    syncStatus.value = t('dataSync.status.downloading');
    
    await ensureWebDavConfigInBackend();

    const dataStr = await invoke('restore_from_webdav');
    const data = JSON.parse(dataStr);
    
    syncStatus.value = t('dataSync.status.restoring');
    
    await db.value.execute('DELETE FROM todo_tags');
    await db.value.execute('DELETE FROM tags');
    await db.value.execute('DELETE FROM archives');
    await db.value.execute('DELETE FROM todos');
    
    if (data.todos && data.todos.length > 0) {
      for (const todo of data.todos) {
        await db.value.execute(
          'INSERT INTO todos (id, text, completed, from_yesterday, created_at, updated_at, tag_id, rolled_count, target_date, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [todo.id, todo.text, todo.completed ? 1 : 0, todo.from_yesterday ? 1 : 0, todo.created_at, todo.updated_at, todo.tag_id, todo.rolled_count || 0, todo.target_date, todo.is_demo || 0]
        );
      }
    }
    
    if (data.tags && data.tags.length > 0) {
      for (const tag of data.tags) {
        await db.value.execute(
          'INSERT INTO tags (id, name, color, is_demo) VALUES (?, ?, ?, ?)',
          [tag.id, tag.name, tag.color, tag.is_demo || 0]
        );
      }
    }
    
    if (data.todoTags && data.todoTags.length > 0) {
      for (const tt of data.todoTags) {
        await db.value.execute(
          'INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)',
          [tt.todo_id, tt.tag_id]
        );
      }
    }
    
    if (data.archives && data.archives.length > 0) {
      for (const archive of data.archives) {
        await db.value.execute(
          'INSERT INTO archives (id, date, content, created_at, is_demo) VALUES (?, ?, ?, ?, ?)',
          [archive.id, archive.date, archive.content, archive.created_at, archive.is_demo || 0]
        );
      }
    }
    
    if (data.settings) {
      await db.value.execute(
        'INSERT OR REPLACE INTO settings (id, api_key, api_provider, api_base_url, api_model, custom_daily_prompt, custom_review_prompt) VALUES (1, ?, ?, ?, ?, ?, ?)',
        [
          data.settings.api_key || '',
          data.settings.api_provider || 'deepseek',
          data.settings.api_base_url || 'https://api.deepseek.com',
          data.settings.api_model || 'deepseek-chat',
          data.settings.custom_daily_prompt || '',
          data.settings.custom_review_prompt || ''
        ]
      );
    }
    
    syncStatus.value = t('dataSync.status.restoreSuccess');
    isSyncing.value = false;
    showToast(t('dataSync.messages.restoreSuccess'), 3000);
    sendNotification(t('dataSync.notifications.restoreSuccess'), t('dataSync.notifications.restoreSuccessDetail'));
  } catch (e) {
    console.error('WebDAV restore failed:', e);
    syncStatus.value = t('dataSync.status.failed') + ': ' + e;
    isSyncing.value = false;
    showToast(t('dataSync.status.failed') + ': ' + e, 3000);
  }
}

export async function sendNotification(title, body) {
  try {
    await invoke('send_notification', { title, body });
  } catch (e) {
    console.error('Send notification failed:', e);
  }
}