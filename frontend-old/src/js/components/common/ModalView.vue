<template>
  <div class="c-modal fixed inset-0 z-50">
    <!-- モーダル背景 -->
    <div 
      class="c-modal__bg absolute inset-0 bg-black bg-opacity-50"
      @click="$emit('close')"
    ></div>
    
    <!-- 閉じるボタン（Modal用） -->
    <CloseButton 
      :show="showCloseButton"
      position="top-right"
      :z-index="50"
      @close="$emit('close')"
    />
    
    <!-- モーダルコンテンツエリア -->
    <div :class="`c-modal__container relative ${fitWidth ? 'w-fit' : 'w-full'} ${fitHeight ? '' : 'h-full'} flex flex-col items-center overflow-y-auto`">
      <!-- スロット（複数の要素を配置可能） -->
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import CloseButton from './CloseButton.vue'

// プロパティの定義
type TModalViewProps = {
  showCloseButton?: boolean,
  fitWidth?: boolean,
  fitHeight?: boolean,
}

withDefaults(defineProps<TModalViewProps>(), {
  showCloseButton: true,
  fitWidth: false,
  fitHeight: false,
})

// イベントの定義
defineEmits<{
  close: []
}>()
</script>

