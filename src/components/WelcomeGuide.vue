<template>
  <transition name="fade">
    <div v-if="showGuide" class="guide-overlay" @click.self="skipGuide">
      <div class="guide-modal">
        <div class="guide-header">
          <img src="../assets/logo_simple_padded.png" alt="FocusLog" class="guide-logo" />
          <h2 class="guide-title">欢迎使用 FocusLog</h2>
          <p class="guide-subtitle">一款专注效率的 AI 工作日志工具</p>
        </div>

        <div class="guide-features">
          <div class="guide-feature">
            <div class="guide-feature__icon">📝</div>
            <div class="guide-feature__text">
              <h4>任务管理</h4>
              <p>快速记录每日任务，支持标签分类和推迟</p>
            </div>
          </div>
          <div class="guide-feature">
            <div class="guide-feature__icon">🤖</div>
            <div class="guide-feature__text">
              <h4>AI 日志</h4>
              <p>一键生成工作日报，支持多种角色模板</p>
            </div>
          </div>
          <div class="guide-feature">
            <div class="guide-feature__icon">📊</div>
            <div class="guide-feature__text">
              <h4>数据洞察</h4>
              <p>热力图追踪完成情况，周报/月报回顾</p>
            </div>
          </div>
        </div>

        <div class="guide-actions">
          <button class="guide-btn guide-btn--primary" @click="loadDemo">
            <Sparkles :size="16" />
            加载示例数据体验
          </button>
          <button class="guide-btn guide-btn--secondary" @click="startFresh">
            我要从零开始
          </button>
        </div>

        <p class="guide-tip">提示：示例数据可在设置中随时清除</p>
      </div>
    </div>
  </transition>
</template>
<script setup>
import { ref, watch } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import { db } from '../composables/useDb.js';
import { seedDemoData } from '../composables/useDemoData.js';

const props = defineProps({
  dbReady: { type: Boolean, default: false }
});

const showGuide = ref(false);

watch(() => props.dbReady, async (ready) => {
  if (!ready || !db.value) return;
  
  try {
    // Check if user has any non-demo todos
    const rows = await db.value.select('SELECT COUNT(*) as count FROM todos WHERE is_demo = 0 OR is_demo IS NULL');
    const count = rows[0]?.count || 0;
    
    // Check if guide has been shown before
    const guideShown = localStorage.getItem('focuslog_guide_shown');
    
    if (count === 0 && !guideShown) {
      // Small delay to let the app render
      setTimeout(() => { showGuide.value = true; }, 500);
    }
  } catch (e) {
    console.error('Guide check failed:', e);
  }
}, { immediate: true });

async function loadDemo() {
  showGuide.value = false;
  localStorage.setItem('focuslog_guide_shown', 'true');
  await seedDemoData();
}

function startFresh() {
  showGuide.value = false;
  localStorage.setItem('focuslog_guide_shown', 'true');
}

function skipGuide() {
  showGuide.value = false;
  localStorage.setItem('focuslog_guide_shown', 'true');
}
</script>
<style scoped>
.guide-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.guide-modal {
  background: var(--bg-modal);
  border: 1px solid var(--border-m);
  border-radius: var(--r-2xl);
  padding: 40px;
  max-width: 440px;
  width: 90%;
  text-align: center;
}

.guide-header {
  margin-bottom: 32px;
}

.guide-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
}

.guide-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-white);
  margin: 0 0 8px;
}

.guide-subtitle {
  font-size: 14px;
  color: var(--text-400);
  margin: 0;
}

.guide-features {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
  text-align: left;
}

.guide-feature {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: var(--bg-s3);
  border-radius: var(--r-lg);
}

.guide-feature__icon {
  font-size: 24px;
  line-height: 1;
}

.guide-feature__text h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-white);
  margin: 0 0 4px;
}

.guide-feature__text p {
  font-size: 13px;
  color: var(--text-400);
  margin: 0;
}

.guide-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.guide-btn {
  width: 100%;
  padding: 14px 24px;
  border-radius: var(--r-lg);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
}

.guide-btn--primary {
  background: var(--purple-500);
  color: white;
}

.guide-btn--primary:hover {
  background: var(--purple-400);
}

.guide-btn--secondary {
  background: transparent;
  color: var(--text-400);
  border: 1px solid var(--border-m);
}

.guide-btn--secondary:hover {
  color: var(--text-white);
  border-color: var(--border-l);
}

.guide-tip {
  font-size: 12px;
  color: var(--text-500);
  margin: 16px 0 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
