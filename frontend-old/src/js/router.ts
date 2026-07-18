import { createRouter, createWebHistory } from 'vue-router'
// import SettingView from './components/SettingView.vue'
import Lightbox from './components/Lightbox.vue'

const routes = [
  {
    path: '/folder/:folderId',
    name: 'folder',
    component: { template: '<span></span>' },
  },  
  {
    path: '/folder/:folderId/detail/:imageId',
    name: 'folderDetail',
    component: Lightbox,
    props: true
  },
  // フィルタルート
  {
    path: '/folder/:folderId/filter',
    name: 'filter',
    component: { template: '<span></span>' },
  },  
  {
    path: '/folder/:folderId/filter/detail/:imageId',
    name: 'filterDetail',
    component: Lightbox,
    props: true
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})
