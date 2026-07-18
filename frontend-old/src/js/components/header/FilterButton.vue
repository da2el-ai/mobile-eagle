<template>
  <button
    @click="$emit('click')"
    class="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
    title="フィルター"
  >
    <!-- じょうろのようなアイコン -->
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="text-gray-600"
    >
      <path
        d="M3 3h18l-6 6v8l-6 2v-10l-6-6z"
        stroke="none"
        stroke-width="0"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="currentColor"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineEmits<{
  click: []
}>()
</script>
