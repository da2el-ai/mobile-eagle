<template>
  <button
    class="flex flex-col justify-center items-center w-8 h-8 p-1 hover:bg-gray-100 rounded-md"
    @click="$emit('click')"
  >
    <div class="w-5 h-0.5 bg-gray-600 mb-1"></div>
    <div class="w-5 h-0.5 bg-gray-600 mb-1"></div>
    <div class="w-5 h-0.5 bg-gray-600"></div>
  </button>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'click'): void
}>()
</script>
