# Feature 21: book mode like HackMD's -- /b/<index note>[/<page>]: the index note's
# lists of links are the table of contents on the left, the page on the right
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'BOOK-1' 'table of contents parser passes its unit test' {
  $r = Invoke-Native 'node' @((Join-Path $PSScriptRoot 'test-book.js'), $script:Hd)
  if ($r.Code -eq 0 -and $r.Out -match '^ok \d+') { $true } else { $r.Out }
}

Test-Check 'BOOK-2' 'routes: /<note>/book redirects to /b/<short id>; unknown books are 404' {
  $sql = "SELECT shortid, alias FROM Notes WHERE deletedAt IS NULL AND permission IN ('freely','editable','locked') AND TRIM(COALESCE(content,'')) <> '' LIMIT 1"
  $n = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @($sql) | ConvertFrom-Json))
  if ($n.Count -eq 0) { return 'WARN: no guest-readable note to test with' }
  $ref = if ($n[0].alias) { $n[0].alias } else { $n[0].shortid }
  $r = Invoke-Http "/$ref/book"
  if ($r.Code -ne 302 -or $r.Location -notlike "*/b/$ref") { return "/$ref/book -> $($r.Code) $($r.Location)" }
  $r = Invoke-Http "/b/$ref"
  if ($r.Code -ne 200) { return "/b/$ref gave HTTP $($r.Code)" }
  foreach ($c in 'class="ctp-book-side', 'ctp-book-search"', 'class="ctp-book-home', 'class="ctp-book-crumbs"', 'class="btn btn-default ctp-book-edit"', 'id="ctp-book-links"') {
    if (-not $r.Body.Contains($c)) { return "book page is missing $c" }
  }
  if ((Invoke-Http '/b/no-such-book-zz9').Code -ne 404) { return 'unknown book is not 404' }
  $true
}

Test-Check 'BOOK-3' 'pages a reader may not see are refused (guests are sent to sign in)' {
  $pub = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT shortid FROM Notes WHERE deletedAt IS NULL AND permission IN ('freely','editable','locked') LIMIT 1") | ConvertFrom-Json))
  $priv = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT shortid FROM Notes WHERE deletedAt IS NULL AND permission = 'private' LIMIT 1") | ConvertFrom-Json))
  if ($pub.Count -eq 0 -or $priv.Count -eq 0) { return 'WARN: need a public and a private note to test with' }
  $r = Invoke-Http "/b/$($pub[0].shortid)/$($priv[0].shortid)"
  if ($r.Code -eq 200) { return 'a private page opened inside a public book' }
  $r = Invoke-Http "/b/$($priv[0].shortid)"
  if ($r.Code -eq 200) { return 'a private book opened for a guest' }
  $true
}

Test-Check 'BOOK-4' 'share dialog "book mode" points at the book, publish stays /publish' {
  $js = Read-Utf8 'public\js\lib\editor\share.js'
  if (-not ($js.Contains("book: '/book'") -and $js.Contains("return noteurl + '/publish'"))) { return 'share.js modes not updated' }
  $true
}

Test-Check 'BOOK-5' 'template escapes titles; the link map cannot close its script tag' {
  $t = Read-Utf8 'public\views\book.ejs'
  # titles / names go through <%= (escaped); the JSON map escapes "<"
  if ($t -match '<%-\s*(n\.title|bookTitle|pageTitle|editorName|p\.name)') { return 'a title is printed unescaped' }
  if (-not $t.Contains(".replace(/</g, '\\u003c')")) { return 'link map does not escape <' }
  $true
}

Test-Check 'BOOK-6' 'eslint passes' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\book.js', 'lib\web\bookRouter.js', 'public\js\catppuccin.js', 'public\js\lib\editor\share.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'BOOK-7' 'editing inside the book: /b/<book>/<page>?edit keeps the TOC, only the editor frame changes' {
  $r = Read-Utf8 'lib\web\bookRouter.js'
  $t = Read-Utf8 'public\views\book.ejs'
  $j = Read-Utf8 'public\js\catppuccin.js'
  if (-not $r.Contains("bookRouter.get('/api/lilith/books/:bookId/toc'")) { return 'TOC API missing' }
  if (-not ($r.Contains("res.render('book-edit.ejs'") -and $r.Contains("const editing = req.query.edit !== undefined"))) { return 'book editing page missing' }
  if (-not ($t.Contains('href="<%= editLink %>"') -and $t.Contains('href="<%= indexEditLink %>"'))) { return 'book page edit buttons do not open the book editing page' }
  if (-not ($j.Contains('function bookShell') -and $j.Contains('history.pushState(state') -and $j.Contains('frame.contentWindow.location.replace(url)'))) { return 'moving between pages reloads the whole page' }
  if (-not $j.Contains("if (document.getElementById('textit')) bookEditor()")) { return 'editor does not know about the book page' }
  if ((Invoke-Http '/api/lilith/books/no-such-book-zz9/toc').Code -ne 404) { return 'unknown book TOC is not 404' }
  if ((Invoke-Http '/b/no-such-book-zz9?edit').Code -ne 404) { return 'unknown book editing page is not 404' }
  $true
}

Complete-Checks '21-book-mode'
