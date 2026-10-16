/* global serverurl, moment */
// Lilith (feature 20): the "..." menu of the note cards (like HackMD), the
// confirm / edit dialogs, and the sidebar scopes (all, bookmarks, folders).
// cover.js owns the list (list.js) and the history; this module adds:
//   - per-user note facts from /api/lilith/notes/meta (owner, folder, bookmark)
//   - the menu and its actions (lib/web/noteListRouter.js on the server)
//   - filtering by scope, combined with cover.js's tag filter

const API = () => `${serverurl}/api/lilith`

export default function initNoteList ({ list, refresh, removeFromHistory, togglePin, isPinned }) {
  let signedIn = false
  let folders = []
  let notes = {} // list id -> { shortid, owner, permission, folderId, starred }
  let scope = { type: 'all', id: null }
  let tags = []

  // ---- server ----
  function api (method, path, body) {
    return fetch(API() + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(r => r.json().catch(() => ({})).then(data => {
      if (!r.ok) throw new Error(data.error || '操作失敗（' + r.status + '）')
      return data
    }))
  }

  function loadMeta () {
    signedIn = true
    if (currentTeam) return Promise.resolve() // a team's meta comes with its notes (loadTeam)
    $('.ctp-organize').show()
    return api('GET', '/notes/meta').then(data => {
      folders = data.folders || []
      notes = data.notes || {}
      freshen()
      renderFolders()
      applyFilter()
    }).catch(err => toast(err.message))
  }

  function escapeText (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }
  // the cards show the title and tags the list kept from the last visit in the editor:
  // use the note's current ones (e.g. a book, which opens in book mode, never updates them)
  function freshen () {
    list.items.forEach(item => {
      const values = item.values()
      const meta = notes[values.id]
      if (!meta || !meta.title) return
      // escaped like history.js does: cover.js draws the chips as HTML
      const tags = (Array.isArray(meta.tags) ? meta.tags : []).map(escapeText)
      const text = escapeText(meta.title) // list.js writes it as HTML (history.js escapes it too)
      const same = values.text === text && JSON.stringify(values.tags || []) === JSON.stringify(tags)
      if (same) return
      item.values({ text, tags })
      // cover.js draws the chips only into an empty box
      const box = item.elm && item.elm.querySelector('.tags')
      if (box) box.innerHTML = tags.map(t => `<span class='label label-default'>${t}</span>`).join(' ')
    })
  }

  function reset () {
    signedIn = false
    currentTeam = null
    teamList = []
    $('.ctp-workspace').hide()
    $('#history').removeClass('ctp-team-mode')
    $('.ctp-team-bar').prop('hidden', true)
    folders = []
    notes = {}
    scope = { type: 'all', id: null }
    $('.ctp-organize').hide()
    renderFolders()
    applyFilter()
  }

  // ---- small helpers ----
  let toastTimer = null
  function toast (message) {
    let el = document.querySelector('.ctp-toast')
    if (!el) {
      el = document.createElement('div')
      el.className = 'ctp-toast'
      el.setAttribute('role', 'status')
      el.setAttribute('aria-live', 'polite')
      document.body.appendChild(el)
    }
    el.textContent = message
    el.classList.add('ctp-shown')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove('ctp-shown'), 2600)
  }

  function copy (text, message) {
    const done = () => toast(message)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done))
    } else fallbackCopy(text, done)
  }
  function fallbackCopy (text, done) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); done() } catch (e) { toast('無法複製，請手動複製：' + text) }
    ta.remove()
  }

  function itemOf (id) {
    const found = list.get('id', id)
    return found && found[0]
  }

  function folderName (id) {
    const f = folders.find(f => f.id === id)
    return f ? f.name : ''
  }

  // ---- dialog (one modal, set up for each use) ----
  const $dialog = $('.ctp-dialog-modal')
  let dialogOk = null
  function dialog (opts) {
    $dialog.find('.modal-title').text(opts.title)
    $dialog.find('.ctp-dialog-msg').text(opts.message || '').toggle(!!opts.message)
    const $item = $dialog.find('.ctp-dialog-item').empty().toggle(!!opts.item)
    if (opts.item) {
      $item.append($('<i class="fa fa-file-text-o" aria-hidden="true"></i>'))
      const $text = $('<div></div>')
      $text.append($('<div class="ctp-dialog-item-title"></div>').text(opts.item.title))
      if (opts.item.sub) $text.append($('<div class="ctp-dialog-item-sub"></div>').text(opts.item.sub))
      $item.append($text)
    }
    const $field = $dialog.find('.ctp-dialog-field').toggle(!!opts.input)
    if (opts.input) {
      $field.find('label').text(opts.input.label)
      $field.find('input').val(opts.input.value || '').attr('placeholder', opts.input.placeholder || '')
      $field.find('.ctp-dialog-hint').text(opts.input.hint || '')
    }
    const $choices = $dialog.find('.ctp-dialog-choices').empty().toggle(!!opts.choices)
    if (opts.choices) {
      opts.choices.forEach((c, i) => {
        const $label = $('<label class="ctp-dialog-choice"></label>')
        const $radio = $('<input type="radio" name="ctp-dialog-choice">').val(c.value === null ? '' : c.value)
        if (c.selected) $radio.prop('checked', true)
        $label.append($radio).append($('<i class="fa fa-fw" aria-hidden="true"></i>').addClass(c.icon)).append($('<span></span>').text(c.label))
        $choices.append($label)
      })
    }
    // moving can also make a new folder on the way
    $dialog.find('.ctp-dialog-new').toggle(!!opts.choices && !opts.noNewFolder).find('input').val('')
    $dialog.find('.ctp-dialog-error').text('')
    $dialog.find('.ctp-dialog-ok').text(opts.ok).toggleClass('btn-danger', !!opts.danger).toggleClass('btn-primary', !opts.danger).prop('disabled', false)
    dialogOk = opts.onOk
    $dialog.modal('show')
  }
  $dialog.on('shown.bs.modal', () => {
    const input = $dialog.find('.ctp-dialog-field:visible input')
    if (input.length) input.trigger('focus').trigger('select')
  })
  $dialog.find('form').on('submit', e => {
    e.preventDefault()
    if (!dialogOk) return
    const $ok = $dialog.find('.ctp-dialog-ok').prop('disabled', true)
    const values = {
      input: $dialog.find('.ctp-dialog-field input').val(),
      choice: $dialog.find('input[name="ctp-dialog-choice"]:checked').val(),
      extra: $dialog.find('.ctp-dialog-new-folder').val()
    }
    Promise.resolve(dialogOk(values)).then(() => {
      $dialog.modal('hide')
    }).catch(err => {
      $dialog.find('.ctp-dialog-error').text(err.message)
      $ok.prop('disabled', false)
    })
  })

  // ---- the menu ----
  const menu = document.createElement('ul')
  menu.className = 'dropdown-menu ctp-card-menu'
  menu.setAttribute('role', 'menu')
  document.body.appendChild(menu)
  let menuFor = null

  function closeMenu () {
    menu.classList.remove('ctp-open')
    if (menuFor) menuFor.setAttribute('aria-expanded', 'false')
    menuFor = null
  }

  function menuItems (id) {
    const meta = notes[id] || {}
    const pinned = isPinned(id)
    const groups = [
      [{ icon: 'fa-eye', label: '以瀏覽模式開啟', act: 'view' }],
      [
        (meta.edit || meta.owner) && { icon: 'fa-i-cursor', label: '修改標題', act: 'title' },
        (meta.edit || meta.owner) && { icon: 'fa-tags', label: '編輯標籤', act: 'tags' },
        signedIn && { icon: 'fa-folder-o', label: '移動', act: 'move' },
        signedIn && { icon: 'fa-files-o', label: '建立副本', act: 'duplicate' },
        // feature 24: into a team (its creator), or out of the team (creator / team manager)
        signedIn && !currentTeam && meta.owner && teamList.length && { icon: 'fa-users', label: meta.teamId ? '換到其他團隊' : '移到團隊', act: 'team' },
        signedIn && currentTeam && (meta.manage || meta.owner) && { icon: 'fa-sign-out', label: '移出團隊', act: 'leave-team' }
      ],
      [
        // pins live in my history; a team's notes are not in it
        !currentTeam && { icon: 'fa-thumb-tack', label: pinned ? '取消釘選' : '釘選', act: 'pin' },
        signedIn && { icon: meta.starred ? 'fa-bookmark' : 'fa-bookmark-o', label: meta.starred ? '取消收藏' : '收藏', act: 'star' }
      ],
      [
        { icon: 'ctp-icon-share', label: '分享', act: 'share' },
        { icon: 'fa-link', label: '複製連結', act: 'copy' }
      ],
      [
        !currentTeam && { icon: 'fa-eye-slash', label: '從紀錄移除', act: 'forget' },
        (meta.manage || meta.owner) && { icon: 'fa-trash-o', label: '刪除這篇筆記', act: 'delete', danger: true }
      ]
    ]
    return groups.map(g => g.filter(Boolean)).filter(g => g.length)
  }

  function openMenu (button, id) {
    menu.innerHTML = ''
    menuItems(id).forEach((group, i) => {
      if (i > 0) {
        const d = document.createElement('li')
        d.className = 'divider'
        menu.appendChild(d)
      }
      group.forEach(entry => {
        const li = document.createElement('li')
        li.setAttribute('role', 'presentation')
        const a = document.createElement('a')
        a.href = '#'
        a.setAttribute('role', 'menuitem')
        a.dataset.act = entry.act
        if (entry.danger) li.className = 'ctp-danger'
        const icon = document.createElement('i')
        icon.className = 'fa fa-fw ' + entry.icon
        icon.setAttribute('aria-hidden', 'true')
        a.appendChild(icon)
        a.appendChild(document.createTextNode(' ' + entry.label))
        li.appendChild(a)
        menu.appendChild(li)
      })
    })
    menu.dataset.id = id
    menuFor = button
    button.setAttribute('aria-expanded', 'true')
    // below the button, right edges aligned; above it when there is no room
    menu.classList.add('ctp-open')
    const r = button.getBoundingClientRect()
    const w = menu.offsetWidth
    const h = menu.offsetHeight
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))
    const below = r.bottom + 6 + h <= window.innerHeight - 8
    const top = below ? r.bottom + 6 : Math.max(8, r.top - h - 6)
    menu.style.left = left + window.scrollX + 'px'
    menu.style.top = top + window.scrollY + 'px'
    const first = menu.querySelector('a')
    if (first) first.focus()
  }

  $(document).on('click', '#history-list .ui-history-more', function (e) {
    e.preventDefault()
    e.stopPropagation()
    const id = $(this).closest('li').find('.id').text()
    if (menuFor === this) closeMenu()
    else openMenu(this, id)
  })
  // the ... button sits inside the card link: keep Enter / Space from opening the note
  $(document).on('keydown', '#history-list .ui-history-more', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault() // Space would scroll the page, Enter would follow the card link
      $(this).trigger('click')
    }
  })
  // (the ... handler above is also on document, so its own click must not close the menu)
  document.addEventListener('click', e => {
    if (menuFor && !menu.contains(e.target) && !e.target.closest('.ui-history-more')) closeMenu()
  })
  document.addEventListener('keydown', e => {
    if (!menuFor) return
    if (e.key === 'Escape') { const b = menuFor; closeMenu(); b.focus() }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const links = Array.from(menu.querySelectorAll('a'))
      const i = links.indexOf(document.activeElement)
      const next = links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]
      if (next) next.focus()
    }
  })
  window.addEventListener('resize', closeMenu)

  menu.addEventListener('click', e => {
    const a = e.target.closest('a[data-act]')
    if (!a) return
    e.preventDefault()
    const id = menu.dataset.id
    closeMenu()
    act(a.dataset.act, id)
  })

  // ---- actions ----
  function act (what, id) {
    const item = itemOf(id)
    const values = item ? item.values() : { text: id, tags: [] }
    const meta = notes[id] || {}
    const path = '/notes/' + encodeURIComponent(id)
    switch (what) {
      case 'view':
        location.href = `${serverurl}/${id}?view`
        break
      case 'title':
        dialog({
          title: '修改標題',
          input: { label: '標題', value: plain(values.text), hint: '會改寫筆記內容裡的第一個標題（# 開頭的那一行）。' },
          ok: '儲存',
          onOk: v => api('POST', path + '/title', { title: v.input }).then(() => { toast('已修改標題'); refresh() })
        })
        break
      case 'tags':
        dialog({
          title: '編輯標籤',
          input: { label: '標籤', value: (values.tags || []).map(plain).join(', '), placeholder: '例如：研究, 課程', hint: '用逗號分隔；留空會移除所有標籤。會改寫筆記裡的 tags 那一行。' },
          ok: '儲存',
          onOk: v => {
            const list = v.input.split(/[,，、]/).map(t => t.trim()).filter(Boolean)
            return api('POST', path + '/tags', { tags: list }).then(() => { toast('已更新標籤'); refresh() })
          }
        })
        break
      case 'move':
        dialog({
          title: '移動到資料夾',
          item: { title: plain(values.text) },
          choices: [{ value: null, label: '不放在資料夾', icon: 'fa-inbox', selected: !meta.folderId }].concat(
            folders.map(f => ({ value: f.id, label: f.name, icon: 'fa-folder-o', selected: meta.folderId === f.id }))
          ),
          ok: '移動',
          onOk: v => {
            const name = (v.extra || '').trim()
            const target = name
              ? api('POST', '/folders', { name }).then(r => { folders.push(r.folder); folders.sort((a, b) => a.name.localeCompare(b.name)); return r.folder.id })
              : Promise.resolve(v.choice || null)
            return target.then(folderId => api('POST', path + '/meta', { folderId }).then(r => {
              notes[id] = Object.assign({}, meta, { folderId: r.folderId })
              renderFolders()
              applyFilter()
              toast(r.folderId ? '已移到「' + folderName(r.folderId) + '」' : '已移出資料夾')
            }))
          }
        })
        break
      case 'team':
        dialog({
          title: '移到團隊',
          message: '團隊的成員都能閱讀、編輯團隊裡的筆記（包含私人筆記）。',
          item: { title: plain(values.text) },
          choices: [{ value: null, label: '不放在團隊（我的空間）', icon: 'fa-user', selected: !meta.teamId }].concat(
            teamList.map(t => ({ value: t.id, label: t.name, icon: 'fa-users', selected: meta.teamId === t.id }))
          ),
          ok: '移動',
          noNewFolder: true,
          onOk: v => api('POST', path + '/team', { teamId: v.choice || null }).then(r => {
            notes[id] = Object.assign({}, meta, { teamId: r.teamId })
            const t = teamList.find(x => x.id === r.teamId)
            toast(t ? '已移到團隊「' + t.name + '」' : '已移回我的空間')
          })
        })
        break
      case 'leave-team':
        dialog({
          title: '移出團隊',
          message: '把這篇筆記移出團隊，回到建立者的「我的空間」？團隊成員之後就不能再編輯它（除非筆記本身的權限允許）。',
          item: { title: plain(values.text) },
          ok: '移出',
          onOk: () => api('POST', path + '/team', { teamId: null }).then(() => { toast('已移出團隊'); refresh() })
        })
        break
      case 'duplicate':
        api('POST', path + '/duplicate', {}).then(() => { toast('已建立副本'); refresh() }).catch(err => toast(err.message))
        break
      case 'pin':
        togglePin(id)
        break
      case 'star':
        api('POST', path + '/meta', { starred: !meta.starred }).then(r => {
          notes[id] = Object.assign({}, meta, { starred: r.starred })
          applyFilter()
          toast(r.starred ? '已加入收藏' : '已取消收藏')
        }).catch(err => toast(err.message))
        break
      case 'share': {
        const url = meta.shortid ? `${serverurl}/s/${meta.shortid}` : `${serverurl}/${id}/publish`
        copy(url, meta.permission === 'private' ? '已複製發表頁連結（這是私人筆記，只有你看得到）' : '已複製發表頁連結')
        break
      }
      case 'copy':
        copy(`${serverurl}/${id}`, '已複製筆記連結')
        break
      case 'forget':
        dialog({
          title: '從紀錄移除',
          message: '把這篇筆記從你的紀錄中移除嗎？筆記本身不會被刪除。',
          item: { title: plain(values.text), sub: values.time },
          ok: '移除',
          onOk: () => removeFromHistory(id).then(() => toast('已從紀錄移除'))
        })
        break
      case 'delete':
        dialog({
          title: '刪除筆記',
          message: '確定刪除這篇筆記嗎？筆記會移到垃圾桶，其他人將無法再開啟；30 天內可以在垃圾桶還原。',
          item: { title: plain(values.text), sub: values.time },
          ok: '刪除',
          danger: true,
          onOk: () => api('DELETE', path, {}).then(() => { delete notes[id]; toast('已移到垃圾桶'); refresh() })
        })
        break
    }
  }

  // ---- card flags (bookmark, folder) ----
  function decorate (item) {
    const el = item.elm
    if (!el) return
    const values = item.values()
    const meta = notes[values.id] || {}
    const group = groupOf(values)
    el.dataset.group = group
    el.dataset.groupCount = group ? countOf(group) : ''
    // one row: who can read it (lock / globe, like HackMD's), the title, then a book or
    // a note (a book opens in book mode)
    const title = el.querySelector('h4.text')
    if (title) {
      let kind = el.querySelector('.ctp-card-kind')
      let perm = el.querySelector('.ctp-card-head .ctp-card-perm')
      if (!kind) {
        const head = document.createElement('div')
        head.className = 'ctp-card-head'
        title.parentNode.insertBefore(head, title)
        perm = document.createElement('i')
        perm.className = 'fa ctp-card-perm'
        perm.hidden = true // until the note's facts have loaded
        head.appendChild(perm)
        head.appendChild(title)
        kind = document.createElement('i')
        kind.setAttribute('aria-hidden', 'true')
        head.appendChild(kind)
      }
      kind.className = 'fa ctp-card-kind ' + (meta.book ? 'fa-book' : 'fa-file-text-o')
      kind.title = meta.book ? '書本' : '筆記'
      if (perm && meta.permission) {
        const open = ['freely', 'editable', 'locked'].includes(meta.permission)
        const signed = ['limited', 'protected'].includes(meta.permission)
        perm.className = 'fa ctp-card-perm ' + (open ? 'fa-globe' : signed ? 'fa-users' : 'fa-lock')
        perm.title = open ? '公開：任何人都能閱讀' : signed ? '登入的使用者能閱讀' : '私人：只有你能閱讀'
        perm.hidden = false
      } else if (perm) {
        perm.hidden = true
      }
    }
    const link = el.querySelector('a')
    if (link && meta.book && meta.shortid) link.setAttribute('href', serverurl + '/b/' + encodeURIComponent(meta.shortid))
    const flags = el.querySelector('.ctp-card-flags')
    if (!flags) return
    flags.innerHTML = ''
    if (meta.starred) {
      const i = document.createElement('i')
      i.className = 'fa fa-bookmark ctp-card-star'
      i.title = '已收藏'
      flags.appendChild(i)
    }
    if (meta.folderId && folderName(meta.folderId)) {
      const s = document.createElement('span')
      s.className = 'ctp-card-folder'
      const i = document.createElement('i')
      i.className = 'fa fa-folder-o'
      s.appendChild(i)
      s.appendChild(document.createTextNode(' ' + folderName(meta.folderId)))
      flags.appendChild(s)
    }
  }

  // ---- sidebar: scopes and folders ----
  function renderFolders () {
    const $list = $('.ctp-folder-list').empty()
    folders.forEach(f => {
      const count = Object.keys(notes).filter(k => notes[k].folderId === f.id).length
      const $a = $('<a href="#" data-scope="folder"></a>').attr('data-id', f.id)
      $a.append('<i class="fa fa-folder-o fa-fw" aria-hidden="true"></i> ')
      $a.append($('<span class="ctp-folder-name"></span>').text(f.name))
      $a.append($('<span class="ctp-folder-count"></span>').text(count))
      $a.append('<span class="ctp-folder-tools"><button type="button" class="ctp-folder-rename" title="重新命名" aria-label="重新命名資料夾"><i class="fa fa-pencil"></i></button><button type="button" class="ctp-folder-delete" title="刪除資料夾" aria-label="刪除資料夾"><i class="fa fa-trash-o"></i></button></span>')
      $list.append($a)
    })
    if (!folders.length) $list.append($('<p class="ctp-folder-empty"></p>').text('還沒有資料夾'))
    const starred = Object.keys(notes).filter(k => notes[k].starred).length
    $('.ctp-scope-nav [data-scope="starred"] .ctp-folder-count').text(starred || '')
    if (scope.type === 'folder' && !folders.find(f => f.id === scope.id)) scope = { type: 'all', id: null }
    markScope()
  }

  function markScope () {
    $('.ctp-organize [data-scope], .ctp-tags-side [data-scope]').each(function () {
      const on = this.dataset.scope === scope.type && ((scope.type !== 'folder' && scope.type !== 'tag') || this.dataset.id === scope.id)
      $(this).toggleClass('active', on).attr('aria-current', on ? 'true' : null)
    })
  }

  $(document).on('click', '.ctp-organize [data-scope], .ctp-tags-side [data-scope]', function (e) {
    e.preventDefault()
    if ($(e.target).closest('.ctp-folder-tools').length) return
    // a tag clicked again goes back to all notes
    const next = { type: this.dataset.scope, id: this.dataset.id || null }
    scope = (next.type === 'tag' || next.type === 'untagged') && next.type === scope.type && next.id === scope.id ? { type: 'all', id: null } : next
    markScope()
    applyFilter()
  })

  $(document).on('click', '.ctp-folder-add', e => {
    e.preventDefault()
    dialog({
      title: '新增資料夾',
      input: { label: '名稱', value: '', placeholder: '例如：課程' },
      ok: '新增',
      onOk: v => api('POST', '/folders', { name: v.input }).then(r => {
        folders.push(r.folder)
        folders.sort((a, b) => a.name.localeCompare(b.name))
        renderFolders()
        toast('已新增資料夾')
      })
    })
  })

  $(document).on('click', '.ctp-folder-rename', function (e) {
    e.preventDefault()
    e.stopPropagation()
    const id = $(this).closest('[data-id]').attr('data-id')
    dialog({
      title: '重新命名資料夾',
      input: { label: '名稱', value: folderName(id) },
      ok: '儲存',
      onOk: v => api('POST', '/folders/' + id, { name: v.input }).then(r => {
        folders = folders.map(f => f.id === id ? r.folder : f).sort((a, b) => a.name.localeCompare(b.name))
        renderFolders()
        list.update()
      })
    })
  })

  $(document).on('click', '.ctp-folder-delete', function (e) {
    e.preventDefault()
    e.stopPropagation()
    const id = $(this).closest('[data-id]').attr('data-id')
    dialog({
      title: '刪除資料夾',
      message: '刪除這個資料夾嗎？裡面的筆記不會被刪除，會回到「不放在資料夾」。',
      item: { title: folderName(id) },
      ok: '刪除資料夾',
      danger: true,
      onOk: () => api('DELETE', '/folders/' + id, {}).then(() => {
        folders = folders.filter(f => f.id !== id)
        Object.keys(notes).forEach(k => { if (notes[k].folderId === id) notes[k].folderId = null })
        renderFolders()
        applyFilter()
        toast('已刪除資料夾')
      })
    })
  })

  // ---- feature 24: workspaces (my space / teams), like HackMD's switcher ----
  const WS_KEY = 'lilith-workspace'
  let teamList = [] // [{ id, name, role, members, notes }]
  let currentTeam = null
  // ?team=<id> opens that team, an empty ?team= the user's own space (the editor's
  // workspace link); otherwise the last workspace
  try {
    const q = new URLSearchParams(location.search)
    currentTeam = q.has('team') ? (q.get('team') || null) : (localStorage.getItem(WS_KEY) || null)
  } catch (e) {}

  function team () {
    return currentTeam ? teamList.find(t => t.id === currentTeam) || null : null
  }

  function loadTeams () {
    return api('GET', '/teams').then(data => {
      teamList = data.teams || []
      if (currentTeam && !team()) currentTeam = null
      renderWorkspace()
    }).catch(() => { teamList = []; currentTeam = null; renderWorkspace() })
  }

  function setWorkspace (id) {
    currentTeam = id
    try {
      if (id) localStorage.setItem(WS_KEY, id)
      else localStorage.removeItem(WS_KEY)
      const url = new URL(location.href)
      if (id) url.searchParams.set('team', id)
      else url.searchParams.delete('team')
      history.replaceState(null, '', url.pathname + url.search + url.hash)
    } catch (e) {}
    scope = { type: 'all', id: null }
    renderWorkspace()
    refresh()
  }

  // a team shows its picture or first letter, my space my picture (or a person icon)
  function setBadge ($el, name, photo) {
    $el.empty().removeClass('ctp-ws-photo')
    if (photo && /^https?:\/\//i.test(photo)) $el.addClass('ctp-ws-photo').append($('<img alt="">').attr('src', photo))
    else if (name) $el.text(Array.from(name)[0] || '?')
    else $el.html('<i class="fa fa-user"></i>')
  }
  function myPhoto () {
    const src = $('.ui-avatar').attr('src')
    return src && /^https?:\/\//i.test(src) ? src : ''
  }

  function renderWorkspace () {
    const t = team()
    $('.ctp-workspace').toggle(signedIn)
    $('.ctp-ws-name').text(t ? t.name : '我的空間')
    setBadge($('.ctp-workspace-toggle .ctp-ws-badge'), t ? t.name : null, t ? t.photo : myPhoto())
    $('#history').toggleClass('ctp-team-mode', !!t)
    // the empty-list message: "no history" for my space, "no notes yet" for a team
    const $empty = $('.ui-nohistory')
    if (!$empty.attr('data-text')) $empty.attr('data-text', $empty.text().trim())
    $empty.text(t ? '團隊還沒有筆記，按「新增團隊筆記」建立第一篇，或從「我的空間」把筆記移到團隊。' : $empty.attr('data-text'))
    const $bar = $('.ctp-team-bar')
    $bar.prop('hidden', !t)
    if (t) {
      $bar.find('.ctp-team-bar-name span').text(t.name)
      $bar.find('.ctp-team-bar-settings').attr('href', `${serverurl}/team/${encodeURIComponent(t.id)}/settings`)
      $bar.find('.ctp-team-bar-page').attr('href', `${serverurl}/t/${encodeURIComponent(t.handle || t.id)}`) // feature 27
      $bar.find('.ctp-team-bar-trash').prop('hidden', !(t.role === 'owner' || t.role === 'admin'))
    }
    const $menu = $('.ctp-workspace-menu').empty()
    // the current workspace on top (feature 28, like HackMD): picture, name, @address and,
    // for a team, its settings
    const $head = $('<div class="ctp-ws-head"></div>')
    const $big = $('<span class="ctp-ws-badge ctp-ws-big" aria-hidden="true"></span>')
    setBadge($big, t ? t.name : null, t ? t.photo : myPhoto())
    const $who = $('<span class="ctp-ws-who"></span>')
    $who.append($('<strong></strong>').text(t ? t.name : '我的空間'))
    if (t) $who.append($('<span class="ctp-ws-handle"></span>').text('@' + (t.handle || t.name)))
    $head.append($big).append($who)
    if (t) {
      $head.append($('<a class="ctp-ws-gear" role="menuitem" title="團隊設定" aria-label="團隊設定"><i class="fa fa-cog" aria-hidden="true"></i></a>')
        .attr('href', `${serverurl}/team/${encodeURIComponent(t.id)}/settings`))
    }
    $menu.append($head).append('<div class="ctp-ws-divider"></div>')
    function item (id, label, sub, badge, photo) {
      const $b = $('<button type="button" role="menuitemradio"></button>').attr('data-ws', id || '')
      $b.attr('aria-checked', (id || null) === currentTeam ? 'true' : 'false')
      const $badge = $('<span class="ctp-ws-badge" aria-hidden="true"></span>')
      setBadge($badge, badge, photo)
      $b.append($badge)
      const $t = $('<span class="ctp-ws-text"></span>').append($('<span class="ctp-ws-label"></span>').text(label))
      if (sub) $t.append($('<span class="ctp-ws-sub"></span>').text(sub))
      $b.append($t)
      if ((id || null) === currentTeam) $b.append('<i class="fa fa-check ctp-ws-check" aria-hidden="true"></i>')
      $menu.append($b)
    }
    item(null, '我的空間', '', null, myPhoto())
    const roleName = { owner: '擁有者', admin: '管理者', member: '成員' }
    teamList.forEach(t => item(t.id, t.name, roleName[t.role] + '・' + t.members + ' 人', t.name, t.photo))
    $menu.append('<div class="ctp-ws-divider"></div>')
    $menu.append('<button type="button" class="ctp-ws-new" role="menuitem"><i class="fa fa-plus fa-fw" aria-hidden="true"></i> 建立新團隊</button>')
  }

  function closeWorkspace () {
    $('.ctp-workspace-menu').prop('hidden', true)
    $('.ctp-workspace-toggle').attr('aria-expanded', 'false')
  }
  $(document).on('click', '.ctp-workspace-toggle', e => {
    e.stopPropagation()
    const open = $('.ctp-workspace-menu').prop('hidden')
    $('.ctp-workspace-menu').prop('hidden', !open)
    $('.ctp-workspace-toggle').attr('aria-expanded', open ? 'true' : 'false')
  })
  $(document).on('click', e => { if (!$(e.target).closest('.ctp-workspace').length) closeWorkspace() })
  $(document).on('keydown', e => { if (e.key === 'Escape') closeWorkspace() })
  $(document).on('click', '.ctp-workspace-menu [data-ws]', function () {
    closeWorkspace()
    const id = this.dataset.ws || null
    if (id !== currentTeam) setWorkspace(id)
  })
  $(document).on('click', '.ctp-ws-new', () => {
    closeWorkspace()
    dialog({
      title: '建立新團隊',
      input: { label: '團隊名稱', value: '', placeholder: '例如：115 產學合作' },
      ok: '建立',
      onOk: v => api('POST', '/teams', { name: v.input }).then(r => {
        teamList.push(Object.assign({ members: 1, notes: 0 }, r.team))
        toast('已建立團隊「' + r.team.name + '」')
        setWorkspace(r.team.id)
      })
    })
  })
  $(document).on('click', '.ctp-team-bar-new', () => {
    const t = team()
    if (!t) return
    api('POST', '/teams/' + encodeURIComponent(t.id) + '/notes', {}).then(r => { location.href = r.url }).catch(err => toast(err.message))
  })

  // the team's notes go into the list instead of my history
  function loadTeam (done) {
    const t = team()
    if (!t) return done && done()
    Promise.all([api('GET', '/teams/' + encodeURIComponent(t.id) + '/notes'), api('GET', '/notes/meta')]).then(([data, meta]) => {
      // switched to another workspace meanwhile: this answer is for a list no longer shown
      if (currentTeam !== t.id) return done && done()
      $('.ctp-organize').show() // folders and bookmarks work for team notes too
      folders = meta.folders || []
      notes = {}
      list.clear()
      list.add((data.notes || []).map(n => {
        notes[n.id] = n
        return {
          id: n.id,
          // escaped like history.js does: list.js and cover.js put them in as HTML
          text: escapeText(n.text || ''),
          timestamp: n.time,
          fromNow: moment(n.time).fromNow(),
          time: moment(n.time).format('llll'),
          tags: (n.tags || []).map(escapeText),
          pinned: false
        }
      }))
      renderFolders()
      applyFilter()
      if (done) done()
    }).catch(err => { toast(err.message); if (done) done() })
  }

  // ---- feature 22: tags in the side bar, sorting / grouping, grid or list ----
  // tags in the history are stored HTML-escaped (cover.js puts them in as HTML)
  const decoder = document.createElement('textarea')
  function plain (html) {
    decoder.innerHTML = html
    return decoder.value
  }

  function renderTags () {
    const counts = {}
    let untagged = 0
    list.items.forEach(item => {
      const t = item.values().tags || []
      if (!t.length) untagged++
      t.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1 })
    })
    const names = Object.keys(counts).sort((a, b) => plain(a).localeCompare(plain(b), 'zh-Hant'))
    const $list = $('.ctp-tag-list').empty()
    function entry (type, id, label, count, icon) {
      const $a = $('<a href="#"></a>').attr('data-scope', type)
      if (id !== null) $a.attr('data-id', id)
      $a.append($('<i class="fa fa-fw" aria-hidden="true"></i>').addClass(icon)).append(' ')
      $a.append($('<span class="ctp-folder-name"></span>').text(label))
      $a.append($('<span class="ctp-folder-count"></span>').text(count))
      $list.append($a)
    }
    if (untagged) entry('untagged', null, '無標籤', untagged, 'fa-tag')
    names.forEach(tag => entry('tag', tag, plain(tag), counts[tag], 'fa-tag'))
    if (!names.length && !untagged) $list.append($('<p class="ctp-folder-empty"></p>').text('還沒有標籤'))
    if (scope.type === 'tag' && !counts[scope.id]) scope = { type: 'all', id: null }
    filterTagList()
    markScope()
  }

  function filterTagList () {
    const q = ($('.ctp-tag-filter').val() || '').trim().toLowerCase()
    $('.ctp-tag-list [data-scope]').each(function () {
      this.hidden = !!q && $(this).find('.ctp-folder-name').text().toLowerCase().indexOf(q) < 0
    })
  }
  $(document).on('input', '.ctp-tag-filter', filterTagList)

  // preferences (per browser): order, grouping, grid / list
  const PREFS_KEY = 'lilith-list-prefs'
  const prefs = { sort: 'recent', group: 'tag', view: 'grid' }
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')) } catch (e) {}
  function savePrefs () {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch (e) {}
  }

  // the group a note is shown under ('' = no heading)
  function groupOf (v) {
    if (prefs.group === 'none') return ''
    if (v.pinned) return '已釘選'
    if (prefs.group === 'year') return String(new Date(v.timestamp).getFullYear())
    const t = v.tags || []
    return t.length ? plain(t[0]) : '無標籤'
  }

  function sortList () {
    const order = {
      recent: (a, b) => b.timestamp - a.timestamp,
      oldest: (a, b) => a.timestamp - b.timestamp,
      title: (a, b) => plain(a.text).localeCompare(plain(b.text), 'zh-Hant'),
      'title-desc': (a, b) => plain(b.text).localeCompare(plain(a.text), 'zh-Hant')
    }[prefs.sort] || ((a, b) => b.timestamp - a.timestamp)
    list.sort('', {
      sortFunction (x, y) {
        const a = x.values()
        const b = y.values()
        if (prefs.group !== 'none') {
          // pinned first, then the groups: tags A-Z with untagged last, or years newest first
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          if (!a.pinned) {
            const ga = groupOf(a)
            const gb = groupOf(b)
            if (ga !== gb) {
              if (prefs.group === 'year') return Number(gb) - Number(ga)
              if (ga === '無標籤') return 1
              if (gb === '無標籤') return -1
              return ga.localeCompare(gb, 'zh-Hant')
            }
          }
        }
        return order(a, b)
      }
    })
    markPrefs()
  }

  // counts per group over the notes that pass the filter (not only this page)
  let groupCounts = null
  function beginUpdate () { groupCounts = null }
  function countOf (label) {
    if (!groupCounts) {
      groupCounts = {}
      list.matchingItems.forEach(item => {
        const g = groupOf(item.values())
        groupCounts[g] = (groupCounts[g] || 0) + 1
      })
    }
    return groupCounts[label] || 0
  }

  function markPrefs () {
    $('.ctp-sort [data-sort-mode]').each(function () {
      const on = this.dataset.sortMode === prefs.sort
      $(this).toggleClass('active', on).attr('aria-checked', on ? 'true' : 'false')
    })
    $('.ctp-sort [data-group-mode]').each(function () {
      const on = this.dataset.groupMode === prefs.group
      $(this).toggleClass('active', on).attr('aria-checked', on ? 'true' : 'false')
    })
    $('.ctp-view-toggle [data-view]').each(function () {
      const on = this.dataset.view === prefs.view
      $(this).toggleClass('active', on).attr('aria-pressed', on ? 'true' : 'false')
    })
    $('#history-list').toggleClass('ctp-list-view', prefs.view === 'list')
  }

  $(document).on('click', '.ctp-sort [data-sort-mode], .ctp-sort [data-group-mode]', function (e) {
    e.preventDefault()
    if (this.dataset.sortMode) prefs.sort = this.dataset.sortMode
    if (this.dataset.groupMode) prefs.group = this.dataset.groupMode
    savePrefs()
    sortList()
  })
  $(document).on('click', '.ctp-view-toggle [data-view]', function () {
    prefs.view = this.dataset.view
    savePrefs()
    markPrefs()
  })
  // "建立資料夾" in the toolbar = the side bar's +
  $(document).on('click', '.ctp-folder-new', () => $('.ctp-folder-add').first().trigger('click'))
  markPrefs()

  // ---- filtering (scope + tags from cover.js) ----
  function applyFilter () {
    const byScope = scope.type !== 'all'
    const byTags = tags.length > 0
    if (!byScope && !byTags) list.filter()
    else {
      list.filter(item => {
        const v = item.values()
        const meta = notes[v.id] || {}
        if (scope.type === 'starred' && !meta.starred) return false
        if (scope.type === 'folder' && meta.folderId !== scope.id) return false
        if (scope.type === 'tag' && !(v.tags || []).includes(scope.id)) return false
        if (scope.type === 'untagged' && (v.tags || []).length) return false
        if (byTags && !(v.tags || []).some(t => tags.includes(t))) return false
        return true
      })
    }
  }

  function setTags (selected) {
    tags = selected
    applyFilter()
  }

  return { loadMeta, reset, decorate, setTags, applyFilter, closeMenu, renderTags, sortList, beginUpdate, loadTeams: () => { signedIn = true; return loadTeams() }, loadTeam, team }
}
