import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/pages/Home.vue'
import PetPreview from '@/pages/PetPreview.vue'
import Battle from '@/pages/Battle.vue'

const router = createRouter({
  history: createWebHistory('/pet-garden/'),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/preview', name: 'preview', component: PetPreview },
    { path: '/battle', name: 'battle', component: Battle }
  ]
})

export default router