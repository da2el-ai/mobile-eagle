<template>
  <div class="flex items-center space-x-1">
    <button
      v-for="i in 5"
      :key="i"
      @click="updateRating(i)"
      class="focus:outline-none"
      :title="`${i}つ星の評価をつける`"
    >
      <!-- ★ アイコン (filled) -->
      <svg
        v-if="i <= modelValue"
        class="w-6 h-6 text-yellow-400"
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
        class="w-6 h-6 text-gray-300"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}>()

const updateRating = (rating: number) => {
  if (rating === props.modelValue) {
    // 同じ星をクリックした場合は評価をリセット
    emit('update:modelValue', 0)
    emit('change', 0)
  } else {
    emit('update:modelValue', rating)
    emit('change', rating)
  }
}
</script>
