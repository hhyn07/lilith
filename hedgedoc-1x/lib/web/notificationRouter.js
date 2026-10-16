'use strict'
// Lilith (feature 26): the notification panel's API (signed in; JSON writes)
//   GET    /api/lilith/notifications?kind=change|team&unread=1   list (newest first)
//   GET    /api/lilith/notifications/count                       unread per kind
//   POST   /api/lilith/notifications/read      { kind }          mark all of a kind as read
//   POST   /api/lilith/notifications/:id       { read }          mark one read / unread
//   DELETE /api/lilith/notifications/:id                         remove one

const Router = require('express').Router
const bodyParser = require('body-parser')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

const errors = require('../errors')
const logger = require('../logger')
const models = require('../models')
const notify = require('../notify')

const notificationRouter = module.exports = Router()
const jsonParser = bodyParser.json({ limit: '4kb' })
const writeLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  keyGenerator: (req) => req.user ? req.user.id : ipKeyGenerator(req.ip),
  handler: (req, res) => errors.errorTooManyRequests(res)
})

function jsonError (res, status, message) {
  return res.status(status).json({ error: message })
}
function requireLogin (req, res, next) {
  if (!req.isAuthenticated()) return jsonError(res, 401, '請先登入')
  next()
}
function requireJson (req, res, next) {
  if (!req.is('application/json')) return jsonError(res, 415, '需要 JSON')
  next()
}
const write = [requireLogin, writeLimit, requireJson, jsonParser]
function handle (fn) {
  return function (req, res) {
    fn(req, res).catch((err) => {
      logger.error('notifications: ' + req.method + ' ' + req.path + ': ' + err)
      if (!res.headersSent) jsonError(res, 500, '處理失敗')
    })
  }
}
const KINDS = ['change', 'team']

notificationRouter.get('/api/lilith/notifications/count', requireLogin, handle(async (req, res) => {
  res.set({ 'Cache-Control': 'private, no-store' })
  res.json(await notify.unreadCounts(req.user.id))
}))

notificationRouter.get('/api/lilith/notifications', requireLogin, handle(async (req, res) => {
  const kind = KINDS.includes(req.query.kind) ? req.query.kind : 'change'
  const [items, unread] = await Promise.all([notify.list(req.user.id, kind, req.query.unread === '1'), notify.unreadCounts(req.user.id)])
  res.set({ 'Cache-Control': 'private, no-store' })
  res.json({ kind, unread, items })
}))

// (before /:id, or "read" would be taken for an id)
notificationRouter.post('/api/lilith/notifications/read', write, handle(async (req, res) => {
  const kind = KINDS.includes(req.body.kind) ? req.body.kind : null
  if (!kind) return jsonError(res, 400, '通知種類不正確')
  await models.LilithNotification.update({ readAt: new Date() }, { where: { userId: req.user.id, kind, readAt: null }, silent: true })
  res.json({ ok: true })
}))

async function mine (req, res) {
  const id = Number(req.params.id)
  const row = Number.isInteger(id) && id > 0 ? await models.LilithNotification.findOne({ where: { id, userId: req.user.id } }) : null
  if (!row) jsonError(res, 404, '找不到這則通知')
  return row
}

notificationRouter.post('/api/lilith/notifications/:id', write, handle(async (req, res) => {
  const row = await mine(req, res)
  if (!row) return
  // silent: reading does not move it to the top
  await row.update({ readAt: req.body.read === false ? null : new Date() }, { silent: true })
  res.json({ ok: true, read: !!row.readAt })
}))

notificationRouter.delete('/api/lilith/notifications/:id', write, handle(async (req, res) => {
  const row = await mine(req, res)
  if (!row) return
  await row.destroy()
  res.json({ ok: true })
}))
