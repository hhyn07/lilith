'use strict'
// Lilith (feature 24): team workspaces -- an in-memory copy of who is in which team
// and which note belongs to which team, so HedgeDoc's synchronous permission checks
// (note/util.js, realtime.js) can ask "may this user see / edit / manage this note?".
//
// Rules (hhyn chose "admins and members"):
//   member of the note's team   reads and edits it, whatever its permission
//   owner / admin of the team    also changes its permission, moves it to the trash
//   the note's own creator keeps every right they had
//
// The tables are the source of truth; every change goes through the functions below,
// which write the table and then update the copy. load() runs once at start-up.

const logger = require('./logger')
const models = require('./models')

const ROLES = ['owner', 'admin', 'member']
const members = new Map() // teamId -> Map(userId -> role)
const noteTeam = new Map() // noteId -> teamId
let loaded = false

async function load () {
  const [rows, notes] = await Promise.all([
    models.LilithTeamMember.findAll({ attributes: ['teamId', 'userId', 'role'] }),
    models.LilithTeamNote.findAll({ attributes: ['teamId', 'noteId'] })
  ])
  members.clear()
  noteTeam.clear()
  rows.forEach(r => {
    if (!members.has(r.teamId)) members.set(r.teamId, new Map())
    members.get(r.teamId).set(r.userId, r.role)
  })
  notes.forEach(n => noteTeam.set(n.noteId, n.teamId))
  // a note deleted with its owner's account (the database removes it directly) leaves
  // its team row behind; drop those
  if (noteTeam.size) {
    const ids = Array.from(noteTeam.keys())
    const alive = new Set((await models.Note.findAll({ where: { id: ids }, attributes: ['id'], paranoid: false })).map(n => n.id))
    const gone = ids.filter(id => !alive.has(id))
    if (gone.length) {
      await models.LilithTeamNote.destroy({ where: { noteId: gone } })
      gone.forEach(id => noteTeam.delete(id))
    }
  }
  loaded = true
  logger.info('teams: ' + members.size + ' team(s), ' + noteTeam.size + ' team note(s) loaded')
}

// ---- questions (synchronous) ----
function roleIn (teamId, userId) {
  const m = teamId && userId ? members.get(teamId) : null
  return (m && m.get(userId)) || null
}

function teamOfNote (noteId) {
  return noteTeam.get(noteId) || null
}

// the user's role in the note's team, or null
function roleForNote (noteId, userId) {
  return roleIn(teamOfNote(noteId), userId)
}

function isManager (role) {
  return role === 'owner' || role === 'admin'
}

// may change the permission / move to the trash: the creator, or a team owner / admin
function canManageNote (noteId, ownerId, userId) {
  if (!userId) return false
  if (ownerId && ownerId === userId) return true
  return isManager(roleForNote(noteId, userId))
}

function teamsOf (userId) {
  const out = []
  members.forEach((m, teamId) => { if (m.has(userId)) out.push({ teamId, role: m.get(userId) }) })
  return out
}

function membersOf (teamId) {
  return Array.from((members.get(teamId) || new Map()).entries()).map(([userId, role]) => ({ userId, role }))
}

function notesOf (teamId) {
  const out = []
  noteTeam.forEach((t, noteId) => { if (t === teamId) out.push(noteId) })
  return out
}

// ---- changes (write the table, then the copy) ----
async function setMember (teamId, userId, role) {
  if (!ROLES.includes(role)) throw new Error('bad role')
  const [row, created] = await models.LilithTeamMember.findOrCreate({ where: { teamId, userId }, defaults: { role } })
  if (!created && row.role !== role) await row.update({ role })
  if (!members.has(teamId)) members.set(teamId, new Map())
  members.get(teamId).set(userId, role)
}

async function removeMember (teamId, userId) {
  await models.LilithTeamMember.destroy({ where: { teamId, userId } })
  const m = members.get(teamId)
  if (m) m.delete(userId)
}

async function setNoteTeam (noteId, teamId) {
  if (teamId) {
    const [row, created] = await models.LilithTeamNote.findOrCreate({ where: { noteId }, defaults: { teamId } })
    if (!created && row.teamId !== teamId) await row.update({ teamId })
    noteTeam.set(noteId, teamId)
  } else {
    await models.LilithTeamNote.destroy({ where: { noteId } })
    noteTeam.delete(noteId)
  }
}

// the team goes away; its notes go back to their creators' own space (they are not deleted)
async function dropTeam (teamId) {
  await models.LilithTeamNote.destroy({ where: { teamId } })
  await models.LilithTeamMember.destroy({ where: { teamId } })
  await models.LilithTeam.destroy({ where: { id: teamId } })
  await models.LilithFollow.destroy({ where: { teamId } }) // feature 27
  members.delete(teamId)
  notesOf(teamId).forEach(noteId => noteTeam.delete(noteId))
}

module.exports = {
  ROLES,
  load,
  isLoaded: () => loaded,
  roleIn,
  teamOfNote,
  roleForNote,
  isManager,
  canManageNote,
  teamsOf,
  membersOf,
  notesOf,
  setMember,
  removeMember,
  setNoteTeam,
  dropTeam
}
