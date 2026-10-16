# Feature 22: note list like HackMD's -- tags with counts in the side bar, grouping
# (pinned / tag / year), sort menu, grid or list, "new folder"; larger text
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'LIST-1' 'list page has the toolbar (search, view, sort / group menu, new folder) and the tag side bar' {
  $page = (Invoke-Http '/').Body
  $need = 'class="form-inline ctp-list-toolbar"', 'class="btn-group ctp-view-toggle"', 'data-view="list"', 'data-sort-mode="recent"', 'data-sort-mode="title"', 'data-group-mode="tag"', 'data-group-mode="year"', 'data-group-mode="none"', 'class="ctp-tags-side"', 'class="form-control ctp-tag-filter"', 'ctp-folder-new', 'href="http://localhost:3000/activity"', 'href="http://localhost:3000/trash"'
  $miss = @($need | Where-Object { -not $page.Contains($_) })
  if ($miss.Count -eq 0) { $true } else { 'missing: ' + ($miss -join ', ') }
}

Test-Check 'LIST-2' 'grouping: noteList.js names each card''s group, catppuccin.js draws "label count" headings' {
  $nl = Read-Utf8 'public\js\lib\noteList.js'
  $cj = Read-Utf8 'public\js\catppuccin.js'
  $cv = Read-Utf8 'public\js\cover.js'
  if (-not ($nl.Contains('function sortList') -and $nl.Contains('function renderTags') -and $nl.Contains('el.dataset.group = group'))) { return 'noteList.js grouping missing' }
  if (-not ($cj.Contains('const label = item.dataset.group') -and $cj.Contains("count.className = 'ctp-year-count'"))) { return 'catppuccin.js headings do not use the groups' }
  if (-not ($cv.Contains('noteList.sortList()') -and $cv.Contains('noteList.renderTags()') -and $cv.Contains('noteList.beginUpdate()'))) { return 'cover.js does not call the module' }
  $true
}

Test-Check 'LIST-3' 'larger text on the list page (side bar 17.5px, card titles 21px, group headings 26.5px; +10% in prompt 110)' {
  $css = Read-Utf8 'public\css\catppuccin.css'
  foreach ($rule in 'html[data-ctp] .ctp-side-nav a:not([style*="none"]) { font-size: 17.5px; }', 'html[data-ctp] #history .list li .item h4.text { font-size: 21px; }', 'html[data-ctp] #history .list > li.ctp-year { font-size: 26.5px; }') {
    if (-not $css.Contains($rule)) { return "missing: $rule" }
  }
  $true
}

Test-Check 'LIST-4' 'eslint passes' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'public\js\lib\noteList.js', 'public\js\cover.js', 'public\js\catppuccin.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Complete-Checks '22-note-list'
