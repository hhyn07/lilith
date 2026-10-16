'use strict'
// Note link autocomplete (Lilith): lets the editor suggest notes after
// "[text](" and create a new note to link to, like HackMD.

const Router = require('express').Router
const bodyParser = require('body-parser')

const config = require('../config')
const logger = require('../logger')
const models = require('../models')
const rateLimit = require('./middleware/rateLimit')

const noteLinkRouter = module.exports = Router()

const MAX_RESULTS = 50
const MAX_TITLE_LENGTH = 200
const jsonParser = bodyParser.json({ limit: '4kb' })

function jsonError (res, status, message) {
  return res.status(status).json({ error: message })
}

function requireLogin (req, res, next) {
  if (!req.isAuthenticated()) return jsonError(res, 401, 'login required')
  next()
}

function parseHistory (raw) {
  if (!raw) return []
  try {
    const history = JSON.parse(raw)
    return Array.isArray(history) ? history : []
  } catch (err) {
    return []
  }
}

function matches (query, item) {
  if (!query) return true
  const q = query.toLowerCase()
  return item.title.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
}

// List notes the user can link to: notes they own (newest first) plus other
// notes from their history. Optional ?q= filters by title or id.
noteLinkRouter.get('/api/lilith/notes', requireLogin, async function (req, res) {
  try {
    const query = String(req.query.q || '').trim().slice(0, MAX_TITLE_LENGTH)
    const owned = await models.Note.findAll({
      where: { ownerId: req.user.id },
      attributes: ['id', 'title', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 500
    })
    const seen = new Set()
    const items = []
    for (const note of owned) {
      const id = models.Note.encodeNoteId(note.id)
      seen.add(id)
      items.push({ id, title: note.title || 'Untitled', owned: true, time: new Date(note.updatedAt).getTime() })
    }
    const user = await models.User.findOne({ where: { id: req.user.id }, attributes: ['history'] })
    for (const entry of parseHistory(user && user.history)) {
      if (!entry || typeof entry.id !== 'string' || seen.has(entry.id)) continue
      seen.add(entry.id)
      items.push({ id: entry.id, title: String(entry.text || 'Untitled'), owned: false, time: Number(entry.time) || 0 })
    }
    res.json({ notes: items.filter((item) => matches(query, item)).slice(0, MAX_RESULTS) })
  } catch (err) {
    logger.error('noteLink: list failed: ' + err)
    jsonError(res, 500, 'could not list notes')
  }
})

// Create an empty note titled `title` and return its id.
// Requires a JSON body: a cross-site form cannot send application/json
// without a CORS preflight, which this server never allows.
const limitNewNotes = config.rateLimitNewNotes > 0 ? rateLimit.newNotes : (req, res, next) => next()
noteLinkRouter.post('/api/lilith/notes', requireLogin, limitNewNotes, jsonParser, async function (req, res) {
  if (!req.is('application/json')) return jsonError(res, 415, 'expected application/json')
  if (config.disableNoteCreation) return jsonError(res, 403, 'note creation is disabled')
  const title = String((req.body && req.body.title) || '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH) || 'Untitled'
  try {
    const content = '# ' + title + '\n\n'
    const note = await models.Note.create({
      ownerId: req.user.id,
      content,
      title: models.Note.parseNoteTitle(content)
    })
    res.status(201).json({ id: models.Note.encodeNoteId(note.id), title: note.title })
  } catch (err) {
    logger.error('noteLink: create failed: ' + err)
    jsonError(res, 500, 'could not create note')
  }
})
