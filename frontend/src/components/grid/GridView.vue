<script setup lang="ts">
import { useRoute } from 'vue-router';

// グリッドビュー本体はステップ2以降（grid.md）で実装する。
// 現時点では URL の folderId を確認できるだけの空のメイン領域。
const route = useRoute();
</script>

<template>
  <main class="flex-1 overflow-y-auto" style="-webkit-overflow-scrolling: touch">
    <div class="p-6 text-sm text-muted">
      Mobile Eagle（フォルダ: {{ route.params.folderId }}）
    </div>
  </main>
</template>
