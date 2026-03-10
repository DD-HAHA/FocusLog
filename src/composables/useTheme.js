// ── Theme composable ───────────────────────────────────────────
import { ref, watchEffect } from 'vue';

const STORAGE_KEY = 'focuslog-theme';

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = ref(getInitialTheme());
export const isDark = ref(theme.value === 'dark');

watchEffect(() => {
  const html = document.documentElement;
  if (theme.value === 'light') {
    html.classList.add('light');
  } else {
    html.classList.remove('light');
  }
  localStorage.setItem(STORAGE_KEY, theme.value);
  isDark.value = theme.value === 'dark';
});

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
}
