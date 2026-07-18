<template>
  <button
    v-if="show"
    @click="$emit('close')"
    :class="[
      'bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all shadow-lg',
      positionClass
    ]"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// プロパティの定義
type TCloseButtonProps = {
  show?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  zIndex?: number
}

const props = withDefaults(defineProps<TCloseButtonProps>(), {
  show: true,
  position: 'top-right',
  zIndex: 10
})

// イベントの定義
defineEmits<{
  close: []
}>()

// ポジションクラスの計算
const positionClass = computed(() => {
  const baseClass = 'absolute'
  const zClass = `z-${props.zIndex}`
  
  switch (props.position) {
    case 'top-right':
      return `${baseClass} top-4 right-4 ${zClass}`
    case 'top-left':
      return `${baseClass} top-4 left-4 ${zClass}`
    case 'bottom-right':
      return `${baseClass} bottom-4 right-4 ${zClass}`
    case 'bottom-left':
      return `${baseClass} bottom-4 left-4 ${zClass}`
    default:
      return `${baseClass} top-4 right-4 ${zClass}`
  }
})
</script>

<style scoped>
/* 必要に応じてカスタムスタイルを追加 */
</style>
