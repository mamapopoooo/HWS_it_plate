import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
// v3 国风设计令牌与游戏化样式层（见 00-总纲 §14、品阶体系-v3 §4）
import './styles/tokens.css'
import './styles/game.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')