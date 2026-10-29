import { t, locale } from '../i18n'
import type { MessageDetail } from '../types'

export function escapeHtml(value: string | null | undefined): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function sanitizeEmailHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html || '', 'text/html')

  doc
    .querySelectorAll(
      'script, iframe, frame, object, embed, form, input, button, textarea, select, link, base, meta, style, svg, math, audio, video, source, track',
    )
    .forEach((el) => el.remove())

  doc.querySelectorAll('*').forEach((el) => {
    ;[...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = (attr.value || '').trim()

      if (
        name.startsWith('on') ||
        name === 'srcdoc' ||
        name === 'formaction' ||
        name === 'style'
      ) {
        el.removeAttribute(attr.name)
        return
      }

      if (name === 'href') {
        if (/^javascript:/i.test(value)) {
          el.removeAttribute(attr.name)
          return
        }
        if (/^(https?:|mailto:)/i.test(value) || value.startsWith('#')) {
          if (el.tagName === 'A') {
            el.setAttribute('target', '_blank')
            el.setAttribute('rel', 'noopener noreferrer')
          }
        } else {
          el.removeAttribute(attr.name)
        }
        return
      }

      if (name === 'src') {
        if (/^(data:|cid:)/i.test(value)) return
        if (/^(https?:)?\/\//i.test(value)) {
          el.setAttribute('data-blocked-src', value)
          el.removeAttribute(attr.name)
          if (el.tagName === 'IMG' && !el.getAttribute('alt')) {
            el.setAttribute('alt', t('Remote image blocked'))
          }
          return
        }
        el.removeAttribute(attr.name)
        return
      }

      if (name === 'srcset' || name === 'poster') {
        el.removeAttribute(attr.name)
      }
    })
  })

  const bodyHtml = doc.body.innerHTML.trim() || `<pre>${escapeHtml(t('No content'))}</pre>`
  return `<!DOCTYPE html>
<html lang="${locale.value}">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; padding: 16px; line-height: 1.6; word-break: break-word; }
        img { max-width: 100%; height: auto; }
        table { max-width: 100%; border-collapse: collapse; }
        pre { white-space: pre-wrap; word-break: break-word; }
        blockquote { margin: 0; padding-left: 12px; border-left: 3px solid #e2e8f0; color: #475569; }
        a { color: #2563eb; }
    </style>
</head>
<body>${bodyHtml}</body>
</html>`
}

export function buildMessageHtml(
  message: Pick<MessageDetail, 'html' | 'text'>,
): string {
  if (message?.html) {
    return sanitizeEmailHtml(message.html)
  }

  return `<!DOCTYPE html>
<html lang="${locale.value}">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; padding: 16px; }
        pre { white-space: pre-wrap; word-break: break-word; }
    </style>
</head>
<body><pre>${escapeHtml(message?.text || t('No content'))}</pre></body>
</html>`
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  // If today, show time, else show date
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString(locale.value)
}

export function formatFullDate(isoString?: string | null): string {
  if (!isoString) return ''
  return new Date(isoString).toLocaleString(locale.value)
}

export function formatSize(bytes?: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
