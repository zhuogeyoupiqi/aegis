<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { App } from 'ant-design-vue'
import type { FormInstance, Rule } from 'ant-design-vue/es/form'
import { bindFeedback } from '@aegis/shared'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const { t } = useI18n()

// 登录页不在 MainLayout 内，需要自己接入一次 message 上下文实例
bindFeedback(App.useApp().message)

const formRef = ref<FormInstance>()
const form = reactive({ account: 'admin', password: '123456', remember: true })

// 表单校验规则：只做非空校验，账号格式等规则等接真实接口时再补。
// 用 computed 生成：错误文案跟语言走，切语言后未触发的校验提示也是新语言
const rules = computed<Record<string, Rule[]>>(() => ({
  account: [{ required: true, message: t('login.accountRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }],
}))

// 服务端错误（账号密码不对）用 alert 展示，与字段级校验错误区分开
const loginError = ref('')

/**
 * 提交登录：绑在 a-form 的 @finish 上——只有校验通过才会进来，
 * 非空校验失败的提示由 a-form-item 自动渲染，这里不再手动 validate。
 */
async function submit(): Promise<void> {
  if (userStore.loading) return
  loginError.value = ''
  try {
    await userStore.login(form.account.trim(), form.password)
    appStore.pushToast(t('login.welcomeBack', { name: userStore.userInfo?.nickname ?? '' }))
    router.push('/workbench')
  } catch (e) {
    // mock/真实接口统一在这里展示错误，校验通过但不成功不跳转
    loginError.value = e instanceof Error ? e.message : t('login.failed')
  }
}

function forgot(): void {
  appStore.pushToast(t('login.forgotToast'), 'info')
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
          <h1>{{ t('login.welcome') }}</h1>
          <p>{{ t('login.subtitle') }}</p>
        </header>

        <!-- 服务端错误横幅：区别于字段校验，登录失败时出现 -->
        <a-alert
          v-if="loginError"
          :message="loginError"
          type="error"
          show-icon
          closable
          class="login-error"
          @close="loginError = ''"
        />

        <a-form
          ref="formRef"
          :model="form"
          :rules="rules"
          layout="vertical"
          class="login-form"
          @finish="submit"
        >
          <a-form-item :label="t('login.account')" name="account">
            <a-input
              v-model:value="form.account"
              :placeholder="t('login.accountPlaceholder')"
              size="large"
              autocomplete="username"
              spellcheck="false"
            />
          </a-form-item>

          <a-form-item :label="t('login.password')" name="password">
            <!-- 密码可见性切换是 a-input-password 内建能力，不再手写眼睛按钮；回车提交走表单原生流程（带校验） -->
            <a-input-password
              v-model:value="form.password"
              :placeholder="t('login.passwordPlaceholder')"
              size="large"
              autocomplete="current-password"
            />
          </a-form-item>

          <div class="form-row">
            <a-checkbox v-model:checked="form.remember">{{ t('login.remember') }}</a-checkbox>
            <a class="forgot" @click.prevent="forgot">{{ t('login.forgot') }}</a>
          </div>

          <a-button type="primary" html-type="submit" size="large" block :loading="userStore.loading">
            {{ userStore.loading ? t('login.submitting') : t('login.submit') }}
          </a-button>
        </a-form>

        <p class="demo-tip">
          {{ t('login.demoTip') }} <span class="kbd">admin</span> · 123456
        </p>

        <!-- 安全提示条：内网平台必备 -->
        <div class="sec-notice">
          <AppIcon name="lock" :size="13" />
          <span>{{ t('login.secNotice') }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: flex; align-items: center; justify-content: center;
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
  display: flex; align-items: center; justify-content: center;
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
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
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
  padding: 44px 44px 28px;
  display: flex; flex-direction: column;
}
.form-head h1 { font-size: 21px; font-weight: 700; }
.form-head p { margin-top: 7px; font-size: 12px; color: var(--fg-muted); line-height: 1.6; }

.login-error { margin-top: 16px; }
.login-form { margin-top: 24px; }
.login-form :deep(.ant-form-item) { margin-bottom: 16px; }

.form-row {
  display: flex; align-items: center; justify-content: space-between;
  margin: -2px 0 20px;
  font-size: 12.5px; color: var(--fg-sub);
}
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
