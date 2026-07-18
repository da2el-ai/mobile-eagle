<template>
  <div class="flex items-center justify-center">
    <!-- 読み取り専用なのでbuttonではなくspanを使用 -->
    <span
      v-for="i in 5"
      :key="i"
      class="inline-flex"
    >
      <!-- ★ アイコン (filled) -->
      <svg
        v-if="i <= modelValue"
        class="w-2 h-2 text-yellow-400"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      </svg>
      <!-- ☆ アイコン (outline) -->
      <svg
        v-else
        class="w-2 h-2 text-gray-300"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      </svg>
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: number
}>()
</script>
