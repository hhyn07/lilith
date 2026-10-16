'use strict'
// Lilith (feature 26): notifications like HackMD's.
//   一般通知 (kind "change"): someone else changed a note you created, a note of your
//     team, a note you bookmarked, or a public note of a team you follow (feature 27) -- "X 和其他 N 個人 變更了〈筆記〉" with the changes.
//     Made when HedgeDoc saves a revision (every 5 minutes while a note is edited);
//     a day's changes to one note are merged into one unread notification.
//   重要通知 (kind "team"): added to a team, role changed, removed, someone joined with
//     the invite link, team deleted.
// Only people who may read the note are told; the people who made the change are not.

const DiffMatchPatch = require('diff-match-patch')
const Sequelize = require('sequelize')

const config = require('./config')
const logger = require('./logger')
const models = require('./models')
const teams = require('./teams')

const Op = Sequelize.Op
const dmp = new DiffMatchPatch()
const KEEP_DAYS = 90
const MAX_PREVIEW = 1600 // characters of changes kept per notification
const CONTEXT = 40 // unchanged characters shown around a change
const GAP = [0, '\n⋯\n']

// the changes of a revision as [op, text] pieces: -1 removed, 1 added, 0 around them
function preview (patchText) {
  let patches = []
  try { patches = dmp.patch_fromText(patchText || '') } catch (e) { return [] }
  const out = []
  let size = 0
  for (const p of patches) {
    if (out.length) out.push(GAP)
    p.diffs.forEach(([op, text], i) => {
      if (size >= MAX_PREVIEW) return
      let t = text
      if (op === 0 && t.length > CONTEXT) {
        // keep the context next to the changes only
        const first = i === 0
        const last = i === p.diffs.length - 1
        t = first ? '…' + t.slice(-CONTEXT) : last ? t.slice(0, CONTEXT) + '…' : t.length > 2 * CONTEXT ? t.slice(0, CONTEXT) + '…' + t.slice(-CONTEXT) : t
      }
      t = t.slice(0, MAX_PREVIEW - size)
      size += t.length
      out.push([op, t])
    })
    if (size >= MAX_PREVIEW) break
  }
  return out
}

// may this signed-in user read the note? (the rules of note/util.js, for any user)
function canRead (note, userId) {
  if (!userId) return false
  if (teams.roleForNote(note.id, userId)) return true
  if (note.permission === 'private') return note.ownerId === userId
  return true
}

async function noteChanged (revision) {
  try {
    if (!revision || !revision.patch) return // the first revision of a note is not a change
    const note = await models.Note.findOne({ where: { id: revision.noteId } })
    if (!note) return
    // who changed it since the previous revision: who wrote new text (authorship entries
    // [user, from, to, created, updated] *created* since then -- "updated" also moves for
    // the person whose text someone else deleted) and the note's last editor
    const prev = await models.Revision.findOne({ where: { noteId: note.id, createdAt: { [Op.lt]: revision.createdAt } }, order: [['createdAt', 'DESC']] })
    const since = prev ? new Date(prev.createdAt).getTime() : 0
    const seen = new Set()
    const actors = []
    if (note.lastchangeuserId) { actors.push(note.lastchangeuserId); seen.add(note.lastchangeuserId) }
    ;(revision.authorship || [])
      .filter(a => Array.isArray(a) && a[0] && a[3] > since)
      .sort((a, b) => b[3] - a[3])
      .forEach(a => { if (!seen.has(a[0])) { seen.add(a[0]); actors.push(a[0]) } })

    // the creator, the note's team, and the people who bookmarked it
    const people = new Set()
    if (note.ownerId) people.add(note.ownerId)
    const teamId = teams.teamOfNote(note.id)
    if (teamId) teams.membersOf(teamId).forEach(m => people.add(m.userId))
    const stars = await models.LilithNoteMeta.findAll({ where: { noteId: note.id, starred: true }, attributes: ['userId'] })
    stars.forEach(s => people.add(s.userId))
    // feature 27: the people who follow the team (only those who may read the note: canRead)
    if (teamId) (await models.LilithFollow.findAll({ where: { teamId }, attributes: ['userId'] })).forEach(f => people.add(f.userId))
    actors.forEach(id => people.delete(id))
    const recipients = Array.from(people).filter(id => canRead(note, id))
    if (!recipients.length) return

    const changes = preview(revision.patch)
    const title = models.Note.decodeTitle(note.title)
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    for (const userId of recipients) {
      const open = await models.LilithNotification.findOne({
        where: { userId, noteId: note.id, kind: 'change', readAt: null, createdAt: { [Op.gte]: dayStart } }
      })
      if (open) {
        const merged = changes.concat(open.data.changes && open.data.changes.length ? [GAP] : [], open.data.changes || [])
        let size = 0
        open.actors = Array.from(new Set(actors.concat(open.actors || [])))
        open.data = { title, changes: merged.filter(([, t]) => (size += t.length) <= MAX_PREVIEW) }
        open.changed('updatedAt', true)
        await open.save()
      } else {
        await models.LilithNotification.create({ userId, kind: 'change', noteId: note.id, teamId, actors, data: { title, changes } })
      }
    }
  } catch (err) {
    logger.error('notify: note change: ' + err)
  }
}

// a team message to some users (message: the text after the actor's name)
async function teamEvent (userIds, actorId, teamId, teamName, message) {
  try {
    const rows = Array.from(new Set(userIds)).filter(id => id && id !== actorId)
      .map(userId => ({ userId, kind: 'team', teamId, actors: actorId ? [actorId] : [], data: { teamName, message } }))
    for (const row of rows) await models.LilithNotification.create(row)
  } catch (err) {
    logger.error('notify: team event: ' + err)
  }
}

function profileOf (user) {
  const p = user ? models.User.getProfile(user) : null
  return { name: (p && p.name) || '', photo: (p && p.photo) || '' }
}

// the user's notifications, newest first, ready for the panel
async function list (userId, kind, unreadOnly) {
  await models.LilithNotification.destroy({ where: { userId, updatedAt: { [Op.lt]: new Date(Date.now() - KEEP_DAYS * 864e5) } } })
  const where = { userId }
  if (kind) where.kind = kind
  if (unreadOnly) where.readAt = null
  const rows = await models.LilithNotification.findAll({ where, order: [['updatedAt', 'DESC']], limit: 100 })
  const userIds = Array.from(new Set([].concat(...rows.map(r => (r.actors || []).slice(0, 3)))))
  const noteIds = Array.from(new Set(rows.map(r => r.noteId).filter(Boolean)))
  const [users, notes] = await Promise.all([
    userIds.length ? models.User.findAll({ where: { id: userIds } }) : [],
    // (review fix) trashed notes too (paranoid: false): the access check must still apply
    noteIds.length ? models.Note.findAll({ where: { id: noteIds }, attributes: ['id', 'alias', 'title', 'ownerId', 'permission', 'deletedAt'], paranoid: false }) : []
  ])
  return rows.map(r => {
    let note = r.noteId ? notes.find(n => n.id === r.noteId) : null
    // no longer allowed to read it (left the team, made private): no link, no changes
    const hidden = note && !canRead(note, userId)
    if (hidden || (note && note.deletedAt)) note = null
    const actors = (r.actors || []).slice(0, 3).map(id => profileOf(users.find(u => u.id === id)))
    return {
      id: r.id,
      kind: r.kind,
      read: !!r.readAt,
      time: r.updatedAt,
      actors,
      others: Math.max(0, (r.actors || []).length - 1),
      title: note ? models.Note.decodeTitle(note.title) : (r.data.title || ''),
      // a note in the trash or deleted has no link
      link: note ? config.serverURL + '/' + (note.alias || models.Note.encodeNoteId(note.id)) : (r.kind === 'team' && r.teamId && teams.roleIn(r.teamId, userId) ? config.serverURL + '/?team=' + encodeURIComponent(r.teamId) : null),
      noAccess: !!hidden,
      changes: hidden ? [] : (r.data.changes || []),
      teamName: r.data.teamName || '',
      message: r.data.message || ''
    }
  })
}

async function unreadCounts (userId) {
  const rows = await models.LilithNotification.findAll({
    where: { userId, readAt: null },
    attributes: ['kind', [Sequelize.fn('COUNT', Sequelize.col('id')), 'n']],
    group: ['kind'],
    raw: true
  })
  const out = { change: 0, team: 0 }
  rows.forEach(r => { out[r.kind] = Number(r.n) })
  return out
}

module.exports = { preview, noteChanged, teamEvent, list, unreadCounts }
