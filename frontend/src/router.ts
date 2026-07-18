import { createRouter, createWebHistory } from 'vue-router';

// ルーティングは base.md 7 章。URL を唯一の情報源にする。
// - `/` は `/folder/all` へリダイレクト
// - `/folder/:folderId` が唯一の画面（グリッドビュー）。フィルタは query、Lightbox は query `image`
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/folder/all' },
    {
      path: '/folder/:folderId',
      name: 'folder',
      component: () => import('@/components/grid/GridView.vue'),
    },
    // 未知のパスはすべてグリッドへ寄せる（SPA フォールバックと整合）。
    { path: '/:pathMatch(.*)*', redirect: '/folder/all' },
  ],
});
