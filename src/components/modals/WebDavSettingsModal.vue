<template>
  <div v-if="isWebDavSettingsOpen" class="modal-overlay" @click.self="close">
    <div class="modal modal--small">
      <header class="modal__header">
        <h2>{{ t('dataSync.settings.title') }}</h2>
        <button @click="close" class="modal__close">&times;</button>
      </header>
      <form @submit.prevent="handleSubmit" class="modal__body">
        <div class="form-group">
          <label>{{ t('dataSync.settings.url') }}</label>
          <input v-model="webdavUrl" type="url" placeholder="https://dav.example.com" required />
        </div>
        <div class="form-group">
          <label>{{ t('dataSync.settings.username') }}</label>
          <input v-model="webdavUsername" type="text" placeholder="username" required />
        </div>
        <div class="form-group">
          <label>{{ t('dataSync.settings.password') }}</label>
          <input v-model="webdavPassword" type="password" placeholder="••••••••" required />
        </div>
        <div class="form-group">
          <label>{{ t('dataSync.settings.path') }}</label>
          <input v-model="webdavPath" type="text" placeholder="/focuslog-backup.json" />
        </div>
        <div class="modal__footer">
          <button type="submit" class="btn--primary">{{ t('dataSync.settings.save') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '../../composables/useI18n.js';
import { webdavUrl, webdavUsername, webdavPassword, webdavPath, isWebDavSettingsOpen, saveWebDavSettings } from '../../composables/useDataSync.js';

const { t } = useI18n();

function close() {
  isWebDavSettingsOpen.value = false;
}

function handleSubmit() {
  saveWebDavSettings(props.showToast);
}

const props = defineProps({
  showToast: Function
});
</script>

<style scoped>
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: var(--text-400);
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-m);
  border-radius: 8px;
  padding: 10px 16px;
  color: var(--text-white);
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.form-group input::placeholder {
  color: var(--text-600);
}

.form-group input:focus {
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.modal__footer button {
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal__footer button[type="button"] {
  background: none;
  border: 1px solid var(--border-m);
  color: var(--text-300);
}

.modal__footer button[type="button"]:hover {
  background: var(--bg-s5);
  color: var(--text-white);
}

.modal__footer button[type="submit"] {
  background: var(--primary-color);
  border: 1px solid var(--primary-color);
  color: white;
}

.modal__footer button[type="submit"]:hover {
  opacity: 0.9;
}
</style>