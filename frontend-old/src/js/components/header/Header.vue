<template>
  <header class="flex flex-wrap justify-between items-center mb-4 pt-4 z-10 bg-white sticky top-0">
    <div class="flex items-center gap-4">
      <!-- フォルダビュー表示ボタン -->
      <HamburgerButton @click="store.setFolderListOpen(true)" />

      <!-- タイトル -->
      <h1 class="text-2xl font-bold">Simple Eagle</h1>
    </div>

    <!-- ツール系ボタン -->
    <div class="flex item-center justify-end gap-4">
      <!-- フィルターボタン -->
      <FilterButton v-if="!store.getSelectMode" @click="store.setFilterOpen(true)" />
      <!-- 複数選択ボタン -->
      <SelectButton @click="store.toggleSelectMode()" :is-active="store.getSelectMode" />
    </div>

    <Breadcrumb />
  </header>
</template>

<script setup lang="ts">
import HamburgerButton from './HamburgerButton.vue';
import FilterButton from './FilterButton.vue';
import SelectButton from './SelectButton.vue';
import Breadcrumb from './Breadcrumb.vue';
import { useMainStore } from '../../store';

// サービスの取得
const store = useMainStore();


</script>
