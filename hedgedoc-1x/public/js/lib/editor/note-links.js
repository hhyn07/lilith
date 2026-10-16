/* global $ */
// Note link autocomplete (Lilith), modelled on HackMD: after typing "[text]("
// the editor lists your notes; picking one inserts its link, and "建立新筆記"
// creates a note titled after the link text and links to it.

const CACHE_MS = 15 * 1000
// "[text](" + optional query typed after the "(", but not image syntax "![alt]("
const LINK_MATCH = /(?<!!)(\[([^[\]\n]*)\])\(([^()\s]*)$/

function escapeHtml (text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// The textcomplete adapter runs String.prototype.replace with our result as
// the replacement, so "$" must be escaped.
function escapeReplacement (text) {
  return String(text).replace(/\$/g, '$$$$')
}

// Link text in "[text]" never contains "]" or a newline here; keep it that way
// for titles we insert.
function safeLinkText (text) {
  return String(text).replace(/[[\]\n\r]/g, ' ').trim()
}

export default function createNoteLinkStrategy ({ serverurl, currentNoteId, editor, isLoggedIn, notInCode, onError }) {
  let cache = null
  let cacheTime = 0
  let pending = null

  function fetchNotes () {
    if (cache && Date.now() - cacheTime < CACHE_MS) return Promise.resolve(cache)
    if (pending) return pending
    pending = $.ajax({ url: serverurl + '/api/lilith/notes', dataType: 'json' })
      .then((data) => {
        cache = (data && data.notes) || []
        cacheTime = Date.now()
        return cache
      })
      .always(() => { pending = null })
    return pending
  }

  function currentLinkText () {
    const cursor = editor.getCursor()
    const before = editor.getLine(cursor.line).slice(0, cursor.ch)
    const match = before.match(LINK_MATCH)
    return match ? match[2].trim() : ''
  }

  function closingParen () {
    const cursor = editor.getCursor()
    return editor.getLine(cursor.line).charAt(cursor.ch) === ')' ? '' : ')'
  }

  const strategy = {
    match: LINK_MATCH,
    index: 3,
    idProperty: 'key',
    search: function (term, callback) {
      if (!isLoggedIn()) return callback([])
      const query = (term || '').toLowerCase()
      const linkText = currentLinkText()
      fetchNotes().then((notes) => {
        const list = notes
          .filter((n) => n.id !== currentNoteId) // linking a note to itself is not useful
          .filter((n) => !query || n.title.toLowerCase().includes(query) || n.id.toLowerCase().includes(query))
          .map((n) => ({ key: 'note:' + n.id, id: n.id, title: n.title, owned: n.owned }))
        list.push({ key: 'create', create: true, title: linkText })
        callback(list)
      }, () => {
        callback([{ key: 'create', create: true, title: linkText }])
      })
    },
    template: function (item) {
      if (item.create) {
        const name = item.title ? '「' + escapeHtml(item.title) + '」' : ''
        return '<div class="note-link-item note-link-create"><i class="fa fa-plus fa-fw"></i>' +
          '<div class="note-link-text"><div class="note-link-title">建立新筆記' + name + '</div>' +
          '<div class="note-link-sub">建立後插入它的連結</div></div></div>'
      }
      return '<div class="note-link-item"><i class="fa fa-file-text-o fa-fw"></i>' +
        '<div class="note-link-text"><div class="note-link-title">' + escapeHtml(item.title) +
        ' <span class="note-link-id">(/' + escapeHtml(item.id) + ')</span></div>' +
        '<div class="note-link-sub">' + (item.owned ? '我的筆記' : '瀏覽紀錄') + '</div></div></div>'
    },
    replace: function (item) {
      const typed = currentLinkText()
      if (item.create) {
        // the note is created after the selection (see onSelect); keep "[text]("
        return escapeReplacement('[' + safeLinkText(typed) + '](')
      }
      const text = typed || safeLinkText(item.title)
      return escapeReplacement('[' + text + '](/' + item.id + closingParen())
    },
    context: function () {
      return notInCode()
    }
  }

  // Called from the textComplete:select handler. textcomplete wraps each
  // strategy in its own Strategy object, so compare by the match pattern.
  function onSelect (item, selectedStrategy) {
    if (!selectedStrategy || selectedStrategy.match !== LINK_MATCH || !item || !item.create) return
    const title = currentLinkText() || 'Untitled'
    const at = editor.getCursor()
    const paren = closingParen()
    $.ajax({
      url: serverurl + '/api/lilith/notes',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ title }),
      dataType: 'json'
    }).then((note) => {
      cache = null
      // Fill in the link text if it was empty, then the id at the old cursor.
      const line = editor.getLine(at.line)
      const before = line.slice(0, at.ch)
      if (!before.match(/\]\($/)) return
      editor.replaceRange('/' + note.id + paren, at)
      if (before.match(/\[\s*\]\($/)) {
        const start = before.lastIndexOf('[')
        editor.replaceRange('[' + safeLinkText(note.title) + ']', { line: at.line, ch: start }, { line: at.line, ch: at.ch - 1 })
      }
    }, () => {
      onError('建立筆記失敗')
    })
  }

  return { strategy, onSelect }
}
