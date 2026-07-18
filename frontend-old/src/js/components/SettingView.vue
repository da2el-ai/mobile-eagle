<template>
  <ModalView v-if="isSettingsOpen" @close="closeSettings" :showCloseButton="false" :fit-height="true">
    <Dialog @close="closeSettings">
      <div class="max-w-2xl mx-auto">
        <h2 class="text-2xl font-bold mb-6">設定</h2>
        
        <form @submit.prevent="handleSaveSettings" class="space-y-6">
          <!-- ファイルサイズ上限 -->
          <div>
            <label for="max_file_size" class="block text-sm font-medium text-gray-700 mb-2">
              ファイルサイズ上限（KB）
            </label>
            <input
              id="max_file_size"
              v-model.number="settings.max_file_size"
              type="number"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="768"
            />
            <p class="mt-1 text-sm text-gray-500">
              ファイルサイズがこの数値より大きい画像は圧縮して表示する<br>
              0 = 圧縮しない / 空欄 = 768
            </p>
          </div>

          <!-- 圧縮率 -->
          <div>
            <label for="quality" class="block text-sm font-medium text-gray-700 mb-2">
              JPEG圧縮率（0〜100）
            </label>
            <input
              id="quality"
              v-model.number="settings.quality"
              type="number"
              min="0"
              max="100"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="85"
            />
            <p class="mt-1 text-sm text-gray-500">
              空欄 = 85
            </p>
          </div>

          <!-- 保存ボタン -->
          <div class="flex justify-end space-x-3">
            <button
              type="button"
              @click="closeSettings"
              class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  </ModalView>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
// import { useRouter } from 'vue-router';
import { useSettings } from '../composables/useSettings';
import { useMainStore } from '../store';
import ModalView from './common/ModalView.vue';
import Dialog from './common/Dialog.vue';

// 設定管理のコンポーザブルを使用
const { settings, saveSettings, initialize } = useSettings()
// const router = useRouter()
const store = useMainStore()


// 設定が開いているかどうかをcomputedプロパティで管理
const isSettingsOpen = computed(() => {
  return store.getSettingOpen;
})

// 設定を保存
const handleSaveSettings = () => {
  saveSettings()
  alert('設定を保存しました')
  // router.push({ name: 'folder', params: { folderId: store.getCurrentFolderId } });
  store.setSettingOpen(false);
}

// 設定を閉じる
const closeSettings = () => {
  // router.push({ name: 'folder', params: { folderId: store.getCurrentFolderId } });
  store.setSettingOpen(false);
}

// コンポーネントマウント時に設定を読み込み
onMounted(() => {
  initialize()
})
</script>


