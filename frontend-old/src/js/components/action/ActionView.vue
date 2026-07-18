<template>
    <div v-if="isSelectMode" class="action-view fixed bottom-0 left-0 w-full p-4 bg-white flex items-center" style="height:4.5rem">
        <!-- アクションモード未選択状態 -->
        <div v-if="actionMode === null" class="flex items-center w-full gap-4">
          <div class="w-full">
            {{selectedCount}} 個選択
          </div>

          <!-- レーティングボタン -->
          <StarButton v-if="actionMode === null" @click="actionMode  = 'rating'" />

          <!-- ゴミ箱ボタン -->
          <TrashButton @click="actionMode  = 'trash'" />
        </div>

        <!-- レーティング変更モード -->
        <div v-if="actionMode === 'rating'" class="flex items-center w-full">
          <StarRating v-model="rating" />

          <div class="flex items-center justify-end grow gap-4">
            <button @click="executeRatingUpdate" class="btn-primary" :disabled="isUpdating">
              {{ isUpdating ? '実行中...' : '実行' }}
            </button>
            <button @click="actionMode = null" class="btn-cancel" :disabled="isUpdating">キャンセル</button>
          </div>
        </div>

        <!-- 削除モード -->
        <div v-if="actionMode === 'trash'" class="flex items-center w-full">
          削除しますか？

          <div class="flex items-center justify-end grow gap-4">
            <button 
              @click="executeDelete" 
              class="btn-primary" 
              :disabled="isDeleting"
              :style="{ opacity: isDeleting ? 0.5 : 1 }"
            >
              {{ isDeleting ? '実行中...' : '実行' }}
            </button>
            <button @click="actionMode = null" class="btn-cancel" :disabled="isDeleting">キャンセル</button>
          </div>
        </div>

    </div>
    <!-- /.action-view -->
</template>

<script setup lang="ts">
import {ref, computed, watch} from 'vue';
import StarButton from './StarButton.vue';
import TrashButton from '../common/TrashButton.vue';
import StarRating from '../common/StarRating.vue';
import { useMainStore } from '../../store';
import { useEagleApi } from '../../composables/useEagleApi';

type TActionMode = null | 'rating' | 'trash';

// サービスの取得
const store = useMainStore();
const eagleApi = useEagleApi();

// 選択モードかどうか
const isSelectMode = computed(()=>{ return store.getSelectMode });

// アクションモード
const actionMode = ref<TActionMode>(null);

// レーティング
const rating = ref(0);

// 更新中フラグ
const isUpdating = ref(false);

// 削除中フラグ
const isDeleting = ref(false);

// 選択個数
const selectedCount = computed(() => 
  store.getImages.reduce((count, image) => 
    image.select ? count + 1 : count, 0
  )
);

// 選択モード解除されたら actionMode も初期化
watch(isSelectMode, ()=>{
  actionMode.value = null;
});


/**
 * レーティング更新を実行
 */
const executeRatingUpdate = async () => {
  if (isUpdating.value) return;
  
  // 選択された画像を取得
  const selectedImages = store.getSelectedImages;
  if (selectedImages.length === 0) {
    alert('画像が選択されていません');
    return;
  }

  isUpdating.value = true;
  
  // 元の評価値を保存（失敗時の復元用）
  const originalRatings = selectedImages.map(image => ({
    id: image.id,
    star: image.star || 0
  }));

  try {
    // 各画像のレーティングを更新
    const updatePromises = selectedImages.map(image => 
      eagleApi.updateItem(image.id, { star: rating.value })
    );

    await Promise.all(updatePromises);
    
    // 成功時の処理
    console.log(`${selectedImages.length}個の画像のレーティングを${rating.value}に更新しました`);
    
    // // アクションモードを終了
    // actionMode.value = null;
    
  } catch (error) {
    console.error('レーティングの更新に失敗しました:', error);
    
    // 失敗時は元の値に戻す
    try {
      const restorePromises = originalRatings.map(({ id, star }) => 
        eagleApi.updateItem(id, { star })
      );
      await Promise.all(restorePromises);
      console.log('レーティングを元の値に復元しました');
    } catch (restoreError) {
      console.error('レーティングの復元に失敗しました:', restoreError);
    }
    
    // エラーメッセージを表示
    alert('レーティングの更新に失敗しました。元の値に復元されました。');
  } finally {
    isUpdating.value = false;
  }
};

/**
 * 削除を実行
 */
const executeDelete = async () => {
  if (isDeleting.value) return;
  
  // 選択された画像を取得
  const selectedImages = store.getSelectedImages;
  if (selectedImages.length === 0) {
    alert('画像が選択されていません');
    return;
  }

  isDeleting.value = true;

  try {
    // 選択された画像のIDリストを作成
    const itemIds = selectedImages.map(image => image.id);
    
    // ゴミ箱に移動
    await eagleApi.moveToTrash(itemIds);
    
    // 成功時の処理
    console.log(`${selectedImages.length}個の画像を削除しました`);
    
    // アクションモードを終了
    actionMode.value = null;
    
  } catch (error) {
    console.error('ファイルの削除に失敗しました:', error);
    window.alert('ファイルの削除に失敗しました。');
  } finally {
    isDeleting.value = false;
  }
};

</script>
