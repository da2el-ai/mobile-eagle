<template>
  <div class="basis-full text-sm text-blue-500">
    <!-- パンくずリストを表示 -->
    <nav class="flex items-center space-x-2" v-if="breadcrumbPath.length > 0">
      <!-- ホーム -->
      <button 
        @click="handleBreadcrumbClick('all')"
        class="hover:text-gray-600 transition-colors"
        :class="{ 'text-blue-500 font-medium': !currentFolder }"
      >
        ALL
      </button>
      
      <!-- パンくずの各階層 -->
      <template v-for="(item) in breadcrumbPath" :key="item.id">
        <span class="text-gray-300">></span>
        <button 
          @click="handleBreadcrumbClick(item.id)"
          class="hover:text-gray-600 transition-colors truncate max-w-32"
          :class="{ 'text-gray-600 font-medium': item.id === currentFolder?.id }"
          :title="item.name"
        >
          {{ item.name }}
        </button>
      </template>
    </nav>
    
    <!-- フォルダーが選択されていない場合 -->
    <nav v-else class="flex items-center">
      <span class="text-gray-400 font-medium">ALL</span>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useMainStore } from '../../store';
import { useRouter } from 'vue-router';

const store = useMainStore();
const router = useRouter();

// onMounted(() => {
//   console.log("Breadcrumb component mounted", store.getCurrentFolder);
//   console.log("Breadcrumb component mounted", store.getFolders);
// });

// 現在のフォルダーを取得
const currentFolder = computed(() => store.getCurrentFolder);

// パンくずリストのパスを取得（Piniaストアのgetterから）
const breadcrumbPath = computed(() => store.getBreadcrumbs);

// パンくずリストのクリック処理
const handleBreadcrumbClick = (folderId: string) => {
  // store.setCurrentFolder(folderId);
  router.push({ name: 'folder', params: { folderId } });
}

</script>
