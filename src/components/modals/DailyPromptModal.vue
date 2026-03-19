<template>
  <div class="modal-overlay" @click.self="isDailyPromptOpen = false">
    <div class="modal modal--lg">
      <header class="modal__header">
        <h2 class="modal__title"><Sparkles :size="18" color="var(--orange-400)" /><span>AI 日志提示词</span></h2>
        <button type="button" class="modal__close" @click="isDailyPromptOpen = false" aria-label="关闭">&times;</button>
      </header>
      <p class="modal__desc">选择职位角色快速填充预设提示词，或自定义生成「今日总结」时的系统提示词。<br>支持占位符：<code style="color:var(--purple-400)">{date}</code>, <code style="color:var(--purple-400)">{completedCount}</code>, <code style="color:var(--purple-400)">{todosText}</code></p>
      
      <!-- 角色选择 -->
      <div class="preset-section">
        <label class="preset-label">快速选择角色</label>
        <div class="preset-grid">
          <button
            v-for="preset in dailyPromptPresets"
            :key="preset.id"
            type="button"
            :class="['preset-chip', { 'preset-chip--active': selectedPresetId === preset.id }]"
            @click="selectPreset(preset)"
          >
            <span class="preset-chip__icon">{{ preset.icon }}</span>
            <span class="preset-chip__label">{{ preset.label }}</span>
          </button>
        </div>
      </div>

      <textarea v-model="customDailyPromptInput" placeholder="留空以使用预设提示词..." class="form-textarea"></textarea>
      <div class="modal__footer">
        <button @click="resetToDefault" class="btn-text">重置默认</button>
        <button @click="saveDailyPrompt(showToast)" class="btn-purple">保存</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, watch } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import { isDailyPromptOpen, customDailyPromptInput, saveDailyPrompt, dailyPromptPresets, DEFAULT_DAILY_PROMPT_CN } from '../../composables/useSettings.js';
defineProps({ showToast: { type: Function, required: true } });

const selectedPresetId = ref(null);

function selectPreset(preset) {
  selectedPresetId.value = preset.id;
  customDailyPromptInput.value = preset.prompt;
}

function resetToDefault() {
  selectedPresetId.value = null;
  customDailyPromptInput.value = DEFAULT_DAILY_PROMPT_CN;
}

// 当弹窗打开时，检测当前提示词是否匹配某个预设
watch(isDailyPromptOpen, (isOpen) => {
  if (isOpen) {
    const current = customDailyPromptInput.value.trim();
    const matched = dailyPromptPresets.find(p => p.prompt.trim() === current);
    selectedPresetId.value = matched ? matched.id : null;
  }
});
</script>
<style scoped>
.preset-section {
  margin-bottom: 12px;
}
.preset-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary, #888);
  margin-bottom: 8px;
}
.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.preset-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--border-color, #333);
  background: transparent;
  color: var(--text-primary, #eee);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.preset-chip:hover {
  border-color: var(--purple-400);
  background: var(--purple-400, #a855f7);
  background: rgba(168, 85, 247, 0.1);
}
.preset-chip--active {
  border-color: var(--purple-400, #a855f7);
  background: rgba(168, 85, 247, 0.15);
  color: var(--purple-400, #a855f7);
}
.preset-chip__icon {
  font-size: 14px;
}
.preset-chip__label {
  font-weight: 500;
  color: var(--text-400);
}
</style>
