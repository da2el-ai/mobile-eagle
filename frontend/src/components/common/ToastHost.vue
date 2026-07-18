<script setup lang="ts">
import { useToast } from '@/composables/use-toast';

// トーストの表示先。App.vue に常設する。
const { toasts } = useToast();
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="max-w-[90vw] rounded-lg bg-black/80 px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ toast.message }}
    </div>
  </div>
</template>
