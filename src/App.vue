<template>
  <div class="flex h-screen bg-[#0B0B0B] text-gray-200 font-sans selection:bg-purple-500/30 overflow-hidden">
    <!-- 侧边栏 Sidebar -->
    <aside class="w-64 border-r border-white/5 flex flex-col p-6 space-y-8 bg-[#0B0B0B]">
      <div class="flex items-center space-x-2 px-2">
        <img src="./assets/logo_simple_padded.png" alt="FocusLog Logo" class="w-8 h-8 rounded-lg shadow-[0_0_15px_rgba(139,92,246,0.3)] object-cover" />
        <span class="font-bold tracking-tight text-white text-lg">FocusLog</span>
      </div>
      
      <nav class="flex-1 space-y-1">
        <div
          v-for="tab in tabs" :key="tab.id"
          @click="currentView = tab.id"
          :class="currentView === tab.id ? 'bg-white/5 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-white'"
          class="flex items-center space-x-3 px-3 py-2 rounded-lg transition-all cursor-pointer"
        >
          <component :is="tab.icon" :size="18" />
          <span class="text-sm">{{ tab.label }}</span>
        </div>

      </nav>

      <!-- 标签过滤 -->
      <div class="mt-4 px-2 space-y-2">
        <div class="flex items-center justify-between text-[11px] text-gray-500 uppercase tracking-wide">
          <span>标签</span>
          <button
            v-if="activeTagFilterId"
            type="button"
            class="text-[10px] text-gray-500 hover:text-purple-400"
            @click="clearTagFilter"
          >
            清除筛选
          </button>
        </div>
        <div v-if="tags.length === 0" class="text-[11px] text-gray-600">
          暂无标签，可在任务输入框标签弹窗中点击「设置」添加。
        </div>
        <div v-else class="space-y-1">
          <button
            v-for="tag in tags"
            :key="tag.id"
            type="button"
            class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors"
            :class="activeTagFilterId === tag.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
            @click="toggleTagFilter(tag.id)"
          >
            <div class="flex items-center space-x-2">
              <span
                class="w-2.5 h-2.5 rounded-full"
                :style="{ backgroundColor: tag.color }"
              ></span>
              <span>{{ tag.name }}</span>
            </div>
            <span class="text-[10px] text-gray-500">
              {{ tagIncompleteCount[tag.id] || 0 }}
            </span>
          </button>
        </div>
      </div>

      <div class="px-3 py-4 text-[10px] text-gray-600 border-t border-white/5 space-y-2">
        <div class="flex items-center space-x-2">
          <div :class="dbReady ? 'bg-green-500' : 'bg-yellow-500'" class="w-1.5 h-1.5 rounded-full animate-pulse"></div>
          <span>{{ dbReady ? 'SQLite 已连接: focus_log.db' : '正在连接数据库...' }}</span>
        </div>
        <p v-if="initError" class="text-red-400 break-all">{{ initError }}</p>
      </div>
    </aside>

    <!-- 主容器 Main Content -->
    <main class="flex-1 flex flex-col items-center overflow-y-auto pt-20 pb-20 relative">
      <div class="w-full max-w-2xl px-6">

        <!-- ══════ 今日待办 ══════ -->
        <div v-show="currentView === 'today'">
          <header class="mb-8">
            <h1 class="text-3xl font-semibold text-white mb-2 tracking-tight">Focus.</h1>
            <p class="text-gray-500 text-sm font-light">今天是 {{ todayStr }}</p>
          </header>

          <!-- 贡献热力图（过去一年） -->
          <section class="mb-8">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] uppercase tracking-wide text-gray-500">
                过去一年的完成记录
                <span v-if="activeTagFilterId" class="text-purple-400/90 font-normal normal-case">
                  （仅「{{ (tags.find(t => t.id === activeTagFilterId) || {}).name || '' }}」）
                </span>
              </span>
              <span v-if="!heatmapLoading && heatmapWeeks.length" class="text-[11px] text-gray-600">最近 52 周</span>
            </div>
            <div class="relative">
              <div class="overflow-x-auto pb-1" ref="heatmapScrollEl">
                <div class="inline-flex space-x-1 min-h-[52px]">
                  <div
                    v-for="(week, wIndex) in heatmapWeeks"
                    :key="wIndex"
                    class="flex flex-col space-y-1"
                  >
                    <div
                      v-for="day in week"
                      :key="day.date"
                      class="w-3 h-3 rounded-sm transition-colors duration-150"
                      :class="[
                        day.isFuture ? 'bg-transparent' : getHeatmapCellClass(day),
                        (heatmapSelectedDate === day.date && !day.isFuture) ? 'ring-1 ring-white/50 ring-inset' : '',
                        !day.isFuture ? 'cursor-pointer' : ''
                      ]"
                      @mouseenter="!day.isFuture && showHeatmapTooltip(day, $event)"
                      @mouseleave="hideHeatmapTooltip"
                      @click="!day.isFuture && selectHeatmapDate(day.date)"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Tooltip -->
              <div
                v-if="heatmapTooltip.visible"
                class="fixed z-40 px-2 py-1 rounded-md bg-black/80 border border-white/10 text-[11px] text-gray-100 shadow-lg pointer-events-none"
                :style="{ left: heatmapTooltip.x + 'px', top: heatmapTooltip.y + 'px' }"
              >
                <div class="font-medium">{{ heatmapTooltip.date }}</div>
                <div class="text-gray-400">完成 {{ heatmapTooltip.count }} 个任务</div>
              </div>
            </div>
          </section>

          <!-- 选中热力图某天后：变为只读模式 -->
          <div
            v-if="heatmapSelectedDate"
            class="mb-4 flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
          >
            <span class="text-[11px] text-gray-400">正在查看 <span class="text-gray-200">{{ heatmapSelectedDate }}</span> 的历史记录（只读模式）</span>
            <button
              type="button"
              class="text-[11px] text-gray-500 hover:text-purple-400"
              @click="clearHeatmapDate"
            >
              退出只读模式 · 查看今日
            </button>
          </div>

          <div v-if="!heatmapSelectedDate" class="relative mb-3 group">
            <div class="absolute inset-y-0 left-4 flex items-center text-gray-500">
              <Plus :size="18" />
            </div>
            <input 
              ref="newTodoInput"
              type="text" 
              v-model="newTodo"
              @input="handleTodoInput"
              @keydown="handleTodoKeydown"
              placeholder="添加一项任务... (支持 #标签名 快捷选择，Enter 保存)"
              class="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-12 pr-12 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all shadow-2xl"
            />
            
            <!-- 标签自动完成下拉框 -->
            <div
              v-if="mentionState.visible"
              class="absolute left-4 top-full mt-2 w-48 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-30 py-2"
              @mousedown.prevent
            >
              <div v-if="filteredMentionTags.length === 0" class="px-3 py-1 text-[11px] text-gray-500">
                按 Enter 回车可直接新建名为 "{{ mentionState.query }}" 的标签
              </div>
              <div v-else class="space-y-0.5 max-h-48 overflow-y-auto px-1.5">
                <button
                  v-for="(tag, index) in filteredMentionTags"
                  :key="tag.id"
                  type="button"
                  class="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                  :class="mentionState.selectedIndex === index ? 'bg-purple-600/30 text-white' : 'text-gray-300 hover:bg-white/[0.06]'"
                  @mousedown.prevent="selectMentionTag(tag)"
                >
                  <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: tag.color }"></span>
                  <span>{{ tag.name }}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              class="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-200 transition-colors"
              @click.stop="createTagPopoverOpen = !createTagPopoverOpen"
            >
              <div class="relative flex items-center">
                <Tags :size="18" />
                <span
                  v-if="selectedTagsForNewTodo.length"
                  class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500"
                ></span>
              </div>
            </button>

            <!-- 标签选择 Popover -->
            <div
              v-if="createTagPopoverOpen"
              class="absolute right-0 top-full mt-2 w-60 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-30 p-3"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] text-gray-400">为新任务选择标签</span>
                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    class="text-[11px] text-gray-500 hover:text-purple-400"
                    @click.stop="openTagManager(); createTagPopoverOpen = false"
                  >
                    设置
                  </button>
                  <button
                    type="button"
                    class="text-[11px] text-gray-500 hover:text-gray-300"
                    @click.stop="createTagPopoverOpen = false"
                  >
                    关闭
                  </button>
                </div>
              </div>

              <div v-if="tags.length === 0" class="text-[11px] text-gray-600 py-2">
                还没有标签，可以点击右上角「设置」先创建。
              </div>
              <div v-else class="space-y-1 max-h-52 overflow-y-auto">
                <button
                  v-for="tag in tags"
                  :key="tag.id"
                  type="button"
                  class="w-full flex items-center justify-between px-2 py-1 rounded-lg hover:bg-white/[0.06] text-xs text-gray-200"
                  @click.stop="toggleNewTodoTag(tag.id)"
                >
                  <div class="flex items-center space-x-2">
                    <span
                      class="w-3 h-3 rounded-full"
                      :style="{ backgroundColor: tag.color }"
                    ></span>
                    <span>{{ tag.name }}</span>
                  </div>
                  <span
                    v-if="newTodoSelectedTagIds.includes(tag.id)"
                    class="text-[10px] text-purple-400"
                  >
                    已选
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="selectedTagsForNewTodo.length"
            class="mb-6 flex items-center space-x-2 text-[11px] text-gray-500"
          >
            <span>已选中：</span>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="tag in selectedTagsForNewTodo"
                :key="tag.id"
                type="button"
                class="px-2 py-0.5 rounded-full border text-[10px] bg-white/[0.02] hover:bg-white/10 transition-colors flex items-center group cursor-pointer"
                :style="{ borderColor: tag.color, color: tag.color }"
                @click="toggleNewTodoTag(tag.id)"
                title="点击移除标签"
              >
                <span>{{ tag.name }}</span>
                <span class="ml-1 opacity-40 group-hover:opacity-100">&times;</span>
              </button>
            </div>
          </div>

          <div class="space-y-3">
            <div 
              v-for="todo in displayedActiveTodos" :key="todo.id"
              class="group flex items-center space-x-4 bg-white/[0.01] border border-white/[0.05] p-4 rounded-xl hover:bg-white/[0.03] hover:border-white/10 transition-all cursor-pointer"
            >
              <div 
                @click.stop="toggleTodo(todo)"
                class="w-5 h-5 border-2 border-white/20 rounded-md group-hover:border-purple-500/50 flex items-center justify-center transition-all bg-transparent"
              >
                <Check v-if="todo.completed" :size="12" class="text-white" />
              </div>
              <div class="flex-1">
                <input
                  v-if="editingTodoId === todo.id"
                  v-model="editingText"
                  @keyup.enter="saveEdit(todo)"
                  @blur="saveEdit(todo)"
                  @keydown.esc="cancelEdit"
                  class="w-full bg-transparent border-b border-white/20 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                />
                <div v-else class="space-y-1">
                  <span
                    class="text-gray-300 text-sm"
                    @dblclick.stop="startEdit(todo)"
                  >
                    {{ todo.text }}
                  </span>
                  <div
                    v-if="getTagsForTodo(todo).length"
                    class="flex flex-wrap gap-1 mt-0.5"
                  >
                    <span
                      v-for="tag in getTagsForTodo(todo)"
                      :key="tag.id"
                      class="px-1.5 py-0.5 rounded-full text-[10px] bg-white/[0.03] border"
                      :style="{ borderColor: tag.color, color: tag.color }"
                    >
                      {{ tag.name }}
                    </span>
                  </div>
                </div>
              </div>
              <span v-if="todo.from_yesterday" class="text-[10px] text-orange-500/70 px-2 py-0.5 bg-orange-500/5 border border-orange-500/10 rounded italic font-light">昨日延宕</span>
              <span
                v-if="(todo.rolled_count || 0) > 3"
                class="inline-flex items-center text-amber-500/60 hover:text-amber-500/90 transition-colors cursor-help"
                :title="`该任务已拖延 ${todo.rolled_count} 天`"
              >
                <Flame :size="14" class="opacity-70" />
              </span>
              <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-2 transition-all">
                <div class="relative flex items-center">
                  <button @click.stop="toggleSnoozePopoverForTodo(todo.id)" class="text-gray-500 hover:text-orange-400 transition-colors p-1" title="推迟任务">
                    <Clock :size="15" />
                  </button>
                  
                  <!-- 推迟任务 Popover -->
                  <div
                    v-if="activeTodoSnoozePopoverId === todo.id"
                    class="absolute right-0 top-full mt-2 w-40 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-30 py-2"
                  >
                    <div class="px-3 pb-2 mb-2 border-b border-white/10 flex items-center justify-between">
                      <span class="text-[11px] text-gray-400">推迟至...</span>
                      <button @click.stop="activeTodoSnoozePopoverId = null" class="text-[11px] text-gray-500 hover:text-gray-300">关闭</button>
                    </div>
                    <div class="space-y-1 px-1.5">
                      <button
                        type="button"
                        class="w-full flex items-center px-2 py-1.5 rounded-lg hover:bg-white/[0.06] text-xs text-gray-200"
                        @click.stop="snoozeTodo(todo, 1)"
                      >
                        🌞 明天
                      </button>
                      <button
                        type="button"
                        class="w-full flex items-center px-2 py-1.5 rounded-lg hover:bg-white/[0.06] text-xs text-gray-200"
                        @click.stop="snoozeTodo(todo, 7)"
                      >
                        📆 下周
                      </button>
                    </div>
                  </div>
                </div>

                <div class="relative flex items-center">
                  <button @click.stop="toggleTagPopoverForTodo(todo.id)" class="text-gray-500 hover:text-purple-400 transition-colors p-1" title="修改标签">
                    <Tags :size="15" />
                  </button>
                  
                  <!-- 修改现存任务的标签 Popover -->
                  <div
                    v-if="activeTodoTagPopoverId === todo.id"
                    class="absolute right-0 top-full mt-2 w-52 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-30 py-2"
                  >
                    <div class="px-3 pb-2 mb-2 border-b border-white/10 flex items-center justify-between">
                      <span class="text-[11px] text-gray-400">修改标签</span>
                      <button @click.stop="activeTodoTagPopoverId = null" class="text-[11px] text-gray-500 hover:text-gray-300">关闭</button>
                    </div>
                    <div v-if="tags.length === 0" class="px-3 text-[11px] text-gray-600">暂无标签项</div>
                    <div v-else class="space-y-1 max-h-48 overflow-y-auto px-1.5">
                      <button
                        v-for="tag in tags"
                        :key="tag.id"
                        type="button"
                        class="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.06] text-xs text-gray-200"
                        @click.stop="toggleExistingTodoTag(todo, tag.id)"
                      >
                        <div class="flex items-center space-x-2">
                          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: tag.color }"></span>
                          <span>{{ tag.name }}</span>
                        </div>
                        <Check v-if="(todoTagsByTodoId[todo.id] || []).includes(tag.id)" :size="12" class="text-purple-400" />
                      </button>
                    </div>
                  </div>
                </div>

                <button @click.stop="startEdit(todo)" class="text-gray-500 hover:text-blue-400 transition-colors p-1" title="编辑任务">
                  <Pencil :size="15" />
                </button>
                <button @click.stop="deleteTodo(todo.id)" class="text-gray-500 hover:text-red-400 transition-colors p-1" title="删除">
                  <Trash2 :size="15" />
                </button>
              </div>
            </div>

            <div v-if="displayedCompletedTodos.length > 0" class="flex items-center py-8">
              <div class="flex-1 h-[1px] bg-white/5"></div>
              <span class="px-4 text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold">已完成</span>
              <div class="flex-1 h-[1px] bg-white/5"></div>
            </div>

            <div 
              v-for="todo in displayedCompletedTodos" :key="todo.id"
              class="flex items-center space-x-4 opacity-40 px-4 group"
            >
              <div @click="toggleTodo(todo)" class="w-5 h-5 bg-purple-600/80 rounded flex items-center justify-center cursor-pointer">
                <Check :size="12" class="text-white" />
              </div>
              <div class="flex-1">
                <input
                  v-if="editingTodoId === todo.id"
                  v-model="editingText"
                  @keyup.enter="saveEdit(todo)"
                  @blur="saveEdit(todo)"
                  @keydown.esc="cancelEdit"
                  class="w-full bg-transparent border-b border-white/20 text-sm text-gray-400 line-through focus:outline-none focus:border-purple-500"
                />
                <div v-else class="space-y-1">
                  <span
                    class="flex-1 line-through text-gray-400 text-sm font-light"
                    @dblclick.stop="startEdit(todo)"
                  >
                    {{ todo.text }}
                  </span>
                  <div
                    v-if="getTagsForTodo(todo).length"
                    class="flex flex-wrap gap-1 mt-0.5"
                  >
                    <span
                      v-for="tag in getTagsForTodo(todo)"
                      :key="tag.id"
                      class="px-1.5 py-0.5 rounded-full text-[10px] bg-white/[0.03] border"
                      :style="{ borderColor: tag.color, color: tag.color }"
                    >
                      {{ tag.name }}
                    </span>
                  </div>
                </div>
              </div>
              <button @click.stop="deleteTodo(todo.id)" class="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all">
                <Trash2 :size="15" />
              </button>
            </div>
          </div>
        </div>

        <!-- ══════ 未来规划 ══════ -->
        <div v-show="currentView === 'upcoming'">
          <header class="mb-12">
            <h1 class="text-3xl font-semibold text-white mb-2 tracking-tight">未来规划</h1>
            <p class="text-gray-500 text-sm font-light">查看已经推迟或预定在未来的任务</p>
          </header>

          <div v-if="upcomingGroups.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-600">
            <CalendarClock :size="40" class="mb-4 opacity-30" />
            <p class="text-sm">暂无未来规划的任务</p>
          </div>

          <div v-for="group in upcomingGroups" :key="group.date" class="mb-10">
            <div class="flex items-center mb-4">
              <div class="flex-1 h-[1px] bg-white/5"></div>
              <span class="px-4 text-xs text-gray-500 font-medium">{{ group.label }}</span>
              <div class="flex-1 h-[1px] bg-white/5"></div>
            </div>
            <div class="space-y-2">
              <div 
                v-for="todo in group.todos" :key="todo.id"
                class="group flex items-center space-x-4 bg-white/[0.01] border border-white/[0.05] p-4 rounded-xl hover:bg-white/[0.03] hover:border-white/10 transition-all"
              >
                <button
                   @click.stop="moveToToday(todo)"
                   class="flex-shrink-0 text-[11px] px-2 py-1 rounded border border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                   title="移回今日"
                >
                  移至今日
                </button>
                <div class="flex-1 space-y-1">
                  <span class="text-sm text-gray-300">{{ todo.text }}</span>
                  <div
                    v-if="getTagsForTodo(todo).length"
                    class="flex flex-wrap gap-1 mt-0.5"
                  >
                    <span
                      v-for="tag in getTagsForTodo(todo)"
                      :key="tag.id"
                      class="px-1.5 py-0.5 rounded-full text-[10px] bg-white/[0.03] border"
                      :style="{ borderColor: tag.color, color: tag.color }"
                    >
                      {{ tag.name }}
                    </span>
                  </div>
                </div>
                <button @click.stop="deleteTodo(todo.id)" class="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1">
                  <Trash2 :size="15" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════ 历史回顾 ══════ -->
        <div v-show="currentView === 'history'">
          <header class="mb-12">
            <h1 class="text-3xl font-semibold text-white mb-2 tracking-tight">历史回顾</h1>
            <p class="text-gray-500 text-sm font-light">查看所有已完成的任务</p>
          </header>

          <div v-if="historyGroups.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-600">
            <Archive :size="40" class="mb-4 opacity-30" />
            <p class="text-sm">暂无历史记录</p>
          </div>

          <div v-for="group in historyGroups" :key="group.date" class="mb-10">
            <div class="flex items-center mb-4">
              <div class="flex-1 h-[1px] bg-white/5"></div>
              <span class="px-4 text-xs text-gray-500 font-medium">{{ group.label }}</span>
              <div class="flex-1 h-[1px] bg-white/5"></div>
            </div>
            <div class="space-y-2">
              <div 
                v-for="todo in group.todos" :key="todo.id"
                class="flex items-center space-x-4 px-4 py-3 rounded-xl"
                :class="todo.completed ? 'opacity-40' : 'bg-white/[0.02] border border-white/[0.05]'"
              >
                <div
                  class="w-5 h-5 rounded flex items-center justify-center"
                  :class="todo.completed ? 'bg-purple-600/80' : 'border-2 border-white/20'"
                >
                  <Check v-if="todo.completed" :size="12" class="text-white" />
                </div>
                <span class="flex-1 text-sm" :class="todo.completed ? 'line-through text-gray-400 font-light' : 'text-gray-300'">{{ todo.text }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════ 回顾中心 ══════ -->
        <div v-show="currentView === 'review'">
          <header class="mb-12">
            <h1 class="text-3xl font-semibold text-white mb-2 tracking-tight">回顾中心</h1>
            <p class="text-gray-500 text-sm font-light">选择时间范围，基于任务与日记生成周报 / 月报回顾</p>
          </header>

          <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-500 mb-1">开始日期</label>
                <input
                  type="date"
                  v-model="reviewStartDate"
                  class="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/10"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">结束日期</label>
                <input
                  type="date"
                  v-model="reviewEndDate"
                  class="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/10"
                />
              </div>
            </div>

            <div class="flex items-center space-x-3">
              <button
                @click="generateReviewReport"
                class="inline-flex items-center px-4 py-2 rounded-xl bg-white text-black text-sm font-medium shadow-[0_10px_40px_rgba(255,255,255,0.18)] hover:scale-105 active:scale-95 transition-all"
              >
                <Sparkles :size="16" class="mr-2" />
                生成回顾报告
              </button>
              <span v-if="reviewStatsText" class="text-[11px] text-gray-600">{{ reviewStatsText }}</span>
            </div>

            <div class="bg-white/[0.03] border border-white/5 rounded-2xl p-5 min-h-[220px] text-sm">
              <div v-if="reviewLoading" class="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 :size="22" class="text-purple-500 animate-spin" />
                <p class="text-gray-500">AI 正在生成阶段性回顾...</p>
              </div>
              <div v-else-if="reviewError" class="text-red-400 whitespace-pre-wrap leading-relaxed">
                {{ reviewError }}
              </div>
              <div v-else-if="reviewContent" class="whitespace-pre-wrap leading-relaxed text-gray-300 font-mono">
                {{ reviewContent }}
              </div>
              <div v-else class="flex items-center justify-center h-full">
                <p class="text-gray-600 text-sm">请选择日期范围并点击「生成回顾报告」。</p>
              </div>
            </div>

            <div v-if="reviewContent" class="flex items-end space-x-3">
              <div class="flex-1">
                <label class="block text-xs text-gray-500 mb-1">保存为文件名</label>
                <input
                  type="text"
                  v-model="reviewFileName"
                  placeholder="例如：Weekly_2024_W43.md（留空则自动生成周报文件名）"
                  class="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/10"
                />
              </div>
              <button
                @click="saveReviewReport"
                class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
              >
                保存为 Markdown
              </button>
            </div>
          </div>
        </div>

        <!-- ══════ 总结存档 ══════ -->
        <div v-show="currentView === 'archive'">
          <header class="mb-12">
            <h1 class="text-3xl font-semibold text-white mb-2 tracking-tight">总结存档</h1>
            <p class="text-gray-500 text-sm font-light">AI 生成的工作日志存档</p>
          </header>

          <div v-if="archives.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-600">
            <Sparkles :size="40" class="mb-4 opacity-30" />
            <p class="text-sm">暂无存档，请先生成今日总结并保存</p>
          </div>

          <div
            v-for="arc in archives" :key="arc.id"
            class="mb-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 hover:border-white/10 transition-all"
          >
            <div class="flex justify-between items-center mb-4">
              <span class="text-sm text-purple-400 font-medium">{{ arc.date }}</span>
              <button @click="deleteArchive(arc.id)" class="text-gray-600 hover:text-red-400 transition-all">
                <Trash2 :size="14" />
              </button>
            </div>
            <div class="whitespace-pre-wrap text-sm text-gray-400 font-mono leading-relaxed">{{ arc.content }}</div>
          </div>
        </div>
      </div>

      <!-- Settings Hub View -->
      <div v-show="currentView === 'settings'" class="max-w-3xl">
        <header class="mb-12">
          <h1 class="text-3xl font-semibold text-white mb-2 tracking-tight">设置</h1>
          <p class="text-gray-500 text-sm font-light">配置 API 供应商及自定义 AI 提示词</p>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            @click="isApiSettingsOpen = true"
            class="group bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 hover:border-purple-500/30 hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
              <KeyRound :size="20" class="text-purple-400" />
            </div>
            <h3 class="text-sm font-bold text-white mb-1">API 设置</h3>
            <p class="text-[11px] text-gray-500 leading-relaxed">配置供应商、密钥及模型名称</p>
          </div>

          <div
            @click="openDailyPrompt"
            class="group bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 hover:border-orange-500/30 hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            <div class="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
              <Sparkles :size="20" class="text-orange-400" />
            </div>
            <h3 class="text-sm font-bold text-white mb-1">AI 日志提示词</h3>
            <p class="text-[11px] text-gray-500 leading-relaxed">自定义每日总结的系统 Prompt</p>
          </div>

          <div
            @click="openReviewPrompt"
            class="group bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
              <Archive :size="20" class="text-cyan-400" />
            </div>
            <h3 class="text-sm font-bold text-white mb-1">AI 归档提示词</h3>
            <p class="text-[11px] text-gray-500 leading-relaxed">自定义回顾报告的系统 Prompt</p>
          </div>

          <div
            @click="isDemoDataModalOpen = true"
            class="group bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 hover:border-green-500/30 hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
              <LayoutDashboard :size="20" class="text-green-400" />
            </div>
            <h3 class="text-sm font-bold text-white mb-1">体验数据</h3>
            <p class="text-[11px] text-gray-500 leading-relaxed">一键生成示例任务与存档体验完整的应用工作流</p>
          </div>
        </div>
      </div>

      <!-- Floating action button -->
      <button 
        v-if="currentView === 'today'"
        @click="generateSummary"
        class="fixed bottom-10 right-10 bg-white text-black px-6 py-3 rounded-full font-bold flex items-center space-x-2 shadow-[0_10px_40px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all"
      >
        <Sparkles :size="16" />
        <span class="text-sm">生成今日总结</span>
      </button>

      <!-- AI 总结侧边抽屉 -->
      <div 
        v-if="isSummaryOpen"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        @click="isSummaryOpen = false"
      ></div>
      <div 
        :class="isSummaryOpen ? 'translate-x-0' : 'translate-x-full'"
        class="fixed right-0 top-0 h-full w-[450px] bg-[#121212] border-l border-white/10 z-50 transition-transform duration-500 p-8 flex flex-col"
      >
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-xl font-bold text-white flex items-center space-x-2">
            <Sparkles :size="20" class="text-purple-500" />
            <span>AI 日志生成</span>
          </h2>
          <button @click="isSummaryOpen = false" class="text-gray-500 hover:text-white">✕</button>
        </div>
        
        <div class="flex-1 bg-white/[0.03] rounded-2xl p-6 text-sm border border-white/5 overflow-y-auto">
          <div v-if="summaryLoading" class="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 :size="24" class="text-purple-500 animate-spin" />
            <p class="text-gray-500">AI 正在生成工作日志...</p>
          </div>
          <div v-else-if="summaryError" class="flex flex-col items-center justify-center h-full space-y-4">
            <p class="text-red-400 text-center leading-relaxed">{{ summaryError }}</p>
            <button
              v-if="!apiKey"
              @click="currentView = 'settings'; isSummaryOpen = false"
              class="text-purple-400 hover:text-purple-300 underline text-xs"
            >前往设置</button>
          </div>
          <div v-else-if="summaryContent" class="whitespace-pre-wrap leading-relaxed text-gray-300 font-mono">{{ summaryContent }}</div>
          <div v-else class="flex items-center justify-center h-full">
            <p class="text-gray-600">点击下方按钮生成今日总结</p>
          </div>
        </div>

        <button
          v-if="summaryContent && !summaryLoading"
          @click="saveArchive"
          class="w-full mt-6 bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-bold transition-colors flex items-center justify-center space-x-2"
        >
          <span>保存为 Markdown 存档</span>
        </button>
      </div>

      <!-- 轻量级保存提示 -->
      <div
        v-if="archiveToastVisible"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/10 border border-white/20 text-xs text-gray-100 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm z-50"
      >
        {{ archiveToastMessage }}
      </div>

      <!-- 弹出提示 (推迟成功 - 相对页面固定位置) -->
      <transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div
          v-if="snoozeToastVisible"
          class="fixed top-64 left-1/2 -translate-x-1/2 bg-[#22C55E]/90 text-white border border-green-400/50 px-5 py-2.5 rounded-full shadow-[0_4px_20px_rgba(34,197,94,0.3)] backdrop-blur-md z-50 flex items-center text-sm font-medium"
        >
          <Check :size="16" class="mr-2" />
          <span>{{ snoozeToastMessage }}</span>
        </div>
      </transition>
    </main>

    <!-- API Settings Modal -->
    <div
      v-if="isApiSettingsOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center"
      @click.self="isApiSettingsOpen = false"
    >
      <div class="bg-[#1A1A1A] border border-white/10 rounded-2xl p-8 w-[440px] shadow-2xl">
        <h2 class="text-lg font-bold text-white mb-6 flex items-center space-x-2">
          <KeyRound :size="18" class="text-purple-500" />
          <span>API 设置</span>
        </h2>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-gray-400 mb-2 block">API 供应商</label>
            <select
              v-model="apiProviderInput"
              @change="onProviderChange"
              class="w-full bg-[#1F1F1F] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all text-sm"
            >
              <option v-for="p in providers" :key="p.id" :value="p.id" class="bg-[#1F1F1F]">{{ p.label }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-2 block">API 密钥 (API Key)</label>
            <input
              type="password"
              v-model="apiKeyInput"
              placeholder="sk-..."
              class="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 transition-all text-sm font-mono"
            />
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-2 block">接口地址 (Base URL)</label>
            <input
              type="text"
              v-model="apiBaseUrlInput"
              placeholder="https://..."
              class="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all text-sm font-mono"
            />
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-2 block">模型名称 (Model)</label>
            <input
              type="text"
              v-model="apiModelInput"
              placeholder="deepseek-chat"
              class="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all text-sm font-mono"
            />
          </div>
          <p class="text-[11px] text-gray-600">密钥仅加密保存在本地 SQLite 数据库中。</p>
        </div>
        <div class="flex justify-end space-x-3 mt-8">
          <button @click="isApiSettingsOpen = false" class="px-5 py-2.5 text-gray-400 hover:text-white text-sm transition-colors">取消</button>
          <button @click="saveApiSettings" class="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">保存配置</button>
        </div>
      </div>
    </div>

    <!-- Demo Data Modal -->
    <div
      v-if="isDemoDataModalOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center"
      @click.self="isDemoDataModalOpen = false"
    >
      <div class="bg-[#1A1A1A] border border-white/10 rounded-2xl p-8 w-[400px] shadow-2xl">
        <h2 class="text-lg font-bold text-white mb-2 flex items-center space-x-2">
          <LayoutDashboard :size="18" class="text-green-500" />
          <span>体验数据</span>
        </h2>
        <p class="text-[12px] text-gray-400 mb-6 leading-relaxed">
          一键生成过去半年的 PM 示例任务与存档。
        </p>
        
        <div class="space-y-4">
          <button
            type="button"
            :disabled="seedDemoLoading"
            @click="seedDemoData"
            class="w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20"
          >
            {{ seedDemoLoading ? '生成中...' : '生成示例数据' }}
          </button>
          <p v-if="seedDemoMessage" class="mt-2 text-[11px] text-center" :class="seedDemoMessage.startsWith('\u5df2') ? 'text-green-400' : 'text-amber-400'">{{ seedDemoMessage }}</p>
        </div>
        
        <div class="flex justify-end mt-6">
          <button @click="isDemoDataModalOpen = false" class="px-5 py-2.5 text-gray-400 hover:text-white text-sm transition-colors w-full bg-white/5 hover:bg-white/10 rounded-lg">关闭</button>
        </div>
      </div>
    </div>

    <!-- Daily Summary Prompt Modal -->
    <div
      v-if="isDailyPromptOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center"
      @click.self="isDailyPromptOpen = false"
    >
      <div class="bg-[#1A1A1A] border border-white/10 rounded-2xl p-8 w-[500px] shadow-2xl">
        <h2 class="text-lg font-bold text-white mb-4 flex items-center space-x-2">
          <Sparkles :size="18" class="text-orange-400" />
          <span>AI 日志提示词</span>
        </h2>
        <p class="text-[12px] text-gray-400 mb-4 leading-relaxed">
          自定义生成「今日总结」时的系统提示词。留空则使用默认范本。<br>
          支持占位符：<code class="text-purple-400">{date}</code>, <code class="text-purple-400">{completedCount}</code>, <code class="text-purple-400">{todosText}</code>
        </p>
        <textarea
          v-model="customDailyPromptInput"
          placeholder="留空以使用预设提示词..."
          class="w-full min-h-[180px] bg-white/[0.03] border border-white/10 rounded-lg p-4 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 transition-all font-mono leading-relaxed resize-y"
        ></textarea>
        <div class="flex justify-end space-x-3 mt-6">
          <button @click="isDailyPromptOpen = false" class="px-5 py-2.5 text-gray-400 hover:text-white text-sm transition-colors">取消</button>
          <button @click="saveDailyPrompt" class="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">保存</button>
        </div>
      </div>
    </div>

    <!-- Review/Archive Prompt Modal -->
    <div
      v-if="isReviewPromptOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center"
      @click.self="isReviewPromptOpen = false"
    >
      <div class="bg-[#1A1A1A] border border-white/10 rounded-2xl p-8 w-[500px] shadow-2xl">
        <h2 class="text-lg font-bold text-white mb-4 flex items-center space-x-2">
          <Archive :size="18" class="text-cyan-400" />
          <span>AI 归档提示词</span>
        </h2>
        <p class="text-[12px] text-gray-400 mb-4 leading-relaxed">
          自定义生成「阶段性回顾报告」时的系统提示词。留空则使用默认范本。
        </p>
        <textarea
          v-model="customReviewPromptInput"
          placeholder="留空以使用预设提示词..."
          class="w-full min-h-[180px] bg-white/[0.03] border border-white/10 rounded-lg p-4 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 transition-all font-mono leading-relaxed resize-y"
        ></textarea>
        <div class="flex justify-end space-x-3 mt-6">
          <button @click="isReviewPromptOpen = false" class="px-5 py-2.5 text-gray-400 hover:text-white text-sm transition-colors">取消</button>
          <button @click="saveReviewPrompt" class="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">保存</button>
        </div>
      </div>
    </div>

    <!-- Tag Manager Modal -->
    <div
      v-if="isTagManagerOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center"
      @click.self="closeTagManager"
    >
      <div class="bg-[#1A1A1A] border border-white/10 rounded-2xl p-8 w-[440px] shadow-2xl">
        <h2 class="text-lg font-bold text-white mb-6 flex items-center space-x-2">
          <Tags :size="18" class="text-purple-500" />
          <span>管理标签</span>
        </h2>

        <div class="space-y-5">
          <div class="space-y-2">
            <label class="text-xs text-gray-400 block">标签名称</label>
            <input
              type="text"
              v-model="tagNameInput"
              placeholder="例如：工作、学习、Side Project..."
              class="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 transition-all text-sm"
            />
          </div>

          <div class="space-y-2">
            <label class="text-xs text-gray-400 block">标签颜色</label>
            <div class="flex items-center space-x-2">
              <button
                v-for="color in tagColorPresets"
                :key="color"
                type="button"
                @click="tagColorInput = color"
                class="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center transition-all"
                :style="{ backgroundColor: color }"
              >
                <div
                  v-if="tagColorInput === color"
                  class="w-3 h-3 rounded-full border border-white bg-white/70"
                ></div>
              </button>
            </div>
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              @click="addTag"
              class="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              :disabled="!tagNameInput.trim()"
            >
              添加标签
            </button>
          </div>

          <div class="border-t border-white/10 pt-4 mt-2 max-h-60 overflow-y-auto">
            <p class="text-xs text-gray-500 mb-3">已有标签</p>
            <div v-if="tags.length === 0" class="text-xs text-gray-600 py-2">
              暂无标签，请先在上方添加。
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="tag in tags"
                :key="tag.id"
                class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]"
              >
                <div class="flex items-center space-x-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    :style="{ backgroundColor: tag.color }"
                  ></span>
                  <span class="text-sm text-gray-200">{{ tag.name }}</span>
                </div>
                <button
                  type="button"
                  @click="deleteTagItem(tag.id)"
                  class="text-[11px] text-gray-500 hover:text-red-400 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            @click="closeTagManager"
            class="px-4 py-2.5 text-gray-400 hover:text-white text-sm transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import {
  LayoutDashboard, Calendar, Archive, Check, Sparkles,
  Plus, Trash2, Settings, KeyRound, Loader2, Tags, Flame, Pencil, Clock, CalendarClock
} from 'lucide-vue-next';
import Database from '@tauri-apps/plugin-sql';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { writeTextFile, mkdir, readTextFile } from '@tauri-apps/plugin-fs';
import { documentDir, join } from '@tauri-apps/api/path';

let db = null;

// ─── UI state ───────────────────────────────────────────────

const currentView = ref('today');
const tabs = [
  { id: 'today',   label: '今日待办', icon: LayoutDashboard },
  { id: 'upcoming', label: '未来规划', icon: CalendarClock },
  { id: 'history', label: '历史回顾', icon: Calendar },
  { id: 'review',  label: '回顾中心', icon: Sparkles },
  { id: 'archive', label: '总结存档', icon: Archive },
  { id: 'settings', label: '设置', icon: Settings },
];

const newTodo = ref('');
const isSummaryOpen = ref(false);
const isApiSettingsOpen = ref(false);
const isDailyPromptOpen = ref(false);
const isReviewPromptOpen = ref(false);
const isDemoDataModalOpen = ref(false);

const DEFAULT_DAILY_PROMPT_CN = `你是一名严谨的产品助理。请根据提供的已完成任务，生成一份简短、结构简单的 Markdown 格式「产品经理工作日报」。要求：
1) 仅针对实际任务进行总结，严禁虚构内容；
2) 重点突出与 AI、大模型、提示词或自动化相关的工作，体现 AI 在实际业务中的应用；
3) 若任务中不涉及 AI 内容，请勿强行编造；
4) 语气专业、朴素，避免使用华丽辞藻；
5) 使用第三人称或中性描述，避免使用“我”；
6) 以 Markdown 小标题和列表形式组织，每条描述建议在 20 字以内；
7) 若有多次拖延的任务，请在末尾以幽默的口吻提醒用户，或建议拆解该任务。`;

const DEFAULT_REVIEW_PROMPT_CN = `你是一名严谨的产品助理。请基于提供的任务记录和 Markdown 日志，生成一份阶段性工作回顾报告。要求：
1) 总结出三个具有代表性的里程碑事件；
2) 每个里程碑需包含背景、关键动作和可见产出，避免笼统描述；
3) 基于当前节奏，提供 3-5 条具有可操作性的下一阶段建议，需体现优先级；
4) 结构要求：阶段概览、三大里程碑、下阶段计划；
5) 语气专业克制，严禁夸大或虚构。`;

const isTagManagerOpen = ref(false);
const todos = ref([]);
const archives = ref([]);
const dbReady = ref(false);
const initError = ref('');

const apiKey = ref('');
const apiKeyInput = ref('');
const apiProvider = ref('deepseek');
const apiBaseUrl = ref('https://api.deepseek.com');
const apiModel = ref('deepseek-chat');

const apiProviderInput = ref('deepseek');
const apiBaseUrlInput = ref('https://api.deepseek.com');
const apiModelInput = ref('deepseek-chat');

const customDailyPrompt = ref('');
const customDailyPromptInput = ref('');

const customReviewPrompt = ref('');
const customReviewPromptInput = ref('');

const providers = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { id: 'gemini', label: 'Gemini (OpenAI API)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-1.5-pro' },
  { id: 'zhipu', label: 'Zhipu AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4' },
  { id: 'doubao', label: 'Doubao', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'ep-xxx' },
  { id: 'volcengine', label: '火山引擎 (Volcengine)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'ep-xxx' },
  { id: 'qwen', label: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
  { id: 'siliconflow', label: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'deepseek-ai/DeepSeek-V3' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  { id: 'xiaomi', label: '小米 (Xiaomi)', baseUrl: 'https://api.xiaomimimo.com/v1', defaultModel: 'mi-lm' },
  { id: 'custom', label: 'Custom', baseUrl: '', defaultModel: '' },
];

const summaryContent = ref('');
const summaryLoading = ref(false);
const summaryError = ref('');

const editingTodoId = ref(null);
const editingText = ref('');

const archiveToastVisible = ref(false);
const archiveToastMessage = ref('');

const snoozeToastVisible = ref(false);
const snoozeToastMessage = ref('');

// 示例数据生成
const seedDemoLoading = ref(false);
const seedDemoMessage = ref('');

// 回顾中心状态
const reviewStartDate = ref('');
const reviewEndDate = ref('');
const reviewLoading = ref(false);
const reviewError = ref('');
const reviewContent = ref('');
const reviewFileName = ref('');
const reviewStatsText = ref('');

// 标签管理状态
const tags = ref([]);
const tagNameInput = ref('');
const tagColorInput = ref('#F97316');
const tagColorPresets = [
  '#F97316', // orange
  '#3B82F6', // blue
  '#22C55E', // green
  '#E11D48', // rose
  '#A855F7', // purple
  '#FACC15'  // yellow
];

// 新任务标签选择
const createTagPopoverOpen = ref(false);
const newTodoSelectedTagIds = ref([]);
const todoTagsByTodoId = ref({});
const activeTagFilterId = ref(null);
const activeTodoTagPopoverId = ref(null);
const activeTodoSnoozePopoverId = ref(null);

const newTodoInput = ref(null);

// 标签 Mention (#) 状态
const mentionState = ref({
  visible: false,
  query: '',
  startIndex: -1,
  selectedIndex: 0
});

// 热力图状态
const heatmapWeeks = ref([]);
const heatmapLoading = ref(false);
const heatmapTooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  date: '',
  count: 0
});

const heatmapScrollEl = ref(null);
const heatmapSelectedDate = ref(null);

// ─── Date helpers ───────────────────────────────────────────

const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const now = new Date();
const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${weekDays[now.getDay()]}`;
const pad = (n) => String(n).padStart(2, '0');
const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

function getDateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 初始化回顾默认时间范围：最近 7 天
reviewStartDate.value = getDateNDaysAgo(6);
reviewEndDate.value = todayDate;

function localNow() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDateLabel(dateStr) {
  if (dateStr === todayDate) return '今天';
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 1) return '昨天';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · ${weekDays[d.getDay()]}`;
}

function getIsoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) {
    return { year: now.getFullYear(), week: 1 };
  }
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // 将周一视为一周起始
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const week = 1 + Math.round(diff / oneWeekMs);
  return { year: target.getFullYear(), week };
}

function getDateRangeDates(startStr, endStr) {
  const dates = [];
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return dates;
  let cur = start;
  while (cur.getTime() <= end.getTime()) {
    dates.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Computed ───────────────────────────────────────────────

const activeTodos = computed(() => todos.value.filter(t => !t.completed));
const completedTodos = computed(() => todos.value.filter(t => t.completed));

const selectedTagsForNewTodo = computed(() =>
  tags.value.filter(t => newTodoSelectedTagIds.value.includes(t.id))
);

const filteredActiveTodos = computed(() => {
  if (!activeTagFilterId.value) return activeTodos.value;
  return activeTodos.value.filter(t => {
    const ids = getTodoTagIds(t);
    return ids.includes(activeTagFilterId.value);
  });
});

const filteredCompletedTodos = computed(() => {
  if (!activeTagFilterId.value) return completedTodos.value;
  return completedTodos.value.filter(t => {
    const ids = getTodoTagIds(t);
    return ids.includes(activeTagFilterId.value);
  });
});

// 主列表展示：如果未选中历史某天，则仅显示 target_date <= todayDate 的“可做”任务
// 如果选中了历史某天，则展示“那天完成的”或“那天创建的”任务
const displayedActiveTodos = computed(() => {
  const list = filteredActiveTodos.value;
  const date = heatmapSelectedDate.value;
  if (!date) return list.filter(t => (t.target_date || t.created_at.slice(0, 10)) <= todayDate);
  return list.filter(t => (t.created_at || '').slice(0, 10) === date);
});
const displayedCompletedTodos = computed(() => {
  const list = filteredCompletedTodos.value;
  const date = heatmapSelectedDate.value;
  if (!date) return list.filter(t =>
    (t.updated_at || '').slice(0, 10) === todayDate ||
    t.target_date === todayDate ||
    t.created_at.slice(0, 10) === todayDate
  );
  // 对于过去的日子，更在意“那天完成的”，旧版本先用 created_at 兼容一下
  return list.filter(t => (t.created_at || '').slice(0, 10) === date);
});

// 未来的任务视图数据 (Active 且 target_date > todayDate)
const displayedUpcomingTodos = computed(() => {
  const list = filteredActiveTodos.value;
  return list.filter(t => t.target_date && t.target_date > todayDate)
             .sort((a,b) => a.target_date.localeCompare(b.target_date));
});

const upcomingGroups = computed(() => {
  const groups = {};
  displayedUpcomingTodos.value.forEach(todo => {
    const d = todo.target_date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(todo);
  });
  
  const dObj = new Date();
  dObj.setDate(dObj.getDate() + 1);
  const tomorrowStr = `${dObj.getFullYear()}-${pad(dObj.getMonth() + 1)}-${pad(dObj.getDate())}`;

  return Object.keys(groups).sort().map(date => ({
    date,
    label: date === tomorrowStr ? '🌞 明天' : '📆 ' + date,
    todos: groups[date]
  }));
});

// Mention 标签过滤
const filteredMentionTags = computed(() => {
  if (!mentionState.value.query) return tags.value;
  const query = mentionState.value.query.toLowerCase();
  return tags.value.filter(t => t.name.toLowerCase().includes(query));
});

const tagIncompleteCount = computed(() => {
  const counts = {};
  for (const tag of tags.value) {
    counts[tag.id] = 0;
  }
  for (const t of todos.value) {
    if (t.completed) continue;
    const ids = getTodoTagIds(t);
    for (const id of ids) {
      if (counts[id] === undefined) counts[id] = 0;
      counts[id]++;
    }
  }
  return counts;
});

const historyGroups = computed(() => {
  const groups = {};
  for (const t of todos.value) {
    const date = t.created_at.slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(t);
  }
  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({
      date,
      label: formatDateLabel(date),
      todos: groups[date]
    }));
});

// ─── Database ───────────────────────────────────────────────

async function initDB() {
  try {
    db = await Database.load('sqlite:focus_log.db');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        from_yesterday INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.execute(
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        api_key TEXT DEFAULT '',
        api_provider TEXT DEFAULT 'deepseek',
        api_base_url TEXT DEFAULT 'https://api.deepseek.com',
        api_model TEXT DEFAULT 'deepseek-chat',
        custom_daily_prompt TEXT DEFAULT '',
        custom_review_prompt TEXT DEFAULT ''
      )`
    );

    // Schema migrations for older databases
    try { await db.execute("ALTER TABLE settings ADD COLUMN api_provider TEXT DEFAULT 'deepseek'"); } catch (_) {}
    try { await db.execute("ALTER TABLE settings ADD COLUMN api_base_url TEXT DEFAULT 'https://api.deepseek.com'"); } catch (_) {}
    try { await db.execute("ALTER TABLE settings ADD COLUMN api_model TEXT DEFAULT 'deepseek-chat'"); } catch (_) {}
    try { await db.execute("ALTER TABLE settings ADD COLUMN custom_daily_prompt TEXT DEFAULT ''"); } catch (_) {}
    try { await db.execute("ALTER TABLE settings ADD COLUMN custom_review_prompt TEXT DEFAULT ''"); } catch (_) {}

    await db.execute(`
      CREATE TABLE IF NOT EXISTS archives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS todo_tags (
        todo_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL
      )
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id)
    `);

    try {
      await db.execute(`ALTER TABLE todos ADD COLUMN from_yesterday INTEGER NOT NULL DEFAULT 0`);
    } catch { /* column already exists */ }

    try {
      await db.execute(`ALTER TABLE todos ADD COLUMN tag_id INTEGER`);
    } catch { /* column already exists */ }

    try {
      await db.execute(`ALTER TABLE todos ADD COLUMN rolled_count INTEGER NOT NULL DEFAULT 0`);
    } catch { /* column already exists */ }

    try {
      await db.execute(`ALTER TABLE todos ADD COLUMN target_date TEXT`);
    } catch { /* column already exists */ }

    dbReady.value = true;
    await rolloverTodos();
    await loadTodos();
    await loadTodoTags();
    await loadSettings();
    await loadArchives();
    await loadTags();
    await loadHeatmap();
  } catch (e) {
    console.error('initDB failed:', e);
    initError.value = `数据库初始化失败: ${e.message || e}`;
  }
}

async function rolloverTodos() {
  const ts = localNow();
  await db.execute(
    `UPDATE todos
        SET created_at = ?, updated_at = ?, from_yesterday = 1,
            rolled_count = COALESCE(rolled_count, 0) + 1
      WHERE completed = 0 AND date(created_at) < date(?)`,
    [ts, ts, todayDate]
  );
}

async function loadTodos() {
  const rows = await db.select('SELECT * FROM todos ORDER BY created_at DESC');
  todos.value = rows.map(r => ({
    ...r,
    completed: !!r.completed,
    from_yesterday: !!r.from_yesterday,
    rolled_count: r.rolled_count != null ? Number(r.rolled_count) : 0
  }));
}

async function loadTodoTags() {
  if (!db) return;
  const rows = await db.select('SELECT * FROM todo_tags');
  const map = {};
  for (const r of rows) {
    const todoId = r.todo_id;
    const tagId = r.tag_id;
    if (!map[todoId]) map[todoId] = [];
    map[todoId].push(tagId);
  }
  todoTagsByTodoId.value = map;
}

// 过去一年内每天完成任务数量（用于贡献热力图）；tagId 为数字时仅统计该标签任务
async function getCompletedCountsLastYear(tagId = null) {
  if (!db) return [];

  const formatDate = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  
  // 扩大时间差查询范围，保证首尾星期都能完整闭环
  const end = new Date();
  end.setDate(end.getDate() + 14);
  const start = new Date();
  start.setDate(start.getDate() - 400);
  
  const startDateStr = formatDate(start);
  const endDateStr = formatDate(end);

  let rows;
  if (tagId != null) {
    rows = await db.select(
      `
        SELECT substr(t.created_at, 1, 10) AS date, COUNT(*) AS count
        FROM todos t
        INNER JOIN todo_tags tt ON t.id = tt.todo_id AND tt.tag_id = ?
        WHERE t.completed = 1
          AND date(t.created_at, 'localtime') BETWEEN date(?, 'localtime') AND date(?, 'localtime')
        GROUP BY date
        ORDER BY date ASC
      `,
      [tagId, startDateStr, endDateStr]
    );
  } else {
    rows = await db.select(
      `
        SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count
        FROM todos
        WHERE completed = 1
          AND date(created_at, 'localtime') BETWEEN date(?, 'localtime') AND date(?, 'localtime')
        GROUP BY date
        ORDER BY date ASC
      `,
      [startDateStr, endDateStr]
    );
  }

  return rows.map(r => ({
    date: r.date,
    count: Number(r.count) || 0
  }));
}

async function loadHeatmap(tagId = null) {
  if (!db) return;
  heatmapLoading.value = true;
  try {
    const data = await getCompletedCountsLastYear(tagId);

    const countMap = {};
    for (const item of data) {
      countMap[item.date] = item.count;
    }

    const weeksToDisplay = 52;
    const daysPerWeek = 7;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDayOfWeek = today.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
    
    // 当前周的第一天 (周日)
    const startOfCurrentWeek = new Date(today);
    startOfCurrentWeek.setDate(today.getDate() - todayDayOfWeek);

    // 热力图起点 (前面向前推 51 周)
    const startOfGrid = new Date(startOfCurrentWeek);
    startOfGrid.setDate(startOfCurrentWeek.getDate() - (weeksToDisplay - 1) * 7);

    const totalCells = weeksToDisplay * daysPerWeek;
    const cells = [];

    for (let i = 0; i < totalCells; i++) {
      const d = new Date(startOfGrid);
      d.setDate(startOfGrid.getDate() + i);

      const isFuture = d.getTime() > today.getTime();
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      
      const count = isFuture ? 0 : (countMap[dateStr] || 0);
      cells.push({ date: dateStr, count, isFuture });
    }

    const result = [];
    for (let w = 0; w < weeksToDisplay; w++) {
      const start = w * daysPerWeek;
      const end = start + daysPerWeek;
      result.push(cells.slice(start, end));
    }
    heatmapWeeks.value = result;

    // 默认滚动到最右侧，保证一进来就看到“最近一周”。
    nextTick(() => {
      setTimeout(() => {
        if (heatmapScrollEl.value) {
          heatmapScrollEl.value.scrollLeft = heatmapScrollEl.value.scrollWidth;
        }
      }, 150); // Increased slightly to ensure rendering is fully complete
    });
  } catch (e) {
    console.error('loadHeatmap failed:', e);
    heatmapWeeks.value = [];
  } finally {
    heatmapLoading.value = false;
  }
}

// 侧边栏切换标签时，热力图只显示该标签的完成分布
watch(activeTagFilterId, (tagId) => {
  if (db) loadHeatmap(tagId ?? null);
});

// 当视图切换回今日视图时自动聚焦焦点
watch(currentView, (val) => {
  if (val === 'today') {
    nextTick(() => {
      newTodoInput.value?.focus();
    });
  }
});

function selectHeatmapDate(dayDate) {
  heatmapSelectedDate.value = heatmapSelectedDate.value === dayDate ? null : dayDate;
}
function clearHeatmapDate() {
  heatmapSelectedDate.value = null;
}

// ─── Settings ───────────────────────────────────────────────

async function loadSettings() {
  try {
    const rows = await db.select('SELECT * FROM settings WHERE id = 1');
    if (rows.length > 0) {
      const row = rows[0];
      apiKey.value = row.api_key || '';
      apiKeyInput.value = apiKey.value;
      apiProvider.value = row.api_provider || 'deepseek';
      apiProviderInput.value = apiProvider.value;
      apiBaseUrl.value = row.api_base_url || 'https://api.deepseek.com';
      apiBaseUrlInput.value = apiBaseUrl.value;
      apiModel.value = row.api_model || 'deepseek-chat';
      apiModelInput.value = apiModel.value;
      customDailyPrompt.value = row.custom_daily_prompt || '';
      customDailyPromptInput.value = customDailyPrompt.value || DEFAULT_DAILY_PROMPT_CN;
      customReviewPrompt.value = row.custom_review_prompt || '';
      customReviewPromptInput.value = customReviewPrompt.value || DEFAULT_REVIEW_PROMPT_CN;
      return;
    }
  } catch (_) {}
  // Fallback to old key-value schema
  try {
    const rows = await db.select("SELECT key, value FROM settings WHERE key = 'deepseek_api_key'");
    if (rows.length > 0) {
      apiKey.value = rows[0].value;
      apiKeyInput.value = rows[0].value;
    }
  } catch (_) {}
}

function onProviderChange() {
  const p = providers.find(item => item.id === apiProviderInput.value);
  if (p) {
    apiBaseUrlInput.value = p.baseUrl;
    apiModelInput.value = p.defaultModel;
  }
}

function openDailyPrompt() {
  if (!customDailyPromptInput.value.trim()) {
    customDailyPromptInput.value = DEFAULT_DAILY_PROMPT_CN;
  }
  isDailyPromptOpen.value = true;
}

function openReviewPrompt() {
  if (!customReviewPromptInput.value.trim()) {
    customReviewPromptInput.value = DEFAULT_REVIEW_PROMPT_CN;
  }
  isReviewPromptOpen.value = true;
}

async function saveApiSettings() {
  if (!db) return;
  try {
    await db.execute(
      `INSERT OR REPLACE INTO settings (id, api_key, api_provider, api_base_url, api_model, custom_daily_prompt, custom_review_prompt) VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [apiKeyInput.value.trim(), apiProviderInput.value, apiBaseUrlInput.value.trim(), apiModelInput.value.trim(), customDailyPrompt.value, customReviewPrompt.value]
    );
    apiKey.value = apiKeyInput.value.trim();
    apiProvider.value = apiProviderInput.value;
    apiBaseUrl.value = apiBaseUrlInput.value.trim();
    apiModel.value = apiModelInput.value.trim();
    
    archiveToastMessage.value = 'API 设置已保存';
    archiveToastVisible.value = true;
    setTimeout(() => { archiveToastVisible.value = false; }, 2000);
  } catch (e) {
    console.error('saveApiSettings failed:', e);
  } finally {
    isApiSettingsOpen.value = false;
  }
}

async function saveDailyPrompt() {
  if (!db) return;
  try {
    customDailyPrompt.value = customDailyPromptInput.value;
    await db.execute(
      `INSERT OR REPLACE INTO settings (id, api_key, api_provider, api_base_url, api_model, custom_daily_prompt, custom_review_prompt) VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [apiKey.value, apiProvider.value, apiBaseUrl.value, apiModel.value, customDailyPrompt.value, customReviewPrompt.value]
    );
    archiveToastMessage.value = '日志提示词已保存';
    archiveToastVisible.value = true;
    setTimeout(() => { archiveToastVisible.value = false; }, 2000);
  } catch (e) {
    console.error('saveDailyPrompt failed:', e);
  } finally {
    isDailyPromptOpen.value = false;
  }
}

async function saveReviewPrompt() {
  if (!db) return;
  try {
    customReviewPrompt.value = customReviewPromptInput.value;
    await db.execute(
      `INSERT OR REPLACE INTO settings (id, api_key, api_provider, api_base_url, api_model, custom_daily_prompt, custom_review_prompt) VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [apiKey.value, apiProvider.value, apiBaseUrl.value, apiModel.value, customDailyPrompt.value, customReviewPrompt.value]
    );
    archiveToastMessage.value = '归档提示词已保存';
    archiveToastVisible.value = true;
    setTimeout(() => { archiveToastVisible.value = false; }, 2000);
  } catch (e) {
    console.error('saveReviewPrompt failed:', e);
  } finally {
    isReviewPromptOpen.value = false;
  }
}

async function seedDemoData() {
  if (!db) return;
  seedDemoLoading.value = true;
  seedDemoMessage.value = '';
  try {
    let tagIds = [...(tags.value.map(t => t.id))];
    if (tagIds.length === 0) {
      const tagList = [
        { name: '需求', color: '#3B82F6' },
        { name: '研发', color: '#8B5CF6' },
        { name: '数据', color: '#10B981' },
        { name: '会议', color: '#F59E0B' },
        { name: '规划', color: '#EF4444' }
      ];
      for (const { name, color } of tagList) {
        const res = await db.execute('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color]);
        tagIds.push(res.lastInsertId);
      }
      const rows = await db.select('SELECT * FROM tags ORDER BY id DESC');
      tags.value = rows;
    }

    const taskTemplates = [
      '撰写新版本 PRD', '需求评审会议', '梳理核心指标埋点', '竞品体验与分析', '周报总结与核心数据盘点',
      '与开发评审技术方案', '跟进前端联调进度', '验收提测版本', '参加每日站会', '制定下个版本架构与 backlog',
      '查看 AB 实验打点数据', '写用户反馈分析报告', '处理客诉与沟通工单', '跟进线上紧急 Bug 修复',
      '与设计对齐高保真交互图', '运营活动配置与上线复盘', '输出产品路线图 (Roadmap)'
    ];

    for (let d = 180; d >= 0; d--) {
      const dateStr = getDateNDaysAgo(d);
      const isWeekend = new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6;
      // Generate fewer tasks on weekends
      const maxTasks = isWeekend ? 3 : 8;
      const minTasks = isWeekend ? 0 : 3;
      const nTasks = minTasks + Math.floor(Math.random() * (maxTasks - minTasks + 1));
      
      for (let i = 0; i < nTasks; i++) {
        const text = taskTemplates[Math.floor(Math.random() * taskTemplates.length)];
        const completed = Math.random() < 0.8; // PMs usually have a higher completion or logging rate
        const h1 = 9 + Math.floor(Math.random() * 3);
        const m1 = Math.floor(Math.random() * 60);
        const created = `${dateStr} ${pad(h1)}:${pad(m1)}:00`;
        const updated = completed
          ? `${dateStr} ${pad(14 + Math.floor(Math.random() * 6))}:${pad(Math.floor(Math.random() * 60))}:00`
          : created;
        const tagId = tagIds.length > 0 ? tagIds[Math.floor(Math.random() * tagIds.length)] : null;
        const rolled_count = (!completed && d > 0 && Math.random() < 0.3) ? Math.floor(Math.random() * 3) + 1 : 0;
        const res = await db.execute(
          'INSERT INTO todos (text, completed, from_yesterday, created_at, updated_at, tag_id, rolled_count, target_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [text, completed ? 1 : 0, rolled_count > 0 ? 1 : 0, created, updated, tagId, rolled_count, dateStr]
        );
        const todoId = res.lastInsertId;
        if (tagId != null) {
          await db.execute('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)', [todoId, tagId]);
        }
      }
    }

    const archiveContents = [
      `# ${getDateNDaysAgo(2)} 工作小结\n\n- 完成需求评审与排期。\n- 与设计对齐交互细节。\n- 推进接口联调，测试环境已就绪。`,
      `# ${getDateNDaysAgo(5)} 日报\n\n- 站会同步进度。\n- 修复 2 个 Bug，补充单测。\n- 阅读 Vue 3 文档一节。`
    ];
    const archiveDates = [getDateNDaysAgo(2), getDateNDaysAgo(5)];
    const ts = localNow();
    for (let i = 0; i < archiveContents.length; i++) {
      await db.execute(
        'INSERT INTO archives (date, content, created_at) VALUES (?, ?, ?)',
        [archiveDates[i], archiveContents[i], ts]
      );
    }

    await loadTodos();
    await loadTodoTags();
    await loadHeatmap(activeTagFilterId.value ?? null);
    await loadArchives();
    seedDemoMessage.value = '已生成近半年 PM 示例数据，热力图与历史已更新。';
  } catch (e) {
    console.error('seedDemoData failed:', e);
    seedDemoMessage.value = '生成失败: ' + (e.message || String(e));
  } finally {
    seedDemoLoading.value = false;
  }
}

// ─── Tags ────────────────────────────────────────────────────

async function loadTags() {
  if (!db) return;
  const rows = await db.select('SELECT * FROM tags ORDER BY id DESC');
  tags.value = rows;
}

function openTagManager() {
  tagNameInput.value = '';
  if (!tagColorPresets.includes(tagColorInput.value)) {
    tagColorInput.value = tagColorPresets[0];
  }
  isTagManagerOpen.value = true;
}

function closeTagManager() {
  isTagManagerOpen.value = false;
}

async function addTag() {
  if (!db) return;
  const name = tagNameInput.value.trim();
  const color = tagColorInput.value;
  if (!name) return;
  try {
    const result = await db.execute(
      'INSERT INTO tags (name, color) VALUES (?, ?)',
      [name, color]
    );
    tags.value.unshift({
      id: result.lastInsertId,
      name,
      color
    });
    tagNameInput.value = '';
  } catch (e) {
    console.error('addTag failed:', e);
  }
}

async function deleteTagItem(id) {
  if (!db) return;
  try {
    await db.execute('UPDATE todos SET tag_id = NULL WHERE tag_id = ?', [id]);
    await db.execute('DELETE FROM todo_tags WHERE tag_id = ?', [id]);
    await db.execute('DELETE FROM tags WHERE id = ?', [id]);
    
    // 从前端状态中移除
    tags.value = tags.value.filter(t => t.id !== id);
    
    // 清理新任务选中状态
    newTodoSelectedTagIds.value = newTodoSelectedTagIds.value.filter(tId => tId !== id);
    
    // 重新拉取一次任务与标签关联关系，使得 UI 立即刷新
    await loadTodoTags();
  } catch (e) {
    console.error('deleteTagItem failed:', e);
  }
}

function toggleNewTodoTag(tagId) {
  const current = newTodoSelectedTagIds.value;
  const idx = current.indexOf(tagId);
  if (idx === -1) {
    newTodoSelectedTagIds.value = [...current, tagId];
  } else {
    const next = [...current];
    next.splice(idx, 1);
    newTodoSelectedTagIds.value = next;
  }
}

function getTodoTagIds(todo) {
  const ids = todoTagsByTodoId.value[todo.id] || [];
  if (ids.length > 0) return ids;
  // 兼容旧数据：如果 todo_tags 里没有记录，但 todos 表上有 tag_id，则视为单标签
  if (todo.tag_id) return [todo.tag_id];
  return [];
}

async function toggleExistingTodoTag(todo, tagId) {
  if (!db) return;
  const currentIds = todoTagsByTodoId.value[todo.id] || [];
  const idx = currentIds.indexOf(tagId);
  const isAdding = idx === -1;
  try {
    if (isAdding) {
      await db.execute(
        'INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)',
        [todo.id, tagId]
      );
      todoTagsByTodoId.value[todo.id] = [...currentIds, tagId];
    } else {
      await db.execute(
        'DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?',
        [todo.id, tagId]
      );
      const nextIds = [...currentIds];
      nextIds.splice(idx, 1);
      todoTagsByTodoId.value[todo.id] = nextIds;
    }
  } catch (e) {
    console.error('toggleExistingTodoTag failed:', e);
  }
}

function toggleTagPopoverForTodo(todoId) {
  if (activeTodoTagPopoverId.value === todoId) {
    activeTodoTagPopoverId.value = null;
  } else {
    activeTodoTagPopoverId.value = todoId;
  }
}

function toggleSnoozePopoverForTodo(todoId) {
  if (activeTodoSnoozePopoverId.value === todoId) {
    activeTodoSnoozePopoverId.value = null;
  } else {
    activeTodoSnoozePopoverId.value = todoId;
  }
}

async function snoozeTodo(todo, days) {
  if (!db) return;
  try {
    const ts = localNow();
    const target = new Date();
    target.setDate(target.getDate() + days);
    const targetStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;

    await db.execute(
      'UPDATE todos SET target_date = ?, updated_at = ? WHERE id = ?',
      [targetStr, ts, todo.id]
    );
    todo.target_date = targetStr;
    todo.updated_at = ts;
    activeTodoSnoozePopoverId.value = null;
    
    snoozeToastMessage.value = '已转移至未来规划';
    snoozeToastVisible.value = true;
    setTimeout(() => { snoozeToastVisible.value = false; }, 2000);
  } catch (e) {
    console.error('snoozeTodo failed:', e);
  }
}

async function moveToToday(todo) {
  if (!db) return;
  try {
    const ts = localNow();
    await db.execute(
      'UPDATE todos SET target_date = ?, updated_at = ? WHERE id = ?',
      [todayDate, ts, todo.id]
    );
    todo.target_date = todayDate;
    todo.updated_at = ts;
  } catch (e) {
    console.error('moveToToday failed:', e);
  }
}

function getTagsForTodo(todo) {
  const ids = getTodoTagIds(todo);
  if (!ids.length) return [];
  const result = [];
  for (const id of ids) {
    const tag = tags.value.find(t => t.id === id);
    if (tag) result.push(tag);
  }
  return result;
}

function toggleTagFilter(tagId) {
  activeTagFilterId.value = activeTagFilterId.value === tagId ? null : tagId;
}

function clearTagFilter() {
  activeTagFilterId.value = null;
}

function getHeatmapCellClass(day) {
  const c = day.count || 0;
  if (c === 0) return 'bg-white/5';
  if (c <= 2) return 'bg-purple-900/40';
  if (c <= 5) return 'bg-purple-700/60';
  return 'bg-purple-500';
}

function showHeatmapTooltip(day, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  heatmapTooltip.value = {
    visible: true,
    x: rect.left + rect.width / 2,
    y: rect.top - 8,
    date: day.date,
    count: day.count
  };
}

function hideHeatmapTooltip() {
  heatmapTooltip.value.visible = false;
}

// ─── Archives ───────────────────────────────────────────────

async function loadArchives() {
  const rows = await db.select('SELECT * FROM archives ORDER BY created_at DESC');
  archives.value = rows;
}

async function saveArchive() {
  if (!db || !summaryContent.value) return;
  try {
    const ts = localNow();
    // 1. 写入数据库存档
    const result = await db.execute(
      'INSERT INTO archives (date, content, created_at) VALUES (?, ?, ?)',
      [todayStr, summaryContent.value, ts]
    );
    archives.value.unshift({
      id: result.lastInsertId,
      date: todayStr,
      content: summaryContent.value,
      created_at: ts
    });

    // 2. 写入用户文档目录 Markdown 文件
    const docs = await documentDir();
    const folder = await join(docs, 'FocusLog_Archive');
    await mkdir(folder, { recursive: true });
    const filename = `${todayDate}.md`;
    const filePath = await join(folder, filename);
    await writeTextFile(filePath, summaryContent.value);

    isSummaryOpen.value = false;

    // 轻量级提示：已写入文件并入库
    archiveToastMessage.value = `已保存到文稿目录 FocusLog_Archive/${todayDate}.md`;
    archiveToastVisible.value = true;
    setTimeout(() => {
      archiveToastVisible.value = false;
    }, 2500);
  } catch (e) {
    console.error('saveArchive failed:', e);
  }
}

async function saveReviewReport() {
  if (!reviewContent.value) return;
  try {
    const docs = await documentDir();
    const folder = await join(docs, 'FocusLog_Archive');
    await mkdir(folder, { recursive: true });

    let name = (reviewFileName.value || '').trim();
    if (!name) {
      const baseDate = reviewStartDate.value || todayDate;
      const { year, week } = getIsoWeek(baseDate);
      name = `Weekly_${year}_W${pad(week)}`;
    }
    if (!name.toLowerCase().endsWith('.md')) {
      name += '.md';
    }

    const filePath = await join(folder, name);
    await writeTextFile(filePath, reviewContent.value);

    archiveToastMessage.value = `已保存回顾到文稿目录 FocusLog_Archive/${name}`;
    archiveToastVisible.value = true;
    setTimeout(() => {
      archiveToastVisible.value = false;
    }, 2500);
  } catch (e) {
    console.error('saveReviewReport failed:', e);
    reviewError.value = e.message || '保存回顾失败';
  }
}

async function deleteArchive(id) {
  if (!db) return;
  await db.execute('DELETE FROM archives WHERE id = ?', [id]);
  archives.value = archives.value.filter(a => a.id !== id);
}

// ─── CRUD ───────────────────────────────────────────────────

function startEdit(todo) {
  editingTodoId.value = todo.id;
  editingText.value = todo.text;
}

function cancelEdit() {
  editingTodoId.value = null;
  editingText.value = '';
}

async function saveEdit(todo) {
  if (!db) return;
  const text = editingText.value.trim();
  // 如果内容被清空，则还原为原文并退出编辑
  if (!text) {
    cancelEdit();
    return;
  }
  try {
    const ts = localNow();
    await db.execute(
      'UPDATE todos SET text = ?, updated_at = ? WHERE id = ?',
      [text, ts, todo.id]
    );
    todo.text = text;
    todo.updated_at = ts;
  } catch (e) {
    console.error('saveEdit failed:', e);
  } finally {
    cancelEdit();
  }
}

function handleTodoInput(e) {
  const text = newTodo.value;
  const cursor = e.target.selectionStart;
  
  // 向前寻找光标前的最后一个 '#'
  const lastHashIndex = text.lastIndexOf('#', cursor - 1);
  
  // 检查 '#' 是否存在，并且（它是字符串开头，或者它前面是个空格）
  if (lastHashIndex !== -1 && (lastHashIndex === 0 || text[lastHashIndex - 1] === ' ')) {
    // 检查 '#' 和光标之间是否包含空格，如果包含说明这个 hashtag 已经打断了
    const queryStr = text.substring(lastHashIndex + 1, cursor);
    if (!queryStr.includes(' ')) {
      // 触发 Mention
      mentionState.value = {
        visible: true,
        query: queryStr,
        startIndex: lastHashIndex,
        selectedIndex: 0
      };
      return;
    }
  }
  
  mentionState.value.visible = false;
}

function handleTodoKeydown(e) {
  if (mentionState.value.visible) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const max = filteredMentionTags.value.length;
      if (max > 0) {
        mentionState.value.selectedIndex = (mentionState.value.selectedIndex + 1) % max;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const max = filteredMentionTags.value.length;
      if (max > 0) {
        mentionState.value.selectedIndex = (mentionState.value.selectedIndex - 1 + max) % max;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // 拦截 Enter 键，选中标签
      if (filteredMentionTags.value.length > 0) {
        selectMentionTag(filteredMentionTags.value[mentionState.value.selectedIndex]);
      } else if (mentionState.value.query) {
        // 如果搜索不到，回车可以直接创建一个新标签 (顺滑体验)
        createNewMentionTag(mentionState.value.query);
      }
    } else if (e.key === 'Escape') {
      mentionState.value.visible = false;
    }
  } else {
    // 只有在弹窗不可见时，回车才真的提交任务
    if (e.key === 'Enter') {
      e.preventDefault();
      addTodo();
    }
  }
}

async function createNewMentionTag(tagName) {
  if (!db) return;
  try {
    const color = tagColorPresets[Math.floor(Math.random() * tagColorPresets.length)];
    const result = await db.execute('INSERT INTO tags (name, color) VALUES (?, ?)', [tagName, color]);
    const newlyCreated = { id: result.lastInsertId, name: tagName, color };
    tags.value.unshift(newlyCreated);
    selectMentionTag(newlyCreated);
  } catch (e) {
    console.error('createNewMentionTag failed:', e);
  }
}

function selectMentionTag(tag) {
  const text = newTodo.value;
  const start = mentionState.value.startIndex;
  
  // 把原来的 `#query` 替换成空（因为我们是通过 newTodoSelectedTagIds 挂载标签的）
  // 或者你想保留文字，这里我们选择去除对应的文字并加入高亮数组
  const before = text.substring(0, start);
  const after = text.substring(start + 1 + mentionState.value.query.length);
  
  newTodo.value = before + after; // 清除输入的 #标签
  
  if (!newTodoSelectedTagIds.value.includes(tag.id)) {
    newTodoSelectedTagIds.value.push(tag.id);
  }
  
  mentionState.value.visible = false;
  
  // 恢复焦点
  nextTick(() => {
    if (newTodoInput.value) newTodoInput.value.focus();
  });
}

const addTodo = async () => {
  let text = newTodo.value.trim();
  if (!text || !db) return;
  try {
    const ts = localNow();
    let selectedIds = [...newTodoSelectedTagIds.value];
    
    // Inline #tag parser
    const matches = text.match(/#(\S+)/g);
    if (matches) {
      for (const match of matches) {
        const tagName = match.slice(1);
        const tagObj = tags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        if (tagObj && !selectedIds.includes(tagObj.id)) {
          selectedIds.push(tagObj.id);
        }
      }
      // Remove recognized hashtags from text to clean up
      text = text.replace(/#(\S+)/g, (match) => {
        const tagName = match.slice(1);
        const tagObj = tags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        return tagObj ? '' : match; // only remove if matched a real tag
      }).trim();
    }
    // Prevent empty text submission after tag stripping
    if (!text) {
      newTodoSelectedTagIds.value = selectedIds;
      return; 
    }

    const primaryTagId = selectedIds.length > 0 ? selectedIds[0] : null;

    const result = await db.execute(
      'INSERT INTO todos (text, completed, from_yesterday, created_at, updated_at, tag_id, rolled_count, target_date) VALUES (?, 0, 0, ?, ?, ?, 0, ?)',
      [text, ts, ts, primaryTagId, todayDate]
    );
    const todoId = result.lastInsertId;

    // 多对多关联：为该任务写入 todo_tags 关系
    for (const tagId of selectedIds) {
      await db.execute(
        'INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)',
        [todoId, tagId]
      );
    }

    todoTagsByTodoId.value = {
      ...todoTagsByTodoId.value,
      [todoId]: selectedIds
    };

    todos.value.unshift({
      id: todoId,
      text,
      completed: false,
      from_yesterday: false,
      created_at: ts,
      updated_at: ts,
      target_date: todayDate,
      tag_id: primaryTagId,
      rolled_count: 0
    });
    newTodo.value = '';
    newTodoSelectedTagIds.value = [];
    createTagPopoverOpen.value = false;
  } catch (e) {
    console.error('addTodo failed:', e);
  }
};

const deleteTodo = async (id) => {
  if (!db) return;
  try {
    await db.execute('DELETE FROM todos WHERE id = ?', [id]);
    todos.value = todos.value.filter(t => t.id !== id);
  } catch (e) {
    console.error('deleteTodo failed:', e);
  }
};

const toggleTodo = async (todo) => {
  if (!db) return;
  try {
    const newCompleted = !todo.completed;
    const ts = localNow();
    await db.execute(
      'UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?',
      [newCompleted ? 1 : 0, ts, todo.id]
    );
    todo.completed = newCompleted;
    todo.updated_at = ts;
  } catch (e) {
    console.error('toggleTodo failed:', e);
  }
};

// ─── AI Summary ─────────────────────────────────────────────

async function generateSummary() {
  isSummaryOpen.value = true;
  summaryContent.value = '';
  summaryError.value = '';

  if (!apiKey.value) {
    summaryError.value = '请先在设置中配置 DeepSeek API Key';
    return;
  }

  const completed = completedTodos.value;
  if (completed.length === 0) {
    summaryError.value = '今天还没有已完成的任务，先去完成几个吧！';
    return;
  }

  summaryLoading.value = true;
  const taskList = completed.map((t, i) => `${i + 1}. ${t.text}`).join('\n');

  // 查询今日未完成且被多次拖延的任务（rolled_count > 3）
  let delayedTaskList = '';
  try {
    const delayed = await db.select(
      'SELECT text, rolled_count FROM todos WHERE completed = 0 AND rolled_count > 3 AND date(created_at) <= date(?)',
      [todayDate]
    );
    if (delayed.length > 0) {
      delayedTaskList = delayed.map((t, i) => `${i + 1}. ${t.text}（已拖延 ${t.rolled_count} 天）`).join('\n');
    }
  } catch (_) { /* 忽略 */ }

  const userContent = delayedTaskList
    ? `今天是 ${todayStr}。以下是今日已完成的任务列表：\n${taskList}\n\n以下任务今日仍未完成且已被多次拖延：\n${delayedTaskList}\n如果发现有任务被反复拖延，请用一句话幽默地提醒我，或者建议我是否应该拆解这个任务。`
    : `今天是 ${todayStr}。以下是今日已完成的任务列表：\n${taskList}`;

  const defaultDailyPrompt = `You are a meticulous product assistant. Based on the completed tasks provided, generate a concise daily work report in Markdown. Requirements:
1) Only summarize actual tasks, do not fabricate results;
2) Highlight work related to AI / LLMs / prompts / automation;
3) Do not force AI descriptions where none exist;
4) Professional, plain tone;
5) Use third person;
6) Use Markdown headings + bullet points, each bullet under 20 characters;
7) If delayed tasks are provided, add a humorous one-liner reminder at the end.`;

  const dailySystemPrompt = customDailyPrompt.value.trim()
    ? customDailyPrompt.value.trim()
        .replace(/\{date\}/g, todayStr)
        .replace(/\{completedCount\}/g, String(completed.length))
        .replace(/\{todosText\}/g, taskList)
    : defaultDailyPrompt;

  try {
    const response = await tauriFetch(`${apiBaseUrl.value}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.value}`
      },
      body: JSON.stringify({
        model: apiModel.value,
        messages: [
          {
            role: 'system',
            content: dailySystemPrompt
          },
          {
            role: 'user',
            content: userContent
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 请求失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    summaryContent.value = data.choices[0].message.content;
  } catch (e) {
    summaryError.value = e.message || '生成总结时发生错误';
  } finally {
    summaryLoading.value = false;
  }
}

// ─── 周报 / 月报回顾 ────────────────────────────────────────────

async function generateReviewReport() {
  reviewError.value = '';
  reviewContent.value = '';
  reviewStatsText.value = '';

  if (!apiKey.value) {
    reviewError.value = '请先在设置中配置 DeepSeek API Key';
    return;
  }
  if (!db) {
    reviewError.value = '数据库尚未初始化完成，请稍后再试';
    return;
  }

  const start = (reviewStartDate.value || '').trim();
  const end = (reviewEndDate.value || '').trim();
  if (!start || !end) {
    reviewError.value = '请先选择开始和结束日期';
    return;
  }
  if (start > end) {
    reviewError.value = '开始日期不能晚于结束日期';
    return;
  }

  reviewLoading.value = true;

  try {
    // 1. 查询时间范围内的已完成任务
    const tasks = await db.select(
      'SELECT * FROM todos WHERE completed = 1 AND date(created_at) BETWEEN date(?) AND date(?) ORDER BY created_at ASC',
      [start, end]
    );

    if (tasks.length === 0) {
      reviewError.value = '该时间范围内没有已完成的任务，无法生成阶段性回顾。';
      return;
    }

    // 2. 读取对应日期的 Markdown 日志
    const docs = await documentDir();
    const folder = await join(docs, 'FocusLog_Archive');
    const datesInRange = getDateRangeDates(start, end);
    const logs = [];

    for (const d of datesInRange) {
      try {
        const filePath = await join(folder, `${d}.md`);
        const content = await readTextFile(filePath);
        logs.push({ date: d, content });
      } catch {
        // 某些日期可能没有生成日记，忽略即可
      }
    }

    reviewStatsText.value = `时间范围内共完成 ${tasks.length} 项任务，找到 ${logs.length} 篇日记`;

    const taskLines = tasks
      .map((t, idx) => `${idx + 1}. [${String(t.created_at).slice(0, 10)}] ${t.text}`)
      .join('\n');

    const logText = logs.length
      ? logs
          .map(l => `### 日志 ${l.date}\n${l.content}`)
          .join('\n\n')
      : '（提示：该时间范围内未找到对应的 Markdown 日志文件，本次回顾将主要基于任务列表进行整理。）';

    const userPrompt = [
      `时间范围：${start} ~ ${end}`,
      '',
      '一、已完成任务列表：',
      taskLines,
      '',
      '二、对应日期的 Markdown 日记内容：',
      logText,
      '',
      '请根据以上任务与日记内容，总结出这一阶段的三个重大里程碑，并给出一份下一阶段的行动建议。',
      '输出为一份结构清晰、简洁的 Markdown 周报 / 月报，不要虚构未出现的内容。'
    ].join('\n');

    const defaultReviewPrompt = `You are a meticulous product assistant. Based on the tasks and Markdown journals provided, generate a periodic work report. Requirements:
1) Summarize three representative milestones from actual task progress;
2) Each milestone should state the background, key actions, and visible output;
3) Provide 3-5 actionable next-phase suggestions with priority awareness;
4) Use Markdown structure: Overview, Three Milestones, Next Phase Plan;
5) Professional tone, no exaggeration.`;

    const reviewSystemPrompt = customReviewPrompt.value.trim() || defaultReviewPrompt;

    const response = await tauriFetch(`${apiBaseUrl.value}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.value}`
      },
      body: JSON.stringify({
        model: apiModel.value,
        messages: [
          {
            role: 'system',
            content: reviewSystemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 请求失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    reviewContent.value = data.choices?.[0]?.message?.content || '';

    // 自动生成一个推荐的周报文件名
    const baseDate = start || todayDate;
    const { year, week } = getIsoWeek(baseDate);
    reviewFileName.value = `Weekly_${year}_W${pad(week)}.md`;
  } catch (e) {
    console.error('generateReviewReport failed:', e);
    reviewError.value = e.message || '生成阶段性回顾时发生错误';
  } finally {
    reviewLoading.value = false;
  }
}

// 点击应用空白区域时关闭内联的 tag 浮窗
onMounted(() => {
  initDB();
  document.addEventListener('click', (e) => {
    // 这里简单通过全局点击关闭单例的修改标签弹窗（因为弹窗本身是 @click.stop 阻止冒泡了）
    activeTodoTagPopoverId.value = null;
    activeTodoSnoozePopoverId.value = null;
  });
  // 初始化后初次自动 focus
  if (currentView.value === 'today') {
    nextTick(() => newTodoInput.value?.focus());
  }
});
</script>

<style>
::-webkit-scrollbar {
  display: none;
}
body {
  margin: 0;
  -webkit-font-smoothing: antialiased;
}
</style>
