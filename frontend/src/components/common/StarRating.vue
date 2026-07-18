<script setup lang="ts">
// 5 段階の星評価（base.md 5.2）。読み取り専用でも操作可でも使う。
// 操作時は同じ星の再クリックで 0 にリセットする。
const props = withDefaults(
  defineProps<{
    modelValue: number;
    max?: number;
    size?: number;
    readonly?: boolean;
    activeColor?: string;
    inactiveColor?: string;
    inactiveOpacity?: number;
  }>(),
  {
    max: 5,
    size: 16,
    readonly: false,
    activeColor: '#f5b301',
    inactiveColor: 'var(--fg)',
    inactiveOpacity: 0.28,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const onClick = (n: number): void => {
  if (props.readonly) return;
  emit('update:modelValue', props.modelValue === n ? 0 : n);
};
</script>

<template>
  <div class="flex items-center" :style="{ gap: '1px', fontSize: `${size}px`, lineHeight: 1 }">
    <span
      v-for="n in max"
      :key="n"
      :style="{
        color: n <= modelValue ? activeColor : inactiveColor,
        opacity: n <= modelValue ? 1 : inactiveOpacity,
        cursor: readonly ? 'default' : 'pointer',
      }"
      @click="onClick(n)"
    >★</span>
  </div>
</template>
