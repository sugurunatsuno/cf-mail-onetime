<script setup lang="ts">
import { onMounted, provide } from 'vue'
import { mailAppKey, useMailApp } from './composables/useMailApp'
import LoginView from './components/LoginView.vue'
import MailWorkspace from './components/MailWorkspace.vue'
import AppModals from './components/AppModals.vue'
import SocialActions from './components/SocialActions.vue'
import FerrisWidget from './components/FerrisWidget.vue'

const app = useMailApp()
provide(mailAppKey, app)
onMounted(() => app.init())
</script>

<template>
  <LoginView />
  <MailWorkspace />
  <SocialActions />
  <FerrisWidget :domains="app.availableDomains" />
  <AppModals />
  <div v-if="app.toastMessage" role="status"
      class="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
    {{ app.toastMessage }}
  </div>
</template>
