<script setup lang="ts">
/**
 * 登录（v3 国风）
 *
 * 学生：学号 + 姓名免密（课堂场景，教师已导入名单）
 * 教师：管理员账号 + 密码
 * 登录成功后按角色进入 v3 页面（学生 → /lobby，教师 → /teacher）。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const mode = ref<'student' | 'admin'>('student')
const studentNo = ref('')
const realName = ref('')
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const canSubmit = computed(() =>
  mode.value === 'student'
    ? studentNo.value.trim().length > 0 && realName.value.trim().length > 0
    : username.value.trim().length > 0 && password.value.length > 0,
)

async function submit() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    if (mode.value === 'student') {
      await auth.studentLogin(studentNo.value.trim(), realName.value.trim())
      await router.push('/lobby')
    } else {
      await auth.adminLogin(username.value.trim(), password.value)
      await router.push('/teacher')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    error.value = msg || (mode.value === 'student' ? '学号或姓名不对，问一下老师' : '账号或密码错误')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login gw-paper">
    <div class="gw-mountain login__mt" aria-hidden="true" />
    <div class="gw-mountain gw-mountain--near login__mt" aria-hidden="true" />

    <main class="login__card gw-scroll">
      <header class="login__head">
        <div class="login__seal">王宠</div>
        <div>
          <h1>王宠课堂</h1>
          <p>山海异兽 · 五阶品阶 · 八卦斗法</p>
        </div>
      </header>

      <nav class="login__tabs">
        <button :class="{ 'is-on': mode === 'student' }" @click="mode = 'student'; error = ''">
          学生登录
        </button>
        <button :class="{ 'is-on': mode === 'admin' }" @click="mode = 'admin'; error = ''">
          教师登录
        </button>
      </nav>

      <form class="login__form" @submit.prevent="submit">
        <template v-if="mode === 'student'">
          <label class="login__field">
            <span>学号</span>
            <input v-model="studentNo" autocomplete="username" placeholder="例：20260101" />
          </label>
          <label class="login__field">
            <span>姓名</span>
            <input v-model="realName" autocomplete="name" placeholder="例：李四" />
          </label>
          <p class="login__hint">学生免密登录：学号 + 姓名即可，名单由老师导入。</p>
        </template>

        <template v-else>
          <label class="login__field">
            <span>账号</span>
            <input v-model="username" autocomplete="username" placeholder="教师账号" />
          </label>
          <label class="login__field">
            <span>密码</span>
            <input v-model="password" type="password" autocomplete="current-password" placeholder="密码" />
          </label>
          <p class="login__hint">教师端可管理班级、审核造物、给学生加减分。</p>
        </template>

        <p v-if="error" class="login__error">{{ error }}</p>

        <button class="gw-seal gw-seal--primary login__submit" type="submit" :disabled="!canSubmit || loading">
          {{ loading ? '登录中…' : mode === 'student' ? '进入课堂' : '进入教师端' }}
        </button>
      </form>

      <footer class="login__foot">
        <span>v3 · 中国风重构</span>
        <span>忘记密码请找信息技术老师重置</span>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.login {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: 24px 16px;
  overflow: hidden;
}
.login__mt {
  z-index: 0;
}

.login__card {
  position: relative;
  z-index: 2;
  width: min(94vw, 400px);
  padding: 22px 26px 18px;
}

.login__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.login__seal {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex: none;
  font-family: var(--font-title);
  font-size: 17px;
  line-height: 1.1;
  letter-spacing: 0.05em;
  color: #f7efe0;
  background: linear-gradient(160deg, #ce4436, var(--cinnabar-d));
  border-radius: 6px;
  transform: rotate(-4deg);
  box-shadow: inset 0 0 0 2px rgba(247, 239, 224, 0.4);
}
.login__head h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 24px;
  letter-spacing: 0.16em;
  color: var(--ink);
}
.login__head p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--ink-3);
}

.login__tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  margin-bottom: 16px;
  background: rgba(255, 253, 246, 0.8);
  border: 1px solid rgba(28, 28, 36, 0.16);
  border-radius: 999px;
}
.login__tabs button {
  flex: 1;
  padding: 7px 0;
  font-family: var(--font-title);
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: color var(--d-quick), background var(--d-quick);
}
.login__tabs button.is-on {
  color: #f7efe0;
  background: linear-gradient(180deg, #ce4436, var(--cinnabar-d));
}

.login__form {
  display: grid;
  gap: 10px;
}
.login__field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-2);
}
.login__field input {
  padding: 10px 12px;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.9);
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
}
.login__field input:focus {
  outline: 2px solid rgba(192, 57, 43, 0.45);
  outline-offset: 1px;
}

.login__hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--ink-3);
}
.login__error {
  margin: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--cinnabar);
  background: rgba(192, 57, 43, 0.08);
  border: 1px solid rgba(192, 57, 43, 0.3);
  border-radius: var(--r-sm);
}

.login__submit {
  width: 100%;
  margin-top: 4px;
}

.login__foot {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding-top: 10px;
  font-size: 10px;
  color: var(--ink-3);
  border-top: 1px solid rgba(28, 28, 36, 0.12);
}

@media (max-width: 480px) {
  .login__card {
    padding: 18px 18px 14px;
  }
  .login__head h1 {
    font-size: 21px;
  }
}
</style>
