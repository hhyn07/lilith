'use strict'
// Lilith (feature 20): the "..." menu of the note cards in the list (like HackMD):
// duplicate, rename, edit tags, move to a folder, bookmark, delete the note,
// and the user's own folders. Signed-in users only; JSON in and out.
//
// Notes are addressed by the id the history list uses (alias or encoded id).

const Router = require('express').Router
const bodyParser = require('body-parser')
const validator = require('validator')
const Sequelize = require('sequelize')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

const book = require('../book')
const config = require('../config')
const errors = require('../errors')
const history = require('../history')
const logger = require('../logger')
const models = require('../models')
const noteEdit = require('../noteEdit')
const realtime = require('../realtime')
const teams = require('../teams')
const noteUtil = require('./note/util')

const noteListRouter = module.exports = Router()

const jsonParser = bodyParser.json({ limit: '8kb' })
const MAX_FOLDERS = 100
const MAX_FOLDER_NAME = 40

// generous enough for clicking around the list, low enough to stop a runaway script
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

// writes must be JSON: a cross-site form cannot send that without CORS approval
function requireJson (req, res, next) {
  if (!req.is('application/json')) return jsonError(res, 415, '需要 JSON')
  next()
}

const write = [requireLogin, writeLimit, requireJson, jsonParser]

function parseNoteId (id) {
  return new Promise((resolve, reject) => {
    models.Note.parseNoteId(id, (err, noteId) => err ? reject(err) : resolve(noteId))
  })
}

// the note behind a list id, or null
async function findNote (listId) {
  if (typeof listId !== 'string' || !listId || listId.length > 200) return null
  const id = await parseNoteId(listId)
  if (!id) return null
  return models.Note.findOne({ where: { id } })
}

function cleanFolderName (name) {
  // eslint-disable-next-line no-control-regex
  return typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_FOLDER_NAME) : ''
}

// update title / tags of the user's own history entry, keep its time and pin
// (resolves once saved, so the list can be reloaded right after)
function updateHistoryEntry (userId, listId, content) {
  return new Promise((resolve) => {
    history.getHistory(userId, (err, entries) => {
      if (err || !entries || !entries[listId]) return resolve()
      const info = models.Note.parseNoteInfo(content)
      entries[listId].text = info.title
      entries[listId].tags = info.tags
      history.setHistory(userId, entries, (err) => {
        if (err) logger.error('note list: history update failed: ' + err)
        resolve()
      })
    })
  })
}

function removeHistoryEntry (userId, listId) {
  return new Promise((resolve) => {
    history.getHistory(userId, (err, entries) => {
      if (err || !entries || !entries[listId]) return resolve()
      delete entries[listId]
      history.setHistory(userId, entries, () => resolve())
    })
  })
}

// apply a title / tags edit to a note the user owns and nobody has open
async function editContent (req, res, makeEdit) {
  const note = await findNote(req.params.noteId)
  if (!note) return jsonError(res, 404, '找不到這篇筆記')
  if (note.ownerId !== req.user.id && !teams.roleForNote(note.id, req.user.id)) return jsonError(res, 403, '只有筆記的擁有者或團隊成員可以修改')
  if (realtime.isNoteOpen(note.id)) return jsonError(res, 409, '這篇筆記正在編輯器中開啟，請直接在編輯器裡修改')
  const content = note.content || ''
  const change = makeEdit(content)
  if (change === undefined) return jsonError(res, 400, '內容不正確')
  if (change === null) return res.json({ ok: true, changed: false })
  const newContent = noteEdit.apply(content, change)
  // keep the author colours in place (same as an edit in the editor)
  const authorship = models.Note.updateAuthorshipByOperation(noteEdit.toOperation(content, change), req.user.id, note.authorship || [])
  await note.update({
    content: newContent,
    title: models.Note.parseNoteTitle(newContent),
    authorship,
    lastchangeAt: Date.now(),
    lastchangeuserId: req.user.id
  })
  await models.Author.findOrCreate({ where: { noteId: note.id, userId: req.user.id }, defaults: { color: null } })
  realtime.wakeRevisionSaver() // a revision for this change, within 5 minutes
  await updateHistoryEntry(req.user.id, req.params.noteId, newContent)
  const info = models.Note.parseNoteInfo(newContent)
  res.json({ ok: true, changed: true, title: info.title, tags: info.tags })
}

function handle (fn) {
  return function (req, res) {
    fn(req, res).catch((err) => {
      logger.error('note list: ' + req.method + ' ' + req.path + ': ' + err)
      if (!res.headersSent) jsonError(res, 500, '處理失敗')
    })
  }
}

// ---- reading ----
// may this signed-in user read the note? (note/util.js checkViewPermission, for a user)
function readable (note, userId) {
  return note.ownerId === userId || !!teams.roleForNote(note.id, userId) || note.permission !== 'private'
}

// the user's folders, and for every note in their list: short id (for the
// published link), whether they own it, its folder and bookmark
noteListRouter.get('/api/lilith/notes/meta', requireLogin, handle(async (req, res) => {
  const userId = req.user.id
  const entries = await new Promise((resolve) => history.getHistory(userId, (err, h) => resolve(err ? null : h)))
  const listIds = entries ? Object.keys(entries) : []
  const pairs = await Promise.all(listIds.map(async (listId) => [listId, await parseNoteId(listId).catch(() => null)]))
  const ids = pairs.map(p => p[1]).filter(Boolean)
  const [notes, metas, folders] = await Promise.all([
    ids.length ? models.Note.findAll({ where: { id: ids }, attributes: ['id', 'shortid', 'ownerId', 'permission', 'content'] }) : [],
    models.LilithNoteMeta.findAll({ where: { userId } }),
    models.LilithFolder.findAll({ where: { userId }, order: [['name', 'ASC']] })
  ])
  const noteById = {}
  notes.forEach(n => { noteById[n.id] = n })
  const metaByNote = {}
  metas.forEach(m => { metaByNote[m.noteId] = m })
  const out = {}
  pairs.forEach(([listId, id]) => {
    const note = id && noteById[id]
    if (!note) return
    const meta = metaByNote[id]
    const canRead = readable(note, userId)
    // the title and tags now (the list keeps the ones from the last visit in the editor;
    // a book opens in book mode, so its entry would never be updated)
    const info = canRead ? models.Note.parseNoteInfo(note.content || '') : null
    out[listId] = {
      title: info ? info.title : null,
      tags: info ? info.tags : null,
      // (review fix) nothing about notes this user may not read: a history can hold any id
      shortid: canRead ? note.shortid : null,
      owner: note.ownerId === userId,
      // feature 24: team members may rename / edit tags, team managers may delete
      edit: note.ownerId === userId || !!teams.roleForNote(note.id, userId),
      manage: teams.canManageNote(note.id, note.ownerId, userId),
      teamId: canRead ? teams.teamOfNote(note.id) : null,
      permission: canRead ? note.permission : 'private',
      folderId: meta ? meta.folderId : null,
      starred: meta ? !!meta.starred : false,
      // a book (lib/book.js): book icon on the card, opens in book mode; only for notes
      // this user may read (a list can keep notes that became private)
      book: canRead && book.isBook(models.Note.extractMeta(note.content || '').markdown, config.serverURL)
    }
  })
  res.json({ folders: folders.map(f => ({ id: f.id, name: f.name })), notes: out })
}))

// one note's folder and bookmark (the published page's bookmark button)
noteListRouter.get('/api/lilith/notes/:noteId/meta', requireLogin, handle(async (req, res) => {
  const note = await findNote(req.params.noteId)
  if (!note || !noteUtil.checkViewPermission(req, note)) return jsonError(res, 404, '找不到這篇筆記')
  const meta = await models.LilithNoteMeta.findOne({ where: { userId: req.user.id, noteId: note.id } })
  // the workspace for the editor's top left (like HackMD): the note's team if the user
  // is in it, otherwise the user's own space
  const teamId = teams.teamOfNote(note.id)
  const team = teamId && teams.roleIn(teamId, req.user.id) ? await models.LilithTeam.findOne({ where: { id: teamId }, attributes: ['id', 'name'] }) : null
  res.json({
    folderId: meta ? meta.folderId : null,
    starred: meta ? !!meta.starred : false,
    workspace: team ? { kind: 'team', id: team.id, name: team.name } : { kind: 'mine' }
  })
}))

// ---- note actions ----
noteListRouter.post('/api/lilith/notes/:noteId/duplicate', write, handle(async (req, res) => {
  const note = await findNote(req.params.noteId)
  if (!note || !noteUtil.checkViewPermission(req, note)) return jsonError(res, 404, '找不到這篇筆記')
  let content = note.content || ''
  const title = models.Note.parseNoteTitle(content)
  if (title) {
    const change = noteEdit.setTitle(content, title + '（副本）')
    if (change) content = noteEdit.apply(content, change)
  }
  // a new note owned by the user, with the default permission (like /new)
  const copy = await models.Note.create({
    ownerId: req.user.id,
    content,
    title: models.Note.parseNoteTitle(content)
  })
  const listId = models.Note.encodeNoteId(copy.id)
  await new Promise((resolve) => history.getHistory(req.user.id, (err, entries) => {
    if (err || !entries) return resolve()
    const info = models.Note.parseNoteInfo(content)
    entries[listId] = { id: listId, text: info.title, time: Date.now(), tags: info.tags, pinned: false }
    history.setHistory(req.user.id, entries, () => resolve())
  }))
  res.json({ ok: true, id: listId, url: config.serverURL + '/' + listId })
}))

noteListRouter.post('/api/lilith/notes/:noteId/title', write, handle(async (req, res) => {
  if (!noteEdit.cleanTitle(req.body.title)) return jsonError(res, 400, '標題不能是空的')
  await editContent(req, res, (content) => noteEdit.setTitle(content, req.body.title))
}))

noteListRouter.post('/api/lilith/notes/:noteId/tags', write, handle(async (req, res) => {
  if (!Array.isArray(req.body.tags)) return jsonError(res, 400, '標籤格式不正確')
  await editContent(req, res, (content) => noteEdit.setTags(content, req.body.tags))
}))

// body: { folderId: <uuid> | null } and / or { starred: true | false }
noteListRouter.post('/api/lilith/notes/:noteId/meta', write, handle(async (req, res) => {
  const userId = req.user.id
  const body = req.body || {}
  const change = {}
  if ('folderId' in body) {
    if (body.folderId === null) change.folderId = null
    else if (typeof body.folderId === 'string' && validator.isUUID(body.folderId)) {
      const folder = await models.LilithFolder.findOne({ where: { id: body.folderId, userId } })
      if (!folder) return jsonError(res, 404, '找不到這個資料夾')
      change.folderId = folder.id
    } else return jsonError(res, 400, '資料夾不正確')
  }
  if ('starred' in body) {
    if (typeof body.starred !== 'boolean') return jsonError(res, 400, '收藏設定不正確')
    change.starred = body.starred
  }
  if (!Object.keys(change).length) return jsonError(res, 400, '沒有要修改的項目')
  const note = await findNote(req.params.noteId)
  if (!note || !noteUtil.checkViewPermission(req, note)) return jsonError(res, 404, '找不到這篇筆記')
  const [meta] = await models.LilithNoteMeta.findOrCreate({ where: { userId, noteId: note.id }, defaults: { starred: false } })
  await meta.update(change)
  res.json({ ok: true, folderId: meta.folderId, starred: !!meta.starred })
}))

// move the note to the trash (owner only); restore or delete it for good in /trash
noteListRouter.delete('/api/lilith/notes/:noteId', write, handle(async (req, res) => {
  const note = await findNote(req.params.noteId)
  if (!note) return jsonError(res, 404, '找不到這篇筆記')
  if (!teams.canManageNote(note.id, note.ownerId, req.user.id)) return jsonError(res, 403, '只有筆記的擁有者或團隊管理者可以刪除')
  const id = note.id
  realtime.closeDeletedNote(id)
  await models.Note.destroy({ where: { id } }) // paranoid: sets deletedAt
  await removeHistoryEntry(req.user.id, req.params.noteId)
  logger.info('note list: note ' + id + ' moved to the trash by its owner')
  res.json({ ok: true, trashed: true })
}))

// ---- trash (feature 23) ----
const TRASH_DAYS = 30

// delete a trashed note for good, with what the editor's delete used to leave behind
async function purge (note) {
  await teams.setNoteTeam(note.id, null)
  await Promise.all([
    models.Revision.destroy({ where: { noteId: note.id } }),
    models.Author.destroy({ where: { noteId: note.id } }),
    models.LilithNotification.destroy({ where: { noteId: note.id } }) // (review fix)
  ])
  await models.Note.destroy({ where: { id: note.id }, force: true }) // the hook removes folder / bookmark rows
}

function trashedNotes (userId, where) {
  return models.Note.findAll({
    where: Object.assign({ ownerId: userId, deletedAt: { [Sequelize.Op.ne]: null } }, where || {}),
    paranoid: false,
    order: [['deletedAt', 'DESC']]
  })
}

async function trashedNote (req) {
  if (!validator.isUUID(req.params.id)) return null
  const notes = await trashedNotes(req.user.id, { id: req.params.id })
  return notes[0] || null
}

// the user's trash; notes older than TRASH_DAYS are deleted for good first
noteListRouter.get('/api/lilith/trash', requireLogin, handle(async (req, res) => {
  const old = await trashedNotes(req.user.id, { deletedAt: { [Sequelize.Op.lt]: new Date(Date.now() - TRASH_DAYS * 864e5) } })
  for (const note of old) await purge(note)
  const notes = await trashedNotes(req.user.id)
  res.json({
    days: TRASH_DAYS,
    notes: notes.map(n => ({
      id: n.id,
      title: models.Note.decodeTitle(n.title),
      deletedAt: n.deletedAt,
      purgeAt: new Date(new Date(n.deletedAt).getTime() + TRASH_DAYS * 864e5)
    }))
  })
}))

noteListRouter.post('/api/lilith/trash/:id/restore', write, handle(async (req, res) => {
  const note = await trashedNote(req)
  if (!note) return jsonError(res, 404, '垃圾桶裡沒有這篇筆記')
  await note.restore()
  // back in the owner's list
  const listId = note.alias || models.Note.encodeNoteId(note.id)
  await new Promise((resolve) => history.getHistory(req.user.id, (err, entries) => {
    if (err || !entries) return resolve()
    const info = models.Note.parseNoteInfo(note.content || '')
    entries[listId] = { id: listId, text: info.title, time: Date.now(), tags: info.tags, pinned: false }
    history.setHistory(req.user.id, entries, () => resolve())
  }))
  logger.info('note list: note ' + note.id + ' restored from the trash')
  res.json({ ok: true, id: listId, url: config.serverURL + '/' + listId })
}))

noteListRouter.delete('/api/lilith/trash/:id', write, handle(async (req, res) => {
  const note = await trashedNote(req)
  if (!note) return jsonError(res, 404, '垃圾桶裡沒有這篇筆記')
  await purge(note)
  logger.info('note list: note ' + note.id + ' deleted for good')
  res.json({ ok: true })
}))

// empty the trash
noteListRouter.delete('/api/lilith/trash', write, handle(async (req, res) => {
  const notes = await trashedNotes(req.user.id)
  for (const note of notes) await purge(note)
  logger.info('note list: trash emptied (' + notes.length + ' notes)')
  res.json({ ok: true, deleted: notes.length })
}))

// ---- folders ----
noteListRouter.post('/api/lilith/folders', write, handle(async (req, res) => {
  const name = cleanFolderName(req.body.name)
  if (!name) return jsonError(res, 400, '資料夾名稱不能是空的')
  const count = await models.LilithFolder.count({ where: { userId: req.user.id } })
  if (count >= MAX_FOLDERS) return jsonError(res, 400, '資料夾最多 ' + MAX_FOLDERS + ' 個')
  const folder = await models.LilithFolder.create({ userId: req.user.id, name })
  res.json({ ok: true, folder: { id: folder.id, name: folder.name } })
}))

noteListRouter.post('/api/lilith/folders/:folderId', write, handle(async (req, res) => {
  if (!validator.isUUID(req.params.folderId)) return jsonError(res, 404, '找不到這個資料夾')
  const name = cleanFolderName(req.body.name)
  if (!name) return jsonError(res, 400, '資料夾名稱不能是空的')
  const folder = await models.LilithFolder.findOne({ where: { id: req.params.folderId, userId: req.user.id } })
  if (!folder) return jsonError(res, 404, '找不到這個資料夾')
  await folder.update({ name })
  res.json({ ok: true, folder: { id: folder.id, name: folder.name } })
}))

// the notes in it go back to "not in a folder"; the notes themselves stay
noteListRouter.delete('/api/lilith/folders/:folderId', write, handle(async (req, res) => {
  if (!validator.isUUID(req.params.folderId)) return jsonError(res, 404, '找不到這個資料夾')
  const userId = req.user.id
  const folder = await models.LilithFolder.findOne({ where: { id: req.params.folderId, userId } })
  if (!folder) return jsonError(res, 404, '找不到這個資料夾')
  await models.LilithNoteMeta.update({ folderId: null }, { where: { userId, folderId: folder.id } })
  await folder.destroy()
  res.json({ ok: true })
}))

// lib/web/teamRouter.js (team trash) deletes for good the same way
noteListRouter.purge = purge
