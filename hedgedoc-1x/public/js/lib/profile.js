/* global $, serverurl */
// Edit user profile dialog (Lilith).

export default function initProfile () {
  const $modal = $('.profile-modal')
  if ($modal.length === 0) return

  const $form = $modal.find('.profile-form')
  const $name = $modal.find('#profile-name')
  const $email = $modal.find('#profile-email')
  const $newPassword = $modal.find('#profile-new-password')
  const $newPassword2 = $modal.find('#profile-new-password2')
  const $current = $modal.find('#profile-current-password')
  const $passwordFields = $modal.find('.profile-password-fields')
  const $providerNote = $modal.find('.profile-provider-note')
  const $status = $modal.find('.profile-status')
  const $save = $modal.find('.profile-save')
  let loaded = null

  function setStatus (text, kind) {
    $status.text(text || '').attr('data-kind', kind || '')
  }

  function fill (me) {
    loaded = me
    $modal.find('.profile-photo').attr('src', me.photo || '')
    $modal.find('.profile-head-name').text(me.displayName)
    $modal.find('.profile-head-email').text(me.email || '')
    $name.val(me.displayName)
    $email.val(me.email || '')
    $newPassword.val('')
    $newPassword2.val('')
    $current.val('')
    $passwordFields.prop('hidden', !me.hasPassword)
    $providerNote.prop('hidden', me.provider === 'email')
    // keep the header menu in sync
    $('.ui-name').text(me.displayName)
    if (me.photo) $('.ui-avatar').attr('src', me.photo)
  }

  function errorText (xhr) {
    return (xhr && xhr.responseJSON && xhr.responseJSON.error) || '發生錯誤，請稍後再試'
  }

  $modal.on('show.bs.modal', function () {
    setStatus('讀取中…')
    $save.prop('disabled', true)
    $.ajax({ url: serverurl + '/api/lilith/me', dataType: 'json' }).then((me) => {
      fill(me)
      setStatus('')
      $save.prop('disabled', false)
    }, (xhr) => setStatus(errorText(xhr), 'error'))
  })

  $form.on('submit', function (event) {
    event.preventDefault()
    if (!loaded) return
    const body = { displayName: $name.val() }
    const emailChanged = $email.val().trim().toLowerCase() !== String(loaded.email || '').toLowerCase()
    const passwordChanged = $newPassword.val().length > 0
    if (loaded.hasPassword && emailChanged) body.email = $email.val().trim()
    if (passwordChanged) {
      if ($newPassword.val() !== $newPassword2.val()) return setStatus('兩次輸入的新密碼不一致', 'error')
      if ($newPassword.val().length < 8) return setStatus('新密碼至少要 8 個字元', 'error')
      body.newPassword = $newPassword.val()
    }
    if ((emailChanged || passwordChanged) && !$current.val()) {
      $current.trigger('focus')
      return setStatus('變更 E-Mail 或密碼時，請輸入目前的密碼', 'error')
    }
    if (emailChanged || passwordChanged) body.currentPassword = $current.val()

    $save.prop('disabled', true)
    setStatus('儲存中…')
    $.ajax({
      url: serverurl + '/api/lilith/me',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(body),
      dataType: 'json'
    }).then((me) => {
      fill(me)
      setStatus(passwordChanged ? '已儲存，密碼已更新' : '已儲存', 'ok')
    }, (xhr) => {
      setStatus(errorText(xhr), 'error')
    }).always(() => $save.prop('disabled', false))
  })
}
