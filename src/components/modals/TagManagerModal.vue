<template>
  <div class="modal-overlay" @click.self="closeTagManager">
    <div class="modal modal--md">
      <h2 class="modal__title"><Tags :size="18" color="var(--purple-500)" /><span>管理标签</span></h2>
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div class="form-group">
          <label class="form-label">标签名称</label>
          <input type="text" v-model="tagNameInput" placeholder="例如：工作、学习、Side Project..." class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">标签颜色</label>
          <div class="color-swatches">
            <button v-for="color in tagColorPresets" :key="color" type="button" @click="tagColorInput = color" class="color-swatch" :style="{ backgroundColor: color }">
              <div v-if="tagColorInput === color" class="color-swatch__check"></div>
            </button>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button type="button" @click="addTag" class="btn-purple" :disabled="!tagNameInput.trim()" :style="{ opacity: tagNameInput.trim() ? 1 : 0.4 }">添加标签</button>
        </div>
        <div class="tag-manager-list">
          <p style="font-size:.75rem;color:var(--text-500);margin:0 0 4px;">已有标签</p>
          <div v-if="tags.length === 0" class="tag-manager-empty">暂无标签，请先在上方添加。</div>
          <div v-else style="display:flex;flex-direction:column;gap:8px;">
            <div v-for="tag in tags" :key="tag.id" class="tag-manager-item">
              <div class="tag-manager-item__left">
                <span class="tag-manager-dot" :style="{ backgroundColor: tag.color }"></span>
                <span class="tag-manager-name">{{ tag.name }}</span>
              </div>
              <button type="button" @click="handleDeleteTag(tag.id)" class="tag-manager-delete">删除</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button type="button" @click="closeTagManager" class="btn-text">关闭</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { Tags } from 'lucide-vue-next';
import { tags, tagNameInput, tagColorInput, tagColorPresets, isTagManagerOpen, closeTagManager, addTag, deleteTagItem } from '../../composables/useTags.js';
import { newTodoSelectedTagIds, todoTagsByTodoId, loadTodoTags } from '../../composables/useTodos.js';

async function handleDeleteTag(id) {
  await deleteTagItem(id, newTodoSelectedTagIds, todoTagsByTodoId);
  await loadTodoTags();
}
</script>
