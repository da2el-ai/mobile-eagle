<script setup lang="ts">
import { ref } from 'vue';
import AppDialog from '@/components/common/AppDialog.vue';
import { useI18n } from '@/composables/use-i18n';
import { useAuthStore } from '@/stores/auth';
import { errorMessage } from '@/api/eagle-api';
import { useToast } from '@/composables/use-toast';

// 認証ダイアログ（auth.md 4 章）。閉じるボタンなし・背景クリックでは閉じない（z-95）。
const { t } = useI18n();
const auth = useAuthStore();
const { showToast } = useToast();

const password = ref('');
const hasError = ref(false);
const submitting = ref(false);

async function submit(): Promise<void> {
  if (submitting.value || !password.value) return;
  submitting.value = true;
  hasError.value = false;
  try {
    const ok = await auth.login(password.value);
    // 失敗（401）はダイアログ内でエラー表示。成功時は auth.status が 'ok' になり App 側で閉じる。
    if (!ok) hasError.value = true;
  } catch (e) {
    // 通信失敗などはトーストで通知し、ダイアログは保持する。
    showToast(errorMessage(e));
  } finally {
    submitting.value = false;
  }
}

// 入力を変えたらエラー表示を消す（auth.md 4 章）。
function onInput(): void {
  if (hasError.value) hasError.value = false;
}
</script>

<template>
  <AppDialog :title="t('auth.title')" :z-index="95" :closable="false">
    <div class="flex flex-col gap-3">
      <input
        v-model="password"
        type="password"
        :placeholder="t('auth.placeholder')"
        autofocus
        class="h-11 rounded-[9px] border border-border bg-elev px-3 text-base text-fg outline-none focus:border-accent"
        @input="onInput"
        @keyup.enter="submit"
      >
      <!-- エラーは赤（#e2554b）で入力欄の下に表示（auth.md 4 章） -->
      <p v-if="hasError" class="text-sm" style="color: #e2554b">
        {{ t('auth.error') }}
      </p>
      <button
        type="button"
        :disabled="submitting"
        :style="{ opacity: submitting ? 0.5 : 1 }"
        class="h-11 rounded-[9px] bg-accent text-base font-bold text-white"
        @click="submit"
      >
        {{ t('common.ok') }}
      </button>
    </div>
  </AppDialog>
</template>
