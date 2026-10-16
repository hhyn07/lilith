'use strict'
// Lilith: stand-alone sign-in page (modelled on HackMD's).

const fs = require('fs')
const path = require('path')
const Router = require('express').Router

const config = require('../config')
const accountRules = require('./accountRules')

const loginRouter = module.exports = Router()

// OAuth-style providers shown as buttons, in HackMD's order
function oauthProviders () {
  return [
    { id: 'google', name: 'Google', icon: 'fa-google', enabled: config.isGoogleEnable },
    { id: 'facebook', name: 'Facebook', icon: 'fa-facebook', enabled: config.isFacebookEnable },
    { id: 'twitter', name: 'X (Twitter)', icon: 'fa-twitter', enabled: config.isTwitterEnable },
    { id: 'github', name: 'GitHub', icon: 'fa-github', enabled: config.isGitHubEnable },
    { id: 'gitlab', name: 'GitLab', icon: 'fa-gitlab', enabled: config.isGitLabEnable },
    { id: 'dropbox', name: 'Dropbox', icon: 'fa-dropbox', enabled: config.isDropboxEnable },
    { id: 'mattermost', name: 'Mattermost', icon: 'fa-comments', enabled: config.isMattermostEnable },
    { id: 'saml', name: config.saml.providerName || 'SAML', icon: 'fa-users', enabled: config.isSAMLEnable },
    { id: 'oauth2', name: config.oauth2.providerName || 'OAuth2', icon: 'fa-sign-in', enabled: config.isOAuth2Enable }
  ].filter((p) => p.enabled)
}

loginRouter.get('/login', function (req, res) {
  if (req.isAuthenticated()) return res.redirect(config.serverURL + '/')
  res.render('login.ejs', {
    infoMessage: req.flash('info'),
    errorMessage: req.flash('error'),
    oauthProviders: oauthProviders(),
    // LDAP / OpenID need their own forms; they stay in the sign-in dialog on the home page
    otherMethods: !!(config.isLDAPEnable || config.isOpenIDEnable)
  })
})

// Lilith: stand-alone sign-up page (modelled on HackMD's)
loginRouter.get('/register', function (req, res) {
  if (req.isAuthenticated()) return res.redirect(config.serverURL + '/')
  if (!config.isEmailEnable || !config.allowEmailRegister) {
    req.flash('info', '目前沒有開放註冊。')
    return res.redirect(config.serverURL + '/login')
  }
  res.render('register.ejs', {
    errorMessage: req.flash('error'),
    // values sent back after a mistake, so they need not be typed again
    username: req.flash('registerUsername')[0] || '',
    email: req.flash('registerEmail')[0] || '',
    oauthProviders: oauthProviders(),
    rules: accountRules,
    termsOfUse: fs.existsSync(path.join(config.docsPath, 'terms-of-use.md'))
  })
})
