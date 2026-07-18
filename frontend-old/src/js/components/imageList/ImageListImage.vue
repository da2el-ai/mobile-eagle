<template>
  <div class="c-grid-item relative" ref="rootElement">
    <div
      :class="[
        'bg-gray-100 rounded overflow-hidden relative aspect-square',
        isClickableImage(props.image) ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
      ]"
      @click="isClickableImage(props.image) ? handleImageClick(props.image) : null"
    >
      <img
        :src="`${ApiBaseUrl}/get_thumbnail_image?id=${props.image.id}`"
        :alt="props.image.name"
        :class="['w-full h-full', `object-${currentObjectFit}`]"
        loading="lazy"
        @error="handleImageError(props.image)"
      />

      <span class="c-badge" :data-clickable="isClickableImage(props.image) ? 'true' : 'false'">{{ props.image.ext.toUpperCase() }}</span>

      <!-- 選択状態マーカー -->
      <div v-if="props.image.select" class="c-select-mark">
        <svg id="_レイヤー_1" data-name="レイヤー 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.2 3.2" width="70%" height="70%" fill="white">
          <path class="cls-1" d="m1.6,3.2c-.15,0-.31-.06-.42-.18L.18,2.02C-.06,1.79-.06,1.41.18,1.18c.23-.23.61-.23.85,0l.58.58L3.18.18c.23-.23.61-.23.85,0,.23.23.23.61,0,.85l-2,2c-.12.12-.27.18-.42.18Z"/>
        </svg>
      </div>
    </div>

    <div class="py-1">
      <StarRatingMini :model-value="props.image.star || 0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettings } from '../../composables/useSettings'
import { useMainStore } from '../../store'
import { API_BASE_URL } from '../../env'
import type { TImageItem } from '../../types'
import StarRatingMini from './StarRatingMini.vue'

interface Props {
  image: TImageItem
}

const props = defineProps<Props>()

const settings = useSettings()
const store = useMainStore()
const router = useRouter()

// index.py のURL
const ApiBaseUrl = computed(() => { return API_BASE_URL })

// object-fitの状態管理
const currentObjectFit = computed(() => settings.getObjectFit())

// 現在のフォルダーを取得
const currentFolder = computed(() => store.getCurrentFolder)

// クリック可能な画像かどうかを判定
const isClickableImage = (image: TImageItem): boolean => {
  return true;
  // const clickableExtensions = ['png', 'jpg', 'jpeg', 'webp']
  // return clickableExtensions.includes(image.ext.toLowerCase())
}

// 画像クリック時の処理
const handleImageClick = (image: TImageItem) => {
  if (store.getSelectMode) {
    // 選択モードの場合は選択状態を切り替え
    store.toggleImageSelect(image.id)
  } else {
    // 通常モードの場合はLightboxを開く
    router.push(`/folder/${currentFolder.value?.id || 'all'}/detail/${image.id}`)
  }
}

const handleImageError = (image: TImageItem) => {
  console.error('Failed to load image:', image.name, image)
}
</script>
