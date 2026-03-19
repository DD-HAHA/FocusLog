<template>
  <div class="modal-overlay" @click.self="isReviewPromptOpen = false">
    <div class="modal modal--lg">
      <header class="modal__header">
        <h2 class="modal__title"><Archive :size="18" color="var(--cyan-400)" /><span>AI 归档提示词</span></h2>
        <button type="button" class="modal__close" @click="isReviewPromptOpen = false" aria-label="关闭">&times;</button>
      </header>
      <p class="modal__desc">自定义生成「阶段性回顾报告」时的系统提示词。留空则使用默认范本。</p>
      <textarea v-model="customReviewPromptInput" placeholder="留空以使用预设提示词..." class="form-textarea"></textarea>
      <div class="modal__footer">
        <button @click="saveReviewPrompt(showToast)" class="btn-purple">保存</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { Archive } from 'lucide-vue-next';
import { isReviewPromptOpen, customReviewPromptInput, saveReviewPrompt } from '../../composables/useSettings.js';
defineProps({ showToast: { type: Function, required: true } });
</script>
