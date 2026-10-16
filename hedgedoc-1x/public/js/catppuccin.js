/* Catppuccin theme switcher
 *
 * Loaded synchronously in <head> so the flavor is applied before first paint.
 * Stores the choice in localStorage ('ctpFlavor': 'auto' | flavor id) and keeps
 * HedgeDoc's own night mode flag ('nightMode') in sync with dark flavors.
 */
(function () {
  // A slide deck that picks its own reveal.js theme keeps that theme untouched
  if (document.documentElement.getAttribute('data-ctp-slides') === 'custom') return
  // lets the CSS keep the home quote hidden until it starts typing (no flash of the whole sentence)
  document.documentElement.classList.add('ctp-js')

  const FLAVORS = [
    { id: 'latte', name: 'Latte', dark: false, base: '#eff1f5', accent: '#cba6f7' }, // Mocha's accent (hhyn)
    { id: 'frappe', name: 'Frappé', dark: true, base: '#303446', accent: '#ca9ee6' },
    { id: 'macchiato', name: 'Macchiato', dark: true, base: '#24273a', accent: '#c6a0f6' },
    { id: 'mocha', name: 'Mocha', dark: true, base: '#1e1e2e', accent: '#cba6f7' }
  ]
  const STORAGE_KEY = 'ctpFlavor'
  const switchers = []
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

  function readChoice () {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY)
      if (value === 'auto' || FLAVORS.some(f => f.id === value)) return value
    } catch (e) {}
    return 'auto'
  }

  function resolve (choice) {
    if (choice !== 'auto') return FLAVORS.find(f => f.id === choice)
    const prefersDark = darkQuery ? darkQuery.matches : false
    return FLAVORS.find(f => f.id === (prefersDark ? 'mocha' : 'latte'))
  }

  function apply (choice) {
    const flavor = resolve(choice)
    const root = document.documentElement
    root.setAttribute('data-ctp', flavor.id)
    root.setAttribute('data-ctp-mode', flavor.dark ? 'dark' : 'light')
    try {
      // HedgeDoc reads this with store.js (JSON) to decide on body.night
      window.localStorage.setItem('nightMode', flavor.dark ? 'true' : 'false')
    } catch (e) {}
    if (document.body) document.body.classList.toggle('night', flavor.dark)
    updateSwitchers(choice, flavor)
    return flavor
  }

  function save (choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice)
    } catch (e) {}
  }

  let currentChoice = readChoice()
  apply(currentChoice)
  // chosen in another tab or in a frame (the book editing page): follow it
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY) return
    currentChoice = readChoice()
    apply(currentChoice)
  })

  if (darkQuery && darkQuery.addEventListener) {
    darkQuery.addEventListener('change', function () {
      if (currentChoice === 'auto') apply(currentChoice)
    })
  }

  // ---- switcher UI ----

  function swatch (flavor) {
    const el = document.createElement('span')
    el.className = 'ctp-swatch'
    el.style.background = flavor.base
    el.style.boxShadow = 'inset 0 0 0 3px ' + flavor.base + ', inset 0 0 0 10px ' + flavor.accent
    return el
  }

  function buildSwitcher (extraClass) {
    const wrapper = document.createElement('div')
    wrapper.className = 'ctp-switcher ' + (extraClass || '')

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'btn btn-default ctp-switcher-toggle'
    button.title = '切換主題'
    button.setAttribute('aria-haspopup', 'true')
    button.setAttribute('aria-expanded', 'false')
    const icon = document.createElement('i')
    icon.className = 'fa fa-paint-brush'
    const label = document.createElement('span')
    label.className = 'ctp-switcher-label'
    button.appendChild(icon)
    button.appendChild(label)

    const menu = document.createElement('ul')
    menu.className = 'ctp-menu'
    menu.setAttribute('role', 'menu')

    const options = [{ id: 'auto', name: '跟隨系統' }].concat(FLAVORS)
    options.forEach(function (option) {
      const item = document.createElement('li')
      const link = document.createElement('a')
      link.href = '#'
      link.setAttribute('role', 'menuitemradio')
      link.setAttribute('data-ctp-choice', option.id)
      if (option.id === 'auto') {
        const dot = document.createElement('span')
        dot.className = 'ctp-swatch ctp-swatch-auto'
        link.appendChild(dot)
      } else {
        link.appendChild(swatch(option))
      }
      const text = document.createElement('span')
      text.textContent = option.name
      link.appendChild(text)
      link.addEventListener('click', function (event) {
        event.preventDefault()
        currentChoice = option.id
        save(currentChoice)
        apply(currentChoice)
        close(wrapper)
      })
      item.appendChild(link)
      menu.appendChild(item)
    })

    button.addEventListener('click', function (event) {
      event.preventDefault()
      event.stopPropagation()
      const isOpen = wrapper.classList.contains('open')
      switchers.forEach(s => close(s.wrapper))
      if (!isOpen) {
        wrapper.classList.add('open')
        button.setAttribute('aria-expanded', 'true')
      }
    })

    wrapper.appendChild(button)
    wrapper.appendChild(menu)
    const switcher = { wrapper, label, menu }
    switchers.push(switcher)
    return switcher
  }

  function close (wrapper) {
    wrapper.classList.remove('open')
    const button = wrapper.querySelector('.ctp-switcher-toggle')
    if (button) button.setAttribute('aria-expanded', 'false')
  }

  function updateSwitchers (choice, flavor) {
    switchers.forEach(function (s) {
      s.label.textContent = choice === 'auto' ? '自動 · ' + flavor.name : flavor.name
      s.menu.querySelectorAll('a').forEach(function (a) {
        const active = a.getAttribute('data-ctp-choice') === choice
        a.classList.toggle('active', active)
        a.setAttribute('aria-checked', active ? 'true' : 'false')
      })
    })
  }

  // ---- home page: group the post list by year (like a blog archive) ----
  // Default sort (cover.js) puts pinned notes first, then newest first: those
  // leading pinned notes get their own "置頂" header. Sorting by time groups
  // purely by year; sorting by title shows no headers.

  function groupByYear (list) {
    let observer = null
    let pending = null

    function regroup () {
      pending = null
      observer.disconnect()
      list.querySelectorAll('li.ctp-year').forEach(li => li.remove())
      // Lilith (feature 22): lib/noteList.js tells each card its group ("已釘選", a tag,
      // a year) and how many notes the group has; the cards are already sorted by it
      let lastLabel = null
      list.querySelectorAll(':scope > li').forEach(function (item) {
        const label = item.dataset.group
        if (!label) { lastLabel = null; return }
        if (label !== lastLabel) {
          const header = document.createElement('li')
          header.className = 'ctp-year'
          header.textContent = label
          if (item.dataset.groupCount) {
            const count = document.createElement('span')
            count.className = 'ctp-year-count'
            count.textContent = item.dataset.groupCount
            header.appendChild(count)
          }
          list.insertBefore(header, item)
          lastLabel = label
        }
      })
      observer.observe(list, { childList: true })
    }

    // list.js adds the items first and cover.js marks pinned ones afterwards,
    // so regroup on the next tick, once per burst of mutations.
    function schedule () {
      if (pending === null) pending = setTimeout(regroup, 0)
    }

    observer = new MutationObserver(schedule)
    regroup()

    // cover.js toggles a pin without re-sorting the list. After the user's
    // click is saved (cover.js flips the class only on success), use the
    // page's own "refresh history" so pinned notes move under "置頂".
    // Capture phase: for guests cover.js flips the class synchronously in its
    // own click handler, so the state must be read before that runs.
    list.addEventListener('click', function (event) {
      const pin = event.target.closest('.ui-history-pin')
      if (!pin) return
      const before = pin.classList.contains('active')
      const watcher = new MutationObserver(function () {
        if (pin.classList.contains('active') === before) return
        watcher.disconnect()
        const refresh = document.querySelector('#history .ui-refresh-history')
        if (refresh) refresh.click()
      })
      watcher.observe(pin, { attributes: true, attributeFilter: ['class'] })
      setTimeout(() => watcher.disconnect(), 5000)
    }, true)
  }

  // ---- home page: type out the quotes, one after another ----
  // The server renders one random quote; all of them are in data-quotes. Each
  // quote is typed out, stays for HOLD_MS, is erased (backspace) and the next
  // random one (never the same twice in a row) is typed. Characters are laid
  // out from the start (hidden), and the heading reserves the height of the
  // tallest quote, so the hero does not jump; screen readers get the sentence.
  const HOLD_MS = 3000
  const TYPE_MS = 90
  const PAUSE_MS = 260
  const ERASE_MS = 35

  function typewriter (el) {
    if (el.getAttribute('data-tw-started')) return
    el.setAttribute('data-tw-started', '1')
    const source = el.parentNode.querySelector('.ctp-quote-source')
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let quotes = []
    try { quotes = JSON.parse(el.getAttribute('data-quotes') || '[]') } catch (e) {}
    quotes = quotes.filter(function (q) { return q && q.text })
    let current = {
      text: el.textContent.trim(),
      source: source ? source.textContent.replace(/^——\s*/, '') : '',
      lang: el.getAttribute('lang') || ''
    }
    if (!current.text || reduce) {
      el.classList.add('ctp-tw-ready')
      if (source) source.classList.add('ctp-shown')
      return
    }

    const caret = document.createElement('span')
    caret.className = 'ctp-tw-caret'
    caret.setAttribute('aria-hidden', 'true')

    // reserve the height of the tallest quote at the current width
    function reserveHeight () {
      const probe = el.cloneNode(false)
      probe.removeAttribute('data-typewriter')
      probe.removeAttribute('data-quotes')
      // exactly the heading's width (the hero's padding box is wider and would undercount lines)
      probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;margin:0;min-height:0;pointer-events:none;width:' + el.clientWidth + 'px'
      el.parentNode.appendChild(probe)
      let max = 0
      quotes.concat([current]).forEach(function (q) {
        if (q.lang) probe.setAttribute('lang', q.lang)
        else probe.removeAttribute('lang')
        probe.textContent = q.text
        max = Math.max(max, probe.offsetHeight)
      })
      probe.remove()
      el.style.minHeight = max ? max + 'px' : ''
    }

    function render (q) {
      if (q.lang) el.setAttribute('lang', q.lang)
      else el.removeAttribute('lang')
      el.setAttribute('aria-label', q.text)
      el.textContent = ''
      const spans = Array.from(q.text).map(function (ch) {
        const span = document.createElement('span')
        span.className = 'ctp-tw-char'
        span.setAttribute('aria-hidden', 'true')
        span.textContent = ch
        el.appendChild(span)
        return span
      })
      el.insertBefore(caret, spans[0])
      if (source) {
        source.classList.remove('ctp-shown')
        source.textContent = '—— ' + q.source
      }
      return spans
    }

    function type (q) {
      const spans = render(q)
      const chars = Array.from(q.text)
      let i = 0
      function step () {
        spans[i].classList.add('ctp-shown')
        i += 1
        if (i < spans.length) {
          el.insertBefore(caret, spans[i])
          // pause a little longer after punctuation
          setTimeout(step, /[，。；：？！、,.;:?!]/.test(chars[i - 1]) ? PAUSE_MS : TYPE_MS)
        } else {
          el.appendChild(caret)
          if (source) source.classList.add('ctp-shown')
          hold(spans)
        }
      }
      setTimeout(step, 250)
    }

    // wait HOLD_MS (only while the tab is visible), then erase and go on
    function hold (spans) {
      if (quotes.length < 2) return
      setTimeout(function wait () {
        if (document.hidden) {
          document.addEventListener('visibilitychange', wait, { once: true })
          return
        }
        erase(spans)
      }, HOLD_MS)
    }

    function erase (spans) {
      if (source) source.classList.remove('ctp-shown')
      let i = spans.length
      function back () {
        i -= 1
        if (i < 0) {
          next()
          return
        }
        spans[i].classList.remove('ctp-shown')
        el.insertBefore(caret, spans[i])
        setTimeout(back, ERASE_MS)
      }
      back()
    }

    function next () {
      const others = quotes.filter(function (q) { return q.text !== current.text })
      current = others[Math.floor(Math.random() * others.length)] || current
      type(current)
    }

    el.classList.add('ctp-tw-ready')
    // start once the Mincho font is ready (at most 0.8 s), so glyphs and heights do not change mid-typing
    let started = false
    const begin = function () {
      if (started) return
      started = true
      reserveHeight()
      let resizeTimer = null
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(reserveHeight, 200)
      })
      type(current)
    }
    if (document.fonts && document.fonts.load) {
      document.fonts.load('600 1em "Lilith Quote JP"', quotes.map(function (q) { return q.text }).join('') || current.text).then(begin, begin)
    }
    setTimeout(begin, 800)
  }

  // Start the quote as soon as it has been parsed (its source line follows it),
  // instead of waiting for every script on the page.
  function startQuote () {
    const quote = document.querySelector('[data-typewriter]')
    if (!quote || !document.querySelector('.ctp-quote-source')) return false
    typewriter(quote)
    return true
  }
  if (document.readyState === 'loading' && window.MutationObserver) {
    const early = new MutationObserver(function () {
      if (startQuote()) early.disconnect()
    })
    early.observe(document.documentElement, { childList: true, subtree: true })
    document.addEventListener('DOMContentLoaded', function () { early.disconnect() })
  }

  // ---- show / hide password: an eye button inside every password field ----
  function passwordToggle (input) {
    if (input.closest('.ctp-pw')) return
    const wrap = document.createElement('span')
    wrap.className = 'ctp-pw'
    input.parentNode.insertBefore(wrap, input)
    wrap.appendChild(input)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ctp-pw-toggle'
    const icon = document.createElement('i')
    icon.className = 'fa fa-eye'
    icon.setAttribute('aria-hidden', 'true')
    button.appendChild(icon)
    function set (show) {
      input.type = show ? 'text' : 'password'
      icon.className = show ? 'fa fa-eye-slash' : 'fa fa-eye'
      button.setAttribute('aria-pressed', show ? 'true' : 'false')
      button.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼')
      button.title = show ? '隱藏密碼' : '顯示密碼'
    }
    set(false)
    button.addEventListener('click', function () {
      const start = input.selectionStart
      const end = input.selectionEnd
      set(input.type === 'password')
      input.focus()
      try { input.setSelectionRange(start, end) } catch (e) {}
    })
    // never submit (or let the browser remember) the field as plain text
    if (input.form) input.form.addEventListener('submit', function () { set(false) })
    wrap.appendChild(button)
  }

  // ---- editor: note title in the middle of the navbar (like HackMD) ----
  // The title follows document.title ("<title> - Lilith"); the icon follows the
  // permission label in the info bar: a lock for notes guests cannot read.
  function navTitle (box) {
    const icon = box.querySelector('i')
    const text = box.querySelector('span')
    const titleEl = document.querySelector('title')
    function update () {
      const t = document.title.replace(/ - Lilith$/, '')
      text.textContent = t === 'Lilith' ? '' : t
      const label = document.querySelector('.ui-permission-label')
      const html = label ? label.innerHTML : ''
      const closed = /fa-hand-stop-o|fa-umbrella|fa-id-card/.test(html)
      icon.className = 'fa fa-fw ' + (html ? (closed ? 'fa-lock' : 'fa-globe') : '')
    }
    update()
    const watch = new MutationObserver(update)
    if (titleEl) watch.observe(titleEl, { childList: true, characterData: true, subtree: true })
    const label = document.querySelector('.ui-permission-label')
    if (label) watch.observe(label, { childList: true, subtree: true })

    // the note's tags as chips after the title (like HackMD); shown when the note has
    // loaded and on Ctrl+S / Cmd+S ("save": HedgeDoc saves by itself, the shortcut only
    // shows the tags and says so instead of the browser's "save page" dialog)
    const chips = document.createElement('span')
    chips.className = 'ctp-nav-tags'
    box.appendChild(chips)
    let shown = ''
    function noteTags () {
      const meta = (window.md && window.md.meta) || {}
      let raw = []
      if (typeof meta.tags === 'string' || typeof meta.tags === 'number') raw = String(meta.tags).split(',')
      else if (Array.isArray(meta.tags)) raw = meta.tags.filter(function (t) { return typeof t === 'string' || typeof t === 'number' }).map(String)
      else {
        // "###### tags: `a` `b`" in the note
        document.querySelectorAll('.ui-view-area .markdown-body h6').forEach(function (h) {
          if (/^tags/i.test(h.textContent)) h.querySelectorAll('code').forEach(function (c) { raw.push(c.textContent) })
        })
      }
      const out = []
      raw.forEach(function (t) { t = t.trim(); if (t && out.indexOf(t) < 0) out.push(t) })
      return out
    }
    function showTags () {
      const tags = noteTags()
      const key = JSON.stringify(tags)
      if (key === shown) return
      shown = key
      chips.textContent = ''
      tags.slice(0, 5).forEach(function (t) {
        const chip = document.createElement('span')
        chip.className = 'ctp-nav-tag'
        chip.textContent = t
        chips.appendChild(chip)
      })
    }
    // when the note has loaded: the title changes then
    if (titleEl) new MutationObserver(function () { setTimeout(showTags, 300) }).observe(titleEl, { childList: true, characterData: true, subtree: true })
    setTimeout(showTags, 1500)
    let toastTimer = null
    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || (e.key || '').toLowerCase() !== 's') return
      e.preventDefault()
      showTags()
      const offline = !!document.querySelector('#online-user-list .label-danger')
      let toast = document.querySelector('.ctp-save-toast')
      if (!toast) {
        toast = document.createElement('div')
        toast.className = 'ctp-toast ctp-save-toast'
        toast.setAttribute('role', 'status')
        document.body.appendChild(toast)
      }
      toast.textContent = offline ? '目前離線，連線後會自動儲存' : '已儲存'
      toast.classList.add('ctp-shown')
      clearTimeout(toastTimer)
      toastTimer = setTimeout(function () { toast.classList.remove('ctp-shown') }, 1600)
    }, true)
  }

  // ---- editor: avatar menu (signed-in users, like HackMD) ----
  // header.ejs ships it hidden; /me tells whether someone is signed in.
  function userMenu (li) {
    // "my notes" points at serverURL/, so the menu knows the site root itself
    const home = li.querySelector('.ctp-user-menu a[href$="/"]')
    const base = (home ? home.getAttribute('href') : '/').replace(/\/$/, '')
    fetch(base + '/me', { credentials: 'same-origin' }).then(function (r) { return r.json() }).then(function (me) {
      if (!me || me.status !== 'ok') return
      li.querySelectorAll('.ctp-user-avatar').forEach(function (img) { img.src = me.photo })
      li.querySelector('.ctp-user-name').textContent = me.name || ''
      li.querySelector('.ctp-user-public').href = base + '/u/' + encodeURIComponent(me.id)
      li.style.display = ''
      workspaceBrand(base, me)
    }).catch(function () {})
  }

  // ---- editor: the top left shows the workspace, like HackMD: "我的空間" with the
  // user's picture, or the note's team (its first character in a circle) -- signed in only
  function workspaceBrand (base, me) {
    const brand = document.querySelector('.navbar-brand.header-brand')
    const ref = location.pathname.replace(/\/+$/, '').split('/').pop()
    if (!brand || !ref || !document.getElementById('textit')) return
    fetch(base + '/api/lilith/notes/' + encodeURIComponent(ref) + '/meta', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null })
      .catch(function () { return null })
      .then(function (m) {
        const ws = (m && m.workspace) || { kind: 'mine' }
        const team = ws.kind === 'team' && ws.name
        let mark
        if (team) {
          mark = document.createElement('span')
          mark.className = 'ctp-ws-mark ctp-ws-team'
          mark.textContent = Array.from(ws.name)[0] || '#'
        } else {
          mark = document.createElement('img')
          mark.className = 'ctp-ws-mark'
          mark.alt = ''
          mark.src = me.photo
        }
        const name = document.createElement('span')
        name.className = 'ctp-brand ctp-ws-name'
        name.textContent = team ? ws.name : '我的空間'
        brand.textContent = ''
        brand.appendChild(mark)
        brand.appendChild(name)
        brand.title = name.textContent
        brand.href = base + '/?team=' + (team ? encodeURIComponent(ws.id) : '')
      })
  }

  // ---- editor: "..." menu, import / export / download open to the side ----
  // Bootstrap 3 closes a dropdown on any click, so a submenu title stops it and
  // toggles its own list instead (hover opens it too, see catppuccin.css).
  function submenus () {
    document.querySelectorAll('.ctp-submenu-toggle').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        const item = a.parentNode
        const wasOpen = item.classList.contains('open')
        item.parentNode.querySelectorAll('.ctp-submenu.open').forEach(function (o) { o.classList.remove('open') })
        if (!wasOpen) item.classList.add('open')
      })
    })
    // a menu opened again starts with its submenus closed
    document.querySelectorAll('[data-toggle="dropdown"]').forEach(function (t) {
      t.addEventListener('click', function () {
        const menu = t.parentNode.querySelector('.dropdown-menu')
        if (menu) menu.querySelectorAll('.ctp-submenu.open').forEach(function (o) { o.classList.remove('open') })
      })
    })
  }

  // ---- notes: the table of contents panel on the left can be folded away (like HackMD) ----
  // index.js / pretty.js show the panel (inline display) when there is room for it;
  // the button follows the panel: « on its top right, or a "目錄" tab at the left edge
  // when folded. The choice is remembered (localStorage, per browser).
  const TOC_KEY = 'lilith-toc-folded'
  function tocPanel (panel) {
    const root = document.documentElement
    let folded = false
    try { folded = localStorage.getItem(TOC_KEY) === '1' } catch (e) {}
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ctp-toc-toggle hidden-print'
    document.body.appendChild(button)
    const bar = document.querySelector('.navbar-fixed-top, .ctp-pretty-bar')
    // the published page has its own button in the top bar (like HackMD's sidebar button)
    const barButton = document.querySelector('.ctp-pretty-toc')

    function update () {
      root.classList.toggle('ctp-toc-folded', folded)
      if (bar) root.style.setProperty('--ctp-toc-top', Math.round(bar.getBoundingClientRect().bottom) + 'px')
      // the bundled scripts hide the panel when it does not fit
      const wanted = panel.style.display !== 'none' && panel.textContent.trim() !== ''
      if (barButton) {
        barButton.hidden = !wanted
        barButton.setAttribute('aria-pressed', folded ? 'false' : 'true')
        barButton.title = folded ? '顯示目錄' : '收合目錄'
        barButton.setAttribute('aria-label', barButton.title)
      }
      button.style.display = wanted && !barButton ? '' : 'none'
      if (!wanted || barButton) return
      const left = parseFloat(panel.style.left) || 0
      const width = panel.offsetWidth || parseFloat(panel.style.width) || 0
      button.classList.toggle('ctp-toc-tab', folded)
      button.innerHTML = folded ? '<i class="fa fa-list-ul"></i> 目錄' : '<i class="fa fa-angle-double-left"></i>'
      button.title = folded ? '顯示目錄' : '收合目錄'
      button.setAttribute('aria-label', button.title)
      button.setAttribute('aria-expanded', folded ? 'false' : 'true')
      button.style.left = (folded ? left : left + width - 36) + 'px'
    }
    function toggle () {
      folded = !folded
      try { localStorage.setItem(TOC_KEY, folded ? '1' : '0') } catch (e) {}
      update()
    }
    button.addEventListener('click', toggle)
    if (barButton) barButton.addEventListener('click', toggle)
    new MutationObserver(update).observe(panel, { attributes: true, attributeFilter: ['style'], childList: true })
    window.addEventListener('resize', update)
    update()
  }

  // ---- bookmark button: published page top bar and the editor's info bar (signed-in users) ----
  // the same bookmark as in the note list (lib/web/noteListRouter.js); the note is the
  // last part of the path (/s/<shortid> or /<note id>)
  function noteStar (button) {
    const noteId = location.pathname.replace(/\/+$/, '').split('/').pop()
    if (!noteId || !window.fetch) return
    const brand = document.querySelector('.ctp-pretty-brand, .navbar-brand.header-brand')
    const base = (brand ? brand.getAttribute('href') : '/').replace(/\/$/, '')
    const url = base + '/api/lilith/notes/' + encodeURIComponent(noteId) + '/meta'
    const icon = button.querySelector('i')
    function show (starred) {
      icon.className = 'fa ' + (starred ? 'fa-bookmark' : 'fa-bookmark-o')
      button.setAttribute('aria-pressed', starred ? 'true' : 'false')
      button.title = starred ? '取消收藏' : '收藏'
      button.setAttribute('aria-label', button.title)
      button.classList.toggle('active', starred)
    }
    let starred = false
    fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) return null // guests (401) and notes they cannot read: no button
      return r.json()
    }).then(function (data) {
      if (!data) return
      starred = !!data.starred
      show(starred)
      button.hidden = false
    }).catch(function () {})
    button.addEventListener('click', function () {
      button.disabled = true
      fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: !starred })
      }).then(function (r) { return r.ok ? r.json() : null }).then(function (data) {
        if (data) { starred = !!data.starred; show(starred) }
      }).catch(function () {}).then(function () { button.disabled = false })
    })
  }

  // ---- published page: the heart and how many people like the note (feature 27);
  // guests see the count, signed-in readers can like it ----
  function noteLike (button) {
    const noteId = location.pathname.replace(/\/+$/, '').split('/').pop()
    if (!noteId || !window.fetch) return
    const brand = document.querySelector('.ctp-pretty-brand, .navbar-brand.header-brand')
    const base = (brand ? brand.getAttribute('href') : '/').replace(/\/$/, '')
    const url = base + '/api/lilith/notes/' + encodeURIComponent(noteId) + '/like'
    const icon = button.querySelector('i')
    const count = button.querySelector('.ctp-like-count')
    let liked = false
    function show (d) {
      liked = !!d.liked
      icon.className = 'fa ' + (liked ? 'fa-heart' : 'fa-heart-o')
      count.textContent = d.count ? ' ' + d.count : ''
      button.setAttribute('aria-pressed', liked ? 'true' : 'false')
      button.classList.toggle('active', liked)
      button.title = d.signin === false ? '登入後可以按喜歡' : liked ? '取消喜歡' : '喜歡'
      button.setAttribute('aria-label', button.title)
    }
    fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null }).then(function (d) {
      if (!d) return
      show(d)
      button.disabled = !d.signin
      button.hidden = false
    }).catch(function () {})
    button.addEventListener('click', function () {
      button.disabled = true
      fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ like: !liked })
      }).then(function (r) { return r.ok ? r.json() : null }).then(function (d) { if (d) show(d) })
        .catch(function () {}).then(function () { button.disabled = false })
    })
  }

  // ---- book mode (feature 21, like HackMD): table of contents on the left ----
  // search the titles, fold the side panel (remembered), keep links to the
  // book's pages inside the book
  const BOOK_KEY = 'lilith-book-folded'
  // a short message at the bottom of a book page
  let bookToastTimer = null
  function bookToast (text) {
    let t = document.querySelector('.ctp-book-toast')
    if (!t) {
      t = document.createElement('div')
      t.className = 'ctp-toast ctp-book-toast'
      t.setAttribute('role', 'status')
      document.body.appendChild(t)
    }
    t.textContent = text
    t.classList.add('ctp-shown')
    clearTimeout(bookToastTimer)
    bookToastTimer = setTimeout(function () { t.classList.remove('ctp-shown') }, 1600)
  }
  function bookPage (side) {
    const root = document.documentElement
    // phones: the panel covers the page, so it starts folded and is not remembered
    const narrow = window.matchMedia && window.matchMedia('(max-width: 767px)').matches
    let stored = null
    try { stored = localStorage.getItem(BOOK_KEY) } catch (e) {}
    const expand = document.querySelector('.ctp-book-expand')
    function setFolded (folded, remember) {
      root.classList.toggle('ctp-book-folded', folded)
      if (expand) expand.hidden = !folded
      if (remember && !narrow) {
        try { localStorage.setItem(BOOK_KEY, folded ? '1' : '0') } catch (e) {}
      }
    }
    setFolded(narrow || stored === '1', false)
    const collapse = side.querySelector('.ctp-book-collapse')
    if (collapse) collapse.addEventListener('click', function () { setFolded(true, true); if (expand) expand.focus() })
    if (expand) expand.addEventListener('click', function () { setFolded(false, true); if (collapse) collapse.focus() })

    // search: keep matching items and the groups / parents around them
    const search = side.querySelector('.ctp-book-search')
    const noMatch = side.querySelector('.ctp-book-nomatch')
    if (search) {
      search.addEventListener('input', function () {
        const q = search.value.trim().toLowerCase()
        let any = false
        function filter (li) {
          const own = li.querySelector(':scope > a .ctp-book-text, :scope > span .ctp-book-text, :scope > details > summary .ctp-book-text')
          const kids = li.querySelectorAll(':scope > ul > li, :scope > details > ul > li')
          let childHit = false
          kids.forEach(function (k) { if (filter(k)) childHit = true })
          const hit = !q || (own && own.textContent.toLowerCase().indexOf(q) >= 0) || childHit
          li.hidden = !hit
          if (hit && q && li.querySelector(':scope > details')) li.querySelector(':scope > details').open = true
          if (hit && q && !childHit) any = true
          return hit
        }
        side.querySelectorAll('.ctp-book-nav > ul > li').forEach(function (li) { if (filter(li)) any = true })
        if (noMatch) noMatch.hidden = !q || any
      })
    }

    // the page being read is visible in the list
    const active = side.querySelector('.ctp-book-item.active')
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' })

    // links in the page to other pages of the book open inside the book
    let links = {}
    try { links = JSON.parse(document.getElementById('ctp-book-links').textContent) || {} } catch (e) {}
    const doc = document.getElementById('doc')
    if (doc) {
      doc.addEventListener('click', function (e) {
        const a = e.target.closest && e.target.closest('a[href]')
        if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
        const href = a.getAttribute('href')
        // own keys only ("constructor" is on every object)
        const target = Object.prototype.hasOwnProperty.call(links, href) ? links[href] : null
        if (typeof target === 'string') {
          e.preventDefault()
          location.href = target
        }
      })
    }
  }

  // ---- /trash (feature 23): restore or delete for good, empty the trash ----
  // the page has no jQuery: plain fetch, and confirm() before anything permanent
  function trashPage (list) {
    const brand = document.querySelector('.login-brand')
    const base = (brand ? brand.getAttribute('href') : '/').replace(/\/$/, '')
    const emptyButton = document.querySelector('.ctp-trash-empty')
    const fmt = function (d) {
      const t = new Date(d)
      return t.getFullYear() + '年' + (t.getMonth() + 1) + '月' + t.getDate() + '日'
    }
    function call (method, path) {
      return fetch(base + '/api/lilith' + path, {
        method,
        credentials: 'same-origin',
        headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : '{}'
      }).then(function (r) {
        return r.json().catch(function () { return {} }).then(function (data) {
          if (!r.ok) throw new Error(data.error || '操作失敗（' + r.status + '）')
          return data
        })
      })
    }
    function message (text) {
      list.innerHTML = ''
      const li = document.createElement('li')
      li.className = 'ctp-my-empty'
      li.textContent = text
      list.appendChild(li)
    }
    // one note in a trash: name, dates, restore, delete for good
    function row (n, restoreCall, deleteCall, reload) {
      const li = document.createElement('li')
      li.className = 'ctp-trash-item'
      const icon = document.createElement('i')
      icon.className = 'fa fa-file-text-o'
      icon.setAttribute('aria-hidden', 'true')
      const text = document.createElement('div')
      text.className = 'ctp-trash-text'
      const title = document.createElement('div')
      title.className = 'ctp-trash-title'
      title.textContent = n.title
      const when = document.createElement('div')
      when.className = 'ctp-trash-when'
      when.textContent = '刪除於 ' + fmt(n.deletedAt) + '・' + fmt(n.purgeAt) + ' 永久刪除'
      text.appendChild(title)
      text.appendChild(when)
      const restore = document.createElement('button')
      restore.type = 'button'
      restore.className = 'btn btn-default'
      restore.innerHTML = '<i class="fa fa-undo" aria-hidden="true"></i> 還原'
      restore.addEventListener('click', function () {
        restore.disabled = true
        restoreCall().then(reload, function (err) { alert(err.message); restore.disabled = false })
      })
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'btn btn-default ctp-trash-delete'
      del.innerHTML = '<i class="fa fa-times" aria-hidden="true"></i> 永久刪除'
      del.addEventListener('click', function () {
        if (!confirm('永久刪除「' + n.title + '」？刪除後無法復原。')) return
        del.disabled = true
        deleteCall().then(reload, function (err) { alert(err.message); del.disabled = false })
      })
      li.appendChild(icon)
      li.appendChild(text)
      li.appendChild(restore)
      li.appendChild(del)
      return li
    }
    function load () {
      call('GET', '/trash').then(function (data) {
        const days = document.querySelector('.ctp-trash-days')
        if (days) days.textContent = data.days
        if (emptyButton) emptyButton.disabled = !data.notes.length
        if (!data.notes.length) return message('垃圾桶是空的。')
        list.innerHTML = ''
        data.notes.forEach(function (n) {
          list.appendChild(row(n, function () { return call('POST', '/trash/' + encodeURIComponent(n.id) + '/restore') },
            function () { return call('DELETE', '/trash/' + encodeURIComponent(n.id)) }, load))
        })
      }).catch(function (err) { message(err.message) })
    }
    // feature 24: each team I own / manage has a trash too
    const teamBox = document.querySelector('.ctp-team-trash')
    let teamLoads = 0
    function loadTeams () {
      if (!teamBox) return
      // (review fix) two quick reloads must not both add their sections
      const mine = ++teamLoads
      call('GET', '/teams').then(function (data) {
        if (mine !== teamLoads) return
        teamBox.innerHTML = ''
        ;(data.teams || []).filter(function (t) { return t.role === 'owner' || t.role === 'admin' }).forEach(function (t) {
          const path = '/teams/' + encodeURIComponent(t.id) + '/trash'
          call('GET', path).then(function (tr) {
            if (mine !== teamLoads) return
            const h = document.createElement('h2')
            h.className = 'ctp-team-trash-title'
            h.textContent = '團隊垃圾桶：' + t.name
            const ul = document.createElement('ul')
            ul.className = 'ctp-trash-list'
            teamBox.appendChild(h)
            teamBox.appendChild(ul)
            if (!tr.notes.length) {
              const li = document.createElement('li')
              li.className = 'ctp-my-empty'
              li.textContent = '這個團隊的垃圾桶是空的。'
              ul.appendChild(li)
            }
            tr.notes.forEach(function (n) {
              ul.appendChild(row(n, function () { return call('POST', path + '/' + encodeURIComponent(n.id) + '/restore') },
                function () { return call('DELETE', path + '/' + encodeURIComponent(n.id)) }, loadTeams))
            })
          }).catch(function () {})
        })
      }).catch(function () {})
    }
    if (emptyButton) {
      emptyButton.addEventListener('click', function () {
        if (!confirm('清空垃圾桶？裡面所有筆記都會永久刪除，無法復原。')) return
        emptyButton.disabled = true
        call('DELETE', '/trash').then(load, function (err) { alert(err.message); emptyButton.disabled = false })
      })
    }
    load()
    loadTeams()
  }

  // ---- /team/:id/settings (feature 24): general, members, invite link ----
  // plain fetch (no jQuery on this page); every change reloads the data from the server
  function teamSettings (root) {
    const brand = document.querySelector('.login-brand')
    const base = (brand ? brand.getAttribute('href') : '/').replace(/\/$/, '')
    const teamId = root.getAttribute('data-team-id')
    const q = function (sel) { return root.querySelector(sel) }
    function call (method, path, body) {
      return fetch(base + '/api/lilith/teams/' + encodeURIComponent(teamId) + path, {
        method,
        credentials: 'same-origin',
        headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body || {})
      }).then(function (r) {
        return r.json().catch(function () { return {} }).then(function (data) {
          if (!r.ok) throw new Error(data.error || '操作失敗（' + r.status + '）')
          return data
        })
      })
    }
    function say (sel, text, bad) {
      const el = q(sel)
      if (!el) return
      el.textContent = text || ''
      el.classList.toggle('ctp-bad', !!bad)
    }

    // sections, like HackMD's left menu (#general / #notes / #members / #social; the old
    // #profile is now part of #general)
    function show () {
      const hash = location.hash.slice(1)
      const want = hash === 'profile' ? 'general' : ['general', 'notes', 'members', 'social'].indexOf(hash) >= 0 ? hash : 'members'
      root.querySelectorAll('.ctp-team-section').forEach(function (sec) { sec.hidden = sec.getAttribute('data-section') !== want })
      root.querySelectorAll('.ctp-team-nav a').forEach(function (a) {
        const on = a.getAttribute('data-section') === want
        a.classList.toggle('active', on)
        if (on) a.setAttribute('aria-current', 'page')
        else a.removeAttribute('aria-current')
      })
    }
    window.addEventListener('hashchange', show)
    show()

    let data = null
    function render () {
      const manager = data.role === 'owner' || data.role === 'admin'
      q('.ctp-team-title').textContent = '・' + data.name
      q('.ctp-team-manage').hidden = !manager
      // feature 28: general settings (picture, name, description), address, privacy,
      // social -- managers edit them, members read them
      const g = q('.ctp-team-general')
      g.name.value = data.name
      g.bio.value = data.profile.bio
      g.photo.value = data.profile.photo
      q('#ctpTeamHandle').value = data.handle
      q('.ctp-team-privacy').value = data.privacy
      const s = q('.ctp-team-social')
      s.email.value = data.profile.email
      for (let i = 0; i < 5; i++) {
        const l = data.profile.links[i] || {}
        s['label' + i].value = l.label || ''
        s['url' + i].value = l.url || ''
      }
      root.querySelectorAll('.ctp-team-general, .ctp-team-handle, .ctp-team-social').forEach(function (f) {
        f.querySelectorAll('input, textarea').forEach(function (x) { x.disabled = !manager })
        f.querySelectorAll('.ctp-team-actions').forEach(function (x) { x.hidden = !manager })
      })
      q('.ctp-team-pic-edit').hidden = !manager
      q('.ctp-team-privacy').disabled = !manager
      q('.ctp-team-leave').closest('.ctp-team-danger-row').hidden = data.role === 'owner'
      q('.ctp-team-delete').closest('.ctp-team-danger-row').hidden = data.role !== 'owner'
      root.querySelectorAll('.ctp-team-pagelink, .ctp-team-pagelink2').forEach(function (a) { a.href = data.page })
      preview()
      if (manager) {
        const url = data.invite && data.invite.url
        q('.ctp-team-invite-none').hidden = !!url
        q('.ctp-team-invite-on').hidden = !url
        q('.ctp-team-invite-new').textContent = url ? '重新產生' : '產生邀請連結'
        if (url) {
          q('.ctp-team-invite-url').value = url
          const d = new Date(data.invite.expiresAt)
          q('.ctp-team-invite-exp').textContent = '有效至 ' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
        }
      }
      const body = q('.ctp-team-members tbody')
      body.innerHTML = ''
      data.members.forEach(function (m) {
        const tr = document.createElement('tr')
        const who = document.createElement('td')
        const img = document.createElement('img')
        img.src = m.photo
        img.alt = ''
        img.width = 28
        img.height = 28
        const name = document.createElement('span')
        name.className = 'ctp-team-member-name'
        name.textContent = m.name + (m.userId === data.me ? '（你）' : '')
        who.appendChild(img)
        who.appendChild(name)
        if (m.email) {
          const mail = document.createElement('span')
          mail.className = 'ctp-team-member-mail'
          mail.textContent = m.email
          who.appendChild(mail)
        }
        const role = document.createElement('td')
        const act = document.createElement('td')
        if (manager && m.role !== 'owner') {
          const sel = document.createElement('select')
          sel.className = 'form-control'
          sel.setAttribute('aria-label', m.name + ' 的權限')
          ;[['admin', '管理者'], ['member', '成員']].forEach(function (o) {
            const opt = document.createElement('option')
            opt.value = o[0]
            opt.textContent = o[1]
            if (o[0] === m.role) opt.selected = true
            sel.appendChild(opt)
          })
          sel.addEventListener('change', function () {
            call('POST', '/members/' + encodeURIComponent(m.userId), { role: sel.value }).then(load, function (err) { alert(err.message); load() })
          })
          role.appendChild(sel)
          const del = document.createElement('button')
          del.type = 'button'
          del.className = 'btn btn-default ctp-team-remove'
          del.title = '移除 ' + m.name
          del.setAttribute('aria-label', del.title)
          del.innerHTML = '<i class="fa fa-trash-o" aria-hidden="true"></i>'
          del.addEventListener('click', function () {
            if (!confirm('把「' + m.name + '」移出團隊？')) return
            call('DELETE', '/members/' + encodeURIComponent(m.userId)).then(load, function (err) { alert(err.message) })
          })
          act.appendChild(del)
        } else {
          role.textContent = m.roleName
        }
        tr.appendChild(who)
        tr.appendChild(role)
        tr.appendChild(act)
        body.appendChild(tr)
      })
    }
    function load () {
      return call('GET', '').then(function (d) { data = d; render() }).catch(function (err) { say('.ctp-team-load-msg', err.message, true) })
    }

    // the picture: an image address, or the first character of the name
    function face (el, name, photo) {
      el.textContent = ''
      el.style.backgroundImage = ''
      if (/^https?:\/\//i.test(photo || '')) {
        const img = document.createElement('img')
        img.alt = ''
        img.src = photo
        el.appendChild(img)
      } else {
        el.textContent = Array.from(name || '#')[0] || '#'
      }
    }
    // the public page card, as typed
    function preview () {
      const g = q('.ctp-team-general')
      const name = g.name.value.trim() || (data && data.name) || ''
      face(q('.ctp-team-pic-face'), name, g.photo.value.trim())
      face(q('.ctp-team-preview-face'), name, g.photo.value.trim())
      q('.ctp-team-preview-name').textContent = name
      q('.ctp-team-preview-handle').textContent = '@' + ((data && data.handle) || 'team')
      q('.ctp-team-preview-bio').textContent = g.bio.value
    }
    const general = q('.ctp-team-general')
    general.addEventListener('input', preview)
    q('.ctp-team-pic-edit').addEventListener('click', function () {
      const box = q('.ctp-team-pic-url')
      box.hidden = !box.hidden
      this.setAttribute('aria-expanded', box.hidden ? 'false' : 'true')
      if (!box.hidden) general.photo.focus()
    })
    q('.ctp-team-general-cancel').addEventListener('click', function () { say('.ctp-team-general-msg', ''); render() })
    general.addEventListener('submit', function (e) {
      e.preventDefault()
      call('POST', '', { name: general.name.value })
        .then(function () { return call('POST', '/profile', { bio: general.bio.value, photo: general.photo.value }) })
        .then(function () { say('.ctp-team-general-msg', '已儲存'); load() }, function (err) { say('.ctp-team-general-msg', err.message, true) })
    })
    q('.ctp-team-handle').addEventListener('submit', function (e) {
      e.preventDefault()
      call('POST', '/handle', { handle: q('#ctpTeamHandle').value })
        .then(function () { say('.ctp-team-handle-msg', '已儲存'); load() }, function (err) { say('.ctp-team-handle-msg', err.message, true) })
    })
    q('.ctp-team-handle-cancel').addEventListener('click', function () { say('.ctp-team-handle-msg', ''); q('#ctpTeamHandle').value = data.handle })
    q('.ctp-team-privacy').addEventListener('change', function () {
      const sel = this
      call('POST', '/privacy', { privacy: sel.value })
        .then(function () { say('.ctp-team-privacy-msg', sel.value === 'open' ? '已改成開放團隊' : '已改成不開放：公開頁只有成員看得到'); load() }, function (err) { say('.ctp-team-privacy-msg', err.message, true); load() })
    })
    q('.ctp-team-social').addEventListener('submit', function (e) {
      e.preventDefault()
      const f = e.target
      const links = []
      for (let i = 0; i < 5; i++) links.push({ label: f['label' + i].value, url: f['url' + i].value })
      call('POST', '/profile', { email: f.email.value, links })
        .then(function () { say('.ctp-team-social-msg', '已儲存'); load() }, function (err) { say('.ctp-team-social-msg', err.message, true) })
    })
    // team notes: every note of the team, with who can read it
    const PERM = { freely: '公開', editable: '公開', locked: '公開', limited: '登入可讀', protected: '登入可讀', private: '私人（成員）' }
    function loadNotes () {
      call('GET', '/notes').then(function (d) {
        const body = q('.ctp-team-notes tbody')
        body.innerHTML = ''
        if (!d.notes.length) say('.ctp-team-notes-msg', '團隊還沒有筆記。')
        d.notes.slice().sort(function (a, b) { return b.time - a.time }).forEach(function (n) {
          const tr = document.createElement('tr')
          const t = document.createElement('td')
          const a = document.createElement('a')
          a.href = base + '/' + encodeURIComponent(n.id)
          a.textContent = n.text || '未命名'
          t.appendChild(a)
          const p = document.createElement('td')
          p.textContent = PERM[n.permission] || n.permission
          const w = document.createElement('td')
          const dt = new Date(n.time)
          w.textContent = dt.getFullYear() + '/' + (dt.getMonth() + 1) + '/' + dt.getDate()
          tr.appendChild(t)
          tr.appendChild(p)
          tr.appendChild(w)
          body.appendChild(tr)
        })
      }).catch(function (err) { say('.ctp-team-notes-msg', err.message, true) })
    }
    q('.ctp-team-add').addEventListener('submit', function (e) {
      e.preventDefault()
      const form = e.target
      call('POST', '/members', { who: form.who.value, role: form.role.value }).then(function (r) {
        say('.ctp-team-add-msg', '已加入「' + r.name + '」')
        form.who.value = ''
        load()
      }, function (err) { say('.ctp-team-add-msg', err.message, true) })
    })
    q('.ctp-team-invite-new').addEventListener('click', function () {
      if (data && data.invite && data.invite.url && !confirm('重新產生後，舊的邀請連結就不能用了。繼續？')) return
      call('POST', '/invite').then(load, function (err) { alert(err.message) })
    })
    q('.ctp-team-invite-off').addEventListener('click', function () {
      call('DELETE', '/invite').then(load, function (err) { alert(err.message) })
    })
    q('.ctp-team-invite-copy').addEventListener('click', function () {
      const input = q('.ctp-team-invite-url')
      const done = function () {
        const b = q('.ctp-team-invite-copy')
        b.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i> 已複製'
        setTimeout(function () { b.innerHTML = '<i class="fa fa-clipboard" aria-hidden="true"></i> 複製' }, 2000)
      }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(input.value).then(done, function () { input.select() })
      else { input.select(); try { document.execCommand('copy'); done() } catch (e) {} }
    })
    q('.ctp-team-leave').addEventListener('click', function () {
      if (!data) return
      if (!confirm('離開團隊「' + data.name + '」？')) return
      call('DELETE', '/members/' + encodeURIComponent(data.me)).then(function () { location.href = base + '/' }, function (err) { alert(err.message) })
    })
    q('.ctp-team-delete').addEventListener('click', function () {
      if (!data) return
      if (prompt('刪除團隊後無法復原（團隊筆記會回到各自建立者）。請輸入團隊名稱確認：') !== data.name) return
      call('DELETE', '').then(function () { location.href = base + '/' }, function (err) { alert(err.message) })
    })
    load()
    loadNotes()
  }

  // ---- editing inside a book (feature 21 E15, like HackMD): /b/<book>[/<page>]?edit keeps
  // the book's table of contents on the left and the editor in a frame on the right;
  // moving to another page only reloads the frame, not the whole page
  function shellOf (win) {
    try {
      const top = win.parent
      if (top && top !== win && top.document.body.classList.contains('ctp-book-shell')) return top
    } catch (e) {}
    return null
  }

  // the editor: inside the book page, or opened with an old "#lilith-book=<book>" link
  function bookEditor () {
    const brand = document.querySelector('.navbar-brand.header-brand')
    const base = (brand ? brand.getAttribute('href') : '/').replace(/\/$/, '')
    const current = location.pathname.replace(/\/+$/, '').split('/').pop()
    const shell = shellOf(window)
    if (!shell) {
      const m = /(?:^#|&)lilith-book=([^&]+)/.exec(location.hash)
      let book = null
      try { book = m && decodeURIComponent(m[1]) } catch (e) {} // a broken link: stay in the editor
      if (book) location.replace(base + '/b/' + encodeURIComponent(book) + '/' + encodeURIComponent(current) + '?edit')
      return
    }
    // inside the book page: show the note at once (no fade-in over a grey page; the book
    // page shows a spinner while the editor loads)
    document.documentElement.classList.add('ctp-in-book-frame')
    // links: pages of the book stay in the book page, everything else leaves the frame
    document.addEventListener('click', function (e) {
      const a = e.target.closest && e.target.closest('a[href]')
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const href = a.getAttribute('href')
      if (!href || href.charAt(0) === '#' || /^javascript:/i.test(href) || a.hasAttribute('download')) return
      if (a.hostname === location.hostname && a.pathname === location.pathname && a.search === location.search && a.hash) return
      // (the preview opens every link in a new tab; pages of the book still stay in it)
      let handled = false
      try { handled = shell.lilithBookOpen(href, a.href) } catch (err) {}
      if (handled) e.preventDefault()
      else if (!a.target || a.target === '_self') a.target = '_top'
    })
  }

  function bookShell (data) {
    const base = (document.querySelector('base') ? document.querySelector('base').href : location.origin + '/').replace(/\/$/, '')
    const frame = document.querySelector('.ctp-book-frame')
    const holder = document.querySelector('.ctp-book-shell-side')
    let state = { page: data.page, edit: data.edit }
    let book = null
    const byEdit = {} // editor ref -> { page, href }
    history.replaceState(state, '', location.href)

    function el (tag, cls, text) {
      const e = document.createElement(tag)
      if (cls) e.className = cls
      if (text !== undefined) e.textContent = text
      return e
    }
    function list (nodes, depth) {
      const ul = el('ul', 'ctp-book-list')
      ul.setAttribute('data-depth', depth)
      nodes.forEach(function (n) {
        const li = el('li')
        if (n.type === 'group') {
          li.className = 'ctp-book-group'
          const d = el('details')
          d.open = true
          const sum = el('summary')
          sum.innerHTML = '<i class="fa fa-angle-down ctp-book-caret" aria-hidden="true"></i>'
          sum.appendChild(el('span', 'ctp-book-text', n.title))
          d.appendChild(sum)
          d.appendChild(list(n.children, depth + 1))
          li.appendChild(d)
        } else {
          li.className = 'ctp-book-item'
          let a
          if (n.href) {
            a = el('a')
            a.href = n.href
            if (n.external) { a.target = '_blank'; a.rel = 'noopener' }
            if (n.edit) {
              a.setAttribute('data-page', n.page)
              a.setAttribute('data-edit', n.edit)
              byEdit[n.edit] = { page: n.page, href: n.href }
            }
          } else {
            a = el('span', n.locked ? 'ctp-book-locked' : 'ctp-book-label')
            if (n.locked) a.title = '你沒有權限閱讀這篇筆記'
          }
          a.appendChild(el('span', 'ctp-book-text', n.title || '未命名'))
          if (n.locked) a.insertAdjacentHTML('beforeend', ' <i class="fa fa-lock" aria-hidden="true"></i>')
          li.appendChild(a)
          if (n.children.length) li.appendChild(list(n.children, depth + 1))
        }
        ul.appendChild(li)
      })
      return ul
    }
    function markActive () {
      holder.querySelectorAll('.ctp-book-item.active, .ctp-book-home.active').forEach(function (x) { x.classList.remove('active') })
      holder.querySelectorAll('[aria-current]').forEach(function (x) { x.removeAttribute('aria-current') })
      let found = null
      holder.querySelectorAll('a[data-edit]').forEach(function (a) {
        if (!found && a.getAttribute('data-edit') === state.edit) found = a
      })
      if (found) {
        found.setAttribute('aria-current', 'page')
        if (found.classList.contains('ctp-book-home')) found.classList.add('active')
        else found.parentNode.classList.add('active')
        if (found.scrollIntoView) found.scrollIntoView({ block: 'nearest' })
      }
    }
    // while the editor loads: a spinner in the middle of the editor area (the editor
    // itself shows a grey page and fades the note in)
    const loading = document.querySelector('.ctp-book-loading')
    let waiting = null
    let waitingFor = null
    function idle () {
      clearInterval(waiting)
      waitingFor = null
      if (loading) loading.hidden = true
    }
    function busy (edit) {
      if (!loading) return
      clearInterval(waiting)
      waitingFor = edit
      loading.hidden = false
      const started = Date.now()
      waiting = setInterval(function () {
        let ready = false
        try {
          const w = frame.contentWindow
          const content = w.document.querySelector('.ui-content')
          ready = w.location.pathname.replace(/\/+$/, '').split('/').pop() === edit &&
            !!content && w.getComputedStyle(content).display !== 'none'
        } catch (e) { ready = true } // left the site: nothing to wait for
        if (ready || Date.now() - started > 15000) idle()
      }, 80)
    }
    busy(data.edit)
    // show a page in the frame; push: a new history entry (not when going back / forward)
    function open (edit, page, href, push) {
      state = { page, edit }
      const url = base + '/' + edit + '?both'
      busy(edit)
      try { frame.contentWindow.location.replace(url) } catch (e) { frame.src = url }
      if (push) history.pushState(state, '', href)
      // (review fix) on a phone the panel covers the editor: fold it once a page is chosen
      if (push && window.matchMedia && window.matchMedia('(max-width: 767px)').matches) {
        const fold = document.querySelector('.ctp-book-shell .ctp-book-collapse')
        if (fold && !document.documentElement.classList.contains('ctp-book-folded')) fold.click()
      }
      markActive()
    }
    // asked by the editor in the frame: is this link a page of the book?
    window.lilithBookOpen = function (raw, abs) {
      if (!book) return false
      let edit = Object.prototype.hasOwnProperty.call(book.links, raw) ? book.links[raw] : null
      if (!edit) {
        // a link straight to the editor of a page: /<edit>[?both]
        let u = null
        try { u = new URL(abs) } catch (e) {}
        if (u && u.origin === location.origin) {
          const ref = u.pathname.replace(/\/+$/, '').split('/').pop()
          if (u.pathname.split('/').length === 2 && Object.prototype.hasOwnProperty.call(byEdit, ref)) edit = ref
        }
      }
      if (typeof edit !== 'string' || !Object.prototype.hasOwnProperty.call(byEdit, edit)) return false
      if (edit !== state.edit) open(edit, byEdit[edit].page, byEdit[edit].href, true)
      return true
    }
    window.addEventListener('popstate', function (e) {
      if (e.state && e.state.edit) open(e.state.edit, e.state.page, null, false)
    })
    // the frame went somewhere by itself: follow it, or leave the book page
    frame.addEventListener('load', function () {
      let path = null
      let title = ''
      try {
        path = frame.contentWindow.location.pathname
        title = frame.contentDocument.title
      } catch (e) {}
      if (title) document.title = title
      // the editor sets its title when the note has loaded
      try {
        const t = frame.contentDocument.querySelector('title')
        if (t) new MutationObserver(function () { document.title = frame.contentDocument.title }).observe(t, { childList: true, characterData: true, subtree: true })
      } catch (e) {}
      if (!path) { idle(); return }
      const ref = path.replace(/\/+$/, '').split('/').pop()
      // a page other than the one being waited for (e.g. the sign-in page): nothing to wait for
      if (waitingFor && ref !== waitingFor) idle()
      if (ref === state.edit) return
      if (path.split('/').length === 2 && Object.prototype.hasOwnProperty.call(byEdit, ref)) {
        state = { page: byEdit[ref].page, edit: ref }
        history.replaceState(state, '', byEdit[ref].href)
        markActive()
      }
    })

    // the side panel: search, refresh, edit the table of contents, fold (like HackMD)
    const LINE = '<svg class="ctp-line-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    const ICONS = {
      refresh: LINE + '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
      pencil: LINE + '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/></svg>',
      fold: LINE + '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>'
    }
    function toolButton (icon, label, cls) {
      const b = el('button', 'ctp-pretty-btn' + (cls ? ' ' + cls : ''))
      b.type = 'button'
      b.title = label
      b.setAttribute('aria-label', label)
      b.innerHTML = ICONS[icon]
      return b
    }
    let nav = null
    let none = null
    // the table of contents (again on refresh: the index note may have changed)
    function fill (toc) {
      book = toc
      book.links = book.links || {}
      Object.keys(byEdit).forEach(function (k) { delete byEdit[k] })
      byEdit[toc.index] = { page: toc.ref, href: toc.indexHref }
      Array.from(nav.childNodes).forEach(function (c) { if (c !== none) nav.removeChild(c) })
      const home = el('a', 'ctp-book-home')
      home.href = toc.indexHref
      home.setAttribute('data-page', toc.ref)
      home.setAttribute('data-edit', toc.index)
      home.innerHTML = '<i class="fa fa-book fa-fw" aria-hidden="true"></i> '
      home.appendChild(document.createTextNode('目錄'))
      nav.insertBefore(home, none)
      if (toc.tree.length) nav.insertBefore(list(toc.tree, 0), none)
      markActive()
    }
    function fetchToc () {
      return fetch(base + '/api/lilith/books/' + encodeURIComponent(data.book) + '/toc', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null })
    }
    fetchToc()
      .then(function (toc) {
        if (!toc) return
        const side = el('aside', 'ctp-book-side hidden-print')
        side.setAttribute('aria-label', '書本目錄：' + toc.title)
        const tools = el('div', 'ctp-book-tools')
        const search = el('input', 'form-control ctp-book-search')
        search.type = 'search'
        search.placeholder = '搜尋標題...'
        search.setAttribute('aria-label', '搜尋標題')
        tools.appendChild(search)
        const refresh = toolButton('refresh', '重新整理目錄')
        const edit = toolButton('pencil', '編輯目錄')
        const collapse = toolButton('fold', '收合目錄', 'ctp-book-collapse')
        tools.appendChild(refresh)
        tools.appendChild(edit)
        tools.appendChild(collapse)
        side.appendChild(tools)
        nav = el('nav', 'ctp-book-nav')
        none = el('p', 'ctp-book-nomatch', '找不到符合的標題')
        none.hidden = true
        nav.appendChild(none)
        side.appendChild(nav)
        holder.appendChild(side)
        fill(toc)
        // the pages of the book open in the frame
        nav.addEventListener('click', function (e) {
          const a = e.target.closest && e.target.closest('a[data-edit]')
          if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          if (a.getAttribute('data-edit') !== state.edit) open(a.getAttribute('data-edit'), a.getAttribute('data-page'), a.href, true)
        })
        // refresh: only the table of contents (the editor keeps going); the search stays
        // (then a message: a table of contents that did not change otherwise looks like
        // nothing happened; the icon stays still, hhyn)
        refresh.addEventListener('click', function () {
          if (refresh.disabled) return
          refresh.disabled = true
          fetchToc().then(function (t) {
            if (!t) return false
            fill(t)
            search.dispatchEvent(new Event('input'))
            return true
          }).catch(function () { return false }).then(function (ok) {
            refresh.disabled = false
            bookToast(ok ? '目錄已更新' : '無法更新目錄，請稍後再試')
          })
        })
        // edit: the index note in the editor
        edit.addEventListener('click', function () {
          if (book && book.index !== state.edit) open(book.index, book.ref, book.indexHref, true)
        })
        // search and fold (remembered): the same as the book page
        bookPage(side)
      }).catch(function () {})
  }

  // ---- a team's public page (feature 27, like HackMD's): follow, share, like, bookmark,
  // search / order the notes, choose the pinned notes (managers) ----
  function teamPage (data) {
    const baseEl = document.querySelector('base')
    const base = (baseEl ? baseEl.href : location.origin + '/').replace(/\/$/, '')
    function post (path, body) {
      return fetch(base + path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().catch(function () { return {} }).then(function (d) {
          if (!r.ok) throw new Error(d.error || '處理失敗')
          return d
        })
      })
    }
    function fail (err) { bookToast(err.message || '處理失敗') }

    // "更新於 3 天前"
    function ago (iso) {
      const t = new Date(iso)
      const s = (Date.now() - t.getTime()) / 1000
      if (s < 60) return '更新於 剛剛'
      if (s < 3600) return '更新於 ' + Math.floor(s / 60) + ' 分鐘前'
      if (s < 86400) return '更新於 ' + Math.floor(s / 3600) + ' 小時前'
      if (s < 7 * 86400) return '更新於 ' + Math.floor(s / 86400) + ' 天前'
      return '更新於 ' + t.getFullYear() + '年' + (t.getMonth() + 1) + '月' + t.getDate() + '日'
    }
    document.querySelectorAll('.ctp-tp-when').forEach(function (el) { el.textContent = ago(el.getAttribute('datetime')) })

    // share: copy the link
    document.querySelectorAll('.ctp-tp-share').forEach(function (b) {
      b.addEventListener('click', function () {
        const url = b.getAttribute('data-href')
        const done = function () { bookToast('已複製連結') }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt('複製這個連結', url) })
        else window.prompt('複製這個連結', url)
      })
    })

    // follow
    const follow = document.querySelector('.ctp-tp-follow')
    if (follow) {
      follow.addEventListener('click', function () {
        const on = follow.getAttribute('aria-pressed') !== 'true'
        follow.disabled = true
        post('/api/lilith/teams/' + encodeURIComponent(data.team) + '/follow', { follow: on }).then(function (d) {
          follow.setAttribute('aria-pressed', d.following ? 'true' : 'false')
          follow.classList.toggle('active', d.following)
          follow.textContent = d.following ? '追蹤中' : '追蹤'
          const n = document.querySelector('.ctp-tp-followers')
          if (n) n.textContent = d.followers
        }).catch(fail).then(function () { follow.disabled = false })
      })
    }

    // like and bookmark: a note can be both pinned and in the list, so update every copy
    function same (cls, ref) {
      return Array.from(document.querySelectorAll(cls)).filter(function (b) { return b.getAttribute('data-ref') === ref })
    }
    document.querySelectorAll('.ctp-tp-like').forEach(function (b) {
      b.addEventListener('click', function () {
        const ref = b.getAttribute('data-ref')
        const on = b.getAttribute('aria-pressed') !== 'true'
        b.disabled = true
        post('/api/lilith/notes/' + encodeURIComponent(ref) + '/like', { like: on }).then(function (d) {
          same('.ctp-tp-like', ref).forEach(function (x) {
            x.setAttribute('aria-pressed', d.liked ? 'true' : 'false')
            x.classList.toggle('active', d.liked)
            x.querySelector('i').className = 'fa ' + (d.liked ? 'fa-heart' : 'fa-heart-o')
            x.querySelector('span').textContent = d.count
          })
        }).catch(fail).then(function () { b.disabled = false })
      })
    })
    document.querySelectorAll('.ctp-tp-star').forEach(function (b) {
      b.addEventListener('click', function () {
        const ref = b.getAttribute('data-ref')
        const on = b.getAttribute('aria-pressed') !== 'true'
        b.disabled = true
        post('/api/lilith/notes/' + encodeURIComponent(ref) + '/meta', { starred: on }).then(function (d) {
          same('.ctp-tp-star', ref).forEach(function (x) {
            x.setAttribute('aria-pressed', d.starred ? 'true' : 'false')
            x.classList.toggle('active', d.starred)
            x.title = d.starred ? '取消收藏' : '收藏'
            x.querySelector('i').className = 'fa ' + (d.starred ? 'fa-bookmark' : 'fa-bookmark-o')
          })
          bookToast(d.starred ? '已收藏' : '已取消收藏')
        }).catch(fail).then(function () { b.disabled = false })
      })
    })

    // search and order (all notes)
    const all = document.querySelector('.ctp-tp-all-list')
    const search = document.querySelector('.ctp-tp-search input')
    const order = document.querySelector('.ctp-tp-order')
    const none = document.querySelector('.ctp-tp-empty')
    function apply () {
      if (!all) return
      const q = (search.value || '').trim().toLowerCase()
      const items = Array.from(all.children)
      items.sort(function (a, b) {
        const d = a.getAttribute('data-time').localeCompare(b.getAttribute('data-time'))
        return order.value === 'old' ? d : -d
      }).forEach(function (li) { all.appendChild(li) })
      let shown = 0
      items.forEach(function (li) {
        const hit = !q || li.getAttribute('data-title').indexOf(q) >= 0
        li.hidden = !hit
        if (hit) shown++
      })
      if (none) none.hidden = shown > 0
    }
    if (search) search.addEventListener('input', apply)
    if (order) order.addEventListener('change', apply)

    // pinned notes (managers): a small dialog with the public notes, at most 3
    const pick = document.querySelector('.ctp-tp-pick')
    if (pick) {
      pick.addEventListener('click', function () {
        const back = document.createElement('div')
        back.className = 'ctp-tp-dialog-back'
        const box = document.createElement('div')
        box.className = 'ctp-tp-dialog'
        box.setAttribute('role', 'dialog')
        box.setAttribute('aria-modal', 'true')
        box.setAttribute('aria-label', '選擇釘選筆記')
        const h = document.createElement('h2')
        h.textContent = '選擇釘選筆記（最多 3 篇）'
        box.appendChild(h)
        const list = document.createElement('div')
        list.className = 'ctp-tp-dialog-list'
        data.notes.forEach(function (n) {
          const label = document.createElement('label')
          const cb = document.createElement('input')
          cb.type = 'checkbox'
          cb.value = n.ref
          cb.checked = data.pinned.indexOf(n.ref) >= 0
          label.appendChild(cb)
          label.appendChild(document.createTextNode(' ' + n.title))
          list.appendChild(label)
        })
        box.appendChild(list)
        const msg = document.createElement('p')
        msg.className = 'ctp-tp-dialog-msg'
        msg.setAttribute('role', 'status')
        box.appendChild(msg)
        const row = document.createElement('div')
        row.className = 'ctp-tp-dialog-row'
        const cancel = document.createElement('button')
        cancel.type = 'button'
        cancel.className = 'btn btn-default'
        cancel.textContent = '取消'
        const save = document.createElement('button')
        save.type = 'button'
        save.className = 'btn ctp-tp-primary'
        save.textContent = '儲存'
        row.appendChild(cancel)
        row.appendChild(save)
        box.appendChild(row)
        back.appendChild(box)
        document.body.appendChild(back)
        function close () { back.remove(); pick.focus() }
        function checked () { return Array.from(list.querySelectorAll('input:checked')).map(function (c) { return c.value }) }
        list.addEventListener('change', function () {
          const n = checked().length
          msg.textContent = n > 3 ? '最多只能選 3 篇' : '已選 ' + n + ' 篇'
          save.disabled = n > 3
        })
        cancel.addEventListener('click', close)
        back.addEventListener('click', function (e) { if (e.target === back) close() })
        box.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') return close()
          if (e.key !== 'Tab') return
          // (review fix) Tab stays inside the dialog
          const items = Array.from(box.querySelectorAll('input, button')).filter(function (x) { return !x.disabled })
          if (!items.length) return
          const first = items[0]
          const last = items[items.length - 1]
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
        })
        save.addEventListener('click', function () {
          save.disabled = true
          post('/api/lilith/teams/' + encodeURIComponent(data.team) + '/pins', { notes: checked() })
            .then(function () { location.reload() })
            .catch(function (err) { msg.textContent = err.message; save.disabled = false })
        })
        const first = list.querySelector('input')
        if (first) first.focus()
      })
    }
  }

  // ---- notifications (feature 26, like HackMD): bell with the unread count, panel with
  // 一般通知 (note changes) / 重要通知 (teams), "only unread", "mark all as read"
  function notifications (slots) {
    const baseEl = document.querySelector('base')
    const base = (baseEl ? baseEl.href : location.origin + '/').replace(/\/$/, '')
    const api = function (method, path, body) {
      return fetch(base + '/api/lilith/notifications' + path, {
        method,
        credentials: 'same-origin',
        keepalive: method !== 'GET',
        headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body || {})
      }).then(function (r) {
        if (r.status === 401) return null
        return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || '讀取失敗'); return d })
      })
    }
    function el (tag, cls, text) {
      const e = document.createElement(tag)
      if (cls) e.className = cls
      if (text !== undefined) e.textContent = text
      return e
    }

    const buttons = []
    let kind = 'change'
    let unreadOnly = false
    let openFor = null

    // the panel (one for the page)
    const panel = el('div', 'ctp-notify-panel')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', '通知')
    panel.hidden = true
    const tabs = el('div', 'ctp-notify-tabs')
    tabs.setAttribute('role', 'tablist')
    const tabFor = {}
    ;[['change', '一般通知'], ['team', '重要通知']].forEach(function (t) {
      const b = el('button', 'ctp-notify-tab')
      b.type = 'button'
      b.setAttribute('role', 'tab')
      b.dataset.kind = t[0]
      b.appendChild(el('span', '', t[1]))
      const badge = el('span', 'ctp-notify-count')
      b.appendChild(badge)
      b.addEventListener('click', function () { kind = t[0]; load() })
      tabFor[t[0]] = { button: b, badge }
      tabs.appendChild(b)
    })
    const bar = el('div', 'ctp-notify-bar')
    const toggle = el('label', 'ctp-notify-unread')
    const box = el('input')
    box.type = 'checkbox'
    toggle.appendChild(box)
    toggle.appendChild(el('span', 'ctp-notify-switch'))
    toggle.appendChild(document.createTextNode('只顯示未讀'))
    box.addEventListener('change', function () { unreadOnly = box.checked; load() })
    const allRead = el('button', 'ctp-notify-allread', '全部標示為已讀')
    allRead.type = 'button'
    // (review fix) failures are shown instead of lost
    function failed (err) { bookToast((err && err.message) || '操作失敗') }
    allRead.addEventListener('click', function () {
      if (allRead.disabled) return
      allRead.disabled = true
      api('POST', '/read', { kind }).then(load, failed).then(function () { allRead.disabled = false })
    })
    bar.appendChild(toggle)
    bar.appendChild(allRead)
    const list = el('div', 'ctp-notify-list')
    panel.appendChild(tabs)
    panel.appendChild(bar)
    panel.appendChild(list)
    document.body.appendChild(panel)

    function dayLabel (t) {
      const d = new Date(t)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5)
      return diff === 0 ? '今天' : diff === 1 ? '昨天' : d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
    }
    function clock (t) {
      const d = new Date(t)
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
    }
    // changes: removed (red, struck), added (green), around them (plain); ↵ marks a line break
    function diffView (changes) {
      const box = el('div', 'ctp-notify-diff')
      changes.forEach(function (c) {
        const span = el('span', c[0] < 0 ? 'ctp-del' : c[0] > 0 ? 'ctp-ins' : 'ctp-ctx')
        const parts = c[1].split('\n')
        parts.forEach(function (part, i) {
          if (i > 0) {
            if (c[0] !== 0) span.appendChild(el('span', 'ctp-nl', '↵'))
            span.appendChild(document.createElement('br'))
          }
          span.appendChild(document.createTextNode(part))
        })
        box.appendChild(span)
      })
      return box
    }

    function item (n) {
      const row = el('div', 'ctp-notify-item' + (n.read ? '' : ' ctp-unread'))
      const who = n.actors[0] || { name: '有人', photo: '' }
      const img = el('img', 'ctp-notify-avatar')
      img.alt = ''
      if (who.photo) img.src = who.photo
      row.appendChild(img)
      const body = el('div', 'ctp-notify-body')
      const line = el('div', 'ctp-notify-line')
      line.appendChild(el('strong', '', who.name || '有人'))
      if (n.others) line.appendChild(document.createTextNode(' 和其他 ' + n.others + ' 個人'))
      if (n.kind === 'change') {
        line.appendChild(document.createTextNode(' 變更了 '))
        if (n.link) {
          const a = el('a', '', n.title)
          a.href = n.link
          a.addEventListener('click', function () { if (!n.read) api('POST', '/' + n.id, { read: true }) })
          line.appendChild(a)
        } else {
          line.appendChild(el('span', 'ctp-notify-gone', n.title + (n.noAccess ? '（已無權限）' : '（已刪除）')))
        }
        line.appendChild(document.createTextNode('：'))
      } else {
        line.appendChild(document.createTextNode(' ' + n.message + ' '))
        if (n.link) {
          const a = el('a', '', '「' + n.teamName + '」')
          a.href = n.link
          a.addEventListener('click', function () { if (!n.read) api('POST', '/' + n.id, { read: true }) })
          line.appendChild(a)
        } else line.appendChild(el('span', '', '「' + n.teamName + '」'))
      }
      body.appendChild(line)
      if (n.kind === 'change' && n.changes.length) body.appendChild(diffView(n.changes))
      body.appendChild(el('time', 'ctp-notify-time', clock(n.time)))
      row.appendChild(body)
      const tools = el('div', 'ctp-notify-tools')
      if (!n.read) tools.appendChild(el('span', 'ctp-notify-dot'))
      const mark = el('button', 'ctp-notify-btn')
      mark.type = 'button'
      mark.title = n.read ? '標示為未讀' : '標示為已讀'
      mark.setAttribute('aria-label', mark.title)
      mark.innerHTML = n.read ? '<i class="fa fa-envelope-o" aria-hidden="true"></i>' : '<i class="fa fa-check" aria-hidden="true"></i>'
      mark.addEventListener('click', function () { mark.disabled = true; api('POST', '/' + n.id, { read: !n.read }).then(load, function (err) { mark.disabled = false; failed(err) }) })
      const del = el('button', 'ctp-notify-btn')
      del.type = 'button'
      del.title = '刪除這則通知'
      del.setAttribute('aria-label', del.title)
      del.innerHTML = '<i class="fa fa-trash-o" aria-hidden="true"></i>'
      del.addEventListener('click', function () { del.disabled = true; api('DELETE', '/' + n.id).then(load, function (err) { del.disabled = false; failed(err) }) })
      tools.appendChild(mark)
      tools.appendChild(del)
      row.appendChild(tools)
      return row
    }

    function setCounts (unread) {
      const total = (unread.change || 0) + (unread.team || 0)
      buttons.forEach(function (b) {
        b.badge.textContent = total > 99 ? '99+' : String(total || '')
        b.badge.hidden = !total
        b.button.setAttribute('aria-label', total ? '通知（' + total + ' 則未讀）' : '通知')
      })
      Object.keys(tabFor).forEach(function (k) {
        tabFor[k].badge.textContent = unread[k] ? String(unread[k]) : ''
        tabFor[k].badge.hidden = !unread[k]
      })
    }

    let loading = 0
    function load () {
      Object.keys(tabFor).forEach(function (k) {
        tabFor[k].button.classList.toggle('active', k === kind)
        tabFor[k].button.setAttribute('aria-selected', k === kind ? 'true' : 'false')
      })
      // (review fix) a slower earlier answer must not replace the one asked for last
      const mine = ++loading
      return api('GET', '?kind=' + kind + (unreadOnly ? '&unread=1' : '')).then(function (data) {
        if (!data || mine !== loading) return
        setCounts(data.unread)
        list.innerHTML = ''
        if (!data.items.length) {
          list.appendChild(el('p', 'ctp-notify-empty', unreadOnly ? '沒有未讀的通知。' : kind === 'change' ? '還沒有通知。別人變更你的筆記、團隊筆記或你收藏的筆記時，會出現在這裡。' : '還沒有重要通知。團隊相關的變動會出現在這裡。'))
          return
        }
        let last = null
        data.items.forEach(function (n) {
          const day = dayLabel(n.time)
          if (day !== last) { list.appendChild(el('div', 'ctp-notify-day', day)); last = day }
          list.appendChild(item(n))
        })
      }).catch(function (err) { list.innerHTML = ''; list.appendChild(el('p', 'ctp-notify-empty', err.message)) })
    }

    function place (button) {
      const r = button.getBoundingClientRect()
      const w = Math.min(460, window.innerWidth - 16)
      panel.style.width = w + 'px'
      panel.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px'
      panel.style.top = (r.bottom + 8) + 'px'
    }
    function close () {
      panel.hidden = true
      if (openFor) openFor.setAttribute('aria-expanded', 'false')
      openFor = null
    }
    document.addEventListener('click', function (e) {
      if (openFor && !panel.contains(e.target) && !e.target.closest('.ctp-bell')) close()
    })
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openFor) { const b = openFor; close(); b.focus() } })
    window.addEventListener('resize', function () { if (openFor) place(openFor) })

    // the bells; shown only when /count answers (signed in)
    slots.forEach(function (slot) {
      const button = el('button', 'ctp-bell')
      button.type = 'button'
      button.setAttribute('aria-haspopup', 'dialog')
      button.setAttribute('aria-expanded', 'false')
      button.title = '通知'
      button.innerHTML = '<i class="fa fa-bell-o" aria-hidden="true"></i>'
      const badge = el('span', 'ctp-bell-count')
      badge.hidden = true
      button.appendChild(badge)
      button.addEventListener('click', function (e) {
        e.stopPropagation()
        if (openFor === button) return close()
        openFor = button
        button.setAttribute('aria-expanded', 'true')
        place(button)
        panel.hidden = false
        load()
        // (review fix) keyboard users land in the panel (it sits at the end of the page)
        tabFor[kind].button.focus()
      })
      slot.appendChild(button)
      buttons.push({ button, badge, slot })
    })
    function poll () {
      if (document.hidden) return
      api('GET', '/count').then(function (unread) {
        if (!unread) return
        buttons.forEach(function (b) { b.slot.hidden = false })
        setCounts(unread)
      }).catch(function () {})
    }
    poll()
    setInterval(poll, 60000)
    document.addEventListener('visibilitychange', poll)
  }

  // ---- home page: /#edit-profile (from the avatar menu) opens the profile dialog ----
  function editProfileFromHash () {
    if (location.hash !== '#edit-profile') return
    history.replaceState(null, '', location.pathname + location.search)
    const $ = window.jQuery
    const signedIn = document.querySelector('.ui-signout') && document.querySelector('.ui-signout').style.display !== 'none'
    if ($ && $.fn.modal && signedIn) $('.profile-modal').modal('show')
  }

  function mount () {
    document.querySelectorAll('input[type="password"]').forEach(passwordToggle)
    const titleBox = document.querySelector('.ctp-nav-title')
    if (titleBox && window.MutationObserver) navTitle(titleBox)
    const user = document.querySelector('.ctp-user')
    if (user && window.fetch) userMenu(user)
    submenus()
    const tocAffix = document.getElementById('ui-toc-affix')
    if (tocAffix && window.MutationObserver) tocPanel(tocAffix)
    if (document.readyState === 'complete') editProfileFromHash()
    else window.addEventListener('load', editProfileFromHash)

    // by now the page is parsed: type the quote even if its source line is missing,
    // so the CSS can never keep it hidden
    const quote = document.querySelector('[data-typewriter]')
    if (quote) typewriter(quote)

    const historyList = document.getElementById('history-list')
    if (historyList && window.MutationObserver) groupByYear(historyList)

    // editor page: replace HedgeDoc's night toggle (desktop + mobile)
    const nightGroups = document.querySelectorAll('.ui-night')
    nightGroups.forEach(function (night) {
      const group = night.closest('.btn-group') || night
      const s = buildSwitcher('ctp-in-navbar')
      group.parentNode.insertBefore(s.wrapper, group.nextSibling)
    })

    // cover page: add to the masthead navigation
    const masthead = document.querySelector('.masthead-nav')
    if (masthead) {
      const li = document.createElement('li')
      li.className = 'ctp-masthead-item'
      li.appendChild(buildSwitcher('ctp-in-masthead').wrapper)
      masthead.insertBefore(li, masthead.querySelector('.ui-signin, .ui-signout'))
    }

    // published note: in the top bar, icon only (like HackMD's brush)
    const prettyTheme = document.querySelector('.ctp-pretty-theme')
    if (prettyTheme) prettyTheme.appendChild(buildSwitcher('ctp-in-pretty').wrapper)
    document.querySelectorAll('.ctp-pretty-star, .ctp-note-star').forEach(noteStar)
    document.querySelectorAll('.ctp-pretty-like').forEach(noteLike)
    const trashList = document.querySelector('.ctp-trash-list')
    if (trashList && window.fetch) trashPage(trashList)
    // invite link page (feature 24): join only when the button is pressed
    const joinButton = document.querySelector('.ctp-join-accept')
    if (joinButton && window.fetch) {
      joinButton.addEventListener('click', function () {
        const brand = document.querySelector('.login-brand')
        const base = (brand ? brand.getAttribute('href') : '/').replace(/\/$/, '')
        joinButton.disabled = true
        fetch(base + '/api/lilith/teams/join', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: joinButton.getAttribute('data-token') })
        }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || '加入失敗'); return d }) })
          .then(function (d) { location.href = d.url }, function (err) {
            document.querySelector('.ctp-join-msg').textContent = err.message
            joinButton.disabled = false
          })
      })
    }
    const teamRoot = document.querySelector('.ctp-team-settings')
    if (teamRoot && window.fetch) teamSettings(teamRoot)
    if (document.getElementById('textit')) bookEditor()
    const shellData = document.getElementById('ctp-book-shell')
    if (shellData && window.fetch) bookShell(JSON.parse(shellData.textContent))
    const tpData = document.getElementById('ctp-team-page')
    if (tpData && window.fetch) teamPage(JSON.parse(tpData.textContent))
    const bellSlots = document.querySelectorAll('.ctp-bell-slot')
    if (bellSlots.length && window.fetch) notifications(Array.from(bellSlots))
    const bookSide = document.querySelector('.ctp-book-side')
    if (bookSide) bookPage(bookSide)

    // any other page: floating button
    if (switchers.length === 0 && !document.body.classList.contains('ctp-book-shell')) {
      document.body.appendChild(buildSwitcher('ctp-floating hidden-print').wrapper)
    }

    document.addEventListener('click', function (event) {
      switchers.forEach(function (s) {
        if (!s.wrapper.contains(event.target)) close(s.wrapper)
      })
    })
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') switchers.forEach(s => close(s.wrapper))
    })

    apply(currentChoice)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount)
  } else {
    mount()
  }
})()
