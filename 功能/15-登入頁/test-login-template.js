// Render public/views/login.ejs with and without third-party providers and
// check the generated HTML (no server, no keys needed).
// Usage: node test-login-template.js <path to hedgedoc-1x>
const path = require('path')
const hd = path.resolve(process.argv[2] || '.')
const ejs = require(path.join(hd, 'node_modules', 'ejs'))

const view = path.join(hd, 'public', 'views', 'login.ejs')
const base = {
  serverURL: 'http://localhost:3000',
  infoMessage: [],
  errorMessage: [],
  otherMethods: false,
  authProviders: { email: true, allowEmailRegister: false }
}

function render (locals) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(view, Object.assign({}, base, locals), { views: [path.join(hd, 'public', 'views')] }, (err, html) => err ? reject(err) : resolve(html))
  })
}

async function main () {
  const r = {}
  const none = await render({ oauthProviders: [] })
  r.email_form = none.includes('action="http://localhost:3000/login"') && none.includes('name="email"') && none.includes('name="password"')
  r.no_divider_without_providers = !none.includes('login-divider') && !none.includes('login-provider')
  r.forgot_password = none.includes('login-forgot') && none.includes('manage_users --reset')

  const two = await render({
    oauthProviders: [
      { id: 'google', name: 'Google', icon: 'fa-google' },
      { id: 'github', name: 'GitHub', icon: 'fa-github' }
    ]
  })
  r.divider_with_providers = two.includes('<div class="login-divider"><span>或是</span></div>')
  r.provider_buttons = two.includes('href="http://localhost:3000/auth/google"') && two.includes('透過 GitHub 登入') &&
    two.indexOf('/auth/google') < two.indexOf('/auth/github')

  const err = await render({ oauthProviders: [], errorMessage: ['<b>bad</b>'] })
  r.error_escaped = err.includes('&lt;b&gt;bad&lt;/b&gt;') && !err.includes('<b>bad</b>')

  const reg = await render({ oauthProviders: [], authProviders: { email: true, allowEmailRegister: true } })
  r.register_hint_only_when_open = reg.includes('還沒有帳號') && reg.includes('href="http://localhost:3000/register"') && !none.includes('還沒有帳號')

  const oauthOnly = await render({ oauthProviders: [{ id: 'github', name: 'GitHub', icon: 'fa-github' }], authProviders: { email: false } })
  r.oauth_only_has_no_form_or_divider = !oauthOnly.includes('login-form') && !oauthOnly.includes('login-divider') && oauthOnly.includes('/auth/github')

  console.log(JSON.stringify(r))
  process.exit(Object.values(r).every(Boolean) ? 0 : 1)
}

main().catch((e) => { console.log(JSON.stringify({ error: String(e) })); process.exit(1) })
