'use strict'
// Edit user profile (Lilith): display name, e-mail and password.

const Router = require('express').Router
const bodyParser = require('body-parser')
const validator = require('validator')

const logger = require('../logger')
const models = require('../models')
const rateLimit = require('./middleware/rateLimit')
const { checkPassword } = require('./accountRules')
const errors = require('../errors')
const { recentPublicNotes } = require('../publicNotes')

const profileRouter = module.exports = Router()

const MAX_NAME_LENGTH = 50
const jsonParser = bodyParser.json({ limit: '4kb' })

function jsonError (res, status, message) {
  return res.status(status).json({ error: message })
}

function requireLogin (req, res, next) {
  if (!req.isAuthenticated()) return jsonError(res, 401, '請先登入')
  next()
}

function parseStoredProfile (raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (err) {
    return null
  }
}

async function describe (user) {
  const profile = models.User.getProfile(user) || {}
  const stored = parseStoredProfile(user.profile)
  return {
    email: user.email || null,
    displayName: profile.name || '',
    photo: profile.photo || null,
    hasPassword: !!user.password,
    // profiles from Google/GitHub/... are rewritten by the provider at each login
    provider: stored && stored.provider && stored.provider !== 'email' ? stored.provider : 'email'
  }
}

// Remove control characters and collapse whitespace.
function cleanName (value) {
  // eslint-disable-next-line no-control-regex
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
}

profileRouter.get('/api/lilith/me', requireLogin, async function (req, res) {
  try {
    const user = await models.User.findOne({ where: { id: req.user.id } })
    if (!user) return jsonError(res, 404, '找不到使用者')
    res.json(await describe(user))
  } catch (err) {
    logger.error('profile: read failed: ' + err)
    jsonError(res, 500, '讀取失敗')
  }
})

// Body (JSON): { displayName?, email?, newPassword?, currentPassword? }
// Changing the e-mail or the password requires the current password.
profileRouter.post('/api/lilith/me', requireLogin, rateLimit.userEndpoints, jsonParser, async function (req, res) {
  if (!req.is('application/json')) return jsonError(res, 415, 'expected application/json')
  const body = req.body || {}
  try {
    const user = await models.User.findOne({ where: { id: req.user.id } })
    if (!user) return jsonError(res, 404, '找不到使用者')
    const stored = parseStoredProfile(user.profile)
    const isEmailAccount = !stored || stored.provider === 'email'

    const wantsEmail = typeof body.email === 'string' && body.email.trim().toLowerCase() !== String(user.email || '').toLowerCase()
    const wantsPassword = typeof body.newPassword === 'string' && body.newPassword.length > 0
    if (wantsEmail || wantsPassword) {
      if (!user.password) return jsonError(res, 400, '這個帳號沒有密碼，無法變更 E-Mail 或密碼')
      if (typeof body.currentPassword !== 'string' || body.currentPassword.length === 0) {
        return jsonError(res, 400, '請輸入目前的密碼')
      }
      if (!await user.verifyPassword(body.currentPassword)) return jsonError(res, 403, '目前的密碼不正確')
    }

    let email = user.email
    if (wantsEmail) {
      email = body.email.trim()
      if (!validator.isEmail(email)) return jsonError(res, 400, 'E-Mail 格式不正確')
      const taken = await models.User.findOne({ where: { email } })
      if (taken && taken.id !== user.id) return jsonError(res, 409, '這個 E-Mail 已經被使用')
      user.email = email
    }

    if (wantsPassword) {
      const weak = checkPassword(body.newPassword)
      if (weak) return jsonError(res, 400, '新' + weak)
      user.password = body.newPassword // hashed by the beforeUpdate hook
    }

    if (typeof body.displayName === 'string') {
      const name = cleanName(body.displayName)
      if (!name) return jsonError(res, 400, '顯示名稱不能是空的')
      if (name.length > MAX_NAME_LENGTH) return jsonError(res, 400, `顯示名稱最多 ${MAX_NAME_LENGTH} 個字`)
      if (isEmailAccount) {
        user.profile = JSON.stringify({ provider: 'email', displayName: name, username: name, emails: email ? [email] : [] })
      } else {
        // Google/GitHub/...: keep the provider data; the provider may overwrite it at the next login
        user.profile = JSON.stringify(Object.assign({}, stored, { displayName: name }))
      }
    } else if (wantsEmail && isEmailAccount && stored) {
      user.profile = JSON.stringify(Object.assign({}, stored, { emails: [email] }))
    }

    await user.save()
    logger.info(`profile: user ${user.id} updated ${[
      typeof body.displayName === 'string' && 'name', wantsEmail && 'email', wantsPassword && 'password'
    ].filter(Boolean).join(', ') || 'nothing'}`)
    res.json(await describe(user))
  } catch (err) {
    logger.error('profile: update failed: ' + err)
    jsonError(res, 500, '儲存失敗')
  }
})

// Public profile page (like HackMD's): avatar, name and the user's notes that
// guests can read. Only what is public anyway: no e-mail, no private notes.
const PROFILE_NOTES_LIMIT = 60
profileRouter.get('/u/:userid', async function (req, res) {
  if (!validator.isUUID(req.params.userid)) return errors.errorNotFound(res)
  try {
    const user = await models.User.findOne({ where: { id: req.params.userid } })
    if (!user) return errors.errorNotFound(res)
    const profile = models.User.getProfile(user)
    if (!profile) return errors.errorNotFound(res)
    const notes = await recentPublicNotes(PROFILE_NOTES_LIMIT, user.id)
    res.set('X-Robots-Tag', 'noindex, nofollow')
    res.render('user.ejs', {
      profileName: profile.name,
      profilePhoto: profile.biggerphoto || profile.photo,
      notes,
      isSelf: !!(req.isAuthenticated() && req.user.id === user.id),
      signin: req.isAuthenticated()
    })
  } catch (err) {
    logger.error('public profile: ' + err)
    return errors.errorInternalError(res)
  }
})
