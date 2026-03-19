<template>
  <div v-if="isThemeSettingsOpen" class="modal-overlay" @click.self="close">
    <div class="modal">
      <header class="modal__header">
        <h2>{{ t('themeSettings.title') }}</h2>
        <button @click="close" class="modal__close">&times;</button>
      </header>
      <div class="modal__body">
        <!-- Theme Mode -->
        <div class="theme-modes">
          <div
            v-for="(mode, key) in themeModes" :key="key"
            :class="['theme-mode-card', themeMode === key && 'theme-mode-card--active']"
            @click="themeMode = key"
          >
            <div class="theme-mode-card__icon">
              <component :is="mode.icon" :size="24" />
            </div>
            <h3>{{ mode.label }}</h3>
            <p>{{ mode.desc }}</p>
          </div>
        </div>

        <!-- Schedule (only for scheduled mode) -->
        <div v-if="themeMode === 'scheduled'" class="schedule-section">
          <div class="form-group">
            <label>{{ t('themeSettings.schedule.darkStartTime') }}</label>
            <input v-model="darkStartTime" type="time" class="form-input" />
          </div>
          <div class="form-group">
            <label>{{ t('themeSettings.schedule.darkEndTime') }}</label>
            <input v-model="darkEndTime" type="time" class="form-input" />
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button type="button" @click="handleSave" class="btn--primary">{{ t('themeSettings.save') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '../../composables/useI18n.js';
import { Monitor, Sun, Moon, Clock } from 'lucide-vue-next';
import { isThemeSettingsOpen, themeMode, darkStartTime, darkEndTime } from '../../composables/useDataSync.js';
import { saveThemeSettings } from '../../composables/useThemeSettings.js';

const { t } = useI18n();

const themeModes = {
  auto: {
    icon: Monitor,
    label: t('themeSettings.modes.auto'),
    desc: t('themeSettings.modes.autoDesc'),
  },
  light: {
    icon: Sun,
    label: t('themeSettings.modes.light'),
    desc: t('themeSettings.modes.lightDesc'),
  },
  dark: {
    icon: Moon,
    label: t('themeSettings.modes.dark'),
    desc: t('themeSettings.modes.darkDesc'),
  },
  scheduled: {
    icon: Clock,
    label: t('themeSettings.modes.scheduled'),
    desc: t('themeSettings.modes.scheduledDesc'),
  },
};

function close() {
  isThemeSettingsOpen.value = false;
}

async function handleSave() {
  await saveThemeSettings(props.showToast);
  close();
}

const props = defineProps({
  showToast: Function
});
</script>

<style scoped>
.theme-modes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.theme-mode-card {
  padding: 20px;
  border-radius: 12px;
  border: 2px solid var(--border-m);
  background: var(--bg-s2);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.theme-mode-card:hover {
  border-color: var(--purple-500);
  background: var(--bg-s3);
}

.theme-mode-card--active {
  border-color: var(--purple-500);
  background: rgba(139, 92, 246, 0.1);
}

.theme-mode-card__icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: var(--bg-s5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-300);
}

.theme-mode-card h3 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-white);
}

.theme-mode-card p {
  margin: 0;
  font-size: 11px;
  color: var(--text-500);
  line-height: 1.4;
}

.schedule-section {
  padding: 20px;
  background: var(--bg-s2);
  border-radius: 12px;
  border: 1px solid var(--border-m);
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-400);
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-m);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-white);
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.form-input:focus {
  border-color: var(--purple-500);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.btn--primary {
  background: var(--purple-500);
  border: 1px solid var(--purple-500);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
}

.btn--primary:hover {
  opacity: 0.9;
}
</style>