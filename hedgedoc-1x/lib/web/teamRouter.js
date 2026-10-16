'use strict'
// Lilith (feature 24): team workspaces like HackMD's.
// API (signed in, JSON writes, rate limited):
//   GET    /api/lilith/teams                       my teams
//   POST   /api/lilith/teams                       { name } -> new team, I am its owner
//   GET    /api/lilith/teams/:id                   name, members, invite link (managers)
//   POST   /api/lilith/teams/:id                   { name } rename (managers)
//   DELETE /api/lilith/teams/:id                   delete the team (owner); its notes go
//                                                  back to their creators, nothing is deleted
//   POST   /api/lilith/teams/:id/members           { who: email or name, role } add (managers)
//   POST   /api/lilith/teams/:id/members/:userId   { role } (managers)
//   DELETE /api/lilith/teams/:id/members/:userId   remove (managers) or leave (myself)
//   POST   /api/lilith/teams/:id/invite            new invite link, 7 days (managers)
//   DELETE /api/lilith/teams/:id/invite            turn the invite link off (managers)
//   GET    /api/lilith/teams/:id/notes             the team's notes (members)
//   POST   /api/lilith/teams/:id/notes             new note in the team (members)
//   POST   /api/lilith/notes/:noteId/team          { teamId | null } move a note in / out
//   GET    /api/lilith/teams/:id/trash             the team trash (managers)
//   POST   /api/lilith/teams/:id/trash/:noteId/restore, DELETE .../trash/:noteId (managers)
// Pages:
//   /team/:id/settings   settings (general, members) -- public/views/team.ejs
//   /team/join/:token    join with an invite link

const crypto = require('crypto')
const Router = require('express').Router
const bodyParser = require('body-parser')
const Sequelize = require('sequelize')
const validator = require('validator')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

const book = require('../book')
const config = require('../config')
const errors = require('../errors')
const logger = require('../logger')
const models = require('../models')
const teams = require('../teams')
const noteUtil = require('./note/util')
const noteListRouter = require('./noteListRouter')
const notify = require('../notify')

const teamRouter = module.exports = Router()
const Op = Sequelize.Op

const MAX_TEAMS = 50
const MAX_MEMBERS = 200
const MAX_NAME = 40
const INVITE_DAYS = 7
const ROLE_NAMES = { owner: '擁有者', admin: '管理者', member: '成員' }

const jsonParser = bodyParser.json({ limit: '8kb' })
const writeLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
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
      logger.error('teams: ' + req.method + ' ' + req.path + ': ' + err)
      if (!res.headersSent) jsonError(res, 500, '處理失敗')
    })
  }
}

function cleanName (name) {
  // eslint-disable-next-line no-control-regex
  return typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : ''
}

function listId (note) {
  return note.alias || models.Note.encodeNoteId(note.id)
}

function profileOf (user) {
  const p = user ? models.User.getProfile(user) : null
  return { name: (p && p.name) || '', photo: (p && p.photo) || '' }
}

// the team, if the user is in it (and, with `manager`, an owner / admin of it)
async function teamFor (req, res, manager) {
  const id = req.params.id
  if (!validator.isUUID(id || '')) { jsonError(res, 404, '找不到這個團隊'); return null }
  const role = teams.roleIn(id, req.user.id)
  if (!role) { jsonError(res, 404, '找不到這個團隊'); return null }
  if (manager && !teams.isManager(role)) { jsonError(res, 403, '只有團隊的擁有者或管理者可以這樣做'); return null }
  const team = await models.LilithTeam.findOne({ where: { id } })
  if (!team) { jsonError(res, 404, '找不到這個團隊'); return null }
  return { team, role }
}

function inviteUrl (team) {
  return team.inviteToken ? config.serverURL + '/team/join/' + team.inviteToken : null
}
function inviteActive (team) {
  return !!(team.inviteToken && team.inviteExpiresAt && new Date(team.inviteExpiresAt) > new Date())
}

// ---- teams ----
teamRouter.get('/api/lilith/teams', requireLogin, handle(async (req, res) => {
  const mine = teams.teamsOf(req.user.id)
  const rows = mine.length ? await models.LilithTeam.findAll({ where: { id: mine.map(m => m.teamId) }, order: [['name', 'ASC']] }) : []
  res.json({
    teams: rows.map(t => ({
      id: t.id,
      name: t.name,
      // feature 28: for the workspace menu
      handle: t.handle || '',
      photo: /^https?:\/\//i.test(t.photo || '') ? t.photo : '',
      role: teams.roleIn(t.id, req.user.id),
      members: teams.membersOf(t.id).length,
      notes: teams.notesOf(t.id).length
    }))
  })
}))

teamRouter.post('/api/lilith/teams', write, handle(async (req, res) => {
  const name = cleanName(req.body.name)
  if (!name) return jsonError(res, 400, '團隊名稱不能是空的')
  if (teams.teamsOf(req.user.id).filter(t => t.role === 'owner').length >= MAX_TEAMS) return jsonError(res, 400, '最多建立 ' + MAX_TEAMS + ' 個團隊')
  const team = await models.LilithTeam.create({ name })
  await teams.setMember(team.id, req.user.id, 'owner')
  logger.info('teams: team ' + team.id + ' created')
  res.json({ ok: true, team: { id: team.id, name: team.name, role: 'owner' } })
}))

// (before the /:id routes, or "join" would be taken for a team id)
teamRouter.post('/api/lilith/teams/join', write, handle(async (req, res) => {
  const team = await inviteTeam(req.body.token)
  if (!team) return jsonError(res, 404, '這個邀請連結已經失效或不存在')
  if (!teams.roleIn(team.id, req.user.id)) {
    if (teams.membersOf(team.id).length >= MAX_MEMBERS) return jsonError(res, 400, '團隊成員已滿')
    await teams.setMember(team.id, req.user.id, 'member')
    notify.teamEvent(teams.membersOf(team.id).filter(m => teams.isManager(m.role)).map(m => m.userId), req.user.id, team.id, team.name, '透過邀請連結加入了團隊')
    logger.info('teams: user joined team ' + team.id + ' with an invite link')
  }
  res.json({ ok: true, url: config.serverURL + '/?team=' + encodeURIComponent(team.id) })
}))

teamRouter.get('/api/lilith/teams/:id', requireLogin, handle(async (req, res) => {
  const t = await teamFor(req, res, false)
  if (!t) return
  const list = teams.membersOf(t.team.id)
  const users = list.length ? await models.User.findAll({ where: { id: list.map(m => m.userId) } }) : []
  const manager = teams.isManager(t.role)
  const order = { owner: 0, admin: 1, member: 2 }
  res.json({
    id: t.team.id,
    name: t.team.name,
    role: t.role,
    me: req.user.id,
    notes: teams.notesOf(t.team.id).length,
    members: list.map(m => {
      const u = users.find(x => x.id === m.userId)
      // (review fix) no e-mail addresses: anyone can make a team and add a person by name,
      // which would show that person's sign-in address to them
      return Object.assign({ userId: m.userId, role: m.role, roleName: ROLE_NAMES[m.role] }, profileOf(u))
    }).sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name)),
    invite: manager ? { url: inviteActive(t.team) ? inviteUrl(t.team) : null, expiresAt: inviteActive(t.team) ? t.team.inviteExpiresAt : null } : null,
    // feature 27: the public page's profile
    profile: { bio: t.team.bio || '', email: t.team.email || '', photo: t.team.photo || '', links: t.team.links || [] },
    // feature 28
    handle: t.team.handle || '',
    privacy: t.team.privacy || 'open',
    page: config.serverURL + '/t/' + encodeURIComponent(t.team.handle || t.team.id)
  })
}))

teamRouter.post('/api/lilith/teams/:id', write, handle(async (req, res) => {
  const t = await teamFor(req, res, true)
  if (!t) return
  const name = cleanName(req.body.name)
  if (!name) return jsonError(res, 400, '團隊名稱不能是空的')
  await t.team.update({ name })
  res.json({ ok: true, name })
}))

teamRouter.delete('/api/lilith/teams/:id', write, handle(async (req, res) => {
  const t = await teamFor(req, res, true)
  if (!t) return
  if (t.role !== 'owner') return jsonError(res, 403, '只有團隊擁有者可以刪除團隊')
  const everyone = teams.membersOf(t.team.id).map(m => m.userId)
  await teams.dropTeam(t.team.id)
  require('../realtime').recheckAccess() // (review fix) open editors of former members close
  notify.teamEvent(everyone, req.user.id, t.team.id, t.team.name, '刪除了團隊（團隊筆記已回到各自建立者的空間）')
  logger.info('teams: team ' + t.team.id + ' deleted by its owner')
  res.json({ ok: true })
}))

// ---- members ----
// find an account by e-mail, or by its display name when exactly one account has it
async function findUser (who) {
  const q = typeof who === 'string' ? who.trim() : ''
  if (!q || q.length > 254) return { error: '請輸入使用者名稱或 Email' }
  if (validator.isEmail(q)) {
    const u = await models.User.findOne({ where: { email: q.toLowerCase() } }) || await models.User.findOne({ where: { email: q } })
    return u ? { user: u } : { error: '找不到這個 Email 的帳號（對方要先註冊 Lilith）' }
  }
  // display names live in the profile JSON, or (no profile) are the part of the e-mail
  // before the @; narrow down with LIKE, then compare the real display name
  const safe = q.replace(/[%_\\]/g, '')
  const candidates = await models.User.findAll({
    where: { [Op.or]: [{ profile: { [Op.like]: '%' + safe + '%' } }, { email: { [Op.like]: safe + '@%' } }] },
    limit: 20
  })
  const exact = candidates.filter(u => (profileOf(u).name || '').toLowerCase() === q.toLowerCase())
  if (exact.length === 1) return { user: exact[0] }
  if (exact.length > 1) return { error: '有好幾個帳號叫這個名字，請改用 Email' }
  return { error: '找不到這個使用者' }
}

teamRouter.post('/api/lilith/teams/:id/members', write, handle(async (req, res) => {
  const t = await teamFor(req, res, true)
  if (!t) return
  const role = req.body.role === 'admin' ? 'admin' : 'member'
  const found = await findUser(req.body.who)
  if (found.error) return jsonError(res, 404, found.error)
  if (teams.roleIn(t.team.id, found.user.id)) return jsonError(res, 400, '這個人已經在團隊裡了')
  if (teams.membersOf(t.team.id).length >= MAX_MEMBERS) return jsonError(res, 400, '團隊成員最多 ' + MAX_MEMBERS + ' 人')
  await teams.setMember(t.team.id, found.user.id, role)
  notify.teamEvent([found.user.id], req.user.id, t.team.id, t.team.name, '把你加入團隊（' + ROLE_NAMES[role] + '）')
  res.json({ ok: true, userId: found.user.id, name: profileOf(found.user).name, role })
}))

teamRouter.post('/api/lilith/teams/:id/members/:userId', write, handle(async (req, res) => {
  const t = await teamFor(req, res, true)
  if (!t) return
  const current = teams.roleIn(t.team.id, req.params.userId)
  if (!current) return jsonError(res, 404, '這個人不在團隊裡')
  if (current === 'owner') return jsonError(res, 400, '不能變更擁有者的權限')
  const role = req.body.role === 'admin' ? 'admin' : req.body.role === 'member' ? 'member' : null
  if (!role) return jsonError(res, 400, '權限不正確')
  await teams.setMember(t.team.id, req.params.userId, role)
  if (role !== current) notify.teamEvent([req.params.userId], req.user.id, t.team.id, t.team.name, '把你在團隊的權限改成' + ROLE_NAMES[role])
  res.json({ ok: true, role })
}))

teamRouter.delete('/api/lilith/teams/:id/members/:userId', write, handle(async (req, res) => {
  const self = req.params.userId === req.user.id
  const t = await teamFor(req, res, !self)
  if (!t) return
  const current = teams.roleIn(t.team.id, req.params.userId)
  if (!current) return jsonError(res, 404, '這個人不在團隊裡')
  if (current === 'owner') return jsonError(res, 400, self ? '擁有者不能離開團隊；不需要這個團隊時請刪除它' : '不能移除擁有者')
  await teams.removeMember(t.team.id, req.params.userId)
  require('../realtime').recheckAccess() // (review fix)
  if (!self) notify.teamEvent([req.params.userId], req.user.id, t.team.id, t.team.name, '把你移出團隊')
  res.json({ ok: true })
}))

// ---- invite link ----
teamRouter.post('/api/lilith/teams/:id/invite', write, handle(async (req, res) => {
  const t = await teamFor(req, res, true)
  if (!t) return
  await t.team.update({
    inviteToken: crypto.randomBytes(18).toString('base64url'),
    inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * 864e5)
  })
  res.json({ ok: true, url: inviteUrl(t.team), expiresAt: t.team.inviteExpiresAt })
}))

teamRouter.delete('/api/lilith/teams/:id/invite', write, handle(async (req, res) => {
  const t = await teamFor(req, res, true)
  if (!t) return
  await t.team.update({ inviteToken: null, inviteExpiresAt: null })
  res.json({ ok: true })
}))

// ---- team notes ----
teamRouter.get('/api/lilith/teams/:id/notes', requireLogin, handle(async (req, res) => {
  const t = await teamFor(req, res, false)
  if (!t) return
  const ids = teams.notesOf(t.team.id)
  const userId = req.user.id
  const [notes, metas] = await Promise.all([
    ids.length ? models.Note.findAll({ where: { id: ids }, attributes: ['id', 'alias', 'shortid', 'title', 'content', 'ownerId', 'permission', 'lastchangeAt', 'createdAt'] }) : [],
    ids.length ? models.LilithNoteMeta.findAll({ where: { userId, noteId: ids } }) : []
  ])
  res.json({
    notes: notes.map(n => {
      const info = models.Note.parseNoteInfo(n.content || '')
      const meta = metas.find(m => m.noteId === n.id)
      return {
        id: listId(n),
        text: info.title,
        time: new Date(n.lastchangeAt || n.createdAt).getTime(),
        tags: info.tags,
        shortid: n.shortid,
        owner: n.ownerId === userId,
        edit: true,
        manage: teams.canManageNote(n.id, n.ownerId, userId),
        permission: n.permission,
        teamId: t.team.id,
        folderId: meta ? meta.folderId : null,
        starred: meta ? !!meta.starred : false,
        book: book.isBook(models.Note.extractMeta(n.content || '').markdown, config.serverURL)
      }
    })
  })
}))

// a new note in the team: owned by me, private (= team members only)
teamRouter.post('/api/lilith/teams/:id/notes', write, handle(async (req, res) => {
  const t = await teamFor(req, res, false)
  if (!t) return
  const note = await models.Note.create({ ownerId: req.user.id, permission: 'private', content: '', title: '' })
  await teams.setNoteTeam(note.id, t.team.id)
  res.json({ ok: true, id: listId(note), url: config.serverURL + '/' + listId(note) })
}))

// move a note into a team (its creator, a member of that team) or out of one
// (its creator, or an owner / admin of the team it is in)
teamRouter.post('/api/lilith/notes/:noteId/team', write, handle(async (req, res) => {
  const ref = req.params.noteId
  const id = await new Promise((resolve) => models.Note.parseNoteId(ref, (err, x) => resolve(err ? null : x)))
  const note = id ? await models.Note.findOne({ where: { id } }) : null
  if (!note || !noteUtil.checkViewPermission(req, note)) return jsonError(res, 404, '找不到這篇筆記')
  const target = req.body.teamId === null ? null : req.body.teamId
  if (target !== null && (typeof target !== 'string' || !teams.roleIn(target, req.user.id))) return jsonError(res, 404, '找不到這個團隊')
  const current = teams.teamOfNote(note.id)
  const isCreator = note.ownerId === req.user.id
  if (target) {
    if (!isCreator) return jsonError(res, 403, '只有筆記的建立者可以把筆記放進團隊')
  } else if (current && !teams.canManageNote(note.id, note.ownerId, req.user.id)) {
    return jsonError(res, 403, '只有筆記建立者或團隊管理者可以把筆記移出團隊')
  }
  await teams.setNoteTeam(note.id, target)
  require('../realtime').recheckAccess() // (review fix) moved out of a team: members lose it
  res.json({ ok: true, teamId: target })
}))

// ---- team trash (managers) ----
function trashedTeamNotes (teamId, extra) {
  const ids = teams.notesOf(teamId)
  if (!ids.length) return []
  return models.Note.findAll({ where: Object.assign({ id: ids, deletedAt: { [Op.ne]: null } }, extra || {}), paranoid: false, order: [['deletedAt', 'DESC']] })
}

teamRouter.get('/api/lilith/teams/:id/trash', requireLogin, handle(async (req, res) => {
  const t = await teamFor(req, res, true)
  if (!t) return
  const notes = await trashedTeamNotes(t.team.id)
  res.json({ notes: notes.map(n => ({ id: n.id, title: models.Note.decodeTitle(n.title), deletedAt: n.deletedAt, purgeAt: new Date(new Date(n.deletedAt).getTime() + 30 * 864e5) })) })
}))

async function teamTrashed (req, res) {
  const t = await teamFor(req, res, true)
  if (!t) return null
  if (!validator.isUUID(req.params.noteId || '')) { jsonError(res, 404, '垃圾桶裡沒有這篇筆記'); return null }
  const notes = await trashedTeamNotes(t.team.id, { id: req.params.noteId })
  if (!notes[0]) { jsonError(res, 404, '垃圾桶裡沒有這篇筆記'); return null }
  return notes[0]
}

teamRouter.post('/api/lilith/teams/:id/trash/:noteId/restore', write, handle(async (req, res) => {
  const note = await teamTrashed(req, res)
  if (!note) return
  await note.restore()
  res.json({ ok: true, id: listId(note) })
}))

teamRouter.delete('/api/lilith/teams/:id/trash/:noteId', write, handle(async (req, res) => {
  const note = await teamTrashed(req, res)
  if (!note) return
  await noteListRouter.purge(note)
  res.json({ ok: true })
}))

// ---- pages ----
function requirePageLogin (req, res, next) {
  if (!req.isAuthenticated()) return res.redirect(config.serverURL + '/login')
  next()
}

teamRouter.get('/team/:id/settings', requirePageLogin, function (req, res) {
  const id = req.params.id
  if (!validator.isUUID(id) || !teams.roleIn(id, req.user.id)) return errors.errorNotFound(res)
  res.set({ 'Cache-Control': 'private' })
  res.render('team.ejs', { teamId: id })
})

// join with an invite link: the page asks first and the button POSTs (JSON), so another
// site cannot sign a visitor up to a team just by loading the link
async function inviteTeam (token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null
  const team = await models.LilithTeam.findOne({ where: { inviteToken: token } })
  return team && inviteActive(team) ? team : null
}

teamRouter.get('/team/join/:token', handle(async (req, res) => {
  const team = await inviteTeam(req.params.token)
  res.set({ 'Cache-Control': 'private', 'X-Robots-Tag': 'noindex' })
  if (!team) return res.render('team-join.ejs', { state: 'invalid', teamName: '', token: '' })
  if (!req.isAuthenticated()) return res.render('team-join.ejs', { state: 'login', teamName: team.name, token: '' })
  if (teams.roleIn(team.id, req.user.id)) return res.redirect(config.serverURL + '/?team=' + encodeURIComponent(team.id))
  res.render('team-join.ejs', { state: 'confirm', teamName: team.name, token: req.params.token })
}))
