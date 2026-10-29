import { expect, test, type Page, type Route } from '@playwright/test'

const boxes = [1, 2].map(id => ({
  id, address: `${id === 1 ? 'alpha' : 'beta'}@example.com`, domain: 'example.com',
  local_part: id === 1 ? 'alpha' : 'beta', is_auto_created: 0,
  created_at: '2026-09-01T12:00:00Z', last_message_at: null, message_count: 2, unread_count: 2,
}))
const messages = [11, 12].map(id => ({
  id, sender: 'sender@example.net', subject: `Delivery ${id}`, preview: 'Message preview',
  verification_code: null, received_at: '2026-09-01T12:00:00Z', is_read: 0,
}))
const detail = (id: number) => ({
  ...messages[0], id, subject: `Delivery ${id}`, mailbox_id: 1, mailbox_address: boxes[0].address,
  text: 'Readable message', html: '<p>Readable message</p>', r2_key: `message-${id}`,
  attachments: [{ id: 7, filename: 'receipt.txt', content_type: 'text/plain', size: 12, hash: 'abc' }],
})

async function mockApi(page: Page, options: { authenticated?: boolean; forcePassword?: boolean } = {}) {
  const requests: Array<{ path: string; method: string; body: Record<string, unknown> | null }> = []
  let mailboxRows = [...boxes]
  let messageRows = [...messages]
  let configured = true
  let authenticated = options.authenticated ?? true
  let forcePassword = options.forcePassword ?? false
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const body = request.postDataJSON() as Record<string, unknown> | null
    requests.push({ path, method, body })
    const json = (data: unknown, status = 200) => route.fulfill({ json: data, status })
    if (path === '/api/config') return json({ domains: ['example.com'] })
    if (path === '/api/session') return json({ authenticated, mustChangePassword: forcePassword }, authenticated ? 200 : 401)
    if (path === '/api/login') {
      if (body?.password === 'incorrect') return json({ error: 'Invalid password' }, 401)
      authenticated = true
      return json({ success: true, mustChangePassword: forcePassword })
    }
    if (path === '/api/change-password') { forcePassword = false; return json({ success: true }) }
    if (path === '/api/logout') { authenticated = false; return json({ success: true }) }
    if (path === '/api/mailboxes' && method === 'POST') {
      const mailbox = { ...boxes[0], id: 3, address: `${body?.address}@${body?.domain}` }
      mailboxRows.push(mailbox)
      return json({ mailbox })
    }
    if (path === '/api/mailboxes') return json({ mailboxes: mailboxRows })
    if (/^\/api\/mailboxes\/\d+$/.test(path) && method === 'DELETE') {
      mailboxRows = mailboxRows.filter(box => box.id !== Number(path.split('/').at(-1)))
      return json({ success: true })
    }
    if (path.match(/\/mailboxes\/\d+\/messages$/)) return json({ messages: path.includes('/1/') ? messageRows : [] })
    if (path === '/api/messages/batch-read') {
      messageRows = messageRows.map(row => ({ ...row, is_read: 1 }))
      return json({ success: true, updated: messageRows.length })
    }
    if (path === '/api/messages/batch-delete') {
      messageRows = []
      return json({ success: true, deleted: 2 })
    }
    if (path.match(/^\/api\/messages\/\d+$/)) return json({ message: detail(Number(path.split('/').at(-1))) })
    if (path === '/api/settings' && method === 'PUT') {
      if (body?.clear_tg_bot_token) configured = false
      return json({ success: true })
    }
    if (path === '/api/settings') return json({ settings: {
      auto_create_enabled: 'false', auto_create_min_length: '6', auto_create_max_length: '20',
      auto_create_start_type: 'both', tg_bot_token_configured: configured,
      tg_chat_id: configured ? '-100123' : '', tg_topic_id: '',
    } })
    return json({ error: `Unmocked ${method} ${path}` }, 404)
  })
  page.on('dialog', dialog => dialog.accept())
  return requests
}

function passwordInput(page: Page, label: string) {
  return page.locator('label').filter({ hasText: new RegExp(`^${label}$`) }).locator('..').locator('input')
}

test('login and forced password change preserve a Telegram message deep link', async ({ page }) => {
  const requests = await mockApi(page, { authenticated: false, forcePassword: true })
  await page.goto('/?message=11&source=telegram')
  await page.getByPlaceholder('Admin Password').fill('incorrect')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Invalid password', { exact: true })).toBeVisible()
  await page.getByPlaceholder('Admin Password').fill('default-password')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Change the default password', { exact: true })).toBeVisible()
  expect(requests.some(request => request.path === '/api/mailboxes')).toBe(false)
  await expect(passwordInput(page, 'Current Password')).toHaveValue('default-password')
  await passwordInput(page, 'New Password').fill('new-password-123')
  await passwordInput(page, 'Confirm New Password').fill('new-password-123')
  await page.getByRole('button', { name: 'Save and Continue' }).click()
  await expect(page.frameLocator('iframe').getByText('Readable message')).toBeVisible()
  await expect(page).toHaveURL(/\?source=telegram$/)
  expect(requests.find(request => request.path === '/api/change-password')?.body).toEqual({
    currentPassword: 'default-password', newPassword: 'new-password-123',
  })
  await expect(page.getByRole('link', { name: /receipt.txt/ })).toHaveAttribute('href', '/api/attachments/7')
})

test('mailbox creation, search, message detail and bulk actions remain usable', async ({ page }) => {
  const requests = await mockApi(page)
  await page.goto('/')
  await page.getByTitle('New Mailbox').click()
  await page.getByPlaceholder('e.g. support', { exact: true }).fill('support')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.locator('aside').getByText('support@example.com')).toBeVisible()
  await page.getByPlaceholder('Search...').fill('alpha')
  await expect(page.locator('aside').getByText('beta@example.com')).toBeHidden()
  await page.locator('aside').getByText('alpha@example.com').click()
  await page.getByText('Delivery 11', { exact: true }).click()
  await expect(page.frameLocator('iframe').getByText('Readable message')).toBeVisible()
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: 'Mark Read', exact: true }).click()
  await expect.poll(() => requests.find(request => request.path === '/api/messages/batch-read')?.body).toEqual({ ids: [11, 12] })
  await expect(page.getByRole('checkbox').first()).not.toBeChecked()
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: 'Mark Read', exact: true }).locator('..').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('No messages in this mailbox.')).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  expect(requests.find(request => request.path === '/api/messages/batch-delete')?.body).toEqual({ ids: [11, 12] })
  await page.locator('aside').getByTitle('Delete Mailbox').click()
  await expect(page.locator('aside').getByText('alpha@example.com')).toBeHidden()
})

test('settings preserve the redacted token when empty and explicitly clear it when disabled', async ({ page }) => {
  const requests = await mockApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: /Settings$/ }).click()
  await expect(page.getByText('Token is configured. It is hidden for security. Leave empty to keep the current value.')).toBeVisible()
  await expect(page.getByPlaceholder('123456:ABC-DEF...')).toHaveValue('')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => requests.filter(request => request.path === '/api/settings' && request.method === 'PUT').length).toBe(1)
  const preserved = requests.find(request => request.path === '/api/settings' && request.method === 'PUT')!.body!
  expect(preserved).not.toHaveProperty('tg_bot_token')
  expect(preserved).not.toHaveProperty('clear_tg_bot_token')
  await page.getByRole('button', { name: /Settings$/ }).click()
  await page.getByRole('heading', { name: 'Telegram Notification' }).locator('..').getByRole('button').click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => requests.filter(request => request.path === '/api/settings' && request.method === 'PUT').length).toBe(2)
  expect(requests.filter(request => request.path === '/api/settings' && request.method === 'PUT')[1].body).toMatchObject({
    clear_tg_bot_token: true, tg_chat_id: '', tg_topic_id: '',
  })
})

test('hostile email is isolated and cannot request remote trackers', async ({ page }) => {
  await mockApi(page)
  const trackers: string[] = []
  page.on('request', request => { if (request.url().includes('tracker.invalid')) trackers.push(request.url()) })
  await page.route('https://tracker.invalid/**', route => route.abort())
  await page.route('**/api/messages/11', route => route.fulfill({ json: { message: {
    ...detail(11), html: `<p>Safe email text</p><script>parent.document.title='compromised'</script>
      <img src="https://tracker.invalid/pixel" onerror="parent.document.title='compromised'">
      <style>@import url('https://tracker.invalid/css');</style>
      <div style="background:url(https://tracker.invalid/bg)">Styled content</div>
      <iframe src="https://tracker.invalid/frame"></iframe><form action="https://tracker.invalid/submit"><input></form>
      <a href="javascript:alert(1)" onclick="alert(2)">Unsafe link</a>
      <a href="https://example.org">Safe link</a>`,
  } } }))
  await page.goto('/?message=11')
  const email = page.frameLocator('iframe')
  await expect(email.getByText('Safe email text')).toBeVisible()
  const sandbox = await page.locator('iframe').getAttribute('sandbox')
  expect(sandbox).not.toContain('allow-scripts')
  expect(sandbox).not.toContain('allow-same-origin')
  await expect(email.locator('script, iframe, form, input, [onerror], [onclick], [style]')).toHaveCount(0)
  await expect(email.getByText('Unsafe link')).not.toHaveAttribute('href')
  await expect(email.getByText('Safe link', { exact: true })).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(email.locator('img')).not.toHaveAttribute('src')
  expect(trackers).toEqual([])
  await expect(page).not.toHaveTitle('compromised')
})

test('a late mailbox response cannot replace the newly selected mailbox', async ({ page }) => {
  await mockApi(page)
  let release: ((route: Route) => Promise<void>) | undefined
  let heldRoute: Route | undefined
  await page.route('**/api/mailboxes/1/messages', route => {
    heldRoute = route
    return new Promise<void>(resolve => { release = async current => {
      await current.fulfill({ json: { messages } })
      resolve()
    } })
  })
  await page.goto('/')
  await page.locator('aside').getByText('alpha@example.com').click()
  await expect.poll(() => !!heldRoute).toBe(true)
  await page.locator('aside').getByText('beta@example.com').click()
  await expect(page.getByText('No messages in this mailbox.')).toBeVisible()
  await release!(heldRoute!)
  await expect(page.getByText('Delivery 11', { exact: true })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'beta@example.com' })).toBeVisible()
})

test('mobile users can navigate mailbox, message and reader panes without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  await page.goto('/')
  await page.locator('aside').getByText('alpha@example.com').click()
  await expect(page.locator('aside')).toBeHidden()
  await page.getByText('Delivery 11', { exact: true }).click()
  await expect(page.frameLocator('iframe').getByText('Readable message')).toBeVisible()
  await page.getByTitle('Back to messages').click()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByText('Delivery 11', { exact: true })).toBeVisible()
  await page.getByTitle('Back to mailboxes').click()
  await expect(page.locator('aside')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('plain text email is escaped and an expired protected session clears the reader', async ({ page }) => {
  await mockApi(page)
  const literal = '<img src="https://tracker.invalid/plain"> is text, not an image'
  await page.route('**/api/messages/11', route => route.fulfill({ json: { message: {
    ...detail(11), html: '', text: literal,
  } } }))
  await page.goto('/?message=11')
  await expect(page.frameLocator('iframe').getByText(literal)).toBeVisible()
  await expect(page.frameLocator('iframe').locator('img')).toHaveCount(0)
  await page.route('**/api/mailboxes/1/messages', route => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }))
  await page.getByTitle('Refresh messages').click()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.locator('aside')).toBeHidden()
})

test('incorrect current password keeps the change form, but an expired session returns to login', async ({ page }) => {
  await mockApi(page, { forcePassword: true })
  let passwordError = 'Current password is incorrect'
  await page.route('**/api/change-password', route => route.fulfill({ status: 401, json: { error: passwordError } }))
  await page.goto('/')
  await expect(page.getByText('Change the default password', { exact: true })).toBeVisible()
  await passwordInput(page, 'Current Password').fill('incorrect-current-password')
  await passwordInput(page, 'New Password').fill('new-password-123')
  await passwordInput(page, 'Confirm New Password').fill('new-password-123')
  await page.getByRole('button', { name: 'Save and Continue' }).click()
  await expect(page.getByText('Current password is incorrect', { exact: true })).toBeVisible()
  await expect(page.getByText('Change the default password', { exact: true })).toBeVisible()
  await expect(passwordInput(page, 'New Password')).toHaveValue('new-password-123')
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeHidden()
  passwordError = 'Unauthorized'
  await passwordInput(page, 'Current Password').fill('correct-current-password')
  await page.getByRole('button', { name: 'Save and Continue' }).click()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await expect(page.getByText('Change the default password', { exact: true })).toBeHidden()
  await expect(passwordInput(page, 'Current Password')).toHaveValue('')
  await expect(passwordInput(page, 'New Password')).toHaveValue('')
})

test('logging out after session expiry clears protected content', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/logout', route => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }))
  await page.goto('/?message=11')
  await expect(page.frameLocator('iframe').getByText('Readable message')).toBeVisible()
  await page.getByRole('button', { name: /Logout$/ }).click()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.locator('aside')).toBeHidden()
  await expect(page.getByText('Failed to sign out. Please try again')).toBeHidden()
})

test('language can switch before and after login and survives reload', async ({ page }) => {
  await mockApi(page, { authenticated: false })
  await page.goto('/')
  const language = page.getByRole('combobox', { name: 'Language / 语言' })
  await expect(language).toHaveValue('en')
  await language.selectOption('zh-CN')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible()
  await page.getByPlaceholder('管理员密码').fill('default-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'CF 邮局', exact: true })).toBeVisible()
  await expect(language).toHaveValue('zh-CN')
  await page.reload()
  await expect(language).toHaveValue('zh-CN')
  await expect(page.getByTitle('新建邮箱')).toBeVisible()
  await language.selectOption('en')
  await expect(page.getByTitle('New Mailbox')).toBeVisible()
  await page.reload()
  await expect(language).toHaveValue('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(await page.evaluate(() => localStorage.getItem('cf-mail.locale'))).toBe('en')
})

test('switching language reformats dates and preserves email content', async ({ page }) => {
  await mockApi(page)
  // A subject matching a translation key must still remain user content.
  await page.route('**/api/messages/11', route => route.fulfill({ json: { message: {
    ...detail(11), subject: 'Settings',
  } } }))
  await page.goto('/?message=11')
  const language = page.getByRole('combobox', { name: 'Language / 语言' })
  const receivedAt = new Date('2026-09-01T12:00:00Z')
  await expect(page.locator('main').getByText(receivedAt.toLocaleString('en', { timeZone: 'UTC' }), { exact: true })).toBeVisible()
  await language.selectOption('zh-CN')
  await expect(page.locator('main').getByText(receivedAt.toLocaleString('zh-CN', { timeZone: 'UTC' }), { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.frameLocator('iframe').getByText('Readable message')).toBeVisible()
  await expect(page.getByRole('link', { name: /receipt.txt/ })).toBeVisible()
  await expect(page.locator('main').getByText('收件人：alpha@example.com')).toBeVisible()
  await expect(page.locator('iframe')).toHaveAttribute('title', '邮件正文')
  await page.getByRole('checkbox').first().check()
  await expect(page.getByText('已选择 2 封', { exact: true })).toBeVisible()
})

test.describe('Chinese browser locale', () => {
  test.use({ locale: 'zh-CN' })

  test('detects Chinese automatically and ignores an invalid saved locale', async ({ page }) => {
    await mockApi(page, { authenticated: false })
    await page.goto('/')
    await expect(page.getByRole('combobox', { name: 'Language / 语言' })).toHaveValue('zh-CN')
    await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible()
    await page.evaluate(() => localStorage.setItem('cf-mail.locale', 'unsupported-locale'))
    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Language / 语言' })).toHaveValue('zh-CN')
    await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible()
  })
})

test('validation, backend errors and destructive confirmations follow the selected language', async ({ page }) => {
  const requests = await mockApi(page, { authenticated: false, forcePassword: true })
  await page.goto('/')
  const language = page.getByRole('combobox', { name: 'Language / 语言' })
  await language.selectOption('zh-CN')
  await page.getByPlaceholder('管理员密码').fill('incorrect')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('密码错误', { exact: true })).toBeVisible()
  await language.selectOption('en')
  await expect(page.getByText('Invalid password', { exact: true })).toBeVisible()
  await language.selectOption('zh-CN')
  await page.getByPlaceholder('管理员密码').fill('default-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('请先修改默认密码', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '保存并继续', exact: true }).click()
  await expect(page.getByText('新密码至少需要 8 个字符', { exact: true })).toBeVisible()
  expect(requests.some(request => request.path === '/api/change-password')).toBe(false)
  await passwordInput(page, '新密码').fill('new-password-123')
  await passwordInput(page, '确认新密码').fill('new-password-123')
  await page.getByRole('button', { name: '保存并继续', exact: true }).click()
  await expect(page.getByTitle('新建邮箱')).toBeVisible()
  const confirmation = page.waitForEvent('dialog')
  await page.locator('aside').getByTitle('删除邮箱').first().click()
  expect((await confirmation).message()).toBe('确定删除此邮箱吗？邮箱中的所有邮件也将被删除。')
  await expect(page.locator('aside').getByText('alpha@example.com')).toBeHidden()
})
