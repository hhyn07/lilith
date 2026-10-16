// Unit test for hedgedoc-1x/lib/noteEdit.js (title / tags edits from the note list).
// Usage: node test-note-edit.js <hedgedoc-1x dir>; prints "ok N" or the failures (ASCII only).
'use strict'
const path = require('path')
const hd = process.argv[2]
const ne = require(path.join(hd, 'lib', 'noteEdit.js'))
// HedgeDoc reads the title / tags with markdown-it + cheerio; do the same here
const md = require(path.join(hd, 'node_modules', 'markdown-it'))()
const cheerio = require(path.join(hd, 'node_modules', 'cheerio'))
const yaml = require(path.join(hd, 'node_modules', 'js-yaml'))

function read (content) {
  let meta = {}
  let body = content
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(content)
  if (m) { meta = yaml.load(m[1]) || {}; body = content.slice(m[0].length) }
  const $ = cheerio.load(md.render(body))
  const title = meta.title || $('h1').first().text()
  let tags = []
  if (typeof meta.tags === 'string') tags = meta.tags.split(',').map(t => t.trim()).filter(Boolean)
  else $('h6').each((i, el) => { if (/^tags/i.test($(el).text())) $(el).find('code').each((j, c) => tags.push($(c).text().trim())) })
  return { title, tags }
}

const fails = []
let n = 0
function check (name, got, want) {
  n++
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(name + ': got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want))
}
function edit (fn, content, value) {
  const e = fn(content, value)
  return e ? ne.apply(content, e) : content
}

// ---- title ----
check('atx', edit(ne.setTitle, '# Old\n\ntext', 'New'), '# New\n\ntext')
check('setext', edit(ne.setTitle, 'Old\n===\ntext', 'New'), 'New\n===\ntext')
check('setext multi-line', read(edit(ne.setTitle, 'one\ntwo\n===\nx', 'New')).title, 'New')
check('no title', edit(ne.setTitle, 'just text', 'New'), '# New\n\njust text')
check('empty note', edit(ne.setTitle, '', 'New'), '# New\n\n')
check('front matter title', read(edit(ne.setTitle, '---\ntitle: Old\n---\n# Heading', 'A "q" \\ b')).title, 'A "q" \\ b')
check('front matter without title', edit(ne.setTitle, '---\ntags: a\n---\n# H\n', 'New'), '---\ntags: a\n---\n# New\n')
check('h1 inside code is skipped', edit(ne.setTitle, '```\n# not\n```\n# Real', 'New'), '```\n# not\n```\n# New')
check('h2 is not a title', edit(ne.setTitle, '## Sub\n', 'New'), '# New\n\n## Sub\n')
check('crlf', edit(ne.setTitle, '# Old\r\ntext', 'New'), '# New\r\ntext')
check('newlines collapsed', ne.cleanTitle(' a\nb  c '), 'a b c')
check('blank title rejected', ne.setTitle('# x', '   '), null)

// ---- tags ----
check('tags line replaced', edit(ne.setTags, '# T\n###### tags: `a`\nx', ['b', 'c']), '# T\n###### tags: `b` `c`\nx')
check('tags line removed', edit(ne.setTags, '# T\n###### tags: `a`\nx', []), '# T\nx')
check('tags added under title', edit(ne.setTags, '# T\nx', ['a']), '# T\n\n###### tags: `a`\nx')
check('tags added, no title', edit(ne.setTags, 'x', ['a']), '###### tags: `a`\n\nx')
check('no tags, nothing to remove', ne.setTags('# T\nx', []), null)
check('front matter tags', read(edit(ne.setTags, '---\ntitle: T\ntags: a, b\n---\nx', ['c', 'd'])).tags, ['c', 'd'])
check('front matter tag list', edit(ne.setTags, '---\ntags:\n  - a\n  - b\ntitle: T\n---\nx', ['c']), '---\ntags: c\ntitle: T\n---\nx')
check('front matter tags removed', edit(ne.setTags, '---\ntitle: T\ntags: a\n---\nx', []), '---\ntitle: T\n---\nx')
check('front matter only tags removed', edit(ne.setTags, '---\ntags: a\n---\nx', []), 'x')
check('tags read back', read(edit(ne.setTags, '# T\n\nbody', ['one', 'two'])).tags, ['one', 'two'])
check('tags cleaned', ne.cleanTags(['a`b', 'c,d', ' ', 'a`b', 7]), ['a b', 'c d'])
check('tags not an array', ne.setTags('# T', 'a'), null)

// ---- authorship operation ----
check('operation', ne.toOperation('abcdef', { start: 2, del: 1, insert: 'XY' }), [2, 'XY', -1, 3])
// HedgeDoc's authorship update must put the inserted text where it really is
const Note = { updateAuthorshipByOperation: null }
try {
  // load only the function: it needs ot.js, not the database
  const src = require('fs').readFileSync(path.join(hd, 'lib', 'models', 'note.js'), 'utf8')
  const body = src.slice(src.indexOf('Note.updateAuthorshipByOperation = function'), src.indexOf('Note.transformPatchToOperations = function'))
  // eslint-disable-next-line no-new-func
  Note.updateAuthorshipByOperation = new Function('ot', 'Note', body + '; return Note.updateAuthorshipByOperation')(require(path.join(hd, 'lib', 'ot')), {})
} catch (e) { fails.push('could not load updateAuthorshipByOperation: ' + e.message) }
if (typeof Note.updateAuthorshipByOperation !== 'function') fails.push('updateAuthorshipByOperation not found in note.js')
else {
  const content = '<!-- x -->\n# Old title\n\nbody'
  const e = ne.setTitle(content, 'New')
  const a = Note.updateAuthorshipByOperation(ne.toOperation(content, e), 'u', [['o', 0, content.length, 1, 1]])
  const out = ne.apply(content, e)
  const mine = a.filter(x => x[0] === 'u').map(x => out.slice(x[1], x[2]))
  check('authorship covers the new title', mine, ['# New'])
  check('authorship total length', a.reduce((n, x) => n + x[2] - x[1], 0), out.length)
}
check('operation at start', ne.toOperation('abc', { start: 0, del: 0, insert: 'Z' }), ['Z', 3])

if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
console.log('ok ' + n)
