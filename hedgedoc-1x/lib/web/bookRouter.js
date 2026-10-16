'use strict'
// Lilith (feature 21): book mode like HackMD's.
//   /b/<index note>            the index note itself, with the book's table of contents
//   /b/<index note>/<page>     a page of the book (any note the reader may see)
//   /<note>/book               -> /b/<note> (the share dialog's "book" link)
// The table of contents comes from the index note's lists of links (lib/book.js).

const Router = require('express').Router
const moment = require('moment')

const config = require('../config')
const errors = require('../errors')
const logger = require('../logger')
const models = require('../models')
const book = require('../book')
const noteUtil = require('./note/util')

const bookRouter = module.exports = Router()

function parseNoteId (ref) {
  return new Promise((resolve, reject) => {
    models.Note.parseNoteId(ref, (err, id) => err ? reject(err) : resolve(id))
  })
}

const withPeople = [
  { model: models.User, as: 'owner' },
  { model: models.User, as: 'lastchangeuser' }
]

async function findNote (ref, include) {
  if (typeof ref !== 'string' || !ref || ref.length > 200) return null
  const id = await parseNoteId(ref)
  if (!id) return null
  return models.Note.findOne({ where: { id }, include: include || null })
}

function refOf (note) {
  return note.alias || note.shortid
}

// the editor's address of a note (feature 25: editing inside a book)
function editRefOf (note) {
  return note.alias || models.Note.encodeNoteId(note.id)
}
// edit a page inside the book: /b/<book>[/<page>]?edit -- the book's table of contents
// on the left and the editor in a frame on the right; moving between pages only
// reloads the frame (catppuccin.js bookShell)
function editHref (note, bookRef) {
  const page = refOf(note)
  return config.serverURL + '/b/' + encodeURIComponent(bookRef) + (page === bookRef ? '' : '/' + encodeURIComponent(page)) + '?edit'
}

// the book's table of contents: the index note's lists of links, resolved for this reader
async function bookToc (req, bookNote) {
  const parsed = models.Note.extractMeta(bookNote.content || '')
  const title = book.bookTitle(parsed.markdown, models.Note.decodeTitle(bookNote.title))
  const tree = await book.resolve(
    book.parseTree(parsed.markdown, title),
    config.serverURL,
    (ref) => findNote(ref),
    (note) => noteUtil.checkViewPermission(req, note),
    editRefOf
  )
  return { title, tree }
}

// everyone who wrote in the note (its author records), owner first
async function contributors (note) {
  const authors = await models.Author.findAll({ where: { noteId: note.id }, attributes: ['userId'] })
  const ids = Array.from(new Set(authors.map(a => a.userId).filter(Boolean)))
  if (note.ownerId && !ids.includes(note.ownerId)) ids.unshift(note.ownerId)
  if (!ids.length) return []
  const users = await models.User.findAll({ where: { id: ids } })
  return ids.map(id => users.find(u => u.id === id)).filter(Boolean).map(u => {
    const p = models.User.getProfile(u) || {}
    return { name: p.name || '', photo: p.photo || '' }
  }).filter(p => p.photo)
}

function getPublishData (req, res, note) {
  return new Promise((resolve) => noteUtil.getPublishData(req, res, note, resolve))
}

async function showBook (req, res) {
  const bookNote = await findNote(req.params.bookId)
  if (!bookNote) return errors.errorNotFound(res)
  if (!noteUtil.checkViewPermission(req, bookNote)) return errors.errorForbidden(res)
  const editing = req.query.edit !== undefined
  const suffix = editing ? '?edit' : ''
  // canonical address: the index note's short id (or alias)
  if (req.params.bookId !== refOf(bookNote)) {
    return res.redirect(config.serverURL + '/b/' + encodeURIComponent(refOf(bookNote)) + (req.params.pageId ? '/' + encodeURIComponent(req.params.pageId) : '') + suffix)
  }

  const pageNote = req.params.pageId
    ? await findNote(req.params.pageId, withPeople)
    : await models.Note.findOne({ where: { id: bookNote.id }, include: withPeople })
  if (!pageNote) return errors.errorNotFound(res)
  if (!noteUtil.checkViewPermission(req, pageNote)) return errors.errorForbidden(res)
  if (req.params.pageId && req.params.pageId !== refOf(pageNote)) {
    return res.redirect(config.serverURL + '/b/' + encodeURIComponent(refOf(bookNote)) + (pageNote.id === bookNote.id ? '' : '/' + encodeURIComponent(refOf(pageNote))) + suffix)
  }
  if (editing) {
    // the page around the editor; the table of contents comes from the toc API
    res.set({ 'Cache-Control': 'private' })
    return res.render('book-edit.ejs', {
      serverURL: config.serverURL,
      shell: JSON.stringify({ book: refOf(bookNote), page: refOf(pageNote), edit: editRefOf(pageNote) }).replace(/</g, '\\u003c'),
      frameSrc: config.serverURL + '/' + editRefOf(pageNote) + '?both'
    })
  }

  const { title: bookTitle, tree } = await bookToc(req, bookNote)
  const data = await getPublishData(req, res, pageNote)
  const lastchange = pageNote.lastchangeAt || pageNote.createdAt
  res.set({ 'Cache-Control': 'private' })
  res.render('book.ejs', Object.assign(data, {
    bookRef: refOf(bookNote),
    bookTitle,
    tree,
    pageRef: refOf(pageNote),
    isIndex: pageNote.id === bookNote.id,
    pageTitle: pageNote.id === bookNote.id ? bookTitle : book.bookTitle(models.Note.extractMeta(pageNote.content || '').markdown, models.Note.decodeTitle(pageNote.title)),
    editorName: data.lastchangeuserprofile ? data.lastchangeuserprofile.name : null,
    editedOn: lastchange ? moment(lastchange).format('YYYY年M月D日') : '',
    editedAt: lastchange ? moment(lastchange).toISOString() : '',
    contributors: await contributors(pageNote),
    // feature 25: "編輯" opens the editor with the book on the left
    editLink: editHref(pageNote, refOf(bookNote)),
    indexEditLink: editHref(bookNote, refOf(bookNote))
  }))
}

function handle (fn) {
  return function (req, res) {
    fn(req, res).catch((err) => {
      logger.error('book: ' + req.path + ': ' + err)
      if (!res.headersSent) errors.errorInternalError(res)
    })
  }
}

bookRouter.get('/b/:bookId', handle(showBook))
bookRouter.get('/b/:bookId/:pageId', handle(showBook))

// feature 25: the table of contents for the book editing page; readable pages carry
// their book address (href), book ref (page) and editor ref (edit), other links as they are
function links (tree) {
  const map = {}
  ;(function walk (nodes) {
    nodes.forEach(n => {
      if (n.note && n.note.canView) map[n.note.link] = n.note.edit
      walk(n.children)
    })
  })(tree)
  return map
}

bookRouter.get('/api/lilith/books/:bookId/toc', handle(async (req, res) => {
  const bookNote = await findNote(req.params.bookId)
  if (!bookNote || !noteUtil.checkViewPermission(req, bookNote)) return res.status(404).json({ error: '找不到這本書' })
  const ref = refOf(bookNote)
  const { title, tree } = await bookToc(req, bookNote)
  function out (nodes) {
    return nodes.map(n => ({
      type: n.type,
      title: (n.title || '').trim(),
      href: n.note && n.note.canView ? config.serverURL + '/b/' + encodeURIComponent(ref) + (n.note.ref === ref ? '' : '/' + encodeURIComponent(n.note.ref)) + '?edit' : (n.external || n.local || null),
      page: n.note && n.note.canView ? n.note.ref : null,
      edit: n.note && n.note.canView ? n.note.edit : null,
      external: !!n.external,
      locked: !!(n.note && !n.note.canView),
      children: out(n.children)
    }))
  }
  res.set({ 'Cache-Control': 'private' })
  res.json({
    ref,
    title,
    index: editRefOf(bookNote),
    indexHref: editHref(bookNote, ref),
    // links inside the pages (as written in the index) -> the book page they open
    links: links(tree),
    viewHref: config.serverURL + '/b/' + encodeURIComponent(ref),
    tree: out(tree)
  })
}))

// the share dialog's "book mode" link
bookRouter.get('/:noteId/book', handle(async (req, res) => {
  const note = await findNote(req.params.noteId)
  if (!note) return errors.errorNotFound(res)
  if (!noteUtil.checkViewPermission(req, note)) return errors.errorForbidden(res)
  res.redirect(config.serverURL + '/b/' + encodeURIComponent(refOf(note)))
}))
