// src/i18n.js
// JP / EN strings + a tiny context. Language is persisted to localStorage.
//
//   import { I18nProvider, useI18n } from "./i18n";
//   wrap the app once:  <I18nProvider> ... </I18nProvider>
//   in any component:   const { t, lang, setLang } = useI18n();
//   t("save")            -> "保存する" / "Save"
//   t("loginFail", 3)    -> functions receive args for interpolation
//   t.days / t.daysSun   -> weekday arrays (use t.arr("days"))

import { createContext, useContext, useState, useEffect, useMemo, createElement } from "react";

const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const STRINGS = {
  ja: {
    // —— chrome / auth ——
    appName: "勤怠管理システム",
    adminMode: "管理者モード",
    logout: "ログアウト",
    loading: "読み込み中…",
    login: "ログイン",
    username: "ユーザー名",
    password: "パスワード",
    usernamePh: "例: tanaka / admin",
    passwordPh: "パスワード",
    loginFail: (n) => `ユーザー名またはパスワードが違います（${n}回失敗）`,
    loginLocked: "試行回数が上限に達しました。ページを再読み込みしてください。",
    // —— tabs ——
    tab_punch: "打刻",
    tab_record: "勤務実績",
    tab_shift: "シフト入力",
    tab_compare: "照合",
    tab_edit: "勤怠修正",
    tab_wage: "時給設定",
    tab_breaks: "休憩テンプレ",
    tab_accounts: "アカウント",
    // —— verdicts ——
    v_holiday: "休日", v_out: "シフト外", v_absent: "欠勤", v_working: "勤務中",
    v_late: "遅刻", v_early: "早退", v_lateEarly: "遅刻・早退", v_normal: "正常",
    // —— table / stats ——
    h_date: "日付", h_day: "曜", h_shift: "シフト", h_in: "出勤", h_out: "退勤", h_worked: "実働", h_verdict: "判定",
    s_days: "出勤日数", s_hours: "総勤務時間", s_pay: "合計給与", s_monthTotal: "月合計",
    dUnit: "日",
    // —— my record ——
    rec_title: "勤務実績",
    rec_sub: (b) => `自分のシフトと打刻の記録（休憩計${b}分）`,
    // —— shift ——
    shift_title: "シフト入力",
    shift_sub: "週ごとにスタッフのシフトを入力してください",
    col_staff: "スタッフ",
    inTime: "出勤時刻", outTime: "退勤時刻",
    save: "保存する", saving: "保存中…", del: "削除する", deleting: "削除中…",
    cancel: "キャンセル",
    dowSuffix: "曜日",
    // —— punch ——
    punch_title: "出退勤 打刻",
    punch_subOne: "打刻ボタンを押してください",
    punch_subMany: "スタッフを選んで打刻してください",
    st_absent: "未出勤", st_working: "勤務中", st_done: "退勤済",
    lbl_in: "出勤", lbl_out: "退勤", lbl_timeSuffix: "時刻",
    gps_checking: "位置情報を確認中…",
    gps_noSupport: "GPSに対応していません",
    gps_ok: (m) => `店舗から約${m}m — 打刻OK`,
    gps_far: (m, r) => `店舗から約${m}m離れています（許容: ${r}m以内）`,
    gps_denied: "位置情報が拒否されました。",
    btn_in: "出勤打刻", btn_out: "退勤打刻",
    gps_note: (addr, r) => `${addr}から${r}m以内の位置情報が必要です`,
    admin_note: "管理者モード：位置情報チェックなし",
    todayStatus: "本日の出勤状況",
    shiftLabel: "シフト",
    // —— compare ——
    cmp_title: "シフト照合",
    cmp_sub: "シフト予定と実際の出退勤を比較します",
    breakLabel: "休憩",
    breakTotal: (m) => `計${m}分`,
    // —— edit ——
    edit_title: "勤怠修正",
    edit_sub: "スタッフの出退勤時刻を手動で変更・追加・削除できます",
    btn_edit: "編集", btn_add: "追加",
    clearNote: "※ 空欄にすると該当の打刻を削除します",
    delDay: "この日の記録を全削除",
    toast_fixed: "勤怠を修正しました",
    toast_delPunch: "打刻記録を削除しました",
    // —— wage ——
    wage_title: "時給・給与設定",
    wage_sub: "スタッフごとの時給と今月の給与を確認できます",
    w_hourly: "時給", w_worked: "今月実働", w_pay: "今月給与", w_change: "変更", w_update: "更新",
    wageErr: "有効な時給を入力してください（900〜5000円）",
    breaksUnit: (m) => `休憩計${m}分`,
    wageFoot: "※ シフト時間で計算（早出・残業は一切カウントしません）。休憩は各スタッフの休憩設定に応じて差し引きます。",
    // —— breaks ——
    brk_title: "休憩テンプレート",
    brk_sub: "休憩パターンのひな形を作成・編集します（スタッフに取り込んで使います）",
    brk_new: "新規テンプレートを作成する",
    brk_none: "テンプレートがありません",
    brk_count: (m, n) => `休憩計 ${m}分・${n}本`,
    brk_editTitle: "テンプレートを編集",
    brk_newTitle: "新規テンプレート",
    brk_name: "テンプレ名",
    brk_namePh: "例: デフォルト / CS",
    noBreak: "休憩なし",
    brk_delTitle: "テンプレート削除",
    brk_delMsg: (n) => `${n} を削除しますか？`,
    brk_delNote: "※ 既にスタッフに取り込んだ休憩には影響しません。",
    delete: "削除する",
    // —— break editor ——
    be_fromTpl: "テンプレから取り込む",
    be_pick: "選択して取り込み…",
    be_opt: (name, m) => `${name}（計${m}分）`,
    be_slots: "休憩時間帯",
    be_total: (m) => `合計 ${m}分`,
    minUnit: (m) => `${m}分`,
    be_add: "休憩を追加",
    // —— accounts ——
    acc_title: "アカウント管理",
    acc_sub: "スタッフアカウントの発行・編集・削除",
    acc_new: "新規アカウントを発行する",
    acc_newTitle: "新規アカウント発行",
    f_name: "氏名",
    f_namePh: "氏名（例: 山本 花子）",
    f_unamePh: "ユーザー名（半角英数字）",
    f_pwPh: "パスワード（4文字以上）",
    f_wageYen: "時給（円）",
    breakSetting: "休憩設定",
    acc_issue: "発行する", acc_issuing: "発行中…",
    acc_editName: (n) => `${n} を編集`,
    col_uname: "ユーザー名", col_actions: "操作",
    acc_delTitle: "アカウント削除",
    acc_delMsg: (n) => `${n} のアカウントを削除しますか？`,
    acc_delNote: "この操作は取り消せません。",
    err_name: "名前を入力してください",
    err_uname: "ユーザー名を入力してください",
    err_unameFmt: "半角英数字・アンダースコアのみ使用可",
    err_unameDup: "このユーザー名は既に使用されています",
    err_pw: "パスワードを入力してください",
    err_pwLen: "4文字以上で入力してください",
    err_wage: "時給は900〜5000円で入力してください",
    // —— nav ——
    prevWeek: "前週", nextWeek: "次週", thisWeek: "今週",
    prevMonth: "前月", nextMonth: "次月", thisMonth: "今月",
    ym: (y, m) => `${y}年${m + 1}月`,
    md: (m, d) => `${m + 1}/${d}`,
    // —— toasts ——
    t_shiftSaved: "シフトを保存しました",
    t_shiftDeleted: "シフトを削除しました",
    t_punchedIn: "出勤打刻しました！",
    t_punchedOut: "退勤打刻しました！",
    t_accIssued: (n) => `${n} のアカウントを発行しました`,
    t_accDeleted: "アカウントを削除しました",
    t_accUpdated: "アカウントを更新しました",
    t_tplCreated: (n) => `テンプレ「${n}」を作成しました`,
    t_tplUpdated: "テンプレを更新しました",
    t_tplDeleted: "テンプレを削除しました",
    // —— weekday arrays ——
    days: ["月", "火", "水", "木", "金", "土", "日"],     // Mon-first
    daysSun: ["日", "月", "火", "水", "木", "金", "土"],   // Sun-first
  },

  en: {
    appName: "Time & Attendance",
    adminMode: "Admin mode",
    logout: "Log out",
    loading: "Loading…",
    login: "Log in",
    username: "Username",
    password: "Password",
    usernamePh: "e.g. tanaka / admin",
    passwordPh: "Password",
    loginFail: (n) => `Incorrect username or password (${n} failed)`,
    loginLocked: "Too many attempts. Please reload the page.",
    tab_punch: "Punch",
    tab_record: "My record",
    tab_shift: "Shifts",
    tab_compare: "Compare",
    tab_edit: "Corrections",
    tab_wage: "Pay",
    tab_breaks: "Breaks",
    tab_accounts: "Accounts",
    v_holiday: "Off", v_out: "Off-shift", v_absent: "Absent", v_working: "Working",
    v_late: "Late", v_early: "Left early", v_lateEarly: "Late & early", v_normal: "On time",
    h_date: "Date", h_day: "Day", h_shift: "Shift", h_in: "In", h_out: "Out", h_worked: "Worked", h_verdict: "Status",
    s_days: "Days worked", s_hours: "Total hours", s_pay: "Total pay", s_monthTotal: "Month total",
    dUnit: "d",
    rec_title: "My record",
    rec_sub: (b) => `Your shifts and punches (breaks ${b} min)`,
    shift_title: "Shift entry",
    shift_sub: "Enter staff shifts week by week",
    col_staff: "Staff",
    inTime: "Clock-in", outTime: "Clock-out",
    save: "Save", saving: "Saving…", del: "Delete", deleting: "Deleting…",
    cancel: "Cancel",
    dowSuffix: "",
    punch_title: "Clock in / out",
    punch_subOne: "Tap a button to punch",
    punch_subMany: "Select a staff member to punch",
    st_absent: "Not in", st_working: "Working", st_done: "Done",
    lbl_in: "Clock-in", lbl_out: "Clock-out", lbl_timeSuffix: "",
    gps_checking: "Checking location…",
    gps_noSupport: "Location not supported",
    gps_ok: (m) => `≈${m} m from store — OK to punch`,
    gps_far: (m, r) => `≈${m} m from store (limit ${r} m)`,
    gps_denied: "Location access denied.",
    btn_in: "Clock in", btn_out: "Clock out",
    gps_note: (addr, r) => `Must be within ${r} m of ${addr}`,
    admin_note: "Admin mode: no location check",
    todayStatus: "Today’s attendance",
    shiftLabel: "Shift",
    cmp_title: "Shift comparison",
    cmp_sub: "Compare planned shifts with actual punches",
    breakLabel: "Breaks",
    breakTotal: (m) => `${m} min total`,
    edit_title: "Corrections",
    edit_sub: "Manually add, edit or delete staff punch times",
    btn_edit: "Edit", btn_add: "Add",
    clearNote: "※ Leave blank to clear that punch",
    delDay: "Delete all records for this day",
    toast_fixed: "Attendance updated",
    toast_delPunch: "Punch records deleted",
    wage_title: "Pay & wages",
    wage_sub: "Hourly rate and this month’s pay per staff",
    w_hourly: "Rate", w_worked: "Worked", w_pay: "Pay", w_change: "Update", w_update: "Update",
    wageErr: "Enter a valid wage (¥900–5000)",
    breaksUnit: (m) => `Breaks ${m} min`,
    wageFoot: "※ Calculated on scheduled hours (no early start / overtime). Breaks are deducted per each staff member’s setting.",
    brk_title: "Break templates",
    brk_sub: "Create and edit reusable break patterns (applied to staff)",
    brk_new: "New template",
    brk_none: "No templates yet",
    brk_count: (m, n) => `${m} min · ${n} blocks`,
    brk_editTitle: "Edit template",
    brk_newTitle: "New template",
    brk_name: "Template name",
    brk_namePh: "e.g. Default / CS",
    noBreak: "No break",
    brk_delTitle: "Delete template",
    brk_delMsg: (n) => `Delete “${n}”?`,
    brk_delNote: "※ Breaks already applied to staff are not affected.",
    delete: "Delete",
    be_fromTpl: "Import from template",
    be_pick: "Choose to import…",
    be_opt: (name, m) => `${name} (${m} min)`,
    be_slots: "Break periods",
    be_total: (m) => `${m} min total`,
    minUnit: (m) => `${m} min`,
    be_add: "Add break",
    acc_title: "Accounts",
    acc_sub: "Issue, edit and delete staff accounts",
    acc_new: "Issue new account",
    acc_newTitle: "New account",
    f_name: "Name",
    f_namePh: "Name (e.g. Hanako Yamamoto)",
    f_unamePh: "Username (alphanumeric)",
    f_pwPh: "Password (4+ characters)",
    f_wageYen: "Hourly (¥)",
    breakSetting: "Break settings",
    acc_issue: "Issue", acc_issuing: "Issuing…",
    acc_editName: (n) => `Edit ${n}`,
    col_uname: "Username", col_actions: "Actions",
    acc_delTitle: "Delete account",
    acc_delMsg: (n) => `Delete the account for ${n}?`,
    acc_delNote: "This cannot be undone.",
    err_name: "Please enter a name",
    err_uname: "Please enter a username",
    err_unameFmt: "Alphanumeric and underscore only",
    err_unameDup: "This username is already taken",
    err_pw: "Please enter a password",
    err_pwLen: "Use at least 4 characters",
    err_wage: "Wage must be between ¥900 and ¥5000",
    prevWeek: "Prev", nextWeek: "Next", thisWeek: "This week",
    prevMonth: "Prev", nextMonth: "Next", thisMonth: "This month",
    ym: (y, m) => `${MONTHS_EN[m]} ${y}`,
    md: (m, d) => `${m + 1}/${d}`,
    t_shiftSaved: "Shift saved",
    t_shiftDeleted: "Shift deleted",
    t_punchedIn: "Clocked in!",
    t_punchedOut: "Clocked out!",
    t_accIssued: (n) => `Issued an account for ${n}`,
    t_accDeleted: "Account deleted",
    t_accUpdated: "Account updated",
    t_tplCreated: (n) => `Created template “${n}”`,
    t_tplUpdated: "Template updated",
    t_tplDeleted: "Template deleted",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    daysSun: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("kintai_lang") || "ja"; } catch { return "ja"; }
  });
  useEffect(() => { try { localStorage.setItem("kintai_lang", lang); } catch {} }, [lang]);

  const value = useMemo(() => {
    const dict = STRINGS[lang] || STRINGS.ja;
    const t = (key, ...args) => {
      const v = dict[key];
      if (typeof v === "function") return v(...args);
      return v == null ? key : v;
    };
    t.arr = (key) => dict[key] || [];
    return { lang, setLang, t };
  }, [lang]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
