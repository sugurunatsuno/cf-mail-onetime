import { t, locale, apiErrorKey, type MessageKey, type MessageParams } from '../i18n'
import { inject, reactive, onUnmounted, watch, type InjectionKey } from 'vue'
import type {
  Mailbox,
  MessageSummary,
  MessageDetail,
  SelectedMessage,
  Settings,
  SettingsPayload,
  SessionResponse,
  TelegramResponse,
} from '../types'
import {
  escapeHtml,
  sanitizeEmailHtml,
  buildMessageHtml,
  formatDate,
  formatFullDate,
  formatSize,
} from '../utils/message'

export function useMailApp() {
  let mailboxRequest = 0
  let messageRequest = 0
  let sessionGeneration = 0
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  const app = reactive({
    toastKey: '' as MessageKey | '',
    toastParams: {} as MessageParams,
    get toastMessage(): string {
      return this.toastKey ? t(this.toastKey, this.toastParams) : ''
    },
    isLoggedIn: false,
    password: '',
    loginErrorKey: '' as MessageKey | '',
    get loginError(): string {
      return this.loginErrorKey ? t(this.loginErrorKey) : ''
    },
    set loginError(key: MessageKey | '') {
      this.loginErrorKey = key
    },
    isLoading: false,
    mailboxes: [] as Mailbox[],
    searchQuery: '',
    messages: [] as MessageSummary[],
    selectedMessageIds: [] as number[],
    selectedMailbox: null as Mailbox | null,
    selectedMessage: null as SelectedMessage | null,
    pendingMessageId: null as number | null,
    // 图片预览
    imagePreview: null as string | null,
    imagePos: { x: 0, y: 0 },
    imageDragging: false,
    dragStart: { x: 0, y: 0 },
    isLoadingMessages: false,
    isLoadingContent: false,
    showCreateModal: false,
    newMailboxAddress: '',
    isCreating: false,
    availableDomains: [] as string[],
    selectedDomain: '',
    showSettingsModal: false,
    settings: {
      auto_create_enabled: 'false',
      auto_create_min_length: '6',
      auto_create_max_length: '20',
      auto_create_start_type: 'both',
      tg_bot_token: '',
      tg_chat_id: '',
      tg_topic_id: '',
    } as Settings,
    tgEnabled: false,
    fetchingChatId: false,
    tgBotTokenConfigured: false,
    passwordChangeRequired: false,
    passwordChangeErrorKey: '' as MessageKey | '',
    get passwordChangeError(): string {
      return this.passwordChangeErrorKey ? t(this.passwordChangeErrorKey) : ''
    },
    set passwordChangeError(key: MessageKey | '') {
      this.passwordChangeErrorKey = key
    },
    changingPassword: false,
    passwordChangeForm: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },

    get filteredMailboxes(): Mailbox[] {
      if (!this.searchQuery.trim()) return this.mailboxes
      const q = this.searchQuery.toLowerCase()
      return this.mailboxes.filter((box) =>
        box.address.toLowerCase().includes(q),
      )
    },

    get allMessagesSelected(): boolean {
      return (
        this.messages.length > 0 &&
        this.selectedMessageIds.length === this.messages.length
      )
    },

    async init(): Promise<void> {
      this.readPendingMessageId()
      await this.fetchConfig()
      await this.fetchSession()
    },

    readPendingMessageId() {
      const rawMessageId = new URLSearchParams(window.location.search).get(
        'message',
      )
      if (rawMessageId === null) return

      if (!/^[1-9]\d*$/.test(rawMessageId)) {
        this.clearPendingMessageId()
        return
      }

      const messageId = Number(rawMessageId)
      if (!Number.isSafeInteger(messageId)) {
        this.clearPendingMessageId()
        return
      }

      this.pendingMessageId = messageId
    },

    clearPendingMessageId() {
      this.pendingMessageId = null
      const url = new URL(window.location.href)
      if (!url.searchParams.has('message')) return

      url.searchParams.delete('message')
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      )
    },

    async initializeAuthenticatedView(): Promise<void> {
      const mailboxesLoaded = await this.fetchMailboxes()
      if (mailboxesLoaded && this.isLoggedIn && !this.passwordChangeRequired) {
        await this.openPendingMessage()
      }
    },

    async fetchConfig(): Promise<void> {
      try {
        const res = await fetch('/api/config')
        if (res.ok) {
          const data: { domains: string[] } = await res.json()
          this.availableDomains = data.domains || []
          if (this.availableDomains.length > 0) {
            this.selectedDomain = this.availableDomains[0]
          }
        }
      } catch (e) {
        console.error('Failed to fetch config', e)
      }
    },

    resetAuthenticatedState() {
      sessionGeneration++
      mailboxRequest++
      messageRequest++
      this.isLoadingMessages = false
      this.isLoadingContent = false
      this.imagePreview = null
      this.settings.tg_bot_token = ''
      this.password = ''
      this.isLoggedIn = false
      this.mailboxes = []
      this.messages = []
      this.selectedMessageIds = []
      this.selectedMailbox = null
      this.selectedMessage = null
      this.showCreateModal = false
      this.showSettingsModal = false
      this.passwordChangeRequired = false
      this.passwordChangeError = ''
      this.passwordChangeForm = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }
    },

    async ensureApiAccess(res: Response): Promise<boolean> {
      if (res.status === 401) {
        this.resetAuthenticatedState()
        return false
      }

      if (res.status === 403) {
        const data: { code?: string } | null = await res
          .clone()
          .json()
          .catch(() => null)
        if (data?.code === 'PASSWORD_CHANGE_REQUIRED') {
          this.passwordChangeRequired = true
          this.passwordChangeError = ''
          return false
        }
      }

      if (!res.ok) this.showToast('Request failed. Please try again')
      return true
    },

    async fetchSession(): Promise<void> {
      try {
        const res = await fetch('/api/session')
        const data: SessionResponse = await res.json()
        if (res.ok && data.authenticated) {
          this.isLoggedIn = true
          this.passwordChangeRequired = !!data.mustChangePassword
          if (!this.passwordChangeRequired) {
            await this.initializeAuthenticatedView()
          }
        } else {
          this.resetAuthenticatedState()
        }
      } catch (e) {
        console.error('Session check failed', e)
        this.resetAuthenticatedState()
      }
    },

    async login(): Promise<void> {
      this.isLoading = true
      this.loginError = ''
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: this.password }),
        })
        const data: SessionResponse = await res.json()

        if (res.ok) {
          this.isLoggedIn = true
          this.passwordChangeRequired = !!data.mustChangePassword
          this.passwordChangeError = ''
          if (this.passwordChangeRequired) {
            this.passwordChangeForm.currentPassword = this.password
          } else {
            await this.initializeAuthenticatedView()
          }
          this.password = ''
        } else {
          this.loginError = apiErrorKey(data.error, 'Login failed')
        }
      } catch (e) {
        this.loginError = 'Network error'
      } finally {
        this.isLoading = false
      }
    },

    async logout(): Promise<void> {
      try {
        const res = await fetch('/api/logout', { method: 'POST' })
        if (!res.ok && res.status !== 401) throw new Error('Logout failed')
        this.resetAuthenticatedState()
      } catch {
        this.showToast('Failed to sign out. Please try again')
      }
    },

    async fetchMailboxes(): Promise<boolean> {
      const generation = sessionGeneration
      try {
        const res = await fetch('/api/mailboxes')
        if (
          generation !== sessionGeneration ||
          !(await this.ensureApiAccess(res))
        )
          return false
        if (!res.ok) throw new Error('Failed to load mailboxes')
        const data: { mailboxes: Mailbox[] } = await res.json()
        if (generation !== sessionGeneration) return false
        this.mailboxes = data.mailboxes
        return true
      } catch {
        this.showToast('Failed to load mailboxes')
        return false
      }
    },

    async createMailbox(): Promise<void> {
      if (!this.newMailboxAddress && this.availableDomains.length === 0) {
        alert(t('Enter a full email address, for example support@example.com'))
        return
      }

      this.isCreating = true
      try {
        const payload = this.newMailboxAddress
          ? this.availableDomains.length > 0
            ? { address: this.newMailboxAddress, domain: this.selectedDomain }
            : { address: this.newMailboxAddress }
          : { domain: this.selectedDomain }
        const res = await fetch('/api/mailboxes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!(await this.ensureApiAccess(res))) return
        if (res.ok) {
          await this.fetchMailboxes()
          await this.fetchConfig()
          this.showCreateModal = false
          this.newMailboxAddress = ''
        } else {
          const data: { error?: string } = await res.json()
          alert(t(apiErrorKey(data.error, 'Failed to create mailbox')))
        }
      } catch (e) {
        alert(t('Error creating mailbox'))
      } finally {
        this.isCreating = false
      }
    },

    async deleteMailbox(id: number): Promise<void> {
      try {
        if (
          !confirm(
            t('Are you sure? All messages in this mailbox will be deleted.'),
          )
        )
          return

        const res = await fetch(`/api/mailboxes/${id}`, { method: 'DELETE' })
        if (!(await this.ensureApiAccess(res))) return
        if (res.ok) {
          if (this.selectedMailbox?.id === id) {
            this.selectedMailbox = null
            this.messages = []
            this.selectedMessageIds = []
            this.selectedMessage = null
          }
          await this.fetchMailboxes()
        }
      } catch {
        this.showToast('Operation failed. Please try again')
      }
    },

    async selectMailbox(box: Mailbox): Promise<void> {
      messageRequest++
      this.isLoadingContent = false
      this.selectedMailbox = box
      this.selectedMessageIds = []
      this.selectedMessage = null
      await this.fetchMessages(box.id)
    },

    async fetchMessages(mailboxId: number): Promise<boolean> {
      const request = ++mailboxRequest
      this.isLoadingMessages = true
      this.messages = []
      this.selectedMessageIds = []
      try {
        const res = await fetch(`/api/mailboxes/${mailboxId}/messages`)
        if (request !== mailboxRequest || !(await this.ensureApiAccess(res)))
          return false
        if (!res.ok) throw new Error('Failed to load messages')
        const data: { messages: MessageSummary[] } = await res.json()
        if (request !== mailboxRequest) return false
        this.messages = data.messages
        return true
      } catch {
        if (request === mailboxRequest)
          this.showToast('Failed to load messages')
        return false
      } finally {
        if (request === mailboxRequest) this.isLoadingMessages = false
      }
    },

    applySelectedMessage(message: MessageDetail): boolean {
      const messageId = Number(message?.id)
      if (!message || !Number.isSafeInteger(messageId) || messageId <= 0) {
        this.selectedMessage = null
        return false
      }

      this.selectedMessage = {
        ...message,
        safe_html: this.buildMessageHtml(message),
      }

      const msgIndex = this.messages.findIndex(
        (item) => Number(item.id) === messageId,
      )
      if (msgIndex !== -1) {
        this.messages[msgIndex].is_read = 1
      }
      return true
    },

    async openPendingMessage(): Promise<void> {
      const messageId = this.pendingMessageId
      const request = ++messageRequest
      if (!messageId || !this.isLoggedIn || this.passwordChangeRequired) return

      this.isLoadingContent = true
      try {
        const res = await fetch(`/api/messages/${messageId}`)
        if (!(await this.ensureApiAccess(res))) return

        if (res.status === 404) {
          this.showToast('Message not found')
          this.clearPendingMessageId()
          return
        }

        if (!res.ok) {
          console.error(`Failed to open linked message: ${res.status}`)
          return
        }

        const data: { message: MessageDetail } = await res.json()
        if (request !== messageRequest) return
        const mailboxId = Number(data?.message?.mailbox_id)
        const mailbox = this.mailboxes.find(
          (box) => Number(box.id) === mailboxId,
        )
        if (!data?.message || !Number.isSafeInteger(mailboxId) || !mailbox) {
          this.showToast('Message not found')
          this.clearPendingMessageId()
          return
        }

        this.selectedMailbox = mailbox
        this.selectedMessage = null
        const messagesLoaded = await this.fetchMessages(mailbox.id)
        if (
          !messagesLoaded ||
          request !== messageRequest ||
          !this.isLoggedIn ||
          this.passwordChangeRequired
        )
          return

        this.applySelectedMessage(data.message)
        this.clearPendingMessageId()
      } catch (e) {
        console.error('Failed to open linked message', e)
      } finally {
        if (request === messageRequest) this.isLoadingContent = false
      }
    },

    async selectMessage(id: number): Promise<void> {
      const request = ++messageRequest
      this.isLoadingContent = true
      this.selectedMessage = null
      try {
        const res = await fetch(`/api/messages/${id}`)
        if (request !== messageRequest || !(await this.ensureApiAccess(res)))
          return
        if (!res.ok) throw new Error('Failed to load message')
        const data: { message: MessageDetail } = await res.json()
        if (request !== messageRequest) return
        this.applySelectedMessage(data.message)
        await this.fetchMailboxes()
      } catch {
        if (request === messageRequest) this.showToast('Failed to load message')
      } finally {
        if (request === messageRequest) this.isLoadingContent = false
      }
    },

    async deleteMessage(id: number): Promise<void> {
      try {
        if (!confirm(t('Delete this message?'))) return

        const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' })
        if (!(await this.ensureApiAccess(res))) return
        if (res.ok) {
          this.selectedMessage = null
          this.selectedMessageIds = this.selectedMessageIds.filter(
            (messageId) => messageId !== id,
          )
          if (this.selectedMailbox)
            await this.fetchMessages(this.selectedMailbox.id)
          await this.fetchMailboxes()
        }
      } catch {
        this.showToast('Operation failed. Please try again')
      }
    },

    toggleMessageSelection(id: number, checked: boolean) {
      if (checked) {
        if (!this.selectedMessageIds.includes(id)) {
          this.selectedMessageIds = [...this.selectedMessageIds, id]
        }
        return
      }

      this.selectedMessageIds = this.selectedMessageIds.filter(
        (messageId) => messageId !== id,
      )
    },

    toggleAllMessages(checked: boolean) {
      this.selectedMessageIds = checked
        ? this.messages.map((msg) => msg.id)
        : []
    },

    async batchMarkMessagesRead(): Promise<void> {
      try {
        if (this.selectedMessageIds.length === 0) return

        const res = await fetch('/api/messages/batch-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: this.selectedMessageIds }),
        })

        if (!(await this.ensureApiAccess(res))) return
        if (res.ok) {
          this.messages = this.messages.map((msg) =>
            this.selectedMessageIds.includes(msg.id)
              ? { ...msg, is_read: 1 }
              : msg,
          )
          this.selectedMessageIds = []
          await this.fetchMailboxes()
          this.showToast('Selected messages marked as read')
        }
      } catch {
        this.showToast('Operation failed. Please try again')
      }
    },

    async batchDeleteMessages(): Promise<void> {
      try {
        if (this.selectedMessageIds.length === 0) return
        if (
          !confirm(
            t('Delete {count} selected messages?', { count: this.selectedMessageIds.length }),
          )
        )
          return

        const deletingIds = [...this.selectedMessageIds]
        const res = await fetch('/api/messages/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: deletingIds }),
        })

        if (!(await this.ensureApiAccess(res))) return
        if (res.ok) {
          if (
            this.selectedMessage?.id &&
            deletingIds.includes(this.selectedMessage.id)
          ) {
            this.selectedMessage = null
          }
          this.selectedMessageIds = []
          if (this.selectedMailbox)
            await this.fetchMessages(this.selectedMailbox.id)
          await this.fetchMailboxes()
          this.showToast('Selected messages deleted')
        }
      } catch {
        this.showToast('Operation failed. Please try again')
      }
    },

    escapeHtml,

    sanitizeEmailHtml,

    buildMessageHtml,

    formatDate,

    formatFullDate,

    formatSize,

    async copyToClipboard(text?: string | null): Promise<void> {
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        this.showToast('Copied to clipboard')
      } catch (err) {
        console.error('Failed to copy: ', err)
      }
    },

    showToast(key: MessageKey, params: MessageParams = {}) {
      clearTimeout(toastTimer)
      this.toastKey = key
      this.toastParams = params
      toastTimer = setTimeout(() => {
        this.toastKey = ''
      }, 2500)
    },

    async fetchSettings(): Promise<void> {
      try {
        const res = await fetch('/api/settings')
        if (!(await this.ensureApiAccess(res))) return
        if (res.ok) {
          const data: {
            settings: Settings & { tg_bot_token_configured: boolean }
          } = await res.json()
          this.settings = {
            ...this.settings,
            ...data.settings,
            tg_bot_token: '',
          }
          this.tgBotTokenConfigured = !!data.settings.tg_bot_token_configured
          this.tgEnabled =
            this.tgBotTokenConfigured || !!this.settings.tg_chat_id
        }
      } catch (e) {
        console.error('Failed to fetch settings', e)
      }
    },

    async saveSettings(): Promise<void> {
      try {
        const data: SettingsPayload = { ...this.settings }
        if (!this.tgEnabled) {
          data.tg_bot_token = ''
          data.tg_chat_id = ''
          data.tg_topic_id = ''
          data.clear_tg_bot_token = true
        } else {
          if (!this.tgBotTokenConfigured && !data.tg_bot_token) {
            alert(t('Enter a Bot Token'))
            return
          }
          if (!data.tg_bot_token) {
            delete data.tg_bot_token
          }
          if (!data.tg_chat_id) {
            alert(t('Enter a Chat ID'))
            return
          }
        }
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!(await this.ensureApiAccess(res))) return
        if (res.ok) {
          this.tgBotTokenConfigured = this.tgEnabled
            ? this.tgBotTokenConfigured || !!this.settings.tg_bot_token
            : false
          this.settings.tg_bot_token = ''
          this.showToast('Settings saved')
          this.showSettingsModal = false
        }
      } catch (e) {
        alert(t('Failed to save settings'))
      }
    },

    async deleteAutoCreatedMailboxes(): Promise<void> {
      try {
        if (!confirm(t('Delete all auto-created mailboxes?'))) return
        const res = await fetch('/api/mailboxes-auto-created', {
          method: 'DELETE',
        })
        if (!(await this.ensureApiAccess(res))) return
        if (res.ok) {
          const data: { deleted: number } = await res.json()
          this.showToast('Deleted {count} mailboxes', { count: data.deleted })
          await this.fetchMailboxes()
          this.selectedMailbox = null
          this.messages = []
          this.selectedMessageIds = []
          this.selectedMessage = null
        }
      } catch {
        this.showToast('Operation failed. Please try again')
      }
    },

    async fetchChatId(): Promise<void> {
      if (!this.settings.tg_bot_token) return
      this.fetchingChatId = true
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${this.settings.tg_bot_token}/getUpdates`,
        )
        const data: TelegramResponse = await res.json()
        if (!data.ok) {
          alert(t('Invalid Bot Token'))
          return
        }
        const lastMsg = data.result?.filter((u) => u.message).pop()
        if (!lastMsg?.message) {
          alert(t('Send a message to the bot first'))
          return
        }
        this.settings.tg_chat_id = String(lastMsg.message.chat.id)
        this.showToast('Chat ID retrieved')
      } catch (e) {
        alert(t('Failed to retrieve Chat ID'))
      } finally {
        this.fetchingChatId = false
      }
    },

    async changePassword(): Promise<void> {
      this.passwordChangeError = ''

      if (!this.passwordChangeForm.currentPassword) {
        this.passwordChangeError = 'Please enter the current password'
        return
      }

      if (
        !this.passwordChangeForm.newPassword ||
        this.passwordChangeForm.newPassword.length < 8
      ) {
        this.passwordChangeError = 'New password must be at least 8 characters'
        return
      }

      if (
        this.passwordChangeForm.newPassword !==
        this.passwordChangeForm.confirmPassword
      ) {
        this.passwordChangeError = 'New passwords do not match'
        return
      }

      this.changingPassword = true
      try {
        const res = await fetch('/api/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: this.passwordChangeForm.currentPassword,
            newPassword: this.passwordChangeForm.newPassword,
          }),
        })

        const data: { error?: string } = await res.json()
        // This route also uses 401 for a wrong current password, with a valid session.
        if (res.status === 401 && data.error !== 'Current password is incorrect') {
          await this.ensureApiAccess(res)
          return
        }
        if (res.ok) {
          this.passwordChangeRequired = false
          this.passwordChangeForm = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          }
          this.showToast('Password updated')
          await this.initializeAuthenticatedView()
        } else {
          this.passwordChangeError = apiErrorKey(data.error, 'Failed to update password')
        }
      } catch (e) {
        this.passwordChangeError = 'Failed to update password'
      } finally {
        this.changingPassword = false
      }
    },

    // 图片拖动
    startDrag(e: MouseEvent) {
      if (e.target instanceof Element && !!e.target.closest('button')) return
      this.imageDragging = true
      this.dragStart = {
        x: e.clientX - this.imagePos.x,
        y: e.clientY - this.imagePos.y,
      }
    },
    onDrag(e: MouseEvent) {
      if (!this.imageDragging) return
      this.imagePos = {
        x: e.clientX - this.dragStart.x,
        y: e.clientY - this.dragStart.y,
      }
    },
    stopDrag() {
      this.imageDragging = false
    },
    openImagePreview(src: string) {
      this.imagePreview = src
      this.imagePos = { x: 0, y: 0 }
    },
  })
  watch(locale, () => {
    if (app.selectedMessage) {
      app.selectedMessage.safe_html = buildMessageHtml(app.selectedMessage)
    }
  })
  // Vue event handlers may receive a method independently of its owning object.
  for (const key of Object.keys(app)) {
    const value: unknown = Reflect.get(app, key)
    if (typeof value === 'function') Reflect.set(app, key, value.bind(app))
  }
  onUnmounted(() => {
    sessionGeneration++
    mailboxRequest++
    messageRequest++
    clearTimeout(toastTimer)
  })
  return app
}

export type MailApp = ReturnType<typeof useMailApp>
export const mailAppKey: InjectionKey<MailApp> = Symbol('mail-app')
export function useMailContext(): MailApp {
  const app = inject(mailAppKey)
  if (!app) throw new Error('Mail application context is missing')
  return app
}
