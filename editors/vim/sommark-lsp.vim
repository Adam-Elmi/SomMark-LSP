" Minimal Configuration snippet to add SomMark support to Vim
" Requires: neoclide/coc.nvim

" Filetype detection for SomMark
autocmd BufRead,BufNewFile *.smark set filetype=sommark

function! SomMarkCloseCurly()
  let col = col('.')
  let line = getline('.')
  let char_before = col > 1 ? line[col - 2] : ''
  if char_before == '$'
    return "{}$\<Left>\<Left>"
  else
    return "{}\<Left>"
  endif
endfunction

" Native Auto-Closing Pairs for SomMark (No plugins required)
augroup SomMarkAutoClose
  autocmd!
  autocmd FileType sommark inoremap <buffer> <expr> { SomMarkCloseCurly()
  autocmd FileType sommark inoremap <buffer> [ []<Left>
  autocmd FileType sommark inoremap <buffer> ( ()<Left>
  autocmd FileType sommark inoremap <buffer> " ""<Left>
  autocmd FileType sommark inoremap <buffer> ' ''<Left>
  autocmd FileType sommark inoremap <buffer> ` ``<Left>

  " Custom Multi-Character Pairs
  autocmd FileType sommark inoremap <buffer> ### ###  ###<Left><Left><Left><Left>
augroup END

