// Feature 16 offline tests: the user name / password rules and the
// register.ejs template (no server, no database).
// Usage: node test-register.js <path to hedgedoc-1x>
const path = require('path')
const hd = path.resolve(process.argv[2] || '.')
const ejs = require(path.join(hd, 'node_modules', 'ejs'))
const rules = require(path.join(hd, 'lib', 'web', 'accountRules'))

const view = path.join(hd, 'public', 'views', 'register.ejs')
const base = {
  serverURL: 'http://localhost:3000',
  errorMessage: [],
  username: '',
  email: '',
  oauthProviders: [],
  rules,
  termsOfUse: false
}

function render (locals) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(view, Object.assign({}, base, locals), { views: [path.join(hd, 'public', 'views')] }, (err, html) => err ? reject(err) : resolve(html))
  })
}

async function main () {
  const r = {}
  const ok = (v) => rules.checkUsername(v) === null
  r.username_rules = ok('hhyn') && ok('a-b-9') && ok('A') && !ok('') && !ok('-abc') && !ok('a b') && !ok('a_b') &&
    !ok('中文') && !ok('x'.repeat(rules.USERNAME_MAX_LENGTH + 1)) && ok('x'.repeat(rules.USERNAME_MAX_LENGTH))
  const pw = (v) => rules.checkPassword(v) === null
  r.password_rules = pw('Abcdefg1') && !pw('Abcdef1') && !pw('abcdefg1') && !pw('ABCDEFG1') && !pw('Abcdefgh') &&
    pw('Aa1' + 'x'.repeat(125)) && !pw('Aa1' + 'x'.repeat(126)) && !pw(undefined)

  const plain = await render({})
  r.form = plain.includes('action="http://localhost:3000/register"') &&
    ['name="username"', 'name="email"', 'name="password"', 'name="password_confirm"'].every((s) => plain.includes(s))
  r.hints = plain.includes(rules.USERNAME_HINT) && plain.includes(rules.PASSWORD_HINT)
  r.login_link = plain.includes('已經有帳號了？<a href="http://localhost:3000/login">登入</a>')
  r.no_divider_without_providers = !plain.includes('login-divider')
  r.no_terms_without_file = !plain.includes('服務條款')

  const full = await render({
    oauthProviders: [{ id: 'google', name: 'Google', icon: 'fa-google' }, { id: 'github', name: 'GitHub', icon: 'fa-github' }],
    termsOfUse: true
  })
  r.providers = full.includes('<span>或是</span>') && full.includes('透過 Google 登入') && full.indexOf('/auth/google') < full.indexOf('/auth/github')
  r.terms = full.includes('/s/terms-of-use')

  const bad = await render({ errorMessage: ['<b>x</b>'], username: '"><script>', email: 'a@b.c' })
  r.escaped = bad.includes('&lt;b&gt;x&lt;/b&gt;') && !bad.includes('"><script>') && bad.includes('value="a@b.c"')

  console.log(JSON.stringify(r))
  process.exit(Object.values(r).every(Boolean) ? 0 : 1)
}

main().catch((e) => { console.log(JSON.stringify({ error: String(e) })); process.exit(1) })
