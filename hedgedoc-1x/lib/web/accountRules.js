'use strict'
// Lilith: user name and password rules (same as HackMD's sign-up page).
// Each check returns an error message in Chinese, or null when the value is fine.

const USERNAME_MAX_LENGTH = 50
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128

const USERNAME_HINT = '僅允許 a-Z、0-9 以及 - 號（- 不能是第一個字元）'
const PASSWORD_HINT = `密碼長度須為 ${PASSWORD_MIN_LENGTH} 到 ${PASSWORD_MAX_LENGTH} 個字，且包含大小寫英文字母及數字`

function checkUsername (value) {
  if (typeof value !== 'string' || value.length === 0) return '請輸入使用者名稱'
  if (value.length > USERNAME_MAX_LENGTH) return `使用者名稱最多 ${USERNAME_MAX_LENGTH} 個字`
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(value)) return '使用者名稱' + USERNAME_HINT
  return null
}

function checkPassword (value) {
  if (typeof value !== 'string' ||
      value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH ||
      !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
    return PASSWORD_HINT
  }
  return null
}

module.exports = {
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  USERNAME_HINT,
  PASSWORD_HINT,
  checkUsername,
  checkPassword
}
