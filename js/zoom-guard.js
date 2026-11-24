/* Global page zoom guard, loaded before login and application startup.
 * Never stop propagation: existing double-click actions remain available.
 */
(() => {
  'use strict';
  const preventZoom = event => {
    if (event.cancelable) event.preventDefault();
  };
  document.addEventListener('dblclick', preventZoom, {capture: true, passive: false});
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, preventZoom, {passive: false});
  }
  document.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) preventZoom(event);
  }, {passive: false});
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) &&
        ['+', '-', '=', '0', 'Add', 'Subtract'].includes(event.key)) {
      preventZoom(event);
    }
  }, {capture: true});
})();
