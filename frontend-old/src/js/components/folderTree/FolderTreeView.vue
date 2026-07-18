<template>
  <ModalView v-if="isModalOpen" :showCloseButton="false" @close="handleClose" :fit-width="true">
    <div class="fixed left-0 top-0 w-[min(80vw,20rem)] h-full bg-white shadow-lg overflow-y-auto">
      <div class="p-4">

        <div class="flex mb-4 justify-end items-center">
          <!-- 設定ボタン -->
          <SettingButton @click="showSettingView" />
        </div>

        <div v-if="loading" class="text-center py-4">
          読み込み中...
        </div>
        
        <div v-else-if="error" class="text-red-500 py-4">
          {{ error }}
        </div>
        <template v-else>
          <FolderTreeItem
            v-for="folder in folders"
            :key="folder.id"
            :folder="folder"
            @select="handleFolderSelect"
          />
        </template>
      </div>
    </div>
  </ModalView>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEagleApi } from '../../composables/useEagleApi'
import { useRouter } from 'vue-router'
import { useMainStore } from '../../store'
import ModalView from '../common/ModalView.vue'
import FolderTreeItem from './FolderTreeItem.vue'
import SettingButton from './SettingButton.vue'

const store = useMainStore();
const isModalOpen = computed(() => store.getFolderListOpen);

const eagleApi = useEagleApi();
const router = useRouter();

// Piniaストアからフォルダーを取得
const folders = computed(() => store.getFolders);
const loading = eagleApi.isLoading();
const error = eagleApi.getError();

// フォルダー一覧を閉じる
const handleClose = () => {
  store.setFolderListOpen(false);
}

// フォルダーを選択
const handleFolderSelect = (folderId: string) => {
  // store.setCurrentFolder(folderId);
  router.push({ name: 'folder', params: { folderId } });
  store.setFolderListOpen(false);
}

// 設定を開く
const showSettingView = () => {
  // router.push({ name: 'setting', params: { folderId: store.getCurrentFolderId } });
  store.setSettingOpen(true);
  handleClose();
}
</script>
