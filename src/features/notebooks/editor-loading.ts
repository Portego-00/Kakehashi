/** Apply the app's theme before the editor bundle or its styles can paint. */
export function getNotebookStartupScript(theme: "light" | "dark", backgroundColor: string) {
  return `(function () {
    function applyTheme() {
      var root = document.documentElement;
      if (!root) return false;
      root.dataset.notebookTheme = ${JSON.stringify(theme)};
      root.style.colorScheme = ${JSON.stringify(theme)};
      root.style.backgroundColor = ${JSON.stringify(`var(--nb-bg, ${backgroundColor})`)};
      return true;
    }
    if (!applyTheme()) {
      var observer = new MutationObserver(function () {
        if (applyTheme()) observer.disconnect();
      });
      observer.observe(document, { childList: true });
    }
  })(); true;`;
}
