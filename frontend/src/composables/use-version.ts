import { readonly, ref } from 'vue';
import { fetchVersion } from '@/api/eagle-api';

// アプリのバージョン。プラグインの manifest.json が単一ソースで、GET /api/version が返す。
// モジュールスコープに単一の state を持つシングルトン（use-settings.ts と同じ方針）。
// **起動時に一度だけ取得する**（設定ダイアログを開くたびに取りに行かない）。

const version = ref<string | null>(null);

// 取得を試みたか。失敗しても再取得しない（バージョン表記のために通信を繰り返さない）。
let tried = false;

export function useVersion() {
  // App.vue のマウント時に呼ぶ。認証前でも取得できる（/api/version は認証不要）。
  async function load(): Promise<void> {
    if (tried) return;
    tried = true;
    try {
      version.value = await fetchVersion();
    } catch {
      // 取得できなければバージョンを表示しないだけ。機能には影響しない
      version.value = null;
    }
  }

  return { version: readonly(version), load };
}
