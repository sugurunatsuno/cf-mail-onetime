export const PUBLIC_BASE_URL_SETTING = 'public_base_url'

export function normalizePublicOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}

export function buildMessageDetailUrl(publicBaseUrl: string | undefined, messageId: number): string | null {
  const origin = publicBaseUrl ? normalizePublicOrigin(publicBaseUrl) : null
  if (!origin || !Number.isSafeInteger(messageId) || messageId <= 0) {
    return null
  }

  const url = new URL(origin)
  url.searchParams.set('message', String(messageId))
  return url.toString()
}
