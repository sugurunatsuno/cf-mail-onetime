/** JSON contracts returned by the existing Hono routes. */
export interface Mailbox {
  id: number
  address: string
  local_part: string
  domain: string
  is_auto_created: number
  created_at: string
  last_message_at: string | null
  message_count: number
  unread_count: number
}

export interface MessageSummary {
  id: number
  sender: string
  subject: string | null
  preview: string | null
  verification_code: string | null
  received_at: string
  is_read: number
}

export interface Attachment {
  id: number
  filename: string
  content_type: string | null
  size: number
  hash: string
}

export interface MessageDetail extends MessageSummary {
  mailbox_id: number
  mailbox_address: string
  html: string
  text: string
  r2_key: string
  attachments: Attachment[]
}

export interface SelectedMessage extends MessageDetail {
  safe_html: string
}

export interface Settings {
  auto_create_enabled: string
  auto_create_min_length: string
  auto_create_max_length: string
  auto_create_start_type: string
  tg_bot_token: string
  tg_chat_id: string
  tg_topic_id: string
}

export type SettingsPayload = Omit<Settings, 'tg_bot_token'> & {
  tg_bot_token?: string
  clear_tg_bot_token?: boolean
}

export interface SessionResponse {
  authenticated?: boolean
  mustChangePassword?: boolean
  error?: string
}

export interface TelegramResponse {
  ok: boolean
  description?: string
  result?: Array<{ message?: { chat: { id: number } } }>
}
