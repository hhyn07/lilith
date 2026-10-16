'use strict'
// Lilith (feature 21): book mode like HackMD's. An "index" note's lists of links
// become the book's table of contents; headings become groups:
//
//   ## 週會議                 -> group "週會議"
//   - [第一次會議](/abc)      ->   page (link to another note)
//     - [附件](/s/xyz)        ->     sub-page
//
// parseTree() is pure (markdown in, tree out); resolve() looks the linked notes up.

const md = require('markdown-it')()

const MAX_NODES = 500
// a path on this site: "/x", but not "//host" or "/\\host" (another site to browsers)
const SITE_PATH = /^\/(?![/\\])/

// [{ type: 'group' | 'page', title, href, children }]
function parseTree (markdown, bookTitle) {
  const tokens = md.parse(markdown || '', {})
  const root = []
  let groupList = root // where list items go (top level or the current heading's group)
  const stack = [] // open list items (their children lists)
  let count = 0
  let pendingItem = null

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === 'heading_open' && stack.length === 0) {
      const text = inlineText(tokens[i + 1])
      // the heading that is the book's own title does not make a group
      if (!text || text === bookTitle) {
        groupList = root
      } else {
        const group = { type: 'group', title: text, href: null, children: [] }
        root.push(group)
        groupList = group.children
      }
    } else if (t.type === 'list_item_open') {
      const parent = stack.length ? stack[stack.length - 1].children : groupList
      // past the limit the item is still pushed (so its close pops the right item) but dropped;
      // items are counted when they open, so a parent counts before its children
      const skip = count >= MAX_NODES
      if (!skip) count++
      pendingItem = { type: 'page', title: '', href: null, children: [], _parent: parent, _skip: skip }
      stack.push(pendingItem)
    } else if (t.type === 'inline' && pendingItem && !pendingItem.title) {
      // the item's text: its first link, or its plain text
      const link = firstLink(t)
      pendingItem.title = link ? link.text : inlineText(t)
      pendingItem.href = link ? link.href : null
    } else if (t.type === 'list_item_close') {
      const item = stack.pop()
      if (!item) continue
      const parent = item._parent
      const skip = item._skip
      delete item._parent
      delete item._skip
      // skip empty items ("- " at the end of a list) and items past the limit
      if (!skip && (item.title || item.children.length)) parent.push(item)
      else if (!skip) count-- // an empty item does not use up the limit
      pendingItem = stack.length ? stack[stack.length - 1] : null
      // a parent's text was read before its children; keep pendingItem from re-reading it
      if (pendingItem && !pendingItem.title) pendingItem.title = ' '
    }
  }
  // groups without pages are only headings in the text, not part of the table of contents
  return root.filter(n => n.type === 'page' || n.children.length)
}

function inlineText (token) {
  if (!token || !token.children) return token && token.content ? token.content.trim() : ''
  return token.children.filter(c => c.type === 'text' || c.type === 'code_inline').map(c => c.content).join('').trim()
}

function firstLink (inline) {
  const kids = inline.children || []
  const start = kids.findIndex(c => c.type === 'link_open')
  if (start < 0) return null
  let text = ''
  for (let j = start + 1; j < kids.length && kids[j].type !== 'link_close'; j++) {
    if (kids[j].type === 'text' || kids[j].type === 'code_inline') text += kids[j].content
  }
  return { href: kids[start].attrGet('href') || '', text: text.trim() }
}

// the note reference in a link to this site: /<id>, /s/<shortid>, /b/<book>/<page>,
// with or without the site address; null for other links
function noteRefOf (href, serverURL) {
  if (typeof href !== 'string' || !href) return null
  let path = href
  if (serverURL && path.startsWith(serverURL + '/')) path = path.slice(serverURL.length)
  // "//host" and "/\\host" (browsers read the backslash as a slash) are other sites
  if (!/^\/(?![/\\])/.test(path)) return null
  path = path.split(/[?#]/)[0]
  const parts = path.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p) } catch (e) { return p } })
  if (parts.length === 1) return parts[0]
  if (parts.length === 2 && parts[0] === 's') return parts[1]
  if (parts.length === 3 && parts[0] === 'b') return parts[2]
  return null
}

// fill in page.note = { id, ref, title, canView } for links to notes on this site
// (lookup(ref) -> note or null; canView(note) -> bool), page.external for http(s) links
// and page.local for other paths on this site
// editRefOf(note) -> the id the editor uses (optional; feature 25 links to the editor)
async function resolve (tree, serverURL, lookup, canView, editRefOf) {
  const pages = []
  ;(function walk (nodes) {
    nodes.forEach(n => { if (n.type === 'page') pages.push(n); walk(n.children) })
  })(tree)
  const seen = new Map() // ref -> promise of the note (each note is looked up once)
  await Promise.all(pages.map(async (p) => {
    const ref = noteRefOf(p.href, serverURL)
    if (ref) {
      if (!seen.has(ref)) seen.set(ref, lookup(ref).catch(() => null))
      const note = await seen.get(ref)
      if (note) {
        const readable = !!canView(note)
        p.note = { id: note.id, ref: note.alias || note.shortid, canView: readable, link: p.href }
        if (editRefOf) p.note.edit = editRefOf(note)
        // only a readable note may lend its title (a private note's title is private)
        if (!p.title.trim()) p.title = readable ? (note.title || ref) : ''
      } else if (SITE_PATH.test(p.href)) {
        // looks like a note but is not one (e.g. /login): a plain link
        p.local = p.href
      }
    } else if (/^https?:\/\//i.test(p.href || '')) {
      p.external = p.href
    } else if (SITE_PATH.test(p.href || '')) {
      // other pages of this site (the home page, /features ...): a plain link
      p.local = p.href
    }
  }))
  return tree
}

// the book's name: the note title, or (HedgeDoc only takes a level-1 heading as the
// title) the first heading of any level
function bookTitle (markdown, noteTitle) {
  if (noteTitle && noteTitle !== 'Untitled') return noteTitle
  const tokens = md.parse(markdown || '', {})
  const i = tokens.findIndex(t => t.type === 'heading_open')
  return (i >= 0 && inlineText(tokens[i + 1])) || noteTitle || 'Untitled'
}

// is the note a book? Its lists link to at least two notes of this site (like HackMD,
// a book gets a book icon on the cards and opens in book mode)
const BOOK_MIN_PAGES = 2
function isBook (markdown, serverURL) {
  let pages = 0
  ;(function walk (nodes) {
    nodes.forEach(n => {
      if (n.type === 'page' && noteRefOf(n.href, serverURL)) pages++
      walk(n.children)
    })
  })(parseTree(markdown, ''))
  return pages >= BOOK_MIN_PAGES
}

module.exports = { parseTree, noteRefOf, resolve, bookTitle, isBook }
