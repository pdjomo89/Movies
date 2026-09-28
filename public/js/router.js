let renderFn = () => {};

export const setRenderer = (fn) => { renderFn = fn; };

export function navigate(path, { replace = false } = {}) {
  if (path === location.pathname + location.search && !replace) return renderFn();
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  renderFn();
}

export const refresh = () => renderFn({ keepScroll: true });
