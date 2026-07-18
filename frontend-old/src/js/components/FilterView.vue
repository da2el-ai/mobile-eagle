<template>
  <ModalView v-if="isFilterOpen" @close="closeFilter" :showCloseButton="false" :fit-height="true">
    <Dialog @close="closeFilter">
      <div class="max-w-2xl mx-auto">
        <h2 class="text-1xl font-bold mb-6">フィルター条件設定</h2>

        <form @submit.prevent="handleApplyFilter" class="space-y-5">
          <!-- 評価 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              評価
            </label>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              <label v-for="star in 6" :key="star" class="flex items-center">
                <input v-model="filterForm.stars" :value="star - 1" type="checkbox" class="mr-1" />
                <span class="flex" style="font-size:0.8rem">
                  <span v-for="i in star - 1" :key="i" class="" style="color:#ff9900">★</span>
                  <span v-for="i in 5 - (star - 1)" :key="i" class="text-gray-400">★</span>
                </span>
              </label>
            </div>
          </div>

          <!-- 拡張子 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              拡張子
            </label>
            <div class="flex gap-2 gap-x-4 flex-wrap">
              <label v-for="ext in store.getExtList" :key="ext" class="flex items-center">
                <input v-model="filterForm.exts" :value="ext" type="checkbox" class="mr-1" />
                <span class="text-sm">{{ ext.toUpperCase() }}</span>
              </label>
            </div>
          </div>

          <!-- キーワード -->
          <div>
            <label for="keyword" class="block text-sm font-medium text-gray-700 mb-2">
              キーワード
            </label>
            <input id="keyword" v-model="filterForm.keyword" type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="検索キーワードを入力" />
          </div>

          <!-- タグ -->
          <div>
            <label for="tags" class="block text-sm font-medium text-gray-700 mb-2">
              タグ
            </label>
            <input id="tags" v-model="filterForm.tags" type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="タグを「,」区切りで入力" />
            <p class="mt-1 text-sm text-gray-500">
              複数のタグを「,」区切りで入力してください
            </p>
          </div>

          <!-- ボタン -->
          <div class="flex justify-end space-x-3">
            <button type="button" @click="closeFilter"
              class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">
              キャンセル
            </button>
            <button type="button" @click="clearFilter"
              class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">
              解除
            </button>
            <button type="submit"
              class="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
              決定
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  </ModalView>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '../store';
import ModalView from './common/ModalView.vue';
import Dialog from './common/Dialog.vue';
import { TFilter } from '../types';

const store = useMainStore()
const router = useRouter()

// フィルターフォームの状態（TFilter型に合わせたパラメーター名）
const filterForm = ref({
  stars: [] as number[],
  exts: [] as string[],
  keyword: '',
  tags: ''
})

// フィルターが開いているかどうかをcomputedプロパティで管理
const isFilterOpen = computed(() => {
  return store.getFilterOpen;
})

// フィルターを適用
const handleApplyFilter = () => {
  console.log('filterForm.value:', filterForm.value);
  console.log('stars type:', typeof filterForm.value.stars, 'isArray:', Array.isArray(filterForm.value.stars));
  console.log('exts type:', typeof filterForm.value.exts, 'isArray:', Array.isArray(filterForm.value.exts));

  // 配列チェックを追加してエラーを防ぐ
  const starArray = Array.isArray(filterForm.value.stars)
    ? filterForm.value.stars.map(star => parseInt(star.toString(), 10))
    : [];
  const extArray = Array.isArray(filterForm.value.exts)
    ? filterForm.value.exts.map(ext => ext.trim()).filter(ext => ext !== '')
    : [];
  const keyword = filterForm.value.keyword.trim();
  const tagArray = filterForm.value.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');

  // いずれかの項目が入力されているかチェック
  const hasFilter =
    starArray.length > 0 ||
    extArray.length > 0 ||
    keyword !== '' ||
    tagArray.length > 0;

  if (hasFilter) {
    // フィルタルートに移動
    router.push({
      name: 'filter',
      params: { folderId: store.getCurrentFolderId || 'all' },
      query: {
        stars: starArray,
        exts: extArray,
        tags: tagArray,
        keyword: keyword,
      } as TFilter
    })
  } else {
    // 全ての項目が空欄の場合はフォルダールートに移動
    router.push({
      name: 'folder',
      params: { folderId: store.getCurrentFolderId || 'all' }
    })
  }
  store.setFilterOpen(false);
}

// フィルターを閉じる
const closeFilter = () => {
  store.setFilterOpen(false);
}

// フィルターを解除
const clearFilter = () => {
  // フィルターを解除してフォルダールートに移動
  router.push({
    name: 'folder',
    params: { folderId: store.getCurrentFolderId || 'all' }
  })

  // フィルターを閉じる
  store.setFilterOpen(false);
}


// store.currentFilterの値をフォームに反映する関数
const loadCurrentFilter = async () => {
  const currentFilter = store.getCurrentFilter
  console.log('loadCurrentFilter - currentFilter:', currentFilter);

  if (currentFilter) {
    // 新しいオブジェクトを作成して強制的に更新
    const newFormData = {
      stars: Array.isArray(currentFilter.stars) ? [...currentFilter.stars] : [],
      exts: Array.isArray(currentFilter.exts) ? [...currentFilter.exts] : [],
      keyword: currentFilter.keyword || '',
      tags: Array.isArray(currentFilter.tags) ? currentFilter.tags.join(', ') : ''
    }

    console.log('loadCurrentFilter - newFormData:', newFormData);

    // 値を設定
    filterForm.value = newFormData

    // nextTickを待ってから再度確認
    await nextTick()
    console.log('loadCurrentFilter - after nextTick:', filterForm.value);
  } else {
    // フィルターがない場合はフォームをリセット
    filterForm.value = {
      stars: [],
      exts: [],
      keyword: '',
      tags: ''
    }
  }
}

// フィルターが開かれた時に現在のフィルター値を読み込む
watch(isFilterOpen, async (newValue) => {
  if (newValue) {
    console.log('FilterView opened, loading current filter...');
    await nextTick()
    await loadCurrentFilter()
  }
})

// コンポーネントマウント時の処理
onMounted(async () => {
  await loadCurrentFilter()
})
</script>
