'use strict'
// Lilith: the signed-in user's own pages, like HackMD's
//   /trash      notes moved to the trash (feature 23): restore or delete for good
//   /activity   what happened to my notes, newest first (feature 24)
// Both render public/views/mypage.ejs; the buttons call lib/web/noteListRouter.js.

const Router = require('express').Router
const moment = require('moment')

const config = require('../config')
const errors = require('../errors')
const logger = require('../logger')
const models = require('../models')

const myPagesRouter = module.exports = Router()
const ACTIVITY_LIMIT = 100

function requireLogin (req, res, next) {
  if (!req.isAuthenticated()) return res.redirect(config.serverURL + '/login')
  next()
}

function listId (note) {
  return note.alias || models.Note.encodeNoteId(note.id)
}

function profileOf (user) {
  const p = user ? models.User.getProfile(user) : null
  return p ? { name: p.name || '', photo: p.photo || '' } : null
}

function render (req, res, view) {
  const me = profileOf(req.user)
  res.set({ 'Cache-Control': 'private' })
  res.render('mypage.ejs', Object.assign({ me: me || { name: '', photo: '' } }, view))
}

myPagesRouter.get('/trash', requireLogin, function (req, res) {
  // the list itself comes from /api/lilith/trash (it also clears out old notes)
  render(req, res, { page: 'trash', title: '垃圾桶' })
})

// what happened to my notes: I created / edited / trashed them, or someone else edited
// one of mine. Built from the notes table (no separate log): each note shows its
// latest change, so earlier edits of the same note are not listed.
myPagesRouter.get('/activity', requireLogin, async function (req, res) {
  try {
    const uid = req.user.id
    const attributes = ['id', 'alias', 'shortid', 'title', 'ownerId', 'lastchangeuserId', 'lastchangeAt', 'createdAt', 'deletedAt']
    const [edited, mine] = await Promise.all([
      models.Note.findAll({ where: { lastchangeuserId: uid }, attributes, order: [['lastchangeAt', 'DESC']], limit: ACTIVITY_LIMIT, paranoid: false }),
      models.Note.findAll({
        where: { ownerId: uid },
        attributes,
        include: [{ model: models.User, as: 'lastchangeuser' }],
        order: [['createdAt', 'DESC']],
        limit: ACTIVITY_LIMIT,
        paranoid: false
      })
    ])
    const events = []
    function add (note, type, time, who) {
      if (!time) return
      events.push({
        type,
        time: new Date(time),
        title: models.Note.decodeTitle(note.title),
        href: note.deletedAt ? config.serverURL + '/trash' : config.serverURL + '/' + listId(note),
        trashed: !!note.deletedAt,
        who
      })
    }
    edited.forEach(n => add(n, 'edited', n.lastchangeAt))
    mine.forEach(n => {
      add(n, 'created', n.createdAt)
      if (n.deletedAt) add(n, 'trashed', n.deletedAt)
      if (n.lastchangeuserId && n.lastchangeuserId !== uid) add(n, 'edited-by', n.lastchangeAt, profileOf(n.lastchangeuser))
    })
    events.sort((a, b) => b.time - a.time)
    // day headings (今天 / 昨天 / date) and clock times, in the server's time zone
    const today = moment().startOf('day')
    const list = events.slice(0, ACTIVITY_LIMIT).map(e => {
      const t = moment(e.time)
      const days = today.diff(t.clone().startOf('day'), 'days')
      return Object.assign(e, {
        day: days === 0 ? '今天' : days === 1 ? '昨天' : t.format('YYYY年M月D日'),
        clock: t.format('HH:mm'),
        iso: t.toISOString()
      })
    })
    render(req, res, { page: 'activity', title: '我的活動', events: list })
  } catch (err) {
    logger.error('activity: ' + err)
    errors.errorInternalError(res)
  }
})
