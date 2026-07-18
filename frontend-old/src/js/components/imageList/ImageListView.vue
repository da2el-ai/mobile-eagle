<template>
  <div class="relative pb-12" ref="viewportRef">
    <!-- 仮想スクロールコンテナ -->
    <div
      :style="{ height: gridInfo.totalHeight + 'px' }"
      class="relative"
    >
      <!-- 上部オフセット用のスペーサー -->
      <div :style="{ height: offsetY + 'px' }"></div>

      <!-- 実際に表示されるコンテンツ -->
      <div :class="gridClasses" ref="containerRef">
        <!-- 子フォルダーボタン（常に表示） -->
        <ImagelistviewFolder
          v-for="childFolder in childFolders"
          :key="`folder-${childFolder.id}`"
          :child-folder="childFolder"
        />

        <!-- 仮想化された画像リスト -->
        <ImageListImage
          v-for="image in visibleImages"
          :key="image.id"
          :image="image"
          ref="imageRefs"
        />

        <!-- スクロール最下部を検知するエレメント -->
        <div ref="interSectionRef"></div>
      </div>
    </div>

    <div class="fixed bottom-4 right-4 flex items-center gap-2">
      <!-- object-fit 変更ボタン -->
      <ObjectFitControl />

      <!-- グリッドサイズ変更ボタン -->
      <GridSizeControl />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { debounce } from 'lodash-es'
import { useEagleApi } from '../../composables/useEagleApi'
import { ITEM_GET_COUNT } from '../../env'
import { useSettings } from '../../composables/useSettings'
import { useMainStore } from '../../store'
import type { TImageItem } from '../../types'
import GridSizeControl from './GridSizeControl.vue'
import ObjectFitControl from './ObjectFitControl.vue'
import ImagelistviewFolder from './ImageListFolder.vue'
import ImageListImage from './ImageListImage.vue'

const settings = useSettings()
const store = useMainStore()
const eagleApi = useEagleApi()

// スクロール検知用のref
const viewportRef = ref<HTMLElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const interSectionRef = ref<HTMLElement | null>(null);
const imageRefs = ref<any[]>([]);

// IntersectionObserver用の変数
let observer: IntersectionObserver | null = null;

// 仮想スクロール用の状態
const scrollTop = ref(0);
const containerHeight = ref(0);
const overscan = 5; // 表示範囲外でも描画するアイテム数
const isScrolling = ref(false);
let scrollTimeout: number | null = null;
let lastStableRange = ref({ startIndex: 0, endIndex: 0, startRow: 0, endRow: 0 });


// リスト画像サイズ、リストgapサイズ
const listInfo = ref({
  imageWidth: 0,
  imageHeight: 0,
  gapX: 0,
  gapY: 0,
  lineWidth: 0,
  lineHeight: 200,
  itemsPerLine: 1,
});



// 現在のフォルダーの子フォルダーを取得
const childFolders = computed(() => store.getChildFolders);

// 全ての画像
const allImages = computed(() => store.getImages);

// グリッドクラスを動的に生成
const gridClasses = computed(() => {
  const gridSize = settings.getGridSize();
  return [
    'c-grid',
    'grid',
    'gap-6',
    `grid-cols-${gridSize.base}`,
    `md:grid-cols-${gridSize.md}`,
    `xl:grid-cols-${gridSize.xl}`
  ].join(' ')
})

/**
 * フィルタリングされた画像リスト
 */
const filteredImages = computed(() => {
  // Piniaストアから画像とフォルダーを取得
  // const allImages = store.getImages
  const currentFilter = store.getCurrentFilter

  // console.log('Current Filter:', currentFilter);

  if (!currentFilter) {
    return allImages.value
  }

  return allImages.value.filter((image) => {
    // 星評価でフィルタリング
    if (currentFilter.stars && currentFilter.stars.length > 0) {
      const imageStar = image.star || 0
      if (!currentFilter.stars.includes(imageStar)) {
        return false
      }
    }

    // 拡張子でフィルタリング
    if (currentFilter.exts && currentFilter.exts.length > 0) {
      if (!currentFilter.exts.includes(image.ext.toLowerCase())) {
        return false
      }
    }

    // キーワードでフィルタリング（名前に含まれるかチェック）
    if (currentFilter.keyword && currentFilter.keyword.trim() !== '') {
      const keyword = currentFilter.keyword.toLowerCase()
      if (!image.name.toLowerCase().includes(keyword) && !image.annotation.toLowerCase().includes(keyword)) {
        return false
      }
    }

    // タグでフィルタリング
    if (currentFilter.tags && currentFilter.tags.length > 0) {
      const hasMatchingTag = currentFilter.tags.some(filterTag =>
        image.tags.some(imageTag =>
          imageTag.toLowerCase().includes(filterTag.toLowerCase())
        )
      )
      if (!hasMatchingTag) {
        return false
      }
    }

    return true
  })
})


// スクロールハンドラ（ページ全体のスクロールを監視）
const handleScrollImmediate = () => {
  const newScrollTop = window.pageYOffset || document.documentElement.scrollTop

  // スクロール位置の変化が小さい場合は更新しない（ジッターを防ぐ）
  // より厳格な閾値を設定（20px以上の変化のみ受け入れる）
  if (Math.abs(newScrollTop - scrollTop.value) < 20) {
    return
  }

  scrollTop.value = newScrollTop
  isScrolling.value = true

  // スクロール終了を検知するためのタイマー
  if (scrollTimeout !== null) {
    clearTimeout(scrollTimeout)
  }
  scrollTimeout = setTimeout(() => {
    isScrolling.value = false
  }, 200)
}

// デバウンスされたスクロールハンドラー（より長い間隔に設定）
const handleScroll = debounce(handleScrollImmediate, 32)

/**
 * グリッドレイアウト情報の計算
 */
const gridInfo = computed(() => {
  if (!containerRef.value || listInfo.value.imageWidth === 0) {
    return {
      itemsPerLine: listInfo.value.itemsPerLine,
      totalRows: filteredImages.value.length,
      totalHeight: 200,
      lineHeight: listInfo.value.lineHeight,
    }
  }
  const totalItems = filteredImages.value.length
  const totalRows = Math.ceil(totalItems / listInfo.value.itemsPerLine)
  const totalHeight = totalRows * listInfo.value.lineHeight

  // console.log("[ImageListView] gridInfo", listInfo.value.itemsPerLine, totalRows, listInfo.value.lineHeight);

  return {
    itemsPerLine: listInfo.value.itemsPerLine,
    totalRows,
    totalHeight,
    lineHeight: listInfo.value.lineHeight
  }
})

/**
 * 表示範囲計算（DOM仮想化の核心部分）- グリッド対応
 */
const visibleRange = computed(() => {
  // ImageListViewコンポーネントの位置を考慮したスクロール計算
  const viewportHeight = window.innerHeight
  const { lineHeight, totalRows, itemsPerLine } = gridInfo.value

  // ImageListViewコンポーネントの上端位置を取得
  const componentTop = viewportRef.value?.offsetTop || 0
  const relativeScrollTop = Math.max(0, scrollTop.value - componentTop)

  // より安定した計算のために、小数点以下を適切に処理
  const startRowFloat = relativeScrollTop / lineHeight
  const endRowFloat = (relativeScrollTop + viewportHeight) / lineHeight

  // 境界での振動を防ぐため、少し余裕を持たせる
  const startRow = Math.max(0, Math.floor(startRowFloat - overscan))
  const endRow = Math.min(
    totalRows - 1,
    Math.ceil(endRowFloat + overscan)
  )

  const startIndex = startRow * itemsPerLine
  const endIndex = Math.min(
    filteredImages.value.length - 1,
    (endRow + 1) * itemsPerLine - 1
  )

  const newRange = { startIndex, endIndex, startRow, endRow }

  // 範囲の変化が小さい場合は前回の安定した範囲を使用
  const lastRange = lastStableRange.value
  const startIndexDiff = Math.abs(newRange.startIndex - lastRange.startIndex)
  const endIndexDiff = Math.abs(newRange.endIndex - lastRange.endIndex)

  // 変化が小さい場合（1行分以下）は前回の範囲を維持
  if (startIndexDiff <= itemsPerLine && endIndexDiff <= itemsPerLine &&
      lastRange.startIndex !== 0 && lastRange.endIndex !== 0) {

    // デバッグログを条件付きで出力（スクロール中のみ）
    // if (isScrolling.value) {
    //   console.log(`[ImageListView] visibleRange STABILIZED - keeping previous range:`, lastRange)
    // }

    return lastRange
  }

  // 大きな変化の場合は新しい範囲を採用し、安定範囲として保存
  lastStableRange.value = newRange

  // デバッグログを条件付きで出力（スクロール中のみ）
  // if (isScrolling.value) {
  //   console.log(`[ImageListView] visibleRange scrollTop:${scrollTop.value}, componentTop:${componentTop}, relativeScrollTop:${relativeScrollTop}, viewportHeight:${viewportHeight}, lineHeight:${lineHeight}`)
  //   console.log(`[ImageListView] visibleRange startIndex:${startIndex}, endIndex:${endIndex}, startRow:${startRow}, endRow:${endRow}`)
  // }

  return newRange
})

// 実際にDOMに描画する画像（仮想化されたリスト）
const visibleImages = computed(() => {
  const { startIndex, endIndex } = visibleRange.value
  return filteredImages.value.slice(startIndex, endIndex + 1).map((image, index) => ({
    ...image,
    virtualIndex: startIndex + index // 仮想インデックス
  }))
})

// 上部のオフセット（見えない部分の高さ）- グリッド対応
const offsetY = computed(() => {
  const { startRow } = visibleRange.value
  const { lineHeight } = gridInfo.value
  return startRow * lineHeight
})

/**
 * DOM要素が描画されるまで待機する関数
 */
const waitForImageRefs = async (maxRetries = 10, delay = 50): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    await nextTick()
    if (imageRefs.value.length > 0) {
      // さらに少し待機してDOM要素が完全に描画されるのを確実にする
      await new Promise(resolve => setTimeout(resolve, delay))
      return true
    }
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  return false
}

/**
 * マウントとリサイズ時に実行
 * アイテムサイズの計算と更新
 */
const updateListInfo = async () => {
  // imageRefsが描画されるまで待機
  const hasImageRefs = await waitForImageRefs()

  if (!hasImageRefs) {
    return
  }

  if (containerRef.value && imageRefs.value.length > 0) {
    const firstComponentInstance = imageRefs.value[0]
    const firstItem = firstComponentInstance?.$el
    if (firstItem) {
      // グリッドアイテムのサイズを取得
      listInfo.value.imageWidth = firstItem.offsetWidth
      listInfo.value.imageHeight = firstItem.offsetHeight

      // グリッドのギャップを取得（CSS gridのgapプロパティから）
      const computedStyle = window.getComputedStyle(containerRef.value)
      const columnGap = computedStyle.columnGap
      const rowGap = computedStyle.rowGap

      // ギャップサイズを計算（rem、px、その他の単位に対応）
      const gapEl = document.createElement('div')
      gapEl.style.position = 'absolute'
      gapEl.style.visibility = 'hidden'
      gapEl.style.width = columnGap
      gapEl.style.height = rowGap
      document.body.appendChild(gapEl)

      listInfo.value.gapX = Math.floor(gapEl.offsetWidth -1)
      listInfo.value.gapY = Math.floor(gapEl.offsetHeight -1)

      document.body.removeChild(gapEl)

      // 行の高さを計算（アイテムの高さ + ギャップ）
      listInfo.value.lineHeight = listInfo.value.imageHeight + listInfo.value.gapY
      // 行の幅
      listInfo.value.lineWidth = containerRef.value.clientWidth
      // １行に入る画像数
      listInfo.value.itemsPerLine = Math.floor((listInfo.value.lineWidth + listInfo.value.gapX) / (listInfo.value.imageWidth + listInfo.value.gapX))

      // console.log("[ImageListView] updateListInfo", listInfo.value);
    }
  }

  if (viewportRef.value) {
    containerHeight.value = viewportRef.value.clientHeight
  }
}

//////////////////////////////
// スクロールでデータ追加
//////////////////////////////

/**
 * 無限スクロール用のハンドラ
 * IntersectionObserverで interSectionRef が画面に入ったら次のアイテムを読み込む
 */
const loadImagesInfinite = async () => {
  if (!eagleApi.isImagesLoading.value) {
    // console.log("[ImageListView] loadImagesInfinite triggered by IntersectionObserver");

    const currentFolder = store.getCurrentFolder;
    await eagleApi.loadImagesInfinite({
      folderId: currentFolder?.id,
      limit: ITEM_GET_COUNT,
    });
  }
}

/**
 * IntersectionObserverのセットアップ
 */
const setupIntersectionObserver = () => {
  if (!interSectionRef.value) return;

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadImagesInfinite();
        }
      });
    },
    {
      root: null, // viewport を使用
      rootMargin: '100px', // 100px 手前で検知
      threshold: 0.1
    }
  );

  observer.observe(interSectionRef.value);
}

// 読み込み数が変わったらリスト情報更新
watch([allImages, gridClasses], async ()=>{
  await nextTick()
  // console.log("[ImageListView] 画像リスト更新された");
  updateListInfo();
});

// スクロール位置の変化を監視（デバッグ用、条件付き）
watch(scrollTop, (newScrollTop, oldScrollTop) => {
  if (isScrolling.value && Math.abs(newScrollTop - oldScrollTop) >= 5) {
    // console.log(`[ImageListView] scrollTop changed: ${newScrollTop}`);
  }
});

// 表示範囲の変化を監視（デバッグ用、条件付き）
watch(visibleRange, (newRange, oldRange) => {
  if (isScrolling.value && (
    newRange.startIndex !== oldRange?.startIndex ||
    newRange.endIndex !== oldRange?.endIndex
  )) {
    // console.log(`[ImageListView] visibleRange changed:`, newRange);
  }
});

// ウィンドウリサイズハンドラ
const handleResize = () => {
  updateListInfo()
}

// コンポーネントマウント時の処理を更新
onMounted(async () => {
  setupIntersectionObserver()
  await updateListInfo()
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll)
})

// コンポーネントアンマウント時の処理を更新
onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll)
})

</script>
