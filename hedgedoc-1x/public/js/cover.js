/* global moment, serverurl */

import {
  checkIfAuth,
  clearLoginState,
  getLoginState,
  resetCheckAuth,
  setloginStateChangeEvent
} from './lib/common/login'

import {
  clearDuplicatedHistory,
  deleteServerHistory,
  getHistory,
  getStorageHistory,
  parseHistory,
  parseServerToHistory,
  parseStorageToHistory,
  postHistoryToServer,
  removeHistory,
  saveHistory,
  saveStorageHistoryToServer
} from './history'

import { saveAs } from 'file-saver'
import List from 'list.js'
import { unescapeHtml } from './utils'
import initProfile from './lib/profile'
import initNoteList from './lib/noteList'

require('./locale')

require('../css/cover.css')
require('../css/site.css')

require('./fix-aria-hidden-for-modals')

initProfile()

const options = {
  valueNames: ['id', 'text', 'timestamp', 'fromNow', 'time', 'tags', 'pinned'],
  item: `<li class="col-xs-12 col-sm-6 col-md-6 col-lg-4">
          <span class="id" style="display:none;"></span>
          <a href="#">
            <div class="item">
              <div class="ui-history-pin fa fa-thumb-tack fa-fw"></div>
              <div class="ui-history-more" role="button" tabindex="0" title="更多" aria-label="更多動作" aria-haspopup="true" aria-expanded="false"><i class="fa fa-ellipsis-h"></i></div>
              <div class="content">
                <h4 class="text"></h4>
                <span class="ctp-card-flags"></span>
                <p>
                  <i><i class="fa fa-clock-o"></i> visited </i><i class="fromNow"></i>
                  <br>
                  <i class="timestamp" style="display:none;"></i>
                  <i class="time"></i>
                </p>
                <p class="tags"></p>
              </div>
            </div>
          </a>
        </li>`,
  page: 18,
  pagination: [{
    outerWindow: 1
  }]
}
const historyList = new List('history', options)

// Lilith (feature 20): the card "..." menu, folders and bookmarks
const noteList = initNoteList({
  list: historyList,
  refresh: () => $('.ui-refresh-history').click(),
  removeFromHistory,
  togglePin,
  isPinned: id => {
    const item = historyList.get('id', id)[0]
    return !!(item && item.values().pinned)
  }
})

window.migrateHistoryFromTempCallback = pageInit
setloginStateChangeEvent(pageInit)

pageInit()

function pageInit () {
  checkIfAuth(
    data => {
      $('.ui-signin').hide()
      $('.ui-or').hide()
      $('.ui-welcome').show()
      if (data.photo) $('.ui-avatar').prop('src', data.photo).show()
      else $('.ui-avatar').prop('src', '').hide()
      $('.ui-name').html(data.name)
      $('.ui-signout').show()
      $('.ui-history').click()
      // Lilith (feature 24): my history, or the notes of the selected team
      noteList.loadTeams().then(() => {
        if (noteList.team()) noteList.loadTeam(() => parseHistoryCallback(historyList))
        else {
          parseServerToHistory(historyList, (list, notehistory) => {
            parseHistoryCallback(list, notehistory)
            noteList.loadMeta()
          })
        }
      })
    },
    () => {
      $('.ui-signin').show()
      $('.ui-or').show()
      $('.ui-welcome').hide()
      $('.ui-avatar').prop('src', '').hide()
      $('.ui-name').html('')
      $('.ui-signout').hide()
      noteList.reset()
      parseStorageToHistory(historyList, parseHistoryCallback)
    }
  )
}

$('.masthead-nav li').click(function () {
  $(this).siblings().removeClass('active')
  $(this).addClass('active')
})

// prevent empty link change hash
$('a[href="#"]').click(function (e) {
  e.preventDefault()
})

$('.ui-home').click(function (e) {
  if (!$('#home').is(':visible')) {
    $('.section:visible').hide()
    $('#home').fadeIn()
  }
})

$('.ui-history').click(() => {
  if (!$('#history').is(':visible')) {
    $('.section:visible').hide()
    $('#history').fadeIn()
  }
})

function checkHistoryList () {
  if ($('#history-list').children().length > 0) {
    $('.pagination').show()
    $('.ui-nohistory').hide()
    $('.ui-import-from-browser').hide()
  } else if ($('#history-list').children().length === 0) {
    $('.pagination').hide()
    $('.ui-nohistory').slideDown()
    getStorageHistory(data => {
      if (data && data.length > 0 && getLoginState() && historyList.items.length === 0) {
        $('.ui-import-from-browser').slideDown()
      }
    })
  }
}

function parseHistoryCallback (list, notehistory) {
  checkHistoryList()
  // Lilith (feature 22): pinned first, then the chosen grouping and order (lib/noteList.js)
  noteList.sortList()
  // parse filter tags
  const filtertags = []
  for (let i = 0, l = list.items.length; i < l; i++) {
    const tags = list.items[i]._values.tags
    if (tags && tags.length > 0) {
      for (let j = 0; j < tags.length; j++) {
        // push info filtertags if not found
        let found = false
        if (filtertags.includes(tags[j])) { found = true }
        if (!found) { filtertags.push(tags[j]) }
      }
    }
  }
  buildTagsFilter(filtertags)
  noteList.renderTags()
}

// update items whenever list updated
historyList.on('updated', e => {
  noteList.beginUpdate()
  for (let i = 0, l = e.items.length; i < l; i++) {
    const item = e.items[i]
    if (item.visible()) {
      const itemEl = $(item.elm)
      const values = item._values
      const a = itemEl.find('a')
      const pin = itemEl.find('.ui-history-pin')
      const tagsEl = itemEl.find('.tags')
      // parse link to element a
      a.attr('href', `${serverurl}/${values.id}`)
      // parse pinned
      if (values.pinned) {
        pin.addClass('active')
      } else {
        pin.removeClass('active')
      }
      // parse tags
      const tags = values.tags
      if (tags && tags.length > 0 && tagsEl.children().length <= 0) {
        const labels = []
        for (let j = 0; j < tags.length; j++) {
          // push into the item label
          labels.push(`<span class='label label-default'>${tags[j]}</span>`)
        }
        tagsEl.html(labels.join(' '))
      }
      noteList.decorate(item)
    }
  }
  $('.ui-history-pin').off('click')
  $('.ui-history-pin').on('click', historyPinClick)
})

// Lilith: remove one note from the history (the card menu's 從紀錄移除)
function removeFromHistory (id) {
  return new Promise((resolve, reject) => {
    checkIfAuth(() => {
      deleteServerHistory(id, err => {
        if (err) return reject(new Error('移除失敗'))
        historyList.remove('id', id)
        checkHistoryList()
        resolve()
      })
    }, () => {
      getHistory(notehistory => {
        saveHistory(removeHistory(id, notehistory))
        historyList.remove('id', id)
        checkHistoryList()
        resolve()
      })
    })
  })
}

function historyPinClick (e) {
  e.preventDefault()
  togglePin($(this).closest('a').siblings('span').html())
}

// pin / unpin (the card's pin button and the menu's 釘選)
function togglePin (id) {
  const item = historyList.get('id', id)[0]
  if (!item) return
  const $this = $(item.elm).find('.ui-history-pin')
  const values = item._values
  let pinned = values.pinned
  if (!values.pinned) {
    pinned = true
    item._values.pinned = true
  } else {
    pinned = false
    item._values.pinned = false
  }
  checkIfAuth(() => {
    postHistoryToServer(id, {
      pinned
    }, (err, result) => {
      if (!err) {
        if (pinned) { $this.addClass('active') } else { $this.removeClass('active') }
      }
    })
  }, () => {
    getHistory(notehistory => {
      for (let i = 0; i < notehistory.length; i++) {
        if (notehistory[i].id === id) {
          notehistory[i].pinned = pinned
          break
        }
      }
      saveHistory(notehistory)
      if (pinned) { $this.addClass('active') } else { $this.removeClass('active') }
    })
  })
}

// auto update item fromNow every minutes
setInterval(updateItemFromNow, 60000)

function updateItemFromNow () {
  const items = $('.item').toArray()
  for (let i = 0; i < items.length; i++) {
    const item = $(items[i])
    const timestamp = parseInt(item.find('.timestamp').text())
    item.find('.fromNow').text(moment(timestamp).fromNow())
  }
}

let clearHistory = false
let deleteId = null

function deleteHistory () {
  checkIfAuth(() => {
    deleteServerHistory(deleteId, (err, result) => {
      if (!err) {
        if (clearHistory) {
          historyList.clear()
          checkHistoryList()
        } else {
          historyList.remove('id', deleteId)
          checkHistoryList()
        }
      }
      $('.delete-history-modal').modal('hide')
      deleteId = null
      clearHistory = false
    })
  }, () => {
    if (clearHistory) {
      saveHistory([])
      historyList.clear()
      checkHistoryList()
      deleteId = null
    } else {
      if (!deleteId) return
      getHistory(notehistory => {
        const newnotehistory = removeHistory(deleteId, notehistory)
        saveHistory(newnotehistory)
        historyList.remove('id', deleteId)
        checkHistoryList()
        deleteId = null
      })
    }
    $('.delete-history-modal').modal('hide')
    clearHistory = false
  })
}

$('.ui-delete-history-modal-confirm').click(() => {
  deleteHistory()
})

$('.ui-import-from-browser').click(() => {
  saveStorageHistoryToServer(() => {
    parseStorageToHistory(historyList, parseHistoryCallback)
  })
})

$('.ui-save-history').click(() => {
  getHistory(data => {
    const history = JSON.stringify(data)
    const blob = new Blob([history], {
      type: 'application/json;charset=utf-8'
    })
    saveAs(blob, `hedgedoc_history_${moment().format('YYYYMMDDHHmmss')}`, true)
  })
})

$('.ui-open-history').bind('change', e => {
  const files = e.target.files || e.dataTransfer.files
  const file = files[0]
  const reader = new FileReader()
  reader.onload = () => {
    const notehistory = JSON.parse(reader.result)
    // console.log(notehistory);
    if (!reader.result) return
    getHistory(data => {
      let mergedata = data.concat(notehistory)
      mergedata = clearDuplicatedHistory(mergedata)
      saveHistory(mergedata)
      parseHistory(historyList, parseHistoryCallback)
    })
    $('.ui-open-history').replaceWith($('.ui-open-history').val('').clone(true))
  }
  reader.readAsText(file)
})

$('.ui-clear-history').click(() => {
  $('.ui-delete-history-modal-msg').text('Do you really want to clear all history?')
  $('.ui-delete-history-modal-item').html('There is no turning back.')
  clearHistory = true
  deleteId = null
})

$('.ui-refresh-history').click(() => {
  const lastTags = $('.ui-use-tags').select2('val')
  $('.ui-use-tags').select2('val', '')
  noteList.setTags([])
  const lastKeyword = $('.search').val()
  $('.search').val('')
  historyList.search()
  // Lilith: a spinner where the list is while it reloads (hhyn), not a slide up / down
  let $spin = $('.ctp-list-loading')
  if (!$spin.length) {
    $spin = $('<div class="ctp-list-loading" role="status" aria-label="載入中"><span class="ctp-spinner" aria-hidden="true"></span></div>')
    $('#history-list').before($spin)
  }
  $spin.show()
  const started = Date.now()
  $('#history-list').hide()
  $('.pagination').hide()

  resetCheckAuth()
  historyList.clear()
  const after = (list, notehistory) => {
    parseHistoryCallback(list, notehistory)
    $('.ui-use-tags').select2('val', lastTags)
    $('.ui-use-tags').trigger('change')
    historyList.search(lastKeyword)
    $('.search').val(lastKeyword)
    checkHistoryList()
    // (at least a moment, so the spinner does not just flash)
    setTimeout(() => {
      $spin.hide()
      $('#history-list').show()
    }, Math.max(0, 300 - (Date.now() - started)))
    if (getLoginState() && !noteList.team()) noteList.loadMeta()
  }
  // Lilith (feature 24): a team's notes come from the team, not from my history
  if (noteList.team()) noteList.loadTeam(() => after(historyList))
  else parseHistory(historyList, after)
})

$('.ui-delete-user-modal-cancel').click(() => {
  $('.ui-delete-user').parent().removeClass('active')
})

$('.ui-logout').click(() => {
  clearLoginState()
  location.href = `${serverurl}/logout`
})

let filtertags = []
$('.ui-use-tags').select2({
  placeholder: $('.ui-use-tags').attr('placeholder'),
  multiple: true,
  data () {
    return {
      results: filtertags
    }
  }
})
$('.select2-input').css('width', 'inherit')
buildTagsFilter([])

function buildTagsFilter (tags) {
  for (let i = 0; i < tags.length; i++) {
    tags[i] = {
      id: i,
      text: unescapeHtml(tags[i])
    }
  }
  filtertags = tags
}
$('.ui-use-tags').on('change', function () {
  const tags = []
  const data = $(this).select2('data')
  for (let i = 0; i < data.length; i++) { tags.push(data[i].text) }
  // Lilith: combined with the sidebar scope (bookmarks / folder) in lib/noteList.js
  noteList.setTags(tags)
  checkHistoryList()
})

$('.search').keyup(() => {
  checkHistoryList()
})

// focus user field after opening login modal
$('.signin-modal').on('shown.bs.modal', function () {
  const fieldLDAP = $('input[name=username]')
  const fieldEmail = $('input[name=email]')
  const fieldOpenID = $('input[name=openid_identifier]')
  if (fieldLDAP.length === 1) {
    fieldLDAP.focus()
  } else if (fieldEmail.length === 1) {
    fieldEmail.focus()
  } else if (fieldOpenID.length === 1) {
    fieldOpenID.focus()
  }
})
