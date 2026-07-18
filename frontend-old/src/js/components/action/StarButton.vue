<template>
  <!-- レーティングボタン -->
  <button
    @click="$emit('click')"
    class="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
    title="レーティング"
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="text-gray-600"
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="currentColor"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
// イベントの定義
defineEmits<{
  click: []
}>()
</script>
