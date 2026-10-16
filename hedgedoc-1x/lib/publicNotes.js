'use strict'
// Lilith: "recommended notes" cards on the home page.
// A note is listed when a guest can read it (freely / editable / locked) and
// it has an owner -- ownerless notes are the bundled docs (features, terms of
// use, release notes...) and old guest notes -- and it is not blank.

const cheerio = require('cheerio')
const md = require('markdown-it')()
const Sequelize = require('sequelize')
const book = require('./book')
const config = require('./config')
const logger = require('./logger')
const models = require('./models')

const Op = Sequelize.Op
const GUEST_READABLE = ['freely', 'editable', 'locked']
const DEFAULT_LIMIT = 6
const EXCERPT_LENGTH = 90

function formatDate (value) {
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Rough reading time: ~400 CJK characters or ~200 other words per minute.
function readingMinutes (text) {
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) || []).length
  const words = (text.replace(/[㐀-鿿豈-﫿]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  return Math.max(1, Math.round(cjk / 400 + words / 200))
}

// Title, tags, plain-text excerpt and reading time of a note's markdown.
function summarize (content) {
  const parsed = models.Note.extractMeta(content || '')
  const $ = cheerio.load(md.render(parsed.markdown))
  const tags = models.Note.extractNoteTags(parsed.meta, $).slice(0, 3)
  // the title heading, the tags line and code are not useful in an excerpt
  $('h1').first().remove()
  $('h6').filter((i, el) => /^tags/i.test($(el).text())).remove()
  $('pre, script, style').remove()
  // html is off in this renderer, so comments such as <!-- lilith:welcome --> come back as text
  const text = $.root().text().replace(/<!--[\s\S]*?-->/g, ' ').replace(/\s+/g, ' ').trim()
  const excerpt = text.length > EXCERPT_LENGTH ? text.slice(0, EXCERPT_LENGTH).trim() + '…' : text
  return { tags, excerpt, minutes: readingMinutes(text), book: book.isBook(parsed.markdown, config.serverURL) }
}

// Returns [{ shortid, title, date, tags, excerpt, minutes, book }], newest change first;
// with ownerId only that user's notes (public profile page /u/<id>).
async function recentPublicNotes (limit = DEFAULT_LIMIT, ownerId = null) {
  try {
    const changed = Sequelize.fn('COALESCE', Sequelize.col('lastchangeAt'), Sequelize.col('updatedAt'))
    const notes = await models.Note.findAll({
      attributes: ['shortid', 'title', 'content', 'lastchangeAt', 'updatedAt'],
      where: {
        permission: { [Op.in]: GUEST_READABLE },
        ownerId: ownerId || { [Op.ne]: null },
        // skip blank notes (e.g. created and never written)
        [Op.and]: Sequelize.where(Sequelize.fn('TRIM', Sequelize.fn('COALESCE', Sequelize.col('content'), '')), { [Op.ne]: '' })
      },
      order: [[changed, 'DESC']],
      limit
    })
    return notes.map((note) => {
      const title = models.Note.decodeTitle(note.title)
      let summary = { tags: [], excerpt: '', minutes: 1, book: false }
      try {
        summary = summarize(note.content)
      } catch (err) {
        logger.warn('public notes: could not summarize ' + note.shortid + ': ' + err)
      }
      return {
        shortid: note.shortid,
        title,
        date: formatDate(note.lastchangeAt || note.updatedAt),
        tags: summary.tags,
        excerpt: summary.excerpt,
        minutes: summary.minutes,
        book: summary.book
      }
    })
  } catch (err) {
    logger.error('public notes: query failed: ' + err)
    return []
  }
}

module.exports = {
  GUEST_READABLE,
  recentPublicNotes,
  summarize
}
