import { reactive } from 'vue';

// 簡易トースト（base.md 9 章）。数秒で消える通知をグローバルキューで管理する。
export interface ToastItem {
  id: number;
  message: string;
}

const toasts = reactive<ToastItem[]>([]);
let seq = 0;

const showToast = (message: string, durationMs = 3000): void => {
  const id = ++seq;
  toasts.push({ id, message });
  setTimeout(() => {
    const index = toasts.findIndex((toast) => toast.id === id);
    if (index !== -1) toasts.splice(index, 1);
  }, durationMs);
};

export function useToast() {
  return { toasts, showToast };
}
