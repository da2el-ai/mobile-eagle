<template>
  <button
    @click="$emit('click')"
    class="p-2 rounded-lg transition-colors duration-200"
    :class="isActive ? 'bg-sky-500 hover:bg-sky-300' : 'hover:bg-gray-100'"
    title="複数選択"
  >
    <!-- 丸とチェックマークのアイコン -->
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      :class="isActive ? 'text-white' : 'text-gray-600'"
    >
      <!-- 丸のフレーム -->
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
      />
      <!-- チェックマーク -->
      <path
        d="M9 12 L11 14 L15 10"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
type TProps = {
  isActive: boolean;
};

withDefaults(defineProps<TProps>(), {
  isActive: false
})

defineEmits<{
  click: []
}>()


</script>
