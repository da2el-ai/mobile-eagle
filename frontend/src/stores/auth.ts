// 認証状態（auth.md 3 章）。起動フローと 401 ハンドリングの中心。
// status !== 'ok' の間はルート watch・自動リロードを起動しない（App.vue / grid.md）。

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { checkAuth, login as apiLogin } from '@/api/eagle-api';

export type AuthStatus = 'checking' | 'required' | 'ok' | 'error';

export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('checking');

  // 起動時チェック。認証不要 or 認証済みなら ok、要認証かつ未認証なら required、
  // 通信失敗（サーバー停止等）なら error（auth.md 3 章）。
  async function check(): Promise<void> {
    status.value = 'checking';
    try {
      const result = await checkAuth();
      status.value = !result.authRequired || result.authenticated ? 'ok' : 'required';
    } catch {
      status.value = 'error';
    }
  }

  // ログイン。成功で ok にする。false（パスワード不一致）はダイアログ内でエラー表示する。
  async function login(password: string): Promise<boolean> {
    const ok = await apiLogin(password);
    if (ok) status.value = 'ok';
    return ok;
  }

  // 401 共通処理: セッション失効で認証ダイアログを再表示する（auth.md 5 章）。
  function requireLogin(): void {
    status.value = 'required';
  }

  return { status, check, login, requireLogin };
});
