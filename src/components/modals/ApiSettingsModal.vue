<template>
  <div class="modal-overlay" @click.self="isApiSettingsOpen = false">
    <div class="modal modal--md">
      <h2 class="modal__title"><KeyRound :size="18" color="var(--purple-500)" /><span>API 设置</span></h2>
      <div class="form-group">
        <label class="form-label">API 供应商</label>
        <select v-model="apiProviderInput" @change="onProviderChange" class="form-select">
          <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.label }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">API 密钥 (API Key)</label>
        <input type="password" v-model="apiKeyInput" placeholder="sk-..." class="form-input form-input--mono" />
      </div>
      <div class="form-group">
        <label class="form-label">接口地址 (Base URL)</label>
        <input type="text" v-model="apiBaseUrlInput" placeholder="https://..." class="form-input form-input--mono" />
      </div>
      <div class="form-group">
        <label class="form-label">模型名称 (Model)</label>
        <input type="text" v-model="apiModelInput" placeholder="deepseek-chat" class="form-input form-input--mono" />
      </div>
      <p class="form-hint">密钥仅加密保存在本地 SQLite 数据库中。</p>
      <div class="modal__footer">
        <button @click="isApiSettingsOpen = false" class="btn-text">取消</button>
        <button @click="saveApiSettings(showToast)" class="btn-purple">保存配置</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { KeyRound } from 'lucide-vue-next';
import { isApiSettingsOpen, apiKeyInput, apiProviderInput, apiBaseUrlInput, apiModelInput, providers, onProviderChange, saveApiSettings } from '../../composables/useSettings.js';
defineProps({ showToast: { type: Function, required: true } });
</script>
