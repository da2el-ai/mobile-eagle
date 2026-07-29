import { useRoute, useRouter } from 'vue-router';

// フォルダ遷移（パンくず・フォルダツリーで共用）。

export function useFolderNavigation() {
  const route = useRoute();
  const router = useRouter();

  // フォルダを切り替える。フィルタ query は引き継ぎ、Lightbox の image だけ落とす。
  // 旧実装はフォルダ移動でフィルタ文脈を失っていた（base.md 2 章）ため、意図的に維持する。
  const navigateToFolder = (folderId: string): void => {
    const query = { ...route.query };
    delete query.image;
    void router.push({ name: 'folder', params: { folderId }, query });
  };

  return { navigateToFolder };
}
