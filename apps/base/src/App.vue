<script setup lang="ts">
import ToastHost from '@/layouts/components/ToastHost.vue'
</script>

<template>
  <router-view />
  <!-- Toast 挂在最外层：登录页与主布局都要用它弹提示 -->
  <ToastHost />
</template>
