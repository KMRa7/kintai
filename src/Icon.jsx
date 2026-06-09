// src/Icon.jsx
// 和モダン line-icon set. Replaces emoji throughout the app.
// 1.6px stroke, currentColor, rounded caps/joins. No dependencies.
//
//   import { Icon } from "./Icon";
//   <Icon name="clock" size={18} />
//   <Icon name="trash" size={14} style={{ color: C.accent }} />

const PATHS = {
  clock:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chart:    '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4"/><path d="M12.5 16V8"/><path d="M17 16v-6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  search:   '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  pencil:   '<path d="M14.5 5.5l4 4M4 20l1-4L16 5a2 2 0 0 1 3 3L8 19l-4 1Z"/>',
  yen:      '<path d="M7 5l5 7 5-7M12 12v7M8.5 13.5h7M8.5 16.5h7"/>',
  coffee:   '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 10h2.2a2.3 2.3 0 0 1 0 4.6H17"/><path d="M7.5 3.5c-.6.8-.6 1.7 0 2.5M11 3.5c-.6.8-.6 1.7 0 2.5"/>',
  user:     '<circle cx="12" cy="8" r="3.8"/><path d="M5 20c.7-3.8 3.6-5.5 7-5.5s6.3 1.7 7 5.5"/>',
  users:    '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.3 3-4.8 6-4.8s5.4 1.5 6 4.8"/><path d="M16 5.6a3.3 3.3 0 0 1 0 6.3M17.5 14.9c2.3.5 3.8 1.9 4.3 4.4"/>',
  lock:     '<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15" r="1.2"/>',
  pin:      '<path d="M12 21c4.5-4.2 7-7.6 7-11a7 7 0 1 0-14 0c0 3.4 2.5 6.8 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  check:    '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x:        '<path d="M6 6l12 12M18 6L6 18"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  trash:    '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 13h9l1-13"/>',
  eye:      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:   '<path d="M4 4l16 16"/><path d="M9.5 9.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2"/><path d="M6.5 6.7C3.9 8.2 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.5 0 2.8-.3 4-.9M17 16.4c2.7-1.5 4.5-4.4 4.5-4.4S18 5.5 12 5.5c-.7 0-1.4.1-2 .2"/>',
  globe:    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5S14.4 18.2 12 20.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5Z"/>',
  power:    '<path d="M12 4v8"/><path d="M7.5 6.8a7 7 0 1 0 9 0"/>',
  save:     '<path d="M5 4h11l3 3v13H5V4Z"/><path d="M8 4v5h7V4.5M8 20v-6h8v6"/>',
  signal:   '<path d="M5 18a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M11 12a2 2 0 0 1 2 0"/><circle cx="12" cy="18.5" r="1"/>',
  list:     '<path d="M8 6.5h12M8 12h12M8 17.5h12"/><circle cx="4" cy="6.5" r="1.1"/><circle cx="4" cy="12" r="1.1"/><circle cx="4" cy="17.5" r="1.1"/>',
  arrowR:   '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevL:    '<path d="M14.5 5L8 12l6.5 7"/>',
  chevR:    '<path d="M9.5 5L16 12l-6.5 7"/>',
  warn:     '<path d="M12 3.5L21 19H3L12 3.5Z"/><path d="M12 10v4"/><circle cx="12" cy="16.6" r="1"/>',
  download: '<path d="M12 4v10M8 10.5l4 4 4-4"/><path d="M5 19.5h14"/>',
  refresh:  '<path d="M20 11a8 8 0 1 0-.7 4.5"/><path d="M20 5v5h-5"/>',
  settings: '<path d="M3.5 7.5h7M14.5 7.5h6M3.5 16.5h3M10.5 16.5h10"/><circle cx="12.5" cy="7.5" r="2.4"/><circle cx="8" cy="16.5" r="2.4"/>',
  train:    '<rect x="5.5" y="3.5" width="13" height="13" rx="3.5"/><path d="M5.5 11h13"/><circle cx="9" cy="13.7" r="0.9"/><circle cx="15" cy="13.7" r="0.9"/><path d="M9 16.5L7 20.5M15 16.5l2 4"/>',
};

export function Icon({ name, size = 18, stroke = 1.6, style, className }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}

export default Icon;
