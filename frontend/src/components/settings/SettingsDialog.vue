<script setup lang="ts">
import { ref } from 'vue';
import AppDialog from '@/components/common/AppDialog.vue';
import ChipButton from '@/components/common/ChipButton.vue';
import { useI18n } from '@/composables/use-i18n';
import { useSettings, type Theme } from '@/composables/use-settings';
import { useVersion } from '@/composables/use-version';
import { useLibraryReloadStore } from '@/stores/library-reload';
import { useUiStore } from '@/stores/ui';

// 設定ダイアログ（settings.md 3 章）。
// **保存ボタンは置かない。** 変更は即時反映・即時保存する
// （旧実装の「項目によって保存タイミングが違う」非対称を解消するため）。
const { t } = useI18n();
const { settings, update } = useSettings();
// 起動時に取得済みの値を読むだけ（ダイアログを開くたびの通信は発生しない）。
const { version } = useVersion();
const ui = useUiStore();
const libraryReload = useLibraryReloadStore();

const close = (): void => {
  ui.isSettingsOpen = false;
};

const themes: { value: Theme; label: string }[] = [
  { value: 'light', label: t('theme.light') },
  { value: 'dark', label: t('theme.dark') },
  { value: 'auto', label: t('theme.auto') },
];

// 数値入力は「入力のたびに反映するが、blur で範囲外を clamp して確定」（settings.md 3 章）。
// 表示用のドラフトを別に持つ理由: update() は sanitize で即座に clamp するため、
// ドラフト無しだと「15」と打とうとした瞬間に「1」が 2 へ矯正され、続きが打てなくなる。
// ドラフトは打った文字をそのまま保ち、blur で確定値（clamp 後）に揃える。
//
// **v-model は使わず `:value` + `@input` で組む。**
// Vue 3 の v-model は `type="number"` の input に自動で数値キャストを掛けるため、
// v-model だと ref<string> に number が入り、`.trim()` が TypeError で落ちる。
// 例外は input ハンドラの中で飲み込まれ、「入力しても blur で消える」という
// 原因の分かりにくい症状になる（実機で踏んだ。knowledge.md に詳細）。
const intervalDraft = ref(String(settings.autoReloadInterval));
const maxFileSizeDraft = ref(settings.maxFileSize == null ? '' : String(settings.maxFileSize));
const qualityDraft = ref(settings.quality == null ? '' : String(settings.quality));

// input の生の文字列を取り出す（常に string。空欄・不正入力は '' になる）。
const rawValue = (e: Event): string => (e.target as HTMLInputElement).value;

const onIntervalInput = (e: Event): void => {
  intervalDraft.value = rawValue(e);
  const raw = intervalDraft.value.trim();
  const n = Number(raw);
  if (raw !== '' && Number.isFinite(n)) update({ autoReloadInterval: n });
};

// 空欄・非数値のまま離れたら直前の有効値へ戻す（settings.md 5 章）。
const onIntervalBlur = (): void => {
  intervalDraft.value = String(settings.autoReloadInterval);
};

// ファイルサイズ上限と圧縮率は**空欄 = null（表示既定を使う）**が有効な値。
const onMaxFileSizeInput = (e: Event): void => {
  maxFileSizeDraft.value = rawValue(e);
  const raw = maxFileSizeDraft.value.trim();
  if (raw === '') {
    update({ maxFileSize: null });
    return;
  }
  const n = Number(raw);
  if (Number.isFinite(n)) update({ maxFileSize: n });
};

const onMaxFileSizeBlur = (): void => {
  maxFileSizeDraft.value = settings.maxFileSize == null ? '' : String(settings.maxFileSize);
};

const onQualityInput = (e: Event): void => {
  qualityDraft.value = rawValue(e);
  const raw = qualityDraft.value.trim();
  if (raw === '') {
    update({ quality: null });
    return;
  }
  const n = Number(raw);
  if (Number.isFinite(n)) update({ quality: n });
};

const onQualityBlur = (): void => {
  qualityDraft.value = settings.quality == null ? '' : String(settings.quality);
};

// ライブラリの強制再読み込み（library-reload.md 4.1）。
// 確認後に設定ダイアログを閉じ、実行中ダイアログへ切り替える。
const onReloadLibrary = (): void => {
  if (!window.confirm(t('libraryReload.confirm'))) return;
  close();
  void libraryReload.start();
};

const LABEL = 'text-[13px] font-semibold text-muted';
const HELP = 'text-xs text-muted';
// iPhone のフォーカスズームを避けるため文字サイズは 16px 以上（base.md 5.2）。
const INPUT =
  'h-11 w-full rounded-[10px] border border-border bg-elev px-[14px] text-base text-fg outline-none focus:border-accent';
</script>

<template>
  <AppDialog :title="t('header.settings')" @close="close">
    <div class="flex flex-col gap-[22px]">
      <section class="flex flex-col gap-2.5">
        <span :class="LABEL">{{ t('theme.label') }}</span>
        <div class="flex gap-2">
          <ChipButton
            v-for="theme in themes"
            :key="theme.value"
            :active="settings.theme === theme.value"
            show-check
            @click="update({ theme: theme.value })"
          >
            {{ theme.label }}
          </ChipButton>
        </div>
      </section>

      <section class="flex flex-col gap-2.5">
        <span :class="LABEL">{{ t('settings.autoReload') }}</span>
        <div class="flex gap-2">
          <ChipButton :active="settings.autoReload" show-check @click="update({ autoReload: true })">
            {{ t('settings.enabled') }}
          </ChipButton>
          <ChipButton
            :active="!settings.autoReload"
            show-check
            @click="update({ autoReload: false })"
          >
            {{ t('settings.disabled') }}
          </ChipButton>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <span :class="LABEL">{{ t('settings.autoReloadInterval') }}</span>
        <input
          :value="intervalDraft"
          type="number"
          min="2"
          max="120"
          :class="INPUT"
          @input="onIntervalInput"
          @blur="onIntervalBlur"
        >
        <span :class="HELP">{{ t('settings.autoReloadIntervalHelp') }}</span>
      </section>

      <section class="flex flex-col gap-2">
        <span :class="LABEL">{{ t('settings.maxFileSize') }}</span>
        <input
          :value="maxFileSizeDraft"
          type="number"
          min="0"
          placeholder="768"
          :class="INPUT"
          @input="onMaxFileSizeInput"
          @blur="onMaxFileSizeBlur"
        >
        <span :class="HELP">{{ t('settings.maxFileSizeHelp') }}</span>
      </section>

      <section class="flex flex-col gap-2">
        <span :class="LABEL">{{ t('settings.quality') }}</span>
        <input
          :value="qualityDraft"
          type="number"
          min="1"
          max="100"
          placeholder="85"
          :class="INPUT"
          @input="onQualityInput"
          @blur="onQualityBlur"
        >
        <span :class="HELP">{{ t('settings.qualityHelp') }}</span>
      </section>

      <section class="flex flex-col gap-2">
        <span :class="LABEL">{{ t('settings.library') }}</span>
        <button
          type="button"
          class="h-11 w-full rounded-[10px] border border-border bg-elev text-base text-fg hover:bg-hover"
          @click="onReloadLibrary"
        >
          {{ t('settings.reloadLibrary') }}
        </button>
        <span :class="HELP">{{ t('settings.reloadLibraryHelp') }}</span>
      </section>

      <!-- バージョン表記（最下部）。取得できなかったときは表示しない -->
      <p v-if="version" class="text-center text-xs text-muted">
        v{{ version }}
      </p>
    </div>
  </AppDialog>
</template>
