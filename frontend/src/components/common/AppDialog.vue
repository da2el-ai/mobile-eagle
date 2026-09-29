<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { useI18n } from '@/composables/use-i18n';

// 中央上寄せのモーダル枠（base.md 5.2）。フィルタ・設定・移動先選択・認証で共用する。
// フォルダツリー（左スライドイン）は別枠。
const props = withDefaults(
  defineProps<{
    title: string;
    // 重なり順（base.md 5.2）。ダイアログ 60 / 移動先 70 / ライブラリ再読み込み 90 / 認証 95。
    zIndex?: number;
    // false のとき閉じるボタンを出さず、背景クリックでも閉じない（認証・ライブラリ再読み込みの実行中）。
    closable?: boolean;
  }>(),
  { zIndex: 60, closable: true },
);

const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const onScrim = (): void => {
  if (props.closable) emit('close');
};
</script>

<template>
  <div
    class="fixed inset-0 flex items-start justify-center bg-scrim"
    :style="{ zIndex, animation: 'fadeIn .15s ease' }"
    @click="onScrim"
  >
    <div
      class="max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-b-[18px] bg-panel text-fg"
      :style="{ animation: 'popIn .22s cubic-bezier(.2,.8,.2,1)' }"
      @click.stop
    >
      <div
        class="sticky top-0 flex items-center justify-between border-b border-border bg-panel px-[18px] py-4"
      >
        <span class="text-base font-bold">{{ title }}</span>
        <button
          v-if="closable"
          type="button"
          class="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-fg hover:bg-hover"
          :aria-label="t('common.close')"
          @click="emit('close')"
        >
          <AppIcon name="close" :size="22" />
        </button>
      </div>
      <div class="p-[18px]">
        <slot />
      </div>
      <slot name="footer" />
    </div>
  </div>
</template>
