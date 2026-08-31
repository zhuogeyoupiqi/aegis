<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()

const form = reactive({ account: 'admin', password: '123456', remember: true })
const showPwd = ref(false)
const errorTip = ref('')

async function submit(): Promise<void> {
  if (userStore.loading) return
  if (!form.account.trim() || !form.password) {
    errorTip.value = '请输入账号和密码'
    return
  }
  errorTip.value = ''
  try {
    await userStore.login(form.account.trim(), form.password)
    appStore.pushToast(`欢迎回来，${userStore.userInfo?.nickname}`)
    router.push('/workbench')
  } catch (e) {
    // mock/真实接口统一在这里展示错误，输入区不成功不跳转
    errorTip.value = e instanceof Error ? e.message : '登录失败，请稍后重试'
  }
}

function forgot(): void {
  appStore.pushToast('内网平台请联系管理员重置密码', 'info')
}
</script>

<template>
  <div class="login-page">
    <!-- 角落氛围光斑：与主界面同源的紫色系，弱化存在感 -->
    <span class="glow glow--l" />
    <span class="glow glow--r" />

    <!-- 分栏卡：左品牌区 + 右表单区（≤880px 时品牌区收起） -->
    <div class="login-card">
      <!--
        品牌区走固定品牌色（不跟随主题切换）：
        登录页是平台门面，任何主题下都保持统一的品牌观感。
        内容克制：logo 一行 + 一句定位 + 三条特性 + 一组数字，不再堆大标题和动效。
      -->
      <aside class="brand-pane">
        <div class="brand-row">
          <span class="brand-row__logo">A</span>
          <div class="brand-row__text">
            <b>Aegis</b>
            <span>个人能力平台</span>
          </div>
        </div>

        <p class="tagline">把散落的工具、样本与经验，<br />收进一个为自己而建的安全工作台。</p>

        <ul class="features">
          <li>
            <span class="features__icon"><AppIcon name="cube" :size="15" /></span>
            <div><b>微前端架构</b><span>基座 + 子应用，独立开发、独立部署</span></div>
          </li>
          <li>
            <span class="features__icon"><AppIcon name="zap" :size="15" /></span>
            <div><b>SOC 实战工具</b><span>发包、解析、样本工场，日常运营顺手用</span></div>
          </li>
          <li>
            <span class="features__icon"><AppIcon name="assets" :size="15" /></span>
            <div><b>个人知识资产</b><span>告警样本与处置经验持续沉淀</span></div>
          </li>
        </ul>

        <div class="metrics">
          <div><b>6</b><span>内置工具</span></div>
          <div><b>1,284</b><span>日志样本</span></div>
          <div><b>12</b><span>知识条目</span></div>
        </div>

        <!-- 底部波浪装饰 -->
        <svg class="waves" viewBox="0 0 420 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 35 C 70 12, 140 58, 210 38 S 350 10, 420 32 V 60 H 0 Z" fill="rgba(255,255,255,0.07)" />
          <path d="M0 45 C 80 25, 160 60, 240 44 S 360 22, 420 42 V 60 H 0 Z" fill="rgba(255,255,255,0.10)" />
        </svg>
      </aside>

      <!-- 表单区：跟随主题（明/暗、主题色在登录页同样生效） -->
      <section class="form-pane">
        <header class="form-head">
          <h1>欢迎回来</h1>
          <p>使用平台账号登录（内网系统 · 未授权访问将被记录）</p>
        </header>

        <form @submit.prevent="submit">
          <div class="field">
            <label for="account">账号</label>
            <input
              id="account"
              v-model="form.account"
              class="input"
              type="text"
              placeholder="请输入账号"
              autocomplete="username"
              spellcheck="false"
            />
          </div>

          <div class="field">
            <label for="password">密码</label>
            <div class="pwd-box">
              <input
                id="password"
                v-model="form.password"
                class="input"
                :type="showPwd ? 'text' : 'password'"
                placeholder="请输入密码"
                autocomplete="current-password"
              />
              <button type="button" class="pwd-eye" :title="showPwd ? '隐藏密码' : '显示密码'" @click="showPwd = !showPwd">
                <AppIcon :name="showPwd ? 'moon' : 'sun'" :size="14" />
              </button>
            </div>
            <p v-if="errorTip" class="field-hint bad">
              <AppIcon name="xCircle" :size="11" />
              {{ errorTip }}
            </p>
          </div>

          <div class="form-row">
            <label class="remember">
              <input v-model="form.remember" type="checkbox" />
              记住我
            </label>
            <a class="forgot" @click.prevent="forgot">忘记密码？</a>
          </div>

          <button type="submit" class="btn btn-primary btn-block" :class="{ disabled: userStore.loading }">
            {{ userStore.loading ? '登录中…' : '登 录' }}
          </button>
        </form>

        <p class="demo-tip">演示账号 <span class="kbd">admin</span> · 密码 <span class="kbd">123456</span></p>

        <!-- 安全提示条：内网平台必备 -->
        <div class="sec-notice">
          <AppIcon name="lock" :size="13" />
          <span>Restricted · Internal Use Only — 本系统仅限授权人员在内网环境使用，操作将被审计留痕</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}
.glow {
  position: fixed; border-radius: 50%;
  filter: blur(110px); pointer-events: none;
}
.glow--l { width: 420px; height: 420px; top: -160px; left: -120px; background: color-mix(in srgb, var(--primary) 10%, transparent); }
.glow--r { width: 380px; height: 380px; top: -140px; right: -100px; background: color-mix(in srgb, var(--grad-2) 8%, transparent); }

.login-card {
  width: min(880px, 100%);
  min-height: 540px;
  display: grid;
  grid-template-columns: 47% 1fr;
  background: var(--bg-card);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/* ---------- 品牌区（固定品牌紫，不随主题切换） ---------- */
.brand-pane {
  position: relative;
  padding: 40px 36px;
  display: flex; flex-direction: column;
  color: #fff;
  background: linear-gradient(160deg, #7c3aed 0%, #9333ea 48%, #d946ef 100%);
  overflow: hidden;
}
.brand-row { display: flex; align-items: center; gap: 11px; }
.brand-row__logo {
  width: 38px; height: 38px; border-radius: 12px;
  display: grid; place-items: center;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-weight: 800; font-size: 18px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.brand-row__text b { display: block; font-size: 18px; letter-spacing: 2px; }
.brand-row__text span { font-size: 11.5px; opacity: 0.75; letter-spacing: 1px; }

.tagline {
  margin-top: 44px;
  font-size: 17px; line-height: 1.75; font-weight: 600;
}
.features { list-style: none; margin-top: 30px; display: grid; gap: 16px; }
.features li { display: flex; gap: 11px; align-items: flex-start; }
.features__icon {
  width: 30px; height: 30px; flex: none; margin-top: 1px;
  border-radius: 9px; display: grid; place-items: center;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
}
.features b { display: block; font-size: 13px; }
.features span { font-size: 11.5px; opacity: 0.72; }

.metrics {
  margin-top: auto;
  display: flex; gap: 30px;
  padding-top: 26px;
}
.metrics b { display: block; font-size: 20px; font-family: var(--font-mono); }
.metrics span { font-size: 11px; opacity: 0.7; }
.waves { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 60px; pointer-events: none; }

/* ---------- 表单区 ---------- */
.form-pane {
  padding: 48px 44px 28px;
  display: flex; flex-direction: column;
}
.form-head h1 { font-size: 21px; font-weight: 700; }
.form-head p { margin-top: 7px; font-size: 12px; color: var(--fg-muted); line-height: 1.6; }

form { margin-top: 30px; }
.pwd-box { position: relative; }
.pwd-box .input { padding-right: 38px; }
.pwd-eye {
  position: absolute; right: 4px; top: 50%;
  transform: translateY(-50%);
  width: 28px; height: 28px;
  display: grid; place-items: center;
  background: transparent; border: none;
  color: var(--fg-muted); cursor: pointer;
  border-radius: 7px;
}
.pwd-eye:hover { color: var(--fg-sub); }

.form-row {
  display: flex; align-items: center; justify-content: space-between;
  margin: 4px 0 18px;
  font-size: 12.5px; color: var(--fg-sub);
}
.remember { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.remember input { accent-color: var(--primary); }
.forgot { color: var(--primary); cursor: pointer; }
.forgot:hover { text-decoration: underline; }

.demo-tip {
  margin-top: 18px;
  text-align: center; font-size: 11.5px; color: var(--fg-muted);
}
.sec-notice {
  margin-top: auto;
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px;
  border-radius: var(--radius-ctl);
  font-size: 11px; line-height: 1.6;
  color: var(--fg-muted);
  background: var(--bg-input);
  border: 1px dashed var(--border-strong);
}

/* ≤880px：品牌区收起，仅表单 */
@media (max-width: 880px) {
  .login-card { grid-template-columns: 1fr; min-height: auto; }
  .brand-pane { display: none; }
  .form-pane { padding: 36px 28px 24px; }
}
</style>
