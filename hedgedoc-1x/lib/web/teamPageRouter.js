'use strict'
// Lilith (feature 27): a team's public page like HackMD's, and what goes with it
//   GET  /t/:id                                the page: profile, members, contributors,
//                                              pinned and all public notes of the team
//   POST /api/lilith/teams/:id/profile         bio, public e-mail, links, picture (managers;
//                                              only the fields that are sent)
//   POST /api/lilith/teams/:id/handle          { handle } the team's address (managers, 28)
//   POST /api/lilith/teams/:id/privacy         { privacy: open | closed } (managers, 28)
//   POST /api/lilith/teams/:id/pins            { notes: [listId] } at most 3 (managers)
//   POST /api/lilith/teams/:id/follow          { follow } (signed in)
//   GET  /api/lilith/notes/:noteId/like        { liked, count }
//   POST /api/lilith/notes/:noteId/like        { like } (signed in, readable notes)
// Public notes = the team's notes guests can read (freely / editable / locked).

const Router = require('express').Router
const bodyParser = require('body-parser')
const validator = require('validator')
const Sequelize = require('sequelize')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

const config = require('../config')
const errors = require('../errors')
const logger = require('../logger')
const models = require('../models')
const teams = require('../teams')
const noteUtil = require('./note/util')
const { GUEST_READABLE, summarize } = require('../publicNotes')

const teamPageRouter = module.exports = Router()
const Op = Sequelize.Op

const MAX_PINS = 3
const MAX_LINKS = 5
const MAX_BIO = 300

const jsonParser = bodyParser.json({ limit: '8kb' })
const writeLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 200,
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
      logger.error('team page: ' + req.method + ' ' + req.path + ': ' + err)
      if (res.headersSent) return
      if (req.path.startsWith('/api/')) jsonError(res, 500, '處理失敗')
      else errors.errorInternalError(res)
    })
  }
}

function profileOf (user) {
  const p = user ? models.User.getProfile(user) : null
  return { name: (p && p.name) || '', photo: (p && p.photo) || '' }
}
// http(s) only: the picture and the links go into src / href
function safeUrl (value) {
  if (typeof value !== 'string') return ''
  const v = value.trim()
  return v.length <= 500 && validator.isURL(v, { protocols: ['http', 'https'], require_protocol: true }) ? v : ''
}
function clean (value, max) {
  // eslint-disable-next-line no-control-regex
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max) : ''
}

// a team's address (feature 28): 2-39 characters, a-z 0-9 and "-", not "-" first
const HANDLE = /^[a-z0-9][a-z0-9-]{1,38}$/
function pageUrl (team) {
  return config.serverURL + '/t/' + encodeURIComponent(team.handle || team.id)
}
// the team, for its managers (otherwise an error is sent and null returned)
async function managedTeam (req, res) {
  const id = req.params.id
  if (!validator.isUUID(id || '')) { jsonError(res, 404, '找不到這個團隊'); return null }
  const role = teams.roleIn(id, req.user.id)
  if (!role) { jsonError(res, 404, '找不到這個團隊'); return null }
  if (!teams.isManager(role)) { jsonError(res, 403, '只有團隊的擁有者或管理者可以修改團隊設定'); return null }
  const team = await models.LilithTeam.findOne({ where: { id } })
  if (!team) { jsonError(res, 404, '找不到這個團隊'); return null }
  return team
}

async function findNote (ref) {
  if (typeof ref !== 'string' || !ref || ref.length > 200) return null
  const id = await new Promise((resolve) => models.Note.parseNoteId(ref, (err, id) => resolve(err ? null : id)))
  return id ? models.Note.findOne({ where: { id } }) : null
}

// ---- the page ----
teamPageRouter.get('/t/:id', handle(async (req, res) => {
  // /t/<team id> or /t/<handle> (feature 28); the id address moves to the handle
  const key = req.params.id || ''
  const byId = validator.isUUID(key)
  if (!byId && !HANDLE.test(key)) return errors.errorNotFound(res)
  const team = await models.LilithTeam.findOne({ where: byId ? { id: key } : { handle: key } })
  if (!team) return errors.errorNotFound(res)
  if (byId && team.handle) return res.redirect(pageUrl(team))
  const me = req.isAuthenticated() ? req.user.id : null
  const role = me ? teams.roleIn(team.id, me) : null
  // a closed team's page: members only (others: as if there were none)
  if (team.privacy === 'closed' && !role) return errors.errorNotFound(res)

  const ids = teams.notesOf(team.id)
  const notes = ids.length
    ? await models.Note.findAll({
      where: { id: ids, permission: { [Op.in]: GUEST_READABLE } },
      attributes: ['id', 'shortid', 'alias', 'title', 'content', 'viewcount', 'lastchangeAt', 'updatedAt']
    })
    : []
  const noteIds = notes.map(n => n.id)
  const memberList = teams.membersOf(team.id)
  const [authors, likes, myLikes, myStars, followers, following] = await Promise.all([
    noteIds.length ? models.Author.findAll({ where: { noteId: noteIds }, attributes: ['noteId', 'userId'] }) : [],
    noteIds.length ? models.LilithLike.findAll({ where: { noteId: noteIds }, attributes: ['noteId'] }) : [],
    me && noteIds.length ? models.LilithLike.findAll({ where: { userId: me, noteId: noteIds }, attributes: ['noteId'] }) : [],
    me && noteIds.length ? models.LilithNoteMeta.findAll({ where: { userId: me, noteId: noteIds, starred: true }, attributes: ['noteId'] }) : [],
    models.LilithFollow.count({ where: { teamId: team.id } }),
    me ? models.LilithFollow.count({ where: { teamId: team.id, userId: me } }) : 0
  ])
  const userIds = Array.from(new Set(memberList.map(m => m.userId).concat(authors.map(a => a.userId).filter(Boolean))))
  const users = userIds.length ? await models.User.findAll({ where: { id: userIds } }) : []
  const person = (uid) => Object.assign({ id: uid }, profileOf(users.find(u => u.id === uid)))
  const memberIds = new Set(memberList.map(m => m.userId))
  const order = { owner: 0, admin: 1, member: 2 }

  const cards = notes.map(n => {
    let s = { excerpt: '', book: false }
    try { s = summarize(n.content) } catch (e) {}
    const by = Array.from(new Set(authors.filter(a => a.noteId === n.id && a.userId).map(a => a.userId)))
    const changed = n.lastchangeAt || n.updatedAt
    const ref = n.alias || n.shortid
    return {
      id: n.id,
      ref: models.Note.encodeNoteId(n.id),
      title: models.Note.decodeTitle(n.title),
      excerpt: s.excerpt,
      href: config.serverURL + (s.book ? '/b/' : '/s/') + encodeURIComponent(ref),
      book: !!s.book,
      time: new Date(changed).toISOString(),
      views: n.viewcount || 0,
      likes: likes.filter(l => l.noteId === n.id).length,
      liked: myLikes.some(l => l.noteId === n.id),
      starred: myStars.some(l => l.noteId === n.id),
      people: by.slice(0, 5).map(person)
    }
  }).sort((a, b) => b.time.localeCompare(a.time))
  const pinned = (team.pinned || []).map(pid => cards.find(c => c.id === pid)).filter(Boolean).slice(0, MAX_PINS)

  res.set({ 'Cache-Control': 'private' })
  res.render('team-page.ejs', {
    team: {
      id: team.id,
      handle: team.handle || '',
      page: pageUrl(team),
      name: team.name,
      initial: Array.from(team.name)[0] || '#',
      bio: team.bio || '',
      email: team.email || '',
      photo: safeUrl(team.photo),
      links: (team.links || []).filter(l => l && safeUrl(l.url)).slice(0, MAX_LINKS)
    },
    members: memberList.map(m => Object.assign({ role: m.role }, person(m.userId)))
      .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name)),
    contributors: Array.from(new Set(authors.map(a => a.userId).filter(uid => uid && !memberIds.has(uid)))).map(person),
    notes: cards,
    pinned,
    followers,
    following: following > 0,
    signin: !!me,
    isMember: !!role,
    isManager: !!(role && teams.isManager(role)),
    // data for catppuccin.js (team page): ids only, escaped for the script tag
    pageData: JSON.stringify({ team: team.id, pinned: pinned.map(p => p.ref), notes: cards.map(c => ({ ref: c.ref, title: c.title })) }).replace(/</g, '\\u003c')
  })
}))

// ---- team profile (managers) ----
teamPageRouter.post('/api/lilith/teams/:id/profile', write, handle(async (req, res) => {
  const id = req.params.id
  if (!validator.isUUID(id || '')) return jsonError(res, 404, '找不到這個團隊')
  const role = teams.roleIn(id, req.user.id)
  if (!role) return jsonError(res, 404, '找不到這個團隊')
  if (!teams.isManager(role)) return jsonError(res, 403, '只有團隊的擁有者或管理者可以修改團隊資料')
  const team = await models.LilithTeam.findOne({ where: { id } })
  if (!team) return jsonError(res, 404, '找不到這個團隊')
  const b = req.body || {}
  const change = {}
  // only the fields that are sent (the general settings and the social section save apart)
  if ('email' in b) {
    change.email = clean(b.email, 200)
    if (change.email && !validator.isEmail(change.email)) return jsonError(res, 400, 'Email 格式不正確')
  }
  if ('photo' in b) {
    change.photo = clean(b.photo, 500)
    if (change.photo && !safeUrl(change.photo)) return jsonError(res, 400, '頭像要是 http:// 或 https:// 開頭的圖片網址')
  }
  if ('bio' in b) change.bio = clean(b.bio, MAX_BIO)
  if ('links' in b) {
    const links = []
    for (const l of Array.isArray(b.links) ? b.links.slice(0, MAX_LINKS) : []) {
      const url = clean(l && l.url, 500)
      const label = clean(l && l.label, 40)
      if (!url && !label) continue
      if (!safeUrl(url)) return jsonError(res, 400, '連結要是 http:// 或 https:// 開頭的網址')
      links.push({ label: label || url, url })
    }
    change.links = links
  }
  await team.update(change)
  res.json({ ok: true, bio: team.bio, email: team.email, photo: team.photo, links: team.links })
}))

// ---- the team's address (feature 28) ----
teamPageRouter.post('/api/lilith/teams/:id/handle', write, handle(async (req, res) => {
  const team = await managedTeam(req, res)
  if (!team) return
  const value = typeof req.body.handle === 'string' ? req.body.handle.trim().toLowerCase() : null
  if (value === null) return jsonError(res, 400, '團隊網址不正確')
  if (value && !HANDLE.test(value)) return jsonError(res, 400, '團隊網址只能用 a-z、0-9 和「-」（2～39 個字，「-」不能在第一個字）')
  if (value && await models.LilithTeam.count({ where: { handle: value, id: { [Op.ne]: team.id } } })) return jsonError(res, 409, '這個團隊網址已經有人用了')
  try {
    await team.update({ handle: value || null })
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return jsonError(res, 409, '這個團隊網址已經有人用了')
    throw err
  }
  res.json({ ok: true, handle: team.handle || '', page: pageUrl(team) })
}))

// ---- who sees the public page (feature 28) ----
teamPageRouter.post('/api/lilith/teams/:id/privacy', write, handle(async (req, res) => {
  const team = await managedTeam(req, res)
  if (!team) return
  if (!['open', 'closed'].includes(req.body.privacy)) return jsonError(res, 400, '團隊隱私性不正確')
  await team.update({ privacy: req.body.privacy })
  res.json({ ok: true, privacy: team.privacy })
}))

// ---- pinned notes (managers): public notes of the team, at most 3 ----
teamPageRouter.post('/api/lilith/teams/:id/pins', write, handle(async (req, res) => {
  const id = req.params.id
  if (!validator.isUUID(id || '')) return jsonError(res, 404, '找不到這個團隊')
  const role = teams.roleIn(id, req.user.id)
  if (!role) return jsonError(res, 404, '找不到這個團隊')
  if (!teams.isManager(role)) return jsonError(res, 403, '只有團隊的擁有者或管理者可以釘選筆記')
  const refs = Array.isArray(req.body.notes) ? req.body.notes : null
  if (!refs || refs.length > MAX_PINS) return jsonError(res, 400, '最多釘選 ' + MAX_PINS + ' 篇')
  const pins = []
  for (const ref of refs) {
    const note = await findNote(ref)
    if (!note || teams.teamOfNote(note.id) !== id || !GUEST_READABLE.includes(note.permission)) return jsonError(res, 400, '只能釘選這個團隊的公開筆記')
    if (!pins.includes(note.id)) pins.push(note.id)
  }
  const team = await models.LilithTeam.findOne({ where: { id } })
  if (!team) return jsonError(res, 404, '找不到這個團隊')
  await team.update({ pinned: pins })
  res.json({ ok: true, count: pins.length })
}))

// ---- follow a team (anyone signed in; the page is public) ----
teamPageRouter.post('/api/lilith/teams/:id/follow', write, handle(async (req, res) => {
  const id = req.params.id
  if (!validator.isUUID(id || '')) return jsonError(res, 404, '找不到這個團隊')
  const team = await models.LilithTeam.findOne({ where: { id }, attributes: ['id'] })
  if (!team) return jsonError(res, 404, '找不到這個團隊')
  if (typeof req.body.follow !== 'boolean') return jsonError(res, 400, '追蹤設定不正確')
  if (req.body.follow) await models.LilithFollow.findOrCreate({ where: { userId: req.user.id, teamId: id } })
  else await models.LilithFollow.destroy({ where: { userId: req.user.id, teamId: id } })
  res.json({ ok: true, following: req.body.follow, followers: await models.LilithFollow.count({ where: { teamId: id } }) })
}))

// ---- like a note ----
async function likeState (noteId, userId) {
  const [count, mine] = await Promise.all([
    models.LilithLike.count({ where: { noteId } }),
    userId ? models.LilithLike.count({ where: { noteId, userId } }) : 0
  ])
  return { liked: mine > 0, count }
}
teamPageRouter.get('/api/lilith/notes/:noteId/like', handle(async (req, res) => {
  const note = await findNote(req.params.noteId)
  if (!note || !noteUtil.checkViewPermission(req, note)) return jsonError(res, 404, '找不到這篇筆記')
  res.set({ 'Cache-Control': 'private, no-store' })
  res.json(Object.assign({ signin: req.isAuthenticated() }, await likeState(note.id, req.isAuthenticated() ? req.user.id : null)))
}))
teamPageRouter.post('/api/lilith/notes/:noteId/like', write, handle(async (req, res) => {
  if (typeof req.body.like !== 'boolean') return jsonError(res, 400, '喜歡設定不正確')
  const note = await findNote(req.params.noteId)
  if (!note || !noteUtil.checkViewPermission(req, note)) return jsonError(res, 404, '找不到這篇筆記')
  if (req.body.like) await models.LilithLike.findOrCreate({ where: { userId: req.user.id, noteId: note.id } })
  else await models.LilithLike.destroy({ where: { userId: req.user.id, noteId: note.id } })
  res.json(Object.assign({ ok: true }, await likeState(note.id, req.user.id)))
}))
