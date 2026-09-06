// Replaced at build time with the exact CSS Modules output.
declare const __DSH_SESSION_TREE_CSS__: string

/** Own one stylesheet for this plugin lifecycle, including hot removal. */
export function mountStyle(): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-session-tree'
  style.dataset.pluginCss = 'dsh-session-tree/BranchesView.module.css'
  style.textContent = __DSH_SESSION_TREE_CSS__
  document.head.appendChild(style)
  return () => style.remove()
}
