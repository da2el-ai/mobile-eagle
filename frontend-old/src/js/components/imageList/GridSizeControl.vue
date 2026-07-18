<template>
  <!-- グリッドサイズ変更ボタン -->
  <div class="flex items-center bg-white shadow-lg rounded-lg border">
    <button 
      @click="decreaseGridSize"
      :disabled="!canDecrease"
      class="h-10 px-3 text-lg font-bold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-l-lg"
    >
      −
    </button>
    <div class="h-10 px-2 flex items-center text-sm text-gray-500 border-l border-r">
      {{ currentDisplayedGridSize }}
    </div>
    <button 
      @click="increaseGridSize"
      :disabled="!canIncrease"
      class="h-10 px-3 text-lg font-bold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-r-lg"
    >
      ＋
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettings } from '../../composables/useSettings';

const settings = useSettings()
const gridSize = computed(() => settings.getGridSize())

// 画面サイズの検出
const screenSize = ref<'base' | 'md' | 'xl'>('base')

// 最小・最大値の定義
const minGridSize = {
  base: 1,
  md: 2,
  xl: 3
}
const maxGridSize = {
  base: 6,
  md: 8,
  xl: 10
}

// 画面サイズを更新する関数
const updateScreenSize = () => {
  const width = window.innerWidth
  if (width >= 1280) { // xl breakpoint
    screenSize.value = 'xl'
  } else if (width >= 768) { // md breakpoint
    screenSize.value = 'md'
  } else {
    screenSize.value = 'base'
  }
}

// 現在の画面サイズに対応するグリッドサイズを取得
const currentDisplayedGridSize = computed(() => {
  return gridSize.value[screenSize.value]
})

// グリッドサイズ更新関数
const updateGridSize = (newGridSize: { base: number, md: number, xl: number }) => {
  settings.setGridSize(newGridSize)
}

// グリッドサイズを増加
const increaseGridSize = () => {
  const newGridSize = { ...gridSize.value }
  
  if (newGridSize.base < maxGridSize.base) {
    newGridSize.base++
  }
  if (newGridSize.md < maxGridSize.md) {
    newGridSize.md++
  }
  if (newGridSize.xl < maxGridSize.xl) {
    newGridSize.xl++
  }
  
  updateGridSize(newGridSize);
}

// グリッドサイズを減少
const decreaseGridSize = () => {
  const newGridSize = { ...gridSize.value }
  
  if (newGridSize.base > minGridSize.base) {
    newGridSize.base--
  }
  if (newGridSize.md > minGridSize.md) {
    newGridSize.md--
  }
  if (newGridSize.xl > minGridSize.xl) {
    newGridSize.xl--
  }
  
  updateGridSize(newGridSize);
}



// 増加可能かどうか
const canIncrease = computed(() => {
  return gridSize.value.base < maxGridSize.base ||
         gridSize.value.md < maxGridSize.md ||
         gridSize.value.xl < maxGridSize.xl
})

// 減少可能かどうか
const canDecrease = computed(() => {
  return gridSize.value.base > minGridSize.base ||
         gridSize.value.md > minGridSize.md ||
         gridSize.value.xl > minGridSize.xl
})

// ライフサイクルフック
onMounted(() => {
  updateScreenSize()
  window.addEventListener('resize', updateScreenSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenSize)
})
</script>
