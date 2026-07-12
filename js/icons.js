export const ICONS = {
  grid: `<svg viewBox="0 0 32 32"><rect x="5" y="5" width="9" height="9" rx="2"/><rect x="18" y="5" width="9" height="9" rx="2"/><rect x="5" y="18" width="9" height="9" rx="2"/><rect x="18" y="18" width="9" height="9" rx="2"/></svg>`,
  imac: `<svg viewBox="0 0 32 32"><rect x="4" y="5" width="24" height="17" rx="2.5"/><path d="M13 23h6l1 3H12z"/><path d="M10 27h12"/></svg>`,
  rec: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" class="rec-fill"/></svg>`,
  key: `<svg viewBox="0 0 32 32"><circle cx="11" cy="12" r="5"/><path d="M15 16l10 10m-5-5 3-3m-7 0 3-3"/></svg>`,
  summary: `<svg viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="24" rx="3"/><path d="M10 10h12M10 16h12M10 22h8"/></svg>`,
  gear: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="4"/><path d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2 2M22.5 22.5l2 2M24.5 7.5l-2 2M9.5 22.5l-2 2"/></svg>`,
  bell: `<svg viewBox="0 0 32 32"><path d="M9 23h14l-2-3v-6a5 5 0 0 0-10 0v6z"/><path d="M14 26h4"/></svg>`
};

export function injectIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach(node => {
    const name = node.dataset.icon;
    node.innerHTML = ICONS[name] || "";
  });
}