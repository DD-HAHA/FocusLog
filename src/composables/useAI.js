// ── AI Summary & Review composable ────────────────────────────
import { ref } from 'vue';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { documentDir, join } from '@tauri-apps/api/path';
import { db } from './useDb.js';
import { completedTodos } from './useTodos.js';
import {
  apiKey, apiBaseUrl, apiModel,
  customDailyPrompt, customReviewPrompt,
} from './useSettings.js';
import { getTodayDate, getTodayStr, getIsoWeek, getDateRangeDates, pad, localNow } from './useDateHelpers.js';

// ── Summary state ─────────────────────────────────────────────
export const isSummaryOpen = ref(false);
export const summaryContent = ref('');
export const summaryLoading = ref(false);
export const summaryError = ref('');

// ── Review state ──────────────────────────────────────────────
export const reviewStartDate = ref('');
export const reviewEndDate = ref('');
export const reviewLoading = ref(false);
export const reviewError = ref('');
export const reviewContent = ref('');
export const reviewFileName = ref('');
export const reviewStatsText = ref('');

// Initialize default review date range
import { getDateNDaysAgo } from './useDateHelpers.js';
reviewStartDate.value = getDateNDaysAgo(6);
reviewEndDate.value = getTodayDate();

// ── AI call helper ────────────────────────────────────────────
function getFriendlyError(status, errText) {
  const errorMap = {
    400: '请求格式有误，请检查设置中的 API 配置',
    401: 'API Key 无效或已过期，请前往设置重新配置',
    403: '没有权限访问该模型，请检查 API Key 权限',
    404: 'API 地址有误，请检查设置中的 API Base URL',
    429: '请求过于频繁，请稍等片刻再试',
    500: 'AI 服务暂时出错，请稍后再试',
    502: 'AI 服务暂时不可用，请稍后再试',
    503: 'AI 服务正在维护，请稍后再试',
  };
  if (errorMap[status]) return errorMap[status];
  if (status >= 500) return 'AI 服务暂时不可用，请稍后再试';
  if (status >= 400) return `请求出错 (${status})，请检查设置`;
  return `生成失败：${errText}`;
}

async function callAI(systemPrompt, userPrompt) {
  let response;
  try {
    response = await tauriFetch(`${apiBaseUrl.value}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.value}`,
      },
      body: JSON.stringify({
        model: apiModel.value,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
  } catch (e) {
    throw new Error('网络连接失败，请检查网络后重试');
  }

  if (!response.ok) {
    let errText = '';
    try { errText = await response.text(); } catch (_) {}
    throw new Error(getFriendlyError(response.status, errText));
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  if (!content) {
    throw new Error('AI 返回内容为空，请重试');
  }
  return content;
}

// ── Daily summary ─────────────────────────────────────────────
export async function generateSummary() {
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

  let delayedTaskList = '';
  try {
    const delayed = await db.value.select(
      'SELECT text, rolled_count FROM todos WHERE completed = 0 AND rolled_count > 3 AND date(created_at) <= date(?)',
      [getTodayDate()]
    );
    if (delayed.length > 0) {
      delayedTaskList = delayed.map((t, i) => `${i + 1}. ${t.text}（已拖延 ${t.rolled_count} 天）`).join('\n');
    }
  } catch (_) { }

  const todayStr = getTodayStr();
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

  const systemPrompt = customDailyPrompt.value.trim()
    ? customDailyPrompt.value.trim()
      .replace(/\{date\}/g, todayStr)
      .replace(/\{completedCount\}/g, String(completed.length))
      .replace(/\{todosText\}/g, taskList)
    : defaultDailyPrompt;

  try {
    summaryContent.value = await callAI(systemPrompt, userContent);
  } catch (e) {
    summaryError.value = e.message || '生成总结时发生错误';
  } finally {
    summaryLoading.value = false;
  }
}

// ── Periodic review ───────────────────────────────────────────
export async function generateReviewReport() {
  reviewError.value = '';
  reviewContent.value = '';
  reviewStatsText.value = '';

  if (!apiKey.value) { reviewError.value = '请先在设置中配置 DeepSeek API Key'; return; }
  if (!db.value) { reviewError.value = '数据库尚未初始化完成，请稍后再试'; return; }

  const start = (reviewStartDate.value || '').trim();
  const end = (reviewEndDate.value || '').trim();
  if (!start || !end) { reviewError.value = '请先选择开始和结束日期'; return; }
  if (start > end) { reviewError.value = '开始日期不能晚于结束日期'; return; }

  reviewLoading.value = true;
  try {
    const tasks = await db.value.select(
      'SELECT * FROM todos WHERE completed = 1 AND date(created_at) BETWEEN date(?) AND date(?) ORDER BY created_at ASC',
      [start, end]
    );
    if (tasks.length === 0) {
      reviewError.value = '该时间范围内没有已完成的任务，无法生成阶段性回顾。';
      return;
    }

    const docs = await documentDir();
    const folder = await join(docs, 'FocusLog_Archive');
    const datesInRange = getDateRangeDates(start, end);
    const logs = [];
    for (const d of datesInRange) {
      try {
        const content = await readTextFile(await join(folder, `${d}.md`));
        logs.push({ date: d, content });
      } catch { /* no log for this day */ }
    }

    reviewStatsText.value = `时间范围内共完成 ${tasks.length} 项任务，找到 ${logs.length} 篇日记`;

    const taskLines = tasks
      .map((t, idx) => `${idx + 1}. [${String(t.created_at).slice(0, 10)}] ${t.text}`)
      .join('\n');

    const logText = logs.length
      ? logs.map(l => `### 日志 ${l.date}\n${l.content}`).join('\n\n')
      : '（提示：该时间范围内未找到对应的 Markdown 日志文件，本次回顾将主要基于任务列表进行整理。）';

    const userPrompt = [
      `时间范围：${start} ~ ${end}`, '',
      '一、已完成任务列表：', taskLines, '',
      '二、对应日期的 Markdown 日记内容：', logText, '',
      '请根据以上任务与日记内容，总结出这一阶段的三个重大里程碑，并给出一份下一阶段的行动建议。',
      '输出为一份结构清晰、简洁的 Markdown 周报 / 月报，不要虚构未出现的内容。',
    ].join('\n');

    const defaultReviewPrompt = `You are a meticulous product assistant. Based on the tasks and Markdown journals provided, generate a periodic work report.`;
    const systemPrompt = customReviewPrompt.value.trim() || defaultReviewPrompt;

    reviewContent.value = await callAI(systemPrompt, userPrompt);

    const { year, week } = getIsoWeek(start || getTodayDate());
    reviewFileName.value = `Weekly_${year}_W${pad(week)}.md`;
  } catch (e) {
    console.error('generateReviewReport failed:', e);
    reviewError.value = e.message || '生成阶段性回顾时发生错误';
  } finally {
    reviewLoading.value = false;
  }
}
