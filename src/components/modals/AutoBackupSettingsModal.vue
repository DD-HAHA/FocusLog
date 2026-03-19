<template>
  <div v-if="isAutoBackupSettingsOpen" class="modal-overlay" @click.self="close">
    <div class="modal">
      <header class="modal__header">
        <h2>{{ t('dataSync.autoBackup.title') }}</h2>
        <button @click="close" class="modal__close">&times;</button>
      </header>
      <div class="modal__body">
        <!-- Enable -->
        <div class="setting-item">
          <div class="setting-item__info">
            <h3>{{ t('dataSync.autoBackup.enabled') }}</h3>
            <p>{{ t('dataSync.autoBackup.enabledDesc') }}</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="autoBackupEnabled" />
            <span class="toggle-switch__slider"></span>
          </label>
        </div>

        <!-- Interval -->
        <div class="setting-item">
          <div class="setting-item__info">
            <h3>{{ t('dataSync.autoBackup.interval') }}</h3>
            <p>{{ t('dataSync.autoBackup.intervalDesc') }}</p>
          </div>
          <select v-model="autoBackupInterval" class="form-select">
            <option value="hourly">{{ t('dataSync.intervals.hourly') }}</option>
            <option value="daily">{{ t('dataSync.intervals.daily') }}</option>
            <option value="weekly">{{ t('dataSync.intervals.weekly') }}</option>
            <option value="monthly">{{ t('dataSync.intervals.monthly') }}</option>
          </select>
        </div>

        <!-- Mode -->
        <div class="setting-item">
          <div class="setting-item__info">
            <h3>{{ t('dataSync.autoBackup.mode') }}</h3>
            <p>{{ t('dataSync.autoBackup.modeDesc') }}</p>
          </div>
          <select v-model="autoBackupMode" class="form-select">
            <option value="overwrite">{{ t('dataSync.autoBackup.modes.overwrite') }}</option>
            <option value="timestamp">{{ t('dataSync.autoBackup.modes.timestamp') }}</option>
          </select>
        </div>

        <!-- Retention -->
        <div class="setting-item">
          <div class="setting-item__info">
            <h3>{{ t('dataSync.autoBackup.retention') }}</h3>
            <p>{{ t('dataSync.autoBackup.retentionDesc') }}</p>
          </div>
          <input type="number" v-model.number="autoBackupRetention" min="0" class="form-input" style="width: 100px;" />
        </div>

        <!-- Last Backup -->
        <div class="setting-item setting-item--info-only">
          <div class="setting-item__info">
            <h3>{{ t('dataSync.autoBackup.lastBackup') }}</h3>
            <p>{{ lastBackupTime ? formatDate(lastBackupTime) : t('dataSync.autoBackup.never') }}</p>
          </div>
          <button @click="handleBackupNow" :disabled="isSyncing || !autoBackupEnabled" class="btn--primary">
            {{ t('dataSync.autoBackup.now') }}
          </button>
        </div>
      </div>
      <div class="modal__footer">
        <button type="button" @click="handleSave" class="btn--primary">{{ t('dataSync.settings.save') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '../../composables/useI18n.js';
import {
  autoBackupEnabled,
  autoBackupInterval,
  autoBackupMode,
  autoBackupRetention,
  lastBackupTime,
  saveAutoBackupSettings,
  performAutoBackup
} from '../../composables/useAutoBackup.js';
import { isSyncing, isAutoBackupSettingsOpen } from '../../composables/useDataSync.js';

const { t } = useI18n();

function close() {
  isAutoBackupSettingsOpen.value = false;
}

async function handleSave() {
  await saveAutoBackupSettings(props.showToast);
  close();
}

async function handleBackupNow() {
  const success = await performAutoBackup();
  if (success) {
    props.showToast(t('dataSync.messages.autoBackupSuccess'), 2000);
  }
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

const props = defineProps({
  showToast: Function
});
</script>

<style scoped>
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-m);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item__info h3 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-white);
}

.setting-item__info p {
  margin: 0;
  font-size: 12px;
  color: var(--text-500);
}

.setting-item--info-only {
  align-items: flex-start;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch__slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-l);
  transition: .4s;
  border-radius: 24px;
}

.toggle-switch__slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-switch__slider {
  background-color: var(--purple-500);
}

.toggle-switch input:checked + .toggle-switch__slider:before {
  transform: translateX(24px);
}

.form-select {
  width: 150px;
  background: var(--bg-input);
  border: 1px solid var(--border-m);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text-white);
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.form-select:focus {
  border-color: var(--purple-500);
}

.form-input {
  background: var(--bg-input);
  border: 1px solid var(--border-m);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text-white);
  font-size: 14px;
  outline: none;
}

.form-input:focus {
  border-color: var(--purple-500);
}

.btn--primary {
  background: var(--purple-500);
  border: 1px solid var(--purple-500);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>