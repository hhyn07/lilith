'use strict'
// Welcome note: every user gets a private, pinned welcome note in their history.

const fs = require('fs')
const path = require('path')
const { Op } = require('sequelize')

const logger = require('./logger')

const WELCOME_TEMPLATE = path.join(__dirname, 'welcome.md')
// Marker inside the template, used to recognise an existing welcome note.
const WELCOME_MARKER = '<!-- lilith:welcome -->'

function parseHistory (raw) {
  if (!raw) return []
  try {
    const history = JSON.parse(raw)
    return Array.isArray(history) ? history : []
  } catch (err) {
    logger.warn('welcome: could not parse user history, starting a new one')
    return []
  }
}

// Put the note at the top of the user's history (pinned) unless it is there.
// Returns true when the history was changed.
// Note: user.history is read-modify-written without a lock (as in lib/history.js),
// so the backfill script should run while the server is stopped.
async function addToHistory (models, userId, note) {
  const id = models.Note.encodeNoteId(note.id)
  // Re-read the user so a history written meanwhile is not overwritten.
  const fresh = await models.User.findOne({ where: { id: userId } })
  const history = parseHistory(fresh && fresh.history)
  if (history.some((item) => item && item.id === id)) return false
  const info = models.Note.parseNoteInfo(note.content)
  history.unshift({ id, text: info.title, time: Date.now(), tags: info.tags, pinned: true })
  await models.User.update({ history: JSON.stringify(history) }, { where: { id: userId } })
  return true
}

// Make sure this user owns a welcome note and has it in their history.
// Resolves to { note, created, addedToHistory }.
async function ensureWelcomeNote (models, user) {
  let note = await models.Note.findOne({
    where: {
      ownerId: user.id,
      content: { [Op.like]: WELCOME_MARKER + '%' }
    }
  })
  let created = false
  if (!note) {
    const content = fs.readFileSync(WELCOME_TEMPLATE, 'utf8')
    note = await models.Note.create({
      ownerId: user.id,
      content,
      title: models.Note.parseNoteTitle(content),
      permission: 'private'
    })
    created = true
  }
  const addedToHistory = await addToHistory(models, user.id, note)
  if (created || addedToHistory) {
    logger.info(`welcome: user ${user.id}: note ${created ? 'created' : 'exists'}, history ${addedToHistory ? 'updated' : 'unchanged'}`)
  }
  return { note, created, addedToHistory }
}

module.exports = {
  WELCOME_MARKER,
  ensureWelcomeNote
}
