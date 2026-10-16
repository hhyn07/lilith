'use strict'
// Lilith: change a note's title or tags from the note list (feature 20).
// Title and tags live in the markdown itself (as HedgeDoc reads them), so
// these functions return one text edit { start, del, insert } on the content,
// or null when nothing changes:
//   title: YAML front matter `title:`, else the first level-1 heading
//          (`# x` or `x` + `===`), else a new `# x` at the top
//   tags:  YAML front matter `tags:`, else the `###### tags:` line, else a new
//          `###### tags:` line under the title

const MAX_TITLE = 120
const MAX_TAG = 40
const MAX_TAGS = 20

// ---- input clean-up ----
function cleanTitle (title) {
  if (typeof title !== 'string') return ''
  return title.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE)
}

function cleanTags (tags) {
  if (!Array.isArray(tags)) return null
  const out = []
  for (const t of tags) {
    if (typeof t !== 'string') continue
    // backticks end the code span of the tags line, commas split YAML tags
    const tag = t.replace(/[`,\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG)
    if (tag && !out.includes(tag)) out.push(tag)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

// ---- reading the content ----
// front matter (as HedgeDoc's extractMeta reads it): { start, end } of the
// lines between the --- markers, and where the body starts
function frontMatter (content) {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(content)
  if (!m) return null
  const start = content.indexOf('\n') + 1
  return { start, end: start + m[1].length, body: m[0].length }
}

// lines from `from` to the end, skipping fenced code blocks:
// [{ start, end, text }] where end is before the line break
function lines (content, from, to) {
  const out = []
  let fence = null
  let pos = from
  const limit = typeof to === 'number' ? to : content.length
  while (pos < limit) {
    let end = content.indexOf('\n', pos)
    if (end < 0 || end > limit) end = limit
    let text = content.slice(pos, end)
    if (text.endsWith('\r')) text = text.slice(0, -1)
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(text)
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null
    } else if (f) {
      fence = f[1]
    } else {
      out.push({ start: pos, end: pos + text.length, text })
    }
    pos = end + 1
  }
  return out
}

// b is the line right after a (no skipped code block in between)
function adjacent (content, a, b) {
  return b.start === a.end + 1 + (content[a.end] === '\r' ? 1 : 0)
}

// the first level-1 heading: { line, setext } (setext: `Title` + `===` line)
function firstH1 (content, from) {
  const ls = lines(content, from)
  for (let i = 0; i < ls.length; i++) {
    if (/^ {0,3}#(?!#)(\s|$)/.test(ls[i].text)) return { line: ls[i], setext: null }
    const next = ls[i + 1]
    if (next && ls[i].text.trim() && !/^ {0,3}([#>*+-]|\d+[.)])/.test(ls[i].text) &&
        /^ {0,3}=+[ \t]*$/.test(next.text) && adjacent(content, ls[i], next)) {
      // a setext heading may be several lines: replace from the paragraph start
      let k = i
      while (k > 0 && ls[k - 1].text.trim() && adjacent(content, ls[k - 1], ls[k])) k--
      return { line: { start: ls[k].start, end: ls[i].end }, setext: next }
    }
  }
  return null
}

function yamlString (s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

// ---- edits ----
function setTitle (content, rawTitle) {
  const title = cleanTitle(rawTitle)
  if (!title) return null
  content = content || ''
  const fm = frontMatter(content)
  if (fm) {
    const key = lines(content, fm.start, fm.end).find(l => /^title\s*:/.test(l.text))
    if (key) return { start: key.start, del: key.end - key.start, insert: 'title: ' + yamlString(title) }
  }
  const from = fm ? fm.body : 0
  const h1 = firstH1(content, from)
  if (h1 && !h1.setext) return { start: h1.line.start, del: h1.line.end - h1.line.start, insert: '# ' + title }
  if (h1) return { start: h1.line.start, del: h1.line.end - h1.line.start, insert: title }
  return { start: from, del: 0, insert: '# ' + title + '\n\n' }
}

function tagsLine (tags) {
  return '###### tags: ' + tags.map(t => '`' + t + '`').join(' ')
}

function setTags (content, rawTags) {
  const tags = cleanTags(rawTags)
  if (!tags) return null
  content = content || ''
  const fm = frontMatter(content)
  if (fm) {
    const ls = lines(content, fm.start, fm.end)
    const i = ls.findIndex(l => /^tags\s*:/.test(l.text))
    if (i >= 0) {
      // the key and its indented / list continuation lines
      let j = i
      while (ls[j + 1] && /^(\s|-)/.test(ls[j + 1].text)) j++
      const start = ls[i].start
      if (tags.length) return { start, del: ls[j].end - start, insert: 'tags: ' + tags.join(', ') }
      // only tags in the front matter: drop the whole block (an empty --- block
      // would render as a horizontal rule)
      if (i === 0 && j === ls.length - 1) return { start: 0, del: fm.body, insert: '' }
      // remove the lines including the line break after them
      return { start, del: Math.min(ls[j].end + 1, fm.end + 1) - start, insert: '' }
    }
  }
  const from = fm ? fm.body : 0
  const line = lines(content, from).find(l => /^ {0,3}#{6}\s*tags/i.test(l.text))
  if (line) {
    if (tags.length) return { start: line.start, del: line.end - line.start, insert: tagsLine(tags) }
    // remove the line and its line break
    const nl = content.indexOf('\n', line.end)
    return { start: line.start, del: (nl < 0 ? content.length : nl + 1) - line.start, insert: '' }
  }
  if (!tags.length) return null
  const h1 = firstH1(content, from)
  if (h1) {
    const after = (h1.setext || h1.line).end
    return { start: after, del: 0, insert: '\n\n' + tagsLine(tags) }
  }
  return { start: from, del: 0, insert: tagsLine(tags) + '\n\n' }
}

function apply (content, edit) {
  return content.slice(0, edit.start) + edit.insert + content.slice(edit.start + edit.del)
}

// the edit as an ot.js operation, for authorship. ot.js puts an insert before
// a delete at the same place, and Note.updateAuthorshipByOperation counts on
// that order (it moves its index back after a delete)
function toOperation (content, edit) {
  const op = []
  if (edit.start > 0) op.push(edit.start)
  if (edit.insert) op.push(edit.insert)
  if (edit.del > 0) op.push(-edit.del)
  const rest = content.length - edit.start - edit.del
  if (rest > 0) op.push(rest)
  return op
}

module.exports = { cleanTitle, cleanTags, setTitle, setTags, apply, toOperation }
