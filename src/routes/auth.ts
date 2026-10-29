import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { jwt } from '../utils/jwt'
import { getJwtSecret } from '../db/init'
import { normalizePublicOrigin, PUBLIC_BASE_URL_SETTING } from '../utils/public-url'
import {
  isUsingDefaultAdminPassword,
  setAdminPassword,
  validateNewPassword,
  verifyAdminPassword,
} from '../utils/password'

type Bindings = {
  DB: D1Database
  ADMIN_PASSWORD: string
}

const auth = new Hono<{ Bindings: Bindings }>()

async function rememberPublicBaseUrl(db: D1Database, requestUrl: string): Promise<void> {
  const origin = normalizePublicOrigin(requestUrl)
  if (!origin) return

  try {
    await db
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .bind(PUBLIC_BASE_URL_SETTING, origin)
      .run()
  } catch (error: unknown) {
    console.error('Failed to remember public base URL:', error)
  }
}

auth.post('/login', async (c) => {
  const body = await c.req.json<{ password: string }>()

  if (!body.password || !(await verifyAdminPassword(c.env.DB, c.env.ADMIN_PASSWORD, body.password))) {
    return c.json({ error: 'Invalid password' }, 401)
  }

  const secret = await getJwtSecret(c.env.DB)
  const token = await jwt.sign({ role: 'admin' }, secret)
  const mustChangePassword = await isUsingDefaultAdminPassword(c.env.DB, c.env.ADMIN_PASSWORD)
  await rememberPublicBaseUrl(c.env.DB, c.req.url)

  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  return c.json({ success: true, mustChangePassword })
})

auth.get('/session', async (c) => {
  const token = getCookie(c, 'token')
  if (!token) {
    return c.json({ authenticated: false, mustChangePassword: false })
  }

  const secret = await getJwtSecret(c.env.DB)
  const payload = await jwt.verify(token, secret)
  if (!payload) {
    return c.json({ authenticated: false, mustChangePassword: false })
  }

  await rememberPublicBaseUrl(c.env.DB, c.req.url)
  const mustChangePassword = await isUsingDefaultAdminPassword(c.env.DB, c.env.ADMIN_PASSWORD)
  return c.json({ authenticated: true, mustChangePassword })
})

auth.post('/change-password', async (c) => {
  const body = await c.req.json<{ currentPassword?: string; newPassword?: string }>()
  const currentPassword = body.currentPassword || ''
  const newPassword = body.newPassword || ''

  if (!(await verifyAdminPassword(c.env.DB, c.env.ADMIN_PASSWORD, currentPassword))) {
    return c.json({ error: 'Current password is incorrect' }, 401)
  }

  const validationError = validateNewPassword(newPassword)
  if (validationError) {
    return c.json({ error: validationError }, 400)
  }

  if (currentPassword === newPassword) {
    return c.json({ error: 'New password must be different from current password' }, 400)
  }

  await setAdminPassword(c.env.DB, newPassword)
  return c.json({ success: true })
})

auth.post('/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' })
  return c.json({ success: true })
})

export { auth }
