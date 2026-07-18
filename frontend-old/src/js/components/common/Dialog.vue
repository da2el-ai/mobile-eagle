<template>
  <div class="c-dialog p-4">
    <div class="c-dialog__frame relative bg-white rounded-lg shadow-xl max-w-4xl w-full overflow-hidden">
      <!-- 閉じるボタン（Dialog用） -->
      <CloseButton 
        :show="showCloseButton"
        position="top-right"
        :z-index="10"
        @close="$emit('close')"
      />
      
      <!-- 表示エリア -->
      <div class="c-dialog__container p-6">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CloseButton from './CloseButton.vue'

// プロパティの定義
type TDialogProps = {
  showCloseButton?: boolean
}

withDefaults(defineProps<TDialogProps>(), {
  showCloseButton: true
})

// イベントの定義
defineEmits<{
  close: []
}>()
</script>

<style scoped>
/* 必要に応じてカスタムスタイルを追加 */
</style>
