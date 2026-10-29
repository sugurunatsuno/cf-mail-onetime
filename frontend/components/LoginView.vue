<script setup lang="ts">
import { useI18n } from '../i18n'
import { useMailContext } from '../composables/useMailApp'
const app = useMailContext()
const { t } = useI18n()
</script>

<template>
<!-- Login Screen -->
    <div v-show="!app.isLoggedIn" class="h-full flex items-center justify-center bg-gray-100">
        <div class="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
            <div class="text-center mb-8">
                <div
                    class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4">
                    <i class="ph ph-envelope-simple text-2xl"></i>
                </div>
                <h1 class="text-2xl font-bold text-gray-900">{{ t('CF Mail Login') }}</h1>
            </div>

            <form @submit.prevent="app.login">
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">{{ t('Password') }}</label>
                    <input type="password" v-model="app.password"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        :placeholder="t('Admin Password')" required>
                </div>

                <div v-show="app.loginError" class="mb-4 text-red-500 text-sm text-center" v-text="app.loginError"></div>

                <button type="submit"
                    class="btn btn-primary w-full"
                    :disabled="app.isLoading">
                    <span v-show="!app.isLoading">{{ t('Sign In') }}</span>
                    <i v-show="app.isLoading" class="ph ph-spinner animate-spin text-xl"></i>
                </button>
            </form>
        </div>
    </div>
</template>
