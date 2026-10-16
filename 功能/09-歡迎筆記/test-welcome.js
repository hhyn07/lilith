// Integration test for the welcome note, run against an in-memory database.
// Usage: node test-welcome.js <path to hedgedoc-1x>
// Prints one JSON object with the result of each check.
process.env.NODE_ENV = 'test'
process.env.CMD_DB_URL = 'sqlite::memory:'

const path = require('path')
const hd = path.resolve(process.argv[2] || '.')
process.chdir(hd)

const logger = require(path.join(hd, 'lib', 'logger'))
logger.transports.forEach((t) => { t.level = 'error' })
const models = require(path.join(hd, 'lib', 'models'))
const { ensureWelcomeNote, WELCOME_MARKER } = require(path.join(hd, 'lib', 'welcome'))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForWelcome (userId) {
  for (let i = 0; i < 30; i++) {
    const note = await models.Note.findOne({ where: { ownerId: userId } })
    if (note) return note
    await sleep(100)
  }
  return null
}

async function main () {
  await models.sequelize.sync()
  const result = {}

  // Same call the registration route makes (runs inside a transaction).
  const [user] = await models.User.findOrCreate({
    where: { email: 'welcome-test@example.com' },
    defaults: { password: 'test-password-only' }
  })
  const note = await waitForWelcome(user.id)
  result.created_after_register = !!note
  if (note) {
    result.private = note.permission === 'private'
    result.has_marker = note.content.startsWith(WELCOME_MARKER)
    result.title = note.title
    const fresh = await models.User.findOne({ where: { id: user.id } })
    const history = JSON.parse(fresh.history || '[]')
    const entry = history.find((h) => h.id === models.Note.encodeNoteId(note.id))
    result.in_history = !!entry
    result.pinned = !!(entry && entry.pinned)
    result.tags = entry ? entry.tags : null
  }

  // Running the backfill again must not create a second note.
  const again = await ensureWelcomeNote(models, user)
  const count = await models.Note.count({ where: { ownerId: user.id } })
  result.idempotent = again.created === false && again.addedToHistory === false && count === 1

  // If the history lost the entry (e.g. a concurrent history write), the
  // backfill puts the existing note back instead of skipping the user.
  await models.User.update({ history: JSON.stringify([{ id: 'other', text: 'x', time: 1, tags: [] }]) }, { where: { id: user.id } })
  const repaired = await ensureWelcomeNote(models, user)
  const afterRepair = JSON.parse((await models.User.findOne({ where: { id: user.id } })).history)
  result.repairs_history = repaired.created === false && repaired.addedToHistory === true &&
    afterRepair.length === 2 && afterRepair[0].pinned === true && afterRepair[1].id === 'other'

  // A user created outside a transaction (e.g. bin/manage_users) also gets one.
  const plain = await models.User.create({ email: 'welcome-test-2@example.com', password: 'test-password-only' })
  result.created_without_transaction = !!(await waitForWelcome(plain.id))

  console.log(JSON.stringify(result))
}

main().then(() => process.exit(0)).catch((err) => {
  console.log(JSON.stringify({ error: String(err) }))
  process.exit(1)
})
