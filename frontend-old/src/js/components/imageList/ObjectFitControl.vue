<template>
  <button
    @click="toggleObjectFit"
    class="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-100 rounded-lg transition-colors shadow-lg border"
    :title="objectFit === 'cover' ? 'Switch to Contain' : 'Switch to Cover'"
  >
    <!-- object-cover アイコン -->
    <svg v-if="objectFit === 'cover'" width="24" height="24" viewBox="0 0 24 24" class="text-gray">
      <rect x="4" y="4" width="16" height="16" fill="currentColor" opacity="0.3" />
      <rect x="8" y="7" width="8" height="10" fill="currentColor" />
    </svg>
    <!-- object-contain アイコン -->
    <svg v-else width="24" height="24" viewBox="0 0 24 24" class="text-gray">
      <rect x="4" y="4" width="16" height="16" fill="currentColor" opacity="0.3" />
      <rect x="4" y="4" width="16" height="16" fill="currentColor" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '../../composables/useSettings'

const settings = useSettings()

const objectFit = computed(() => settings.getObjectFit())

const toggleObjectFit = () => {
  settings.setObjectFit(objectFit.value === 'cover' ? 'contain' : 'cover')
}
</script>
