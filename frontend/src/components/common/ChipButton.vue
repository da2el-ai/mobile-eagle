<script setup lang="ts">
import AppIcon from './AppIcon.vue';

// チップ型のトグルボタン（base.md 5.2）。標準のチェックボックス/ラジオは使わず、
// 選択中はアクセント背景 + 白文字 +（任意で）チェックアイコンで表現する。
withDefaults(
  defineProps<{
    active?: boolean;
    // 選択中にチェックアイコンを表示するか（拡張子・テーマ等で使う）。
    showCheck?: boolean;
  }>(),
  { active: false, showCheck: false },
);
</script>

<template>
  <button
    type="button"
    class="flex h-[38px] items-center gap-1 rounded-[20px] border px-3.5 text-sm"
    :class="
      active
        ? 'border-accent bg-accent font-semibold text-white'
        : 'border-border bg-elev text-fg hover:bg-hover'
    "
  >
    <AppIcon v-if="showCheck && active" name="check" :size="16" />
    <slot />
  </button>
</template>
