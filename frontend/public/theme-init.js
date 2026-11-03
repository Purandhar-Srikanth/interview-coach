// Apply the saved theme before React loads, so the page never flashes the wrong colours.
// (A separate file rather than an inline <script>, so the Content-Security-Policy can forbid
// inline scripts, which blocks most cross-site-scripting attacks.)
try {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark')
} catch {
  // storage blocked: default light theme
}
