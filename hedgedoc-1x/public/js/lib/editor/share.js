/* global $ */
// Share dialog (Lilith): share link with open mode, read/edit permissions
// mapped onto HedgeDoc's permission levels, and the publish link.

// HedgeDoc permission -> [who can read, who can edit]
const PERMISSIONS = {
  private: ['owner', 'owner'],
  protected: ['signed', 'owner'],
  limited: ['signed', 'signed'],
  locked: ['everyone', 'owner'],
  editable: ['everyone', 'signed'],
  freely: ['everyone', 'everyone']
}
const RANK = { owner: 0, signed: 1, everyone: 2 }
const DESCRIPTIONS = {
  private: '私密：只有你能閱讀或編輯',
  protected: '已登入的使用者可以閱讀，只有你能編輯',
  limited: '已登入的使用者可以閱讀與編輯',
  locked: '所有人（包含未登入）都可以閱讀，只有你能編輯',
  editable: '所有人都可以閱讀，已登入的使用者可以編輯',
  freely: '所有人（包含未登入）都可以閱讀與編輯'
}
const PUBLISH_DESCRIPTIONS = {
  owner: '目前只有你能開啟發表頁。要讓別人看到，請先在「分享」頁放寬「可閱讀」。',
  signed: '目前只有已登入的使用者能開啟發表頁。',
  everyone: '任何拿到網址的人都能開啟發表頁。'
}
// Open modes offered in the share dialog -> path suffix appended to the note URL
const MODES = {
  edit: '?both',
  view: '?view',
  book: '/book', // Lilith: real book mode (lib/web/bookRouter.js) -> /b/<note>
  slide: '/slide'
}

export function toPermission (read, edit) {
  for (const name of Object.keys(PERMISSIONS)) {
    const [r, e] = PERMISSIONS[name]
    if (r === read && e === edit) return name
  }
  return null
}

// Copy through a temporary off-screen textarea and the legacy copy command.
function copyBySelection (text) {
  return new Promise((resolve, reject) => {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    document.body.appendChild(area)
    area.select()
    try {
      if (document.execCommand('copy')) resolve()
      else reject(new Error('copy command failed'))
    } catch (err) {
      reject(err)
    } finally {
      document.body.removeChild(area)
    }
  })
}

// Prefer the Clipboard API; fall back to the copy command when it is missing
// (insecure context) or refuses (no permission / no user activation).
function copyText (text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(() => copyBySelection(text))
  }
  return copyBySelection(text)
}

export default function initShare ({ noteurl, getPermission, isOwner, setPermission }) {
  const $modal = $('.share-modal')
  if ($modal.length === 0) return { update () {} }

  const allowFreely = String($modal.data('allow-freely')) === 'true'
  const $urlBase = $modal.find('.share-url-base')
  const $url = $modal.find('.share-url')
  const $urlFull = $modal.find('#share-url-full')
  const $mode = $modal.find('.share-mode')
  const $modeToggle = $modal.find('.share-mode-toggle')
  const $modeMenu = $modal.find('.share-mode-menu')
  const $helpToggle = $modal.find('.share-mode-help')
  const $helpText = $modal.find('.share-mode-help-text')
  const $preview = $modal.find('.share-preview')
  const $read = $modal.find('.share-read')
  const $edit = $modal.find('.share-edit')
  const $desc = $modal.find('.share-pane[data-share-pane="share"] .share-perm-desc')
  const $note = $modal.find('.share-perm-note')
  const $publishUrl = $modal.find('.share-publish-url')
  const $publishOpen = $modal.find('.share-publish-open')
  const $publishDesc = $modal.find('.share-publish-desc')
  const $toast = $modal.find('.share-toast')
  let toastTimer = null
  let activeTab = 'share'
  let mode = 'view'

  const baseUrl = noteurl.slice(0, noteurl.lastIndexOf('/') + 1)
  const noteId = noteurl.slice(baseUrl.length)

  function shareUrl () {
    return noteurl + MODES[mode]
  }

  function publishUrl () {
    return noteurl + '/publish'
  }

  function showToast (text) {
    $toast.text(text)
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => $toast.text(''), 2000)
  }

  function copy (text, done) {
    copyText(text).then(() => showToast(done)).catch(() => showToast('複製失敗，請手動選取網址'))
  }

  function renderUrl () {
    // Like HackMD: the base on its own line, the note part (+ mode) in the box
    $urlBase.text(baseUrl)
    $url.val(noteId + MODES[mode])
    $urlFull.text(shareUrl())
    $preview.attr('href', shareUrl())
  }

  function setMode (next) {
    mode = MODES[next] ? next : 'view'
    const $item = $modeMenu.find('[data-mode="' + mode + '"]')
    $mode.attr('data-mode', mode)
    $modeToggle.find('.share-mode-icon').attr('class', 'fa fa-fw share-mode-icon ' + $item.data('icon'))
    $modeToggle.find('.share-mode-label').text($item.text().trim())
    $modeMenu.find('[role="option"]').each(function () {
      this.setAttribute('aria-selected', this.getAttribute('data-mode') === mode ? 'true' : 'false')
    })
    renderUrl()
  }

  function toggleModeMenu (open) {
    $modeMenu.prop('hidden', !open)
    $modeToggle.attr('aria-expanded', open ? 'true' : 'false')
  }

  function limitEditOptions (read) {
    $edit.find('option').each(function () {
      const hiddenOption = this.value === 'everyone' && !allowFreely
      this.hidden = hiddenOption
      this.disabled = hiddenOption || RANK[this.value] > RANK[read]
    })
  }

  function render () {
    const permission = getPermission()
    const owner = isOwner()
    const [read, edit] = PERMISSIONS[permission] || PERMISSIONS.private
    $read.val(read)
    limitEditOptions(read)
    $edit.val(edit)
    $read.prop('disabled', !owner)
    $edit.prop('disabled', !owner)
    $note.prop('hidden', owner)
    $desc.text(DESCRIPTIONS[permission] || '')
    renderUrl()
    $publishUrl.val(publishUrl())
    $publishOpen.attr('href', publishUrl())
    $publishDesc.text(PUBLISH_DESCRIPTIONS[read])
  }

  function requestPermission (read, edit) {
    if (RANK[edit] > RANK[read]) edit = read
    if (edit === 'everyone' && !allowFreely) edit = 'signed'
    const permission = toPermission(read, edit)
    if (!permission) return
    limitEditOptions(read)
    $edit.val(edit)
    $desc.text(DESCRIPTIONS[permission])
    // the server answers with a 'permission' event, which calls update()
    setPermission(permission)
  }

  $read.on('change', () => requestPermission($read.val(), $edit.val()))
  $edit.on('change', () => requestPermission($read.val(), $edit.val()))

  $modeToggle.on('click', (event) => {
    event.stopPropagation()
    toggleModeMenu($modeMenu.prop('hidden'))
  })
  $modeMenu.on('click', '[role="option"]', function (event) {
    event.stopPropagation()
    setMode(this.getAttribute('data-mode'))
    toggleModeMenu(false)
  })
  $modal.on('click', () => toggleModeMenu(false))
  $modal.on('keydown', (event) => {
    // Esc closes the open mode menu first; Bootstrap's close handler sits on
    // the same element and is bound when the modal opens, i.e. after this one.
    if (event.key === 'Escape' && !$modeMenu.prop('hidden')) {
      event.stopImmediatePropagation()
      toggleModeMenu(false)
    }
  })
  $helpToggle.on('click', () => {
    const open = $helpText.prop('hidden')
    $helpText.prop('hidden', !open)
    $helpToggle.attr('aria-expanded', open ? 'true' : 'false')
  })

  $modal.find('[data-share-tab]').on('click', function (event) {
    event.preventDefault()
    activeTab = $(this).data('share-tab')
    $modal.find('.share-tabs li').removeClass('active')
    $(this).parent().addClass('active')
    $modal.find('[data-share-pane]').each(function () {
      this.hidden = $(this).data('share-pane') !== activeTab
    })
  })

  $modal.find('.share-copy').on('click', function () {
    copy($(this).data('copy') === 'publish' ? publishUrl() : shareUrl(), '已複製')
  })
  $modal.find('.share-copy-main').on('click', () => {
    copy(activeTab === 'publish' ? publishUrl() : shareUrl(), '已複製連結')
  })

  $modal.on('show.bs.modal', render)
  $modal.on('hide.bs.modal', () => toggleModeMenu(false))
  setMode('view')

  return { update: render }
}
