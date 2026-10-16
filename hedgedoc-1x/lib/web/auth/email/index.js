'use strict'

const Router = require('express').Router
const passport = require('passport')
const validator = require('validator')
const LocalStrategy = require('passport-local').Strategy
const config = require('../../../config')
const models = require('../../../models')
const logger = require('../../../logger')
const { urlencodedParser } = require('../../utils')
const errors = require('../../../errors')
const rateLimit = require('../../middleware/rateLimit')
const { checkUsername, checkPassword } = require('../../accountRules')

const emailAuth = module.exports = Router()

passport.use(new LocalStrategy({
  usernameField: 'email'
}, function (email, password, done) {
  if (!validator.isEmail(email)) return done(null, false)
  models.User.findOne({
    where: {
      email
    }
  }).then(function (user) {
    if (!user) return done(null, false)
    user.verifyPassword(password).then(verified => {
      if (verified) {
        return done(null, user)
      } else {
        logger.warn('invalid password given for %s', user.email)
        return done(null, false)
      }
    })
  }).catch(function (err) {
    logger.error(err)
    return done(err)
  })
}))

if (config.allowEmailRegister) {
  // Lilith: form on the stand-alone /register page. Mistakes go back to that
  // page with a message (and the name / e-mail filled in again); a new
  // account is signed in right away.
  emailAuth.post('/register', rateLimit.userEndpoints, urlencodedParser, async function (req, res, next) {
    const body = req.body || {}
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    const fail = function (message) {
      req.flash('error', message)
      req.flash('registerUsername', username)
      req.flash('registerEmail', email)
      return res.redirect(config.serverURL + '/register')
    }
    const problem = checkUsername(username) ||
      (!validator.isEmail(email) && 'Email 格式不正確') ||
      checkPassword(password) ||
      (body.password_confirm !== password && '兩次輸入的密碼不一致')
    if (problem) return fail(problem)

    try {
      const [user, created] = await models.User.findOrCreate({
        where: { email },
        defaults: {
          password,
          // same shape as a name set in "edit profile" (lib/web/profileRouter.js)
          profile: JSON.stringify({ provider: 'email', displayName: username, username, emails: [email] })
        }
      })
      if (!created) return fail('這個 Email 已經註冊過了，請直接登入。')
      logger.debug('user registered: ' + user.id)
      req.login(user, function (err) {
        if (err) return next(err)
        return res.redirect(config.serverURL + '/')
      })
    } catch (err) {
      logger.error('register failed: ' + err)
      return errors.errorInternalError(res)
    }
  })
}

emailAuth.post('/login', rateLimit.userEndpoints, urlencodedParser, function (req, res, next) {
  if (!req.body.email || !req.body.password) return errors.errorBadRequest(res)
  if (!validator.isEmail(req.body.email)) return errors.errorBadRequest(res)
  passport.authenticate('local', {
    successReturnToOrRedirect: config.serverURL + '/',
    // Lilith: back to the sign-in page, with a message in Chinese
    failureRedirect: config.serverURL + '/login',
    failureFlash: 'E-Mail 或密碼錯誤。'
  })(req, res, next)
})
