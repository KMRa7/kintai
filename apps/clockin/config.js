const config = {
  appName: "勤怠管理システム",
  brandName: "UDON RESTAURANT",
  emoji: "🍜",                 // legacy fallback only — UI now uses the 勤 seal / line icons
  themeColor: "#2a2017",
  adminPassword: "udon2024",
  storeLat: 34.9980,
  storeLng: 135.7780,
  storeRadiusM: 150,
  storeAddress: "京都府京都市東山区日吉町228-1, 228-1 セブンハイツ",
  // —— 和モダン (warm washi, light) ——
  theme: {
    bg: "#f4ecde",          // washi 紙
    paper: "#fffdf8",       // card surface
    surface2: "#efe6d4",    // sunken panel / header band / avatar
    ink: "#2a2017",         // sumi 墨
    muted: "#968471",       // secondary text / labels
    accent: "#c0402e",      // 朱 vermilion — primary accent / clock-out
    gold: "#ab8338",        // 金 brass — highlight / today / brand
    gold2: "#cdab6c",
    green: "#587a4f",       // 抹茶 matcha — working / positive
    greenBg: "#e8efdf",
    greenBorder: "#cfe0c2",
    border: "#e7dcc7",      // hairline
    border2: "#f0e8d8",     // inner divider
    shadow: "0 2px 14px rgba(54,38,20,0.08)",
    blue: "#3a5780",        // 藍 indigo — clock-in / info
    blueBg: "#e7ecf2",
  },
};

export default config;
