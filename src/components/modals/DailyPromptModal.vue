<template>
  <div class="modal-overlay" @click.self="isDailyPromptOpen = false">
    <div class="modal modal--lg">
      <h2 class="modal__title"><Sparkles :size="18" color="var(--orange-400)" /><span>AI 日志提示词</span></h2>
      <p class="modal__desc">自定义生成「今日总结」时的系统提示词。留空则使用默认范本。<br>支持占位符：<code style="color:var(--purple-400)">{date}</code>, <code style="color:var(--purple-400)">{completedCount}</code>, <code style="color:var(--purple-400)">{todosText}</code></p>
      <textarea v-model="customDailyPromptInput" placeholder="留空以使用预设提示词..." class="form-textarea"></textarea>
      <div class="modal__footer">
        <button @click="isDailyPromptOpen = false" class="btn-text">取消</button>
        <button @click="saveDailyPrompt(showToast)" class="btn-purple">保存</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { Sparkles } from 'lucide-vue-next';
import { isDailyPromptOpen, customDailyPromptInput, saveDailyPrompt } from '../../composables/useSettings.js';
defineProps({ showToast: { type: Function, required: true } });
</script>
