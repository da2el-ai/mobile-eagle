<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { thumbnailUrl } from '@/api/eagle-api';
import type { TImageItem } from '@/types';

// サムネイルリストビュー（lightbox.md 5 章）。iOS 写真アプリ風の横並びストリップ。
const props = defineProps<{
  items: TImageItem[];
  // 現在表示中のインデックス（-1 は無し）。
  currentIndex: number;
}>();

const emit = defineEmits<{ select: [id: string]; nearEnd: [] }>();

// ドラッグと判定する移動距離。これ未満はタップとして扱う（lightbox.md 5 章）。
const DRAG_THRESHOLD_PX = 4;
// 末尾からこの距離まで来たら先読みを促す。
const NEAR_END_PX = 400;

const stripRef = ref<HTMLElement | null>(null);

// 現在のサムネイルを中央へスクロールする。
const centerCurrent = (smooth: boolean): void => {
  const strip = stripRef.value;
  if (!strip || props.currentIndex < 0) return;
  const target = strip.children[props.currentIndex] as HTMLElement | undefined;
  if (!target) return;
  strip.scrollTo({
    left: target.offsetLeft - strip.clientWidth / 2 + target.offsetWidth / 2,
    behavior: smooth ? 'smooth' : 'auto',
  });
};

// レイアウト確定前に測ると位置がずれるため、複数回に分けて追い込む。
// 1 回だけだと開いた直後の中央寄せが必ず外れる（モックアップ制作時に判明した挙動）。
const centerCurrentSoon = (smooth: boolean): void => {
  requestAnimationFrame(() => {
    centerCurrent(smooth);
    requestAnimationFrame(() => centerCurrent(smooth));
  });
  setTimeout(() => centerCurrent(smooth), 80);
};

// 前後移動・タップでの切り替えはスムーズスクロールで追従させる。
watch(() => props.currentIndex, () => centerCurrentSoon(true));

const onScroll = (): void => {
  const strip = stripRef.value;
  if (!strip) return;
  if (strip.scrollWidth - strip.scrollLeft - strip.clientWidth < NEAR_END_PX) emit('nearEnd');
};

// Pointer Events でのドラッグスクロール。ドラッグ直後のクリックは抑止する。
let isDown = false;
let hasMoved = false;
let startX = 0;
let startScroll = 0;
let suppressClick = false;

const onPointerDown = (e: PointerEvent): void => {
  const strip = stripRef.value;
  if (!strip) return;
  isDown = true;
  hasMoved = false;
  startX = e.clientX;
  startScroll = strip.scrollLeft;
  // ドラッグ中は smooth を切る（追従が遅れてカクつくため）。
  strip.style.scrollBehavior = 'auto';
};

const onPointerMove = (e: PointerEvent): void => {
  const strip = stripRef.value;
  if (!isDown || !strip) return;
  const dx = e.clientX - startX;
  if (Math.abs(dx) <= DRAG_THRESHOLD_PX) return;
  if (!hasMoved) {
    hasMoved = true;
    // 指がストリップの外へ出てもドラッグを継続させる。
    try {
      strip.setPointerCapture(e.pointerId);
    } catch {
      // 対応していない環境では単に capture 無しで続行する。
    }
  }
  strip.scrollLeft = startScroll - dx;
};

const onPointerUp = (e: PointerEvent): void => {
  const strip = stripRef.value;
  if (!isDown || !strip) return;
  isDown = false;
  strip.style.scrollBehavior = '';
  if (hasMoved) suppressClick = true;
  try {
    strip.releasePointerCapture(e.pointerId);
  } catch {
    // capture していなければ何もしない。
  }
};

// capture フェーズで止める。サムネイルの click ハンドラより先に握りつぶす必要がある。
const onClickCapture = (e: MouseEvent): void => {
  if (!suppressClick) return;
  e.stopPropagation();
  e.preventDefault();
  suppressClick = false;
};

onMounted(() => {
  const strip = stripRef.value;
  if (!strip) return;
  strip.addEventListener('pointerdown', onPointerDown);
  strip.addEventListener('pointermove', onPointerMove);
  strip.addEventListener('pointerup', onPointerUp);
  strip.addEventListener('pointercancel', onPointerUp);
  strip.addEventListener('click', onClickCapture, true);
  // 開いた直後は即座に中央へ（アニメーションなし）。
  centerCurrentSoon(false);
});

onBeforeUnmount(() => {
  const strip = stripRef.value;
  if (!strip) return;
  strip.removeEventListener('pointerdown', onPointerDown);
  strip.removeEventListener('pointermove', onPointerMove);
  strip.removeEventListener('pointerup', onPointerUp);
  strip.removeEventListener('pointercancel', onPointerUp);
  strip.removeEventListener('click', onClickCapture, true);
});
</script>

<template>
  <!-- 左右パディングは calc(50% - 32px)。先頭・末尾のサムネイルも画面中央に来られるようにする。 -->
  <div
    ref="stripRef"
    class="z-[88] flex select-none items-center gap-1.5 overflow-x-auto overflow-y-hidden bg-[rgba(0,0,0,.5)] px-[calc(50%-32px)] py-3 backdrop-blur-[6px]"
    style="scroll-behavior: smooth; touch-action: pan-x; cursor: grab"
    @scroll="onScroll"
  >
    <button
      v-for="(item, index) in items"
      :key="item.id"
      type="button"
      class="h-16 w-16 flex-none overflow-hidden rounded-md bg-[rgba(255,255,255,.1)] p-0 transition-opacity"
      :class="index === currentIndex ? 'border-2 border-white opacity-100' : 'opacity-60'"
      @click="emit('select', item.id)"
    >
      <img
        :src="thumbnailUrl(item.id)"
        alt=""
        draggable="false"
        loading="lazy"
        class="pointer-events-none block h-full w-full object-cover"
      >
    </button>
  </div>
</template>
