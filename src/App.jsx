import { useState, useEffect, useCallback, useRef } from "react";
import CONFIG from "@config";
import { createClient } from "@supabase/supabase-js";
import { Icon } from "./Icon";
import { I18nProvider, useI18n } from "./i18n";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ADMIN = { username: "admin", password: CONFIG.adminPassword };
const TIME_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
  "20:00","20:30","21:00","21:30","22:00",
];
const STORE_LAT = CONFIG.storeLat, STORE_LNG = CONFIG.storeLng, STORE_RADIUS_M = CONFIG.storeRadiusM;

// —— type system (和モダン) ——
const SERIF = "'Shippori Mincho','Hiragino Mincho ProN',serif";
const SANS  = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap";

const C = {
  bg: CONFIG.theme.bg,
  paper: CONFIG.theme.paper,
  surface2: CONFIG.theme.surface2,
  ink: CONFIG.theme.ink,
  muted: CONFIG.theme.muted,
  accent: CONFIG.theme.accent,
  gold: CONFIG.theme.gold,
  gold2: CONFIG.theme.gold2,
  green: CONFIG.theme.green,
  greenBg: CONFIG.theme.greenBg,
  greenBorder: CONFIG.theme.greenBorder,
  border: CONFIG.theme.border,
  border2: CONFIG.theme.border2,
  shadow: CONFIG.theme.shadow,
  blue: CONFIG.theme.blue,
  blueBg: CONFIG.theme.blueBg,
};
const ON_DARK = "#fffaf3";          // text on C.ink buttons (light theme)
const ON_GOLD = "#0a0a0a";          // text on gold/gold2 buttons
const isDarkThemeEarly = (CONFIG.theme.bg || "").toLowerCase().match(/^#0|^#1/) ? true : false;
const INK_TEXT = isDarkThemeEarly ? CONFIG.theme.bg : ON_DARK; // readable text on an "ink" surface in either theme
const ROW_A = C.paper;
const ROW_B = C.bg;
const HEAD_BG = C.surface2;
const HEAD_FG = C.muted;
const SUBTLE = C.surface2;
const FAINT = C.muted;
const isDarkTheme = (CONFIG.theme.bg || "").toLowerCase().match(/^#0|^#1/) ? true : false;
const DANGER_BG = isDarkTheme ? "#2a0d0d" : "#f8e7e1";

// verdict palette (theme-aware)
const VD = {
  holiday:  { bg: C.surface2, color: C.muted },
  out:      { bg: C.blueBg,   color: C.blue },
  absent:   { bg: DANGER_BG,  color: C.accent },
  working:  { bg: C.greenBg,  color: C.green },
  late:     { bg: isDarkTheme ? "#241d0a" : "#f4ecd6", color: C.gold },
  early:    { bg: isDarkTheme ? "#1c1630" : "#ece6f5", color: isDarkTheme ? "#b79cf0" : "#6e5aa0" },
  lateEarly:{ bg: DANGER_BG,  color: C.accent },
  normal:   { bg: C.greenBg,  color: C.green },
};

function getWeekDates(offset=0){
  const today=new Date(), mon=new Date(today);
  mon.setDate(today.getDate()-((today.getDay()+6)%7)+offset*7);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
}
// generalized period: "week" (7d, Mon-anchored), "2week" (14d), "month" (calendar month)
function getPeriodDates(kind,offset=0){
  const today=new Date(); today.setHours(0,0,0,0);
  if(kind==="month"){
    const base=new Date(today.getFullYear(),today.getMonth()+offset,1);
    const n=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
    return Array.from({length:n},(_,i)=>new Date(base.getFullYear(),base.getMonth(),i+1));
  }
  const len=kind==="2week"?14:7;
  const mon=new Date(today); mon.setDate(today.getDate()-((today.getDay()+6)%7)+offset*len);
  return Array.from({length:len},(_,i)=>{const d=new Date(mon); d.setDate(mon.getDate()+i); return d;});
}
function toDateStr(d){ return d.toISOString().split("T")[0]; }
function fmtDate(d){ return `${d.getMonth()+1}/${d.getDate()}`; }
function fmtHM(ts){ if(!ts) return "──"; const d=new Date(ts); return d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}); }
function fmtHMS(d){ return d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
function toMin(hhmm){ const[h,m]=hhmm.split(":").map(Number); return h*60+m; }
function minToHM(m){ const h=Math.floor(m/60), mm=m%60; return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`; }
function nameToAvatar(name){ return name.trim().charAt(0); }

// —— CSV export (UTF-8 BOM so Sheets/Excel read Japanese correctly) ——
function csvCell(v){ const s=String(v==null?"":v); return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function downloadCSV(filename, rows){
  const csv = rows.map(r=>r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function csvBtnStyle(){
  return {padding:"7px 13px",borderRadius:8,border:`1px solid ${C.gold}`,background:"transparent",color:C.gold,fontFamily:SANS,fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap"};
}

function parseBreaks(raw){
  if(!raw) return [];
  try{
    const a=typeof raw==="string"?JSON.parse(raw):raw;
    if(Array.isArray(a)) return a.filter(x=>Array.isArray(x)&&x.length===2);
    if(a&&typeof a==="object"&&Array.isArray(a.default)) return a.default.filter(x=>Array.isArray(x)&&x.length===2);
    return [];
  }catch{ return []; }
}
// break config — legacy array applies to every day; object form {default:[[..]], byDay:{dow:[[..]]}}
function parseBreakConfig(raw){
  let v=raw;
  if(!v) return {default:[],byDay:{}};
  try{ if(typeof v==="string") v=JSON.parse(v); }catch{ return {default:[],byDay:{}}; }
  const clean=arr=>Array.isArray(arr)?arr.filter(x=>Array.isArray(x)&&x.length===2):[];
  if(Array.isArray(v)) return {default:clean(v),byDay:{}};
  if(v&&typeof v==="object"){
    const byDay={};
    if(v.byDay&&typeof v.byDay==="object") for(const k of Object.keys(v.byDay)) byDay[k]=clean(v.byDay[k]);
    return {default:clean(v.default),byDay};
  }
  return {default:[],byDay:{}};
}
function breaksForDate(raw,date){
  const cfg=parseBreakConfig(raw), dow=date.getDay();
  return (cfg.byDay&&cfg.byDay[dow]!==undefined)?cfg.byDay[dow]:cfg.default;
}
function hasPerDayBreaks(raw){ return Object.keys(parseBreakConfig(raw).byDay||{}).length>0; }
// transport (交通費): fixed monthly default + optional per-month override
function ymOf(year,month){ return `${year}-${String(month+1).padStart(2,"0")}`; }
function parseTransportOverrides(raw){
  if(!raw) return {};
  try{ const v=typeof raw==="string"?JSON.parse(raw):raw; return (v&&typeof v==="object"&&!Array.isArray(v))?v:{}; }catch{ return {}; }
}
function transportForMonth(s,ym){
  const ov=parseTransportOverrides(s?.transport_overrides);
  if(ov[ym]!=null&&ov[ym]!=="") return Number(ov[ym])||0;
  return Number(s?.transport_fixed)||0;
}
function hasTransportOverride(s,ym){
  const ov=parseTransportOverrides(s?.transport_overrides);
  return ov[ym]!=null&&ov[ym]!=="";
}
function breaksTotalMin(breaks){ return breaks.reduce((s,[a,b])=>s+Math.max(0,b-a),0); }
function breakMinutesInWindow(breaks,startMin,endMin){
  return breaks.reduce((sum,[bs,be])=>sum+Math.max(0,Math.min(endMin,be)-Math.max(startMin,bs)),0);
}
function calcBillableMinutes(shiftStart,shiftEnd,clockIn,clockOut,breaksRaw){
  if(!clockIn||!clockOut) return 0;
  const breaks=parseBreaks(breaksRaw);
  const sIn=toMin(shiftStart), sOut=toMin(shiftEnd);
  const aIn=new Date(clockIn), aOut=new Date(clockOut);
  const aInM=aIn.getHours()*60+aIn.getMinutes();
  const aOutM=aOut.getHours()*60+aOut.getMinutes();
  const wIn=Math.max(aInM,sIn), wOut=Math.min(aOutM,sOut);
  const worked=Math.max(0,wOut-wIn);
  const brk=breakMinutesInWindow(breaks,wIn,wOut);
  return Math.max(0,worked-brk);
}
function calcDistanceM(lat1,lng1,lat2,lng2){
  const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// —— brand seal (replaces CONFIG.emoji) ——
function Seal({size=34,radius=7}){
  return (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,fontSize:Math.round(size*0.5),background:C.accent,color:"#fff",borderRadius:radius,fontFamily:SERIF,fontWeight:600,lineHeight:1,boxShadow:"inset 0 0 0 1.5px rgba(255,255,255,0.22)",flexShrink:0}}>勤</span>
  );
}
function LangToggle(){
  const {lang,setLang}=useI18n();
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:5,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 5px 3px 8px"}}>
      <Icon name="globe" size={13} style={{color:C.muted}}/>
      {["ja","en"].map(l=>(
        <button key={l} onClick={()=>setLang(l)}
          style={{border:"none",background:lang===l?C.accent:"transparent",color:lang===l?"#fff":C.muted,borderRadius:13,padding:"3px 9px",cursor:"pointer",fontFamily:SANS,fontWeight:700,fontSize:11}}>
          {l==="ja"?"日":"EN"}
        </button>
      ))}
    </div>
  );
}

// viewport helper for responsive tweaks (no CSS file needed)
function useNarrow(bp=560){
  const [n,setN]=useState(typeof window!=="undefined" ? window.innerWidth<=bp : false);
  useEffect(()=>{
    const f=()=>setN(window.innerWidth<=bp);
    window.addEventListener("resize",f);
    return ()=>window.removeEventListener("resize",f);
  },[bp]);
  return n;
}

export default function App(){
  return (
    <I18nProvider>
      <AppInner/>
    </I18nProvider>
  );
}

function AppInner(){
  const {t}=useI18n();
  const narrow=useNarrow();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("punch");
  const [now, setNow] = useState(new Date());
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(()=>{ try{ return JSON.parse(localStorage.getItem("kintai_settings"))||{}; }catch{ return {}; } });
  useEffect(()=>{ try{ localStorage.setItem("kintai_settings",JSON.stringify(settings)); }catch{} },[settings]);

  useEffect(()=>{ const tm=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(tm); },[]);

  const loadAll = useCallback(async()=>{
    setLoading(true);
    const [s,sh,at,tp,rq] = await Promise.all([
      supabase.from("staff").select("*").order("id"),
      supabase.from("shifts").select("*"),
      supabase.from("attendance").select("*"),
      supabase.from("break_templates").select("*").order("id"),
      supabase.from("shift_requests").select("*"),
    ]);
    if(s.data) setStaff(s.data);
    if(sh.data) setShifts(sh.data);
    if(at.data) setAttendance(at.data);
    if(tp.data) setTemplates(tp.data);
    if(rq.data) setRequests(rq.data);
    setLoading(false);
  },[]);

  useEffect(()=>{ loadAll(); },[loadAll]);

  function showToast(msg,type="ok"){ setToast({msg,type}); setTimeout(()=>setToast(null),2500); }

  function handleLoginSuccess(user,admin){
    setCurrentUser(user); setIsAdmin(admin);
    setTab(admin?"shift":"punch");
  }
  function handleLogout(){ setCurrentUser(null); setIsAdmin(false); }

  function getShiftByDate(date,staffId){
    const ds=toDateStr(date);
    return shifts.find(s=>s.staff_id===staffId && s.date===ds)||null;
  }
  async function saveShift(staffId,date,startTime,endTime){
    const ds=toDateStr(date);
    const existing=shifts.find(s=>s.staff_id===staffId&&s.date===ds);
    if(existing){
      const {data}=await supabase.from("shifts").update({start_time:startTime,end_time:endTime}).eq("id",existing.id).select().single();
      if(data) setShifts(p=>p.map(s=>s.id===existing.id?data:s));
    } else {
      const {data}=await supabase.from("shifts").insert({staff_id:staffId,date:ds,start_time:startTime,end_time:endTime}).select().single();
      if(data) setShifts(p=>[...p,data]);
    }
    showToast(t("t_shiftSaved"));
  }
  async function deleteShift(staffId,date){
    const ds=toDateStr(date);
    const existing=shifts.find(s=>s.staff_id===staffId&&s.date===ds);
    if(!existing) return;
    await supabase.from("shifts").delete().eq("id",existing.id);
    setShifts(p=>p.filter(s=>s.id!==existing.id));
    showToast(t("t_shiftDeleted"));
  }

  // —— shift requests (staff side) ——
  function getRequest(staffId,date){ const ds=toDateStr(date); return requests.find(r=>r.staff_id===staffId&&r.date===ds)||null; }
  async function saveRequest(staffId,date,type,startTime,endTime){
    const ds=toDateStr(date);
    const existing=requests.find(r=>r.staff_id===staffId&&r.date===ds);
    const payload={status:type,start_time:type==="work"?startTime:null,end_time:type==="work"?endTime:null};
    if(existing){
      const {data}=await supabase.from("shift_requests").update(payload).eq("id",existing.id).select().single();
      if(data) setRequests(p=>p.map(r=>r.id===existing.id?data:r));
    } else {
      const {data}=await supabase.from("shift_requests").insert({staff_id:staffId,date:ds,...payload}).select().single();
      if(data) setRequests(p=>[...p,data]);
    }
  }
  async function deleteRequest(staffId,date){
    const ds=toDateStr(date);
    const existing=requests.find(r=>r.staff_id===staffId&&r.date===ds);
    if(!existing) return;
    await supabase.from("shift_requests").delete().eq("id",existing.id);
    setRequests(p=>p.filter(r=>r.id!==existing.id));
  }

  function getAtt(staffId,date){
    const ds=toDateStr(date);
    return attendance.find(a=>a.staff_id===staffId&&a.date===ds)||null;
  }
  async function punchIn(staffId){
    const today=new Date(), ds=toDateStr(today);
    const existing=getAtt(staffId,today);
    const ts=today.toISOString();
    if(existing){
      const {data}=await supabase.from("attendance").update({clock_in:ts}).eq("id",existing.id).select().single();
      if(data) setAttendance(p=>p.map(a=>a.id===existing.id?data:a));
    } else {
      const {data}=await supabase.from("attendance").insert({staff_id:staffId,date:ds,clock_in:ts}).select().single();
      if(data) setAttendance(p=>[...p,data]);
    }
    showToast(t("t_punchedIn"));
  }
  async function punchOut(staffId){
    const today=new Date(), ds=toDateStr(today);
    const existing=getAtt(staffId,today);
    const ts=today.toISOString();
    if(existing){
      const {data}=await supabase.from("attendance").update({clock_out:ts}).eq("id",existing.id).select().single();
      if(data) setAttendance(p=>p.map(a=>a.id===existing.id?data:a));
    } else {
      const {data}=await supabase.from("attendance").insert({staff_id:staffId,date:ds,clock_out:ts}).select().single();
      if(data) setAttendance(p=>[...p,data]);
    }
    showToast(t("t_punchedOut"));
  }

  async function editAttendance(staffId,dateStr,field,timeStr){
    const existing=attendance.find(a=>a.staff_id===staffId&&a.date===dateStr);
    const col=field==="in"?"clock_in":"clock_out";
    let ts=null;
    if(timeStr){
      const [h,m]=timeStr.split(":").map(Number);
      const d=new Date(dateStr); d.setHours(h,m,0,0);
      ts=d.toISOString();
    }
    if(existing){
      const {data}=await supabase.from("attendance").update({[col]:ts}).eq("id",existing.id).select().single();
      if(data) setAttendance(p=>p.map(a=>a.id===existing.id?data:a));
    } else if(ts){
      const {data}=await supabase.from("attendance").insert({staff_id:staffId,date:dateStr,[col]:ts}).select().single();
      if(data) setAttendance(p=>[...p,data]);
    }
  }
  async function clearAttendanceDay(staffId,dateStr){
    const existing=attendance.find(a=>a.staff_id===staffId&&a.date===dateStr);
    if(!existing) return;
    await supabase.from("attendance").delete().eq("id",existing.id);
    setAttendance(p=>p.filter(a=>a.id!==existing.id));
  }

  async function addStaff(name,username,password,wage,breaks,transportFixed){
    const {data}=await supabase.from("staff").insert({name,username,password,wage,breaks:JSON.stringify(breaks||[]),transport_fixed:transportFixed||0,transport_overrides:"{}"}).select().single();
    if(data){ setStaff(p=>[...p,data]); showToast(t("t_accIssued",name)); }
  }
  async function deleteStaff(id){
    await supabase.from("staff").delete().eq("id",id);
    setStaff(p=>p.filter(s=>s.id!==id));
    showToast(t("t_accDeleted"));
  }
  async function updateStaff(id,fields){
    const payload={...fields};
    if(payload.breaks!==undefined) payload.breaks=JSON.stringify(payload.breaks||[]);
    if(payload.transport_overrides!==undefined) payload.transport_overrides=JSON.stringify(payload.transport_overrides||{});
    const {data}=await supabase.from("staff").update(payload).eq("id",id).select().single();
    if(data){ setStaff(p=>p.map(s=>s.id===id?data:s)); showToast(t("t_accUpdated")); }
  }

  async function addTemplate(name,breaks){
    const {data}=await supabase.from("break_templates").insert({name,breaks:JSON.stringify(breaks||[])}).select().single();
    if(data){ setTemplates(p=>[...p,data]); showToast(t("t_tplCreated",name)); }
  }
  async function updateTemplate(id,name,breaks){
    const {data}=await supabase.from("break_templates").update({name,breaks:JSON.stringify(breaks||[])}).eq("id",id).select().single();
    if(data){ setTemplates(p=>p.map(x=>x.id===id?data:x)); showToast(t("t_tplUpdated")); }
  }
  async function deleteTemplate(id){
    await supabase.from("break_templates").delete().eq("id",id);
    setTemplates(p=>p.filter(x=>x.id!==id));
    showToast(t("t_tplDeleted"));
  }

  if(loading && staff.length===0){
    return (
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,fontFamily:SANS}}>
        <link href={FONT_LINK} rel="stylesheet"/>
        {CONFIG.logoBase64
          ? <img src={CONFIG.logoBase64} alt={CONFIG.brandName} style={{width:48,height:48,objectFit:"contain"}}/>
          : <Seal size={48} radius={10}/>
        }
        <div style={{fontSize:14,color:C.muted}}>{t("loading")}</div>
      </div>
    );
  }

  if(!currentUser && !isAdmin){
    return <LoginPage onSuccess={handleLoginSuccess} staff={staff}/>;
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:SANS,color:C.ink,WebkitFontSmoothing:"antialiased"}}>
      <link href={FONT_LINK} rel="stylesheet"/>
      <header style={{background:C.paper,color:C.ink,padding:narrow?"10px 12px":"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:C.shadow,gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:narrow?8:11,minWidth:0}}>
          {CONFIG.logoBase64
            ? <img src={CONFIG.logoBase64} alt={CONFIG.brandName} style={{width:narrow?30:36,height:narrow?30:36,objectFit:"contain",borderRadius:6,flexShrink:0}}/>
            : <Seal size={narrow?30:36}/>
          }
          <div style={{minWidth:0}}>
            <div style={{fontSize:narrow?12.5:14,fontWeight:600,letterSpacing:narrow?"0.04em":"0.1em",fontFamily:SERIF,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t("appName")}</div>
            <div style={{fontSize:narrow?9:10,color:C.gold,letterSpacing:"0.14em",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{isAdmin?t("adminMode"):CONFIG.brandName}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:narrow?7:11,flexShrink:0}}>
          <LangToggle/>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:narrow?14:17,fontWeight:600,fontVariantNumeric:"tabular-nums",color:C.gold,letterSpacing:"0.04em",fontFamily:SERIF}}>{fmtHMS(now)}</div>
            {!isAdmin&&!narrow&&<div style={{fontSize:10,color:C.muted}}>{currentUser?.name}</div>}
          </div>
          <button onClick={handleLogout} title={t("logout")} style={{padding:narrow?"7px 9px":"6px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:SANS,fontSize:11,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,flexShrink:0}}><Icon name="power" size={14}/>{!narrow&&t("logout")}</button>
        </div>
      </header>

      {isAdmin?(
        <AdminLayout tab={tab} setTab={setTab} staff={staff} shifts={shifts}
          getShiftByDate={getShiftByDate} saveShift={saveShift} deleteShift={deleteShift}
          attendance={attendance} getAtt={getAtt} punchIn={punchIn} punchOut={punchOut}
          editAttendance={editAttendance} clearAttendanceDay={clearAttendanceDay}
          addStaff={addStaff} deleteStaff={deleteStaff} updateStaff={updateStaff}
          templates={templates} addTemplate={addTemplate} updateTemplate={updateTemplate} deleteTemplate={deleteTemplate}
          settings={settings} setSettings={setSettings}
          requests={requests} getRequest={getRequest}
          showToast={showToast} now={now}/>
      ):(
        <UserLayout tab={tab} setTab={setTab} currentUser={currentUser} now={now}
          getAtt={getAtt} punchIn={punchIn} punchOut={punchOut}
          getShiftByDate={getShiftByDate} attendance={attendance}
          settings={settings} getRequest={getRequest} saveRequest={saveRequest} deleteRequest={deleteRequest} showToast={showToast}/>
      )}

      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="ok"?C.ink:C.accent,color:toast.type==="ok"?INK_TEXT:"#fff",padding:"11px 26px",borderRadius:32,fontSize:13,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,0.28)",zIndex:999,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:8}}>
          <Icon name={toast.type==="ok"?"check":"warn"} size={15}/>{toast.msg}
        </div>
      )}
    </div>
  );
}

function LoginPage({onSuccess,staff}){
  const {t}=useI18n();
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [attempts,setAttempts]=useState(0);
  const [showPw,setShowPw]=useState(false);
  const locked=attempts>=5;

  function handleLogin(){
    if(locked) return;
    if(username===ADMIN.username&&password===ADMIN.password){ onSuccess(null,true); return; }
    const found=staff.find(s=>s.username===username&&s.password===password);
    if(found){ onSuccess(found,false); return; }
    const next=attempts+1; setAttempts(next);
    setError(next>=5?t("loginLocked"):t("loginFail",next));
    setPassword("");
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.ink,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:SANS,position:"relative"}}>
      <link href={FONT_LINK} rel="stylesheet"/>
      <div style={{position:"absolute",top:18,right:18}}><LangToggle/></div>
      <div style={{marginBottom:28,textAlign:"center"}}>
        {CONFIG.logoWideBase64
          ? <img src={CONFIG.logoWideBase64} alt={CONFIG.brandName} style={{maxWidth:200,height:"auto",objectFit:"contain",marginBottom:12}}/>
          : CONFIG.logoBase64
            ? <img src={CONFIG.logoBase64} alt={CONFIG.brandName} style={{width:64,height:64,objectFit:"contain",marginBottom:8}}/>
            : <div style={{marginBottom:14}}><Seal size={62} radius={12}/></div>
        }
        <div style={{fontSize:20,fontWeight:600,color:C.ink,letterSpacing:"0.1em",fontFamily:SERIF}}>{t("appName")}</div>
        <div style={{fontSize:11,color:C.gold,letterSpacing:"0.16em",marginTop:4}}>{CONFIG.brandName}</div>
      </div>
      <div style={{background:C.paper,borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:360,boxShadow:C.shadow,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:15,fontWeight:600,marginBottom:20,fontFamily:SERIF,color:C.ink}}>{t("login")}</div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5,fontWeight:600}}>{t("username")}</label>
          <input type="text" value={username} onChange={e=>{setUsername(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&document.getElementById("pw-input").focus()}
            placeholder={t("usernamePh")} disabled={locked}
            style={{width:"100%",padding:"11px 12px",borderRadius:9,border:`1.5px solid ${error?C.accent:C.border}`,background:C.bg,fontFamily:SANS,fontSize:14,color:C.ink,outline:"none",boxSizing:"border-box",caretColor:C.gold,WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5,fontWeight:600}}>{t("password")}</label>
          <div style={{position:"relative"}}>
            <input id="pw-input" type={showPw?"text":"password"} value={password}
              onChange={e=>{setPassword(e.target.value);setError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              placeholder={t("passwordPh")} disabled={locked}
              style={{width:"100%",padding:"11px 40px 11px 12px",borderRadius:9,border:`1.5px solid ${error?C.accent:C.border}`,background:C.bg,fontFamily:SANS,fontSize:14,color:C.ink,outline:"none",boxSizing:"border-box",caretColor:C.gold,WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
            <button onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.muted,display:"inline-flex"}}><Icon name={showPw?"eyeOff":"eye"} size={18}/></button>
          </div>
        </div>
        {error&&<div style={{fontSize:12,color:C.accent,fontWeight:600,marginBottom:14,padding:"8px 12px",background:DANGER_BG,borderRadius:8,display:"flex",alignItems:"center",gap:7}}><Icon name={locked?"lock":"x"} size={14}/>{error}</div>}
        <button onClick={handleLogin} disabled={!username||!password||locked}
          style={{width:"100%",padding:13,borderRadius:10,border:(!username||!password||locked)?`1px solid ${C.border}`:"none",background:!username||!password||locked?C.surface2:C.gold,color:!username||!password||locked?C.muted:ON_GOLD,fontFamily:SANS,fontSize:14,fontWeight:700,cursor:!username||!password||locked?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Icon name="arrowR" size={16}/>{t("login")}
        </button>
      </div>
    </div>
  );
}

function UserLayout({tab,setTab,currentUser,now,getAtt,punchIn,punchOut,getShiftByDate,attendance,settings,getRequest,saveRequest,deleteRequest,showToast}){
  const {t}=useI18n();
  const tabStyle=(active)=>({flex:1,padding:"11px 4px 9px",border:"none",cursor:"pointer",background:active?C.paper:"transparent",borderBottom:active?`2.5px solid ${C.accent}`:"2.5px solid transparent",color:active?C.accent:C.muted,fontFamily:SANS,fontSize:11,fontWeight:active?700:500,display:"flex",flexDirection:"column",alignItems:"center",gap:4});
  return (
    <>
      <nav style={{display:"flex",background:C.surface2,borderBottom:`1px solid ${C.border}`}}>
        <button onClick={()=>setTab("punch")} style={tabStyle(tab==="punch")}><Icon name="clock" size={18}/>{t("tab_punch")}</button>
        <button onClick={()=>setTab("request")} style={tabStyle(tab==="request")}><Icon name="calendar" size={18}/>{t("tab_request")}</button>
        <button onClick={()=>setTab("record")} style={tabStyle(tab==="record")}><Icon name="chart" size={18}/>{t("tab_record")}</button>
      </nav>
      <main style={{maxWidth:820,margin:"0 auto",padding:"18px 14px 60px"}}>
        {tab==="punch" && <PunchView staff={[currentUser]} now={now} getAtt={getAtt} punchIn={punchIn} punchOut={punchOut} getShiftByDate={getShiftByDate} singleUser={true}/>}
        {tab==="request" && <StaffRequestView currentUser={currentUser} period={settings.requestPeriod||"week"} getRequest={getRequest} saveRequest={saveRequest} deleteRequest={deleteRequest} getShiftByDate={getShiftByDate} showToast={showToast}/>}
        {tab==="record" && <MyRecordView currentUser={currentUser} getAtt={getAtt} getShiftByDate={getShiftByDate} attendance={attendance}/>}
      </main>
    </>
  );
}

function AdminLayout({tab,setTab,staff,getShiftByDate,saveShift,deleteShift,attendance,getAtt,punchIn,punchOut,editAttendance,clearAttendanceDay,addStaff,deleteStaff,updateStaff,templates,addTemplate,updateTemplate,deleteTemplate,settings,setSettings,requests,getRequest,showToast,now}){
  const {t}=useI18n();
  const TABS=[
    {id:"shift",icon:"calendar",label:t("tab_shift")},
    {id:"punch",icon:"clock",label:t("tab_punch")},
    {id:"compare",icon:"search",label:t("tab_compare")},
    {id:"edit",icon:"pencil",label:t("tab_edit")},
    {id:"wage",icon:"yen",label:t("tab_wage")},
    {id:"breaks",icon:"coffee",label:t("tab_breaks")},
    {id:"accounts",icon:"users",label:t("tab_accounts")},
    {id:"settings",icon:"settings",label:t("tab_settings")},
  ];
  const tabStyle=(active)=>({flex:1,padding:"10px 2px 8px",border:"none",cursor:"pointer",background:active?C.paper:"transparent",borderBottom:active?`2.5px solid ${C.accent}`:"2.5px solid transparent",color:active?C.accent:C.muted,fontFamily:SANS,fontSize:10,fontWeight:active?700:500,whiteSpace:"nowrap",display:"flex",flexDirection:"column",alignItems:"center",gap:3});
  return (
    <>
      <nav style={{display:"flex",background:C.surface2,borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
        {TABS.map(tt=><button key={tt.id} onClick={()=>setTab(tt.id)} style={tabStyle(tab===tt.id)}><Icon name={tt.icon} size={16}/>{tt.label}</button>)}
      </nav>
      <main style={{maxWidth:900,margin:"0 auto",padding:"18px 14px 60px"}}>
        {tab==="shift"    && <ShiftInputView staff={staff} getShiftByDate={getShiftByDate} saveShift={saveShift} deleteShift={deleteShift} period={settings.shiftPeriod||"week"} getRequest={getRequest} showToast={showToast}/>}
        {tab==="punch"    && <PunchView staff={staff} now={now} getAtt={getAtt} punchIn={punchIn} punchOut={punchOut} getShiftByDate={getShiftByDate} singleUser={false}/>}
        {tab==="compare"  && <CompareView staff={staff} attendance={attendance} getShiftByDate={getShiftByDate} getAtt={getAtt}/>}
        {tab==="edit"     && <AttendanceEditView staff={staff} attendance={attendance} editAttendance={editAttendance} clearAttendanceDay={clearAttendanceDay} showToast={showToast} getShiftByDate={getShiftByDate}/>}
        {tab==="wage"     && <WageView staff={staff} attendance={attendance} getShiftByDate={getShiftByDate} updateStaff={updateStaff} showToast={showToast}/>}
        {tab==="breaks"   && <BreakTemplateView templates={templates} addTemplate={addTemplate} updateTemplate={updateTemplate} deleteTemplate={deleteTemplate}/>}
        {tab==="accounts" && <AccountsView staff={staff} addStaff={addStaff} deleteStaff={deleteStaff} updateStaff={updateStaff} templates={templates}/>}
        {tab==="settings" && <SettingsView settings={settings} setSettings={setSettings} showToast={showToast}/>}
      </main>
    </>
  );
}

// verdict → { vk, bg, color }. Label resolved with t("v_"+vk) at render.
function verdictOf(sh,att){
  if(!sh&&!att?.clock_in) return {vk:"holiday",...VD.holiday};
  if(!sh&& att?.clock_in) return {vk:"out",...VD.out};
  if( sh&&!att?.clock_in) return {vk:"absent",...VD.absent};
  if(!att?.clock_out)     return {vk:"working",...VD.working};
  const aIn=new Date(att.clock_in),aOut=new Date(att.clock_out);
  const aInM=aIn.getHours()*60+aIn.getMinutes(),aOutM=aOut.getHours()*60+aOut.getMinutes();
  const late=aInM>toMin(sh.start_time)+5,early=aOutM<toMin(sh.end_time)-5;
  if(late&&early) return {vk:"lateEarly",...VD.lateEarly};
  if(late)        return {vk:"late",...VD.late};
  if(early)       return {vk:"early",...VD.early};
  return              {vk:"normal",...VD.normal};
}

function MonthTable({staff:s,getShiftByDate,getAtt,year,month,monthDates,today,transport=0}){
  const {t}=useI18n();
  const DAYS=t.arr("daysSun");
  const monthTotal=monthDates.reduce((acc,d)=>{
    const sh=getShiftByDate(d,s.id),att=getAtt(s.id,d);
    const mins=sh&&att?.clock_in&&att?.clock_out?calcBillableMinutes(sh.start_time,sh.end_time,att.clock_in,att.clock_out,breaksForDate(s.breaks,d)):0;
    return {mins:acc.mins+mins,pay:acc.pay+Math.floor(mins/60*(s.wage||0))};
  },{mins:0,pay:0});
  return (
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[[t("s_days"),`${monthDates.filter(d=>{const a=getAtt(s.id,d);return a?.clock_in&&a?.clock_out;}).length}${t("dUnit")}`,C.green],[t("s_hours"),`${Math.floor(monthTotal.mins/60)}h${monthTotal.mins%60}m`,C.ink],[t("s_pay"),`¥${(monthTotal.pay+transport).toLocaleString()}`,C.accent,transport>0?t("transport_incl",transport):null]].map(([label,val,color,sub])=>(
          <div key={label} style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:11,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{label}</div>
            <div style={{fontSize:18,fontWeight:600,color,fontFamily:SERIF,fontVariantNumeric:"tabular-nums"}}>{val}</div>
            {sub&&<div style={{fontSize:9,color:C.muted,marginTop:2}}>{sub}</div>}
          </div>
        ))}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",background:C.paper,borderRadius:14,overflow:"hidden",boxShadow:C.shadow,fontSize:12,minWidth:440}}>
          <thead><tr style={{background:HEAD_BG,color:HEAD_FG}}>
            {[t("h_date"),t("h_day"),t("h_shift"),t("h_in"),t("h_out"),t("h_worked"),t("h_verdict")].map((h,i)=><th key={i} style={{padding:"10px 6px",textAlign:"center",fontSize:11,whiteSpace:"nowrap",fontWeight:700}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {monthDates.map((d,i)=>{
              const sh=getShiftByDate(d,s.id),att=getAtt(s.id,d),vd=verdictOf(sh,att);
              const mins=sh&&att?.clock_in&&att?.clock_out?calcBillableMinutes(sh.start_time,sh.end_time,att.clock_in,att.clock_out,breaksForDate(s.breaks,d)):0;
              const isWE=d.getDay()===0||d.getDay()===6,isToday=d.toDateString()===today.toDateString();
              return (
                <tr key={i} style={{borderBottom:`1px solid ${C.border2}`,background:isToday?C.surface2:i%2===0?ROW_A:ROW_B}}>
                  <td style={{padding:"8px 6px",textAlign:"center",fontWeight:isToday?700:400,color:isToday?C.gold:C.ink,whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums"}}>{t("md",month,d.getDate())}{isToday&&" ✦"}</td>
                  <td style={{padding:"8px 4px",textAlign:"center",color:isWE?C.accent:C.muted,fontWeight:600}}>{DAYS[d.getDay()]}</td>
                  <td style={{padding:"8px 6px",textAlign:"center",color:sh?C.green:FAINT,whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums"}}>{sh?`${sh.start_time}〜${sh.end_time}`:"──"}</td>
                  <td style={{padding:"8px 6px",textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{att?.clock_in?<span style={{color:C.blue}}>{fmtHM(att.clock_in)}</span>:<span style={{color:FAINT}}>──</span>}</td>
                  <td style={{padding:"8px 6px",textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{att?.clock_out?<span style={{color:C.accent}}>{fmtHM(att.clock_out)}</span>:<span style={{color:FAINT}}>──</span>}</td>
                  <td style={{padding:"8px 6px",textAlign:"center",fontWeight:700,color:mins>0?C.ink:FAINT,fontVariantNumeric:"tabular-nums"}}>{mins>0?`${Math.floor(mins/60)}h${mins%60}m`:"──"}</td>
                  <td style={{padding:"8px 6px",textAlign:"center"}}><span style={{fontSize:10,padding:"3px 8px",borderRadius:20,background:vd.bg,color:vd.color,fontWeight:700,whiteSpace:"nowrap"}}>{t("v_"+vd.vk)}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr style={{background:HEAD_BG,color:HEAD_FG}}>
            <td colSpan={5} style={{padding:"11px 12px",fontWeight:700,fontSize:12}}>{t("s_monthTotal")}</td>
            <td style={{padding:"11px 6px",textAlign:"center",color:C.gold,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{Math.floor(monthTotal.mins/60)}h{monthTotal.mins%60}m</td>
            <td style={{padding:"11px 6px",textAlign:"center",color:C.gold,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>¥{(monthTotal.pay+transport).toLocaleString()}</td>
          </tr></tfoot>
        </table>
      </div>
    </>
  );
}

function MyRecordView({currentUser,getAtt,getShiftByDate}){
  const {t}=useI18n();
  const [moOffset,setMoOffset]=useState(0);
  const today=new Date();
  const base=new Date(today.getFullYear(),today.getMonth()+moOffset,1);
  const year=base.getFullYear(),month=base.getMonth();
  const monthDates=Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>new Date(year,month,i+1));
  const s=currentUser;
  const brkTotal=breaksTotalMin(parseBreaks(s.breaks));
  return (
    <div>
      <SectionTitle icon="chart" title={t("rec_title")} sub={t("rec_sub",brkTotal)}/>
      <WeekNavMonth year={year} month={month} offset={moOffset} setOffset={setMoOffset}/>
      <MonthTable staff={s} getShiftByDate={getShiftByDate} getAtt={getAtt} year={year} month={month} monthDates={monthDates} today={today} transport={transportForMonth(s,ymOf(year,month))}/>
    </div>
  );
}

function ShiftInputView({staff,getShiftByDate,saveShift,deleteShift,period,getRequest,showToast}){
  const {t}=useI18n();
  const DAYS=t.arr("daysSun");
  const isMonth=period==="month";
  const [weekOffset,setWeekOffset]=useState(0);
  const [moOffset,setMoOffset]=useState(0);
  const [modal,setModal]=useState(null);
  const [editVal,setEditVal]=useState({start:"10:00",end:"18:00"});
  const [saving,setSaving]=useState(false);
  const today=new Date();
  const mBase=new Date(today.getFullYear(),today.getMonth()+moOffset,1);
  const dates=isMonth
    ? Array.from({length:new Date(mBase.getFullYear(),mBase.getMonth()+1,0).getDate()},(_,i)=>new Date(mBase.getFullYear(),mBase.getMonth(),i+1))
    : getWeekDates(weekOffset);
  const reqOf=(staffId,d)=>getRequest?getRequest(staffId,d):null;
  const pendingCount=getRequest?staff.reduce((n,s)=>n+dates.filter(d=>{const rq=getRequest(s.id,d);return rq&&!getShiftByDate(d,s.id);}).length,0):0;

  function openModal(staffId,dayIdx){
    const d=dates[dayIdx];
    const sh=getShiftByDate(d,staffId);
    const req=reqOf(staffId,d);
    setEditVal(sh?{start:sh.start_time,end:sh.end_time}:(req&&req.status==="work"?{start:req.start_time,end:req.end_time}:{start:"10:00",end:"18:00"}));
    setModal({staffId,dayIdx,req});
  }
  async function save(){
    setSaving(true);
    await saveShift(modal.staffId,dates[modal.dayIdx],editVal.start,editVal.end);
    setSaving(false); setModal(null);
  }
  async function approve(){
    setSaving(true);
    await saveShift(modal.staffId,dates[modal.dayIdx],modal.req.start_time,modal.req.end_time);
    setSaving(false); setModal(null);
  }
  async function remove(){
    setSaving(true);
    await deleteShift(modal.staffId,dates[modal.dayIdx]);
    setSaving(false); setModal(null);
  }

  const colW=isMonth?46:70;
  const nameW=isMonth?92:88;
  return (
    <div>
      <SectionTitle icon="calendar" title={t("shift_title")} sub={t("shift_sub")}/>
      {pendingCount>0&&<div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:12,padding:"6px 12px",borderRadius:20,background:isDarkTheme?"#241d0a":"#f4ecd6",color:C.gold,fontSize:11.5,fontWeight:700}}><Icon name="signal" size={13}/>{t("req_adminCount",pendingCount)}</div>}
      {isMonth
        ? <WeekNavMonth year={mBase.getFullYear()} month={mBase.getMonth()} offset={moOffset} setOffset={setMoOffset}/>
        : <WeekNav dates={dates} offset={weekOffset} setOffset={setWeekOffset}/>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",background:C.paper,borderRadius:14,overflow:"hidden",boxShadow:C.shadow,fontSize:12,minWidth:isMonth?nameW+dates.length*colW:560}}>
          <thead><tr style={{background:HEAD_BG,color:HEAD_FG}}>
            <th style={{padding:"10px 12px",textAlign:"left",width:nameW,minWidth:nameW,fontWeight:700,position:"sticky",left:0,background:HEAD_BG,zIndex:2}}>{t("col_staff")}</th>
            {dates.map((d,i)=>{const we=d.getDay()===0||d.getDay()===6;return <th key={i} style={{padding:"10px 4px",textAlign:"center",color:we?C.gold:HEAD_FG,minWidth:colW,fontWeight:700}}><div>{DAYS[d.getDay()]}</div><div style={{fontSize:10,opacity:0.7,fontWeight:400}}>{isMonth?d.getDate():fmtDate(d)}</div></th>;})}
          </tr></thead>
          <tbody>
            {staff.map((s,si)=>{
              const rowBg=si%2===0?ROW_A:ROW_B;
              return (
              <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`,background:rowBg}}>
                <td style={{padding:"10px",fontWeight:700,position:"sticky",left:0,background:rowBg,zIndex:1}}>
                  <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:"50%",background:SUBTLE,color:C.muted,fontSize:11,fontWeight:600,marginRight:6,fontFamily:SERIF}}>{nameToAvatar(s.name)}</span>
                  {s.name.split(" ")[0]}
                </td>
                {dates.map((_,dayIdx)=>{
                  const d=dates[dayIdx];
                  const sh=getShiftByDate(d,s.id);
                  const req=reqOf(s.id,d);
                  const reqDiffers=req&&req.status==="work"&&!(sh&&sh.start_time===req.start_time&&sh.end_time===req.end_time);
                  return (
                    <td key={dayIdx} style={{padding:"5px 3px",textAlign:"center"}}>
                      {sh?(
                        <button onClick={()=>openModal(s.id,dayIdx)} style={{position:"relative",width:"100%",padding:"6px 1px",borderRadius:8,border:`1px solid ${C.greenBorder}`,background:C.greenBg,color:C.green,fontSize:isMonth?9.5:10.5,fontWeight:700,cursor:"pointer",fontFamily:SANS,lineHeight:1.5,fontVariantNumeric:"tabular-nums"}}>
                          {sh.start_time}<br/>〜{sh.end_time}
                          {(req&&(reqDiffers||req.status==="off"))&&<span style={{position:"absolute",top:3,right:3,width:6,height:6,borderRadius:"50%",background:C.gold}}/>}
                        </button>
                      ):req?(
                        <button onClick={()=>openModal(s.id,dayIdx)} title={t("req_pending")} style={{width:"100%",padding:"5px 1px",borderRadius:8,border:`1.5px dashed ${req.status==="off"?C.accent:C.gold}`,background:"transparent",color:req.status==="off"?C.accent:C.gold,fontSize:isMonth?9:10,fontWeight:700,cursor:"pointer",fontFamily:SANS,lineHeight:1.4,fontVariantNumeric:"tabular-nums"}}>
                          {req.status==="work"?<>{req.start_time}<br/>〜{req.end_time}</>:t("req_offShort")}
                          <div style={{fontSize:isMonth?7.5:8.5,opacity:0.85,fontWeight:700,letterSpacing:"0.04em"}}>{t("req_pending")}</div>
                        </button>
                      ):(
                        <button onClick={()=>openModal(s.id,dayIdx)} style={{width:"100%",padding:isMonth?"9px 0":"12px 0",border:`1.5px dashed ${C.border}`,borderRadius:8,background:"transparent",color:C.muted,cursor:"pointer",display:"inline-flex",justifyContent:"center"}}><Icon name="plus" size={isMonth?12:15}/></button>
                      )}
                    </td>
                  );
                })}
              </tr>
            );})}
          </tbody>
        </table>
      </div>
      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{fontSize:15,fontWeight:600,marginBottom:3,fontFamily:SERIF}}>{staff.find(s=>s.id===modal.staffId)?.name}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:18}}>{DAYS[dates[modal.dayIdx].getDay()]}{t("dowSuffix")}（{fmtDate(dates[modal.dayIdx])}）</div>
          {modal.req&&(
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:16,padding:"10px 12px",borderRadius:10,background:modal.req.status==="off"?DANGER_BG:(isDarkTheme?"#241d0a":"#f4ecd6"),border:`1px solid ${modal.req.status==="off"?C.accent+"55":C.gold+"66"}`}}>
              <Icon name="user" size={16} style={{color:modal.req.status==="off"?C.accent:C.gold,flexShrink:0}}/>
              <div style={{flex:1,fontSize:12,fontWeight:700,color:modal.req.status==="off"?C.accent:C.gold,fontVariantNumeric:"tabular-nums"}}>{t("req_hope")}: {modal.req.status==="work"?`${modal.req.start_time}〜${modal.req.end_time}`:t("req_off")}</div>
              {modal.req.status==="work"&&<button onClick={approve} disabled={saving} style={{padding:"6px 11px",borderRadius:8,border:"none",background:C.gold,color:ON_GOLD,fontFamily:SANS,fontSize:11.5,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{t("req_approve")}</button>}
            </div>
          )}
          <div style={{display:"flex",gap:12,marginBottom:20}}>
            <label style={LS}>{t("inTime")}<select value={editVal.start} onChange={e=>setEditVal(v=>({...v,start:e.target.value}))} style={SS}>{TIME_SLOTS.map(x=><option key={x}>{x}</option>)}</select></label>
            <label style={LS}>{t("outTime")}<select value={editVal.end} onChange={e=>setEditVal(v=>({...v,end:e.target.value}))} style={SS}>{TIME_SLOTS.map(x=><option key={x}>{x}</option>)}</select></label>
          </div>
          <button onClick={save} disabled={saving} style={PB(C.ink)}><Icon name="save" size={15}/>{saving?t("saving"):t("save")}</button>
          {getShiftByDate(dates[modal.dayIdx],modal.staffId)&&<button onClick={remove} disabled={saving} style={{...PB("danger"),marginTop:8}}><Icon name="trash" size={15}/>{t("del")}</button>}
        </Modal>
      )}
    </div>
  );
}

function PunchView({staff,now,getAtt,punchIn,punchOut,getShiftByDate,singleUser}){
  const {t}=useI18n();
  const [selected,setSelected]=useState(singleUser?staff[0]:null);
  const [gps,setGps]=useState("idle");
  const [gpsMsg,setGpsMsg]=useState("");
  const [punching,setPunching]=useState(false);
  const [pendingType,setPendingType]=useState(null);
  const watchRef = useRef(null);
  const doneRef = useRef(false);
  const today=new Date();
  const att=selected?getAtt(selected.id,today):null;
  const shift=selected?getShiftByDate(today,selected.id):null;
  const status=!att?.clock_in?"absent":!att?.clock_out?"working":"done";

  async function doPunch(type){
    setPunching(true);
    type==="in"?await punchIn(selected.id):await punchOut(selected.id);
    setPunching(false);
  }

  function evaluateFix(pos, type){
    const dist=Math.round(calcDistanceM(pos.coords.latitude,pos.coords.longitude,STORE_LAT,STORE_LNG));
    const acc=Math.round(pos.coords.accuracy||0);
    // Give the benefit of GPS error, capped at 100m, so a real on-site staff isn't falsely rejected
    const tolerance=Math.min(acc,100);
    if(dist-tolerance<=STORE_RADIUS_M){
      setGps("ok"); setGpsMsg(t("gps_ok2",dist,acc));
      doPunch(type);
    } else {
      setGps("far"); setGpsMsg(t("gps_far2",dist,acc,STORE_RADIUS_M));
    }
  }

  // Sample GPS for a few seconds, keep the most accurate fix, finish early on a confident reading.
  function acquireAndPunch(type){
    setPendingType(type);
    if(!navigator.geolocation){ setGps("error"); setGpsMsg(t("gps_noSupport")); return; }
    setGps("checking"); setGpsMsg(t("gps_checking"));
    let best=null; doneRef.current=false;
    const SAMPLE_MS=8000;
    const finish=()=>{
      if(doneRef.current) return; doneRef.current=true;
      if(watchRef.current!=null){ navigator.geolocation.clearWatch(watchRef.current); watchRef.current=null; }
      if(!best){ setGps("error"); setGpsMsg(t("gps_timeout")); return; }
      evaluateFix(best, type);
    };
    watchRef.current=navigator.geolocation.watchPosition(
      pos=>{
        if(!best || (pos.coords.accuracy||1e9) < (best.coords.accuracy||1e9)) best=pos;
        const dist=calcDistanceM(best.coords.latitude,best.coords.longitude,STORE_LAT,STORE_LNG);
        const acc=best.coords.accuracy||0;
        // confident, clearly-inside fix → stop early
        if(acc<=30 && dist<=STORE_RADIUS_M) finish();
      },
      err=>{ if(!best && !doneRef.current){ doneRef.current=true; if(watchRef.current!=null){navigator.geolocation.clearWatch(watchRef.current);watchRef.current=null;} setGps(err.code===1?"denied":"error"); setGpsMsg(err.code===1?t("gps_denied"):t("gps_timeout")); } },
      {enableHighAccuracy:true,timeout:SAMPLE_MS,maximumAge:0}
    );
    setTimeout(finish, SAMPLE_MS);
  }

  useEffect(()=>()=>{ if(watchRef.current!=null) navigator.geolocation.clearWatch(watchRef.current); },[]);

  function handlePunch(type, skipGps=false){
    if(skipGps){ doPunch(type); return; }
    acquireAndPunch(type);
  }

  const SL={absent:t("st_absent"),working:t("st_working"),done:t("st_done")};
  const SC={absent:C.muted,working:C.green,done:C.blue};
  const SB={absent:C.surface2,working:C.greenBg,done:C.blueBg};
  const canIn=!att?.clock_in&&gps!=="checking"&&!punching;
  const canOut=att?.clock_in&&!att?.clock_out&&gps!=="checking"&&!punching;
  const gpsIcon = gps==="checking"?"signal":gps==="ok"?"pin":"x";
  const gpsColor = gps==="ok"?C.green:gps==="checking"?C.gold:C.accent;
  const gpsBg = gps==="ok"?C.greenBg:gps==="checking"?C.surface2:DANGER_BG;

  return (
    <div>
      <SectionTitle icon="clock" title={t("punch_title")} sub={singleUser?t("punch_subOne"):t("punch_subMany")}/>
      {!singleUser&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(118px,1fr))",gap:10,marginBottom:22}}>
          {staff.map(s=>{
            const a=getAtt(s.id,today),st=!a?.clock_in?"absent":!a?.clock_out?"working":"done",isSel=selected?.id===s.id;
            return (
              <button key={s.id} onClick={()=>{setSelected(s);setGps("idle");setGpsMsg("");}} style={{background:isSel?C.gold:C.paper,border:`2px solid ${isSel?C.gold:C.border}`,borderRadius:14,padding:"12px 8px",cursor:"pointer",textAlign:"center",boxShadow:isSel?C.shadow:"none"}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.28)":SUBTLE,color:isSel?ON_GOLD:C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:600,margin:"0 auto 7px",fontFamily:SERIF}}>{nameToAvatar(s.name)}</div>
                <div style={{fontSize:12,fontWeight:700,color:isSel?ON_GOLD:C.ink,marginBottom:6}}>{s.name.split(" ")[0]}</div>
                <span style={{fontSize:10,padding:"3px 9px",borderRadius:20,background:isSel?"rgba(255,255,255,0.25)":SB[st],color:isSel?ON_GOLD:SC[st],fontWeight:700}}>{SL[st]}</span>
              </button>
            );
          })}
        </div>
      )}
      {selected&&(
        <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:16,padding:20,boxShadow:C.shadow}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div style={{width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold2},${C.gold})`,color:ON_GOLD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:600,fontFamily:SERIF}}>{nameToAvatar(selected.name)}</div>
            <div>
              <div style={{fontSize:17,fontWeight:600,fontFamily:SERIF}}>{selected.name}</div>
              {shift&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{t("shiftLabel")}: {shift.start_time} 〜 {shift.end_time}</div>}
            </div>
            <span style={{marginLeft:"auto",fontSize:11,padding:"5px 13px",borderRadius:20,background:SB[status],color:SC[status],fontWeight:700}}>{SL[status]}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:15}}>
            {[[t("lbl_in"),C.blue,att?.clock_in],[t("lbl_out"),C.accent,att?.clock_out]].map(([label,dot,ts])=>(
              <div key={label} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 12px",textAlign:"center"}}>
                <div style={{fontSize:10.5,color:C.muted,marginBottom:4,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><span style={{width:7,height:7,borderRadius:"50%",background:dot,display:"inline-block"}}/>{label}{t("lbl_timeSuffix")}</div>
                <div style={{fontSize:22,fontWeight:600,fontVariantNumeric:"tabular-nums",fontFamily:SERIF,color:ts?C.ink:FAINT}}>{ts?fmtHM(ts):"──"}</div>
              </div>
            ))}
          </div>
          {gps!=="idle"&&<div style={{marginBottom:14,padding:"10px 14px",borderRadius:10,fontSize:12,fontWeight:700,background:gpsBg,color:gpsColor,display:"flex",alignItems:"center",gap:8}}><Icon name={gpsIcon} size={16}/><span style={{flex:1}}>{gpsMsg}</span>{(gps==="far"||gps==="error"||gps==="denied")&&<button onClick={()=>acquireAndPunch(pendingType||"in")} style={{border:`1px solid ${gpsColor}`,background:"transparent",color:gpsColor,borderRadius:8,padding:"5px 10px",fontFamily:SANS,fontSize:11,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,whiteSpace:"nowrap",flexShrink:0}}><Icon name="refresh" size={13}/>{t("gps_retry")}</button>}</div>}
          <div style={{display:"flex",gap:10}}>
            <button disabled={!canIn} onClick={()=>handlePunch("in",!singleUser)} style={{flex:1,padding:"13px 0",borderRadius:12,border:canIn?"none":`1px solid ${C.border}`,background:canIn?C.green:C.surface2,color:canIn?ON_DARK:C.muted,fontSize:13,fontWeight:700,cursor:canIn?"pointer":"not-allowed",fontFamily:SANS,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8}}><Icon name="check" size={16}/>{t("btn_in")}</button>
            <button disabled={!canOut} onClick={()=>handlePunch("out",!singleUser)} style={{flex:1,padding:"13px 0",borderRadius:12,border:canOut?"none":`1px solid ${C.border}`,background:canOut?C.blue:C.surface2,color:canOut?ON_DARK:C.muted,fontSize:13,fontWeight:700,cursor:canOut?"pointer":"not-allowed",fontFamily:SANS,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8}}><Icon name="power" size={16}/>{t("btn_out")}</button>
          </div>
          {singleUser&&<div style={{marginTop:11,textAlign:"center",fontSize:11,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="pin" size={13}/>{t("gps_note",CONFIG.storeAddress,STORE_RADIUS_M)}</div>}
          {!singleUser&&<div style={{marginTop:11,textAlign:"center",fontSize:11,color:C.gold,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="signal" size={13}/>{t("admin_note")}</div>}
        </div>
      )}
      {!singleUser&&(
        <div style={{marginTop:24}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:10,display:"flex",alignItems:"center",gap:7}}><Icon name="list" size={15}/>{t("todayStatus")}</div>
          <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            {staff.map((s,i)=>{
              const a=getAtt(s.id,today),st=!a?.clock_in?"absent":!a?.clock_out?"working":"done";
              return (
                <div key={s.id} style={{display:"flex",alignItems:"center",padding:"11px 14px",gap:10,borderBottom:i<staff.length-1?`1px solid ${C.border2}`:"none"}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:SUBTLE,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,fontFamily:SERIF}}>{nameToAvatar(s.name)}</div>
                  <div style={{flex:1,fontSize:13,fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:11,color:C.muted,textAlign:"right",minWidth:100,fontVariantNumeric:"tabular-nums"}}>
                    {a?.clock_in&&<div>{t("lbl_in")} {fmtHM(a.clock_in)}</div>}
                    {a?.clock_out&&<div>{t("lbl_out")} {fmtHM(a.clock_out)}</div>}
                    {!a?.clock_in&&<div style={{color:FAINT}}>{t("st_absent")}</div>}
                  </div>
                  <span style={{fontSize:10,padding:"3px 9px",borderRadius:20,background:SB[st],color:SC[st],fontWeight:700,minWidth:48,textAlign:"center"}}>{SL[st]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CompareView({staff,getShiftByDate,getAtt}){
  const {t}=useI18n();
  const [selStaff,setSelStaff]=useState(staff[0]);
  const [moOffset,setMoOffset]=useState(0);
  const today=new Date();
  const base=new Date(today.getFullYear(),today.getMonth()+moOffset,1);
  const year=base.getFullYear(),month=base.getMonth();
  const monthDates=Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>new Date(year,month,i+1));
  if(!selStaff) return null;
  const brkTotal=breaksTotalMin(parseBreaks(selStaff.breaks));
  function exportCSV(){
    const DAYS=t.arr("daysSun");
    const header=[t("h_date"),t("h_day"),t("h_shift")+"("+t("h_in")+")",t("h_shift")+"("+t("h_out")+")",t("h_in"),t("h_out"),t("csv_workedMin"),t("h_verdict")];
    const rows=[header];
    monthDates.forEach(d=>{
      const sh=getShiftByDate(d,selStaff.id),att=getAtt(selStaff.id,d),vd=verdictOf(sh,att);
      const mins=sh&&att?.clock_in&&att?.clock_out?calcBillableMinutes(sh.start_time,sh.end_time,att.clock_in,att.clock_out,breaksForDate(selStaff.breaks,d)):0;
      rows.push([
        `${year}-${String(month+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
        DAYS[d.getDay()],
        sh?sh.start_time:"", sh?sh.end_time:"",
        att?.clock_in?fmtHM(att.clock_in):"", att?.clock_out?fmtHM(att.clock_out):"",
        mins, t("v_"+vd.vk),
      ]);
    });
    downloadCSV(`kintai_${selStaff.username}_${year}-${String(month+1).padStart(2,"0")}.csv`, rows);
  }
  return (
    <div>
      <SectionTitle icon="search" title={t("cmp_title")} sub={t("cmp_sub")}/>
      <WeekNavMonth year={year} month={month} offset={moOffset} setOffset={setMoOffset}/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {staff.map(s=><button key={s.id} onClick={()=>setSelStaff(s)} style={chip(selStaff.id===s.id)}>{nameToAvatar(s.name)} {s.name}</button>)}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
        <div style={{fontSize:11,color:C.muted}}>{t("breakLabel")}: <span style={{color:C.gold,fontWeight:700}}>{t("breakTotal",brkTotal)}</span></div>
        <button onClick={exportCSV} style={csvBtnStyle()}><Icon name="download" size={14}/>{t("csv_export")}</button>
      </div>
      <MonthTable staff={selStaff} getShiftByDate={getShiftByDate} getAtt={getAtt} year={year} month={month} monthDates={monthDates} today={today} transport={transportForMonth(selStaff,ymOf(year,month))}/>
    </div>
  );
}

function AttendanceEditView({staff,attendance,editAttendance,clearAttendanceDay,showToast,getShiftByDate}){
  const {t}=useI18n();
  const DAYS=t.arr("daysSun");
  const [selStaff,setSelStaff]=useState(staff[0]);
  const [moOffset,setMoOffset]=useState(0);
  const [editModal,setEditModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const today=new Date();
  const base=new Date(today.getFullYear(),today.getMonth()+moOffset,1);
  const year=base.getFullYear(),month=base.getMonth();
  const monthDates=Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>new Date(year,month,i+1));

  function getAttD(date){ return attendance.find(a=>a.staff_id===selStaff?.id&&a.date===toDateStr(date))||null; }

  function openEdit(d){
    const att=getAttD(d);
    setEditModal({
      dateStr:toDateStr(d),
      dateLabel:`${t("md",month,d.getDate())}（${DAYS[d.getDay()]}）`,
      inVal:att?.clock_in?new Date(att.clock_in).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}):"",
      outVal:att?.clock_out?new Date(att.clock_out).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}):"",
    });
  }
  async function saveEdit(){
    setSaving(true);
    await editAttendance(selStaff.id,editModal.dateStr,"in",editModal.inVal||null);
    await editAttendance(selStaff.id,editModal.dateStr,"out",editModal.outVal||null);
    setSaving(false); setEditModal(null); showToast(t("toast_fixed"));
  }
  async function deleteDay(){
    setSaving(true);
    await clearAttendanceDay(selStaff.id,editModal.dateStr);
    setSaving(false); setEditModal(null); showToast(t("toast_delPunch"));
  }

  if(!selStaff) return null;
  return (
    <div>
      <SectionTitle icon="pencil" title={t("edit_title")} sub={t("edit_sub")}/>
      <WeekNavMonth year={year} month={month} offset={moOffset} setOffset={setMoOffset}/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {staff.map(s=><button key={s.id} onClick={()=>setSelStaff(s)} style={chip(selStaff.id===s.id)}>{nameToAvatar(s.name)} {s.name}</button>)}
      </div>
      <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:C.shadow}}>
        <div style={{background:HEAD_BG,padding:"10px 14px",display:"grid",gridTemplateColumns:"60px 30px 100px 80px 80px 70px",gap:8,fontSize:11,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`}}>
          <span>{t("h_date")}</span><span>{t("h_day")}</span><span>{t("h_shift")}</span><span>{t("h_in")}</span><span>{t("h_out")}</span><span style={{textAlign:"center"}}>{t("btn_edit")}</span>
        </div>
        {monthDates.map((d,i)=>{
          const att=getAttD(d),sh=getShiftByDate(d,selStaff.id);
          const isWE=d.getDay()===0||d.getDay()===6,isToday=d.toDateString()===today.toDateString();
          const hasRecord=att?.clock_in||att?.clock_out;
          return (
            <div key={i} style={{display:"grid",gridTemplateColumns:"60px 30px 100px 80px 80px 70px",gap:8,alignItems:"center",padding:"8px 14px",borderBottom:i<monthDates.length-1?`1px solid ${C.border2}`:"none",background:isToday?C.surface2:i%2===0?ROW_A:ROW_B}}>
              <span style={{fontSize:12,fontWeight:isToday?700:400,color:isToday?C.gold:C.ink,fontVariantNumeric:"tabular-nums"}}>{t("md",month,d.getDate())}{isToday?" ✦":""}</span>
              <span style={{fontSize:12,color:isWE?C.gold:C.muted,fontWeight:600}}>{DAYS[d.getDay()]}</span>
              <span style={{fontSize:11,color:sh?C.green:FAINT,fontVariantNumeric:"tabular-nums"}}>{sh?`${sh.start_time}〜${sh.end_time}`:"──"}</span>
              <span style={{fontSize:12,color:att?.clock_in?C.blue:FAINT,fontWeight:att?.clock_in?600:400,fontVariantNumeric:"tabular-nums"}}>{att?.clock_in?fmtHM(att.clock_in):"──"}</span>
              <span style={{fontSize:12,color:att?.clock_out?C.accent:FAINT,fontWeight:att?.clock_out?600:400,fontVariantNumeric:"tabular-nums"}}>{att?.clock_out?fmtHM(att.clock_out):"──"}</span>
              <button onClick={()=>openEdit(d)} style={{padding:"5px 9px",borderRadius:8,border:`1px solid ${C.border}`,background:hasRecord?C.surface2:C.bg,color:C.ink,fontSize:11,cursor:"pointer",fontFamily:SANS,fontWeight:600,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5}}>
                <Icon name={hasRecord?"pencil":"plus"} size={13}/>{hasRecord?t("btn_edit"):t("btn_add")}
              </button>
            </div>
          );
        })}
      </div>
      {editModal&&(
        <Modal onClose={()=>setEditModal(null)}>
          <div style={{fontSize:15,fontWeight:600,marginBottom:3,fontFamily:SERIF}}>{selStaff.name}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:20}}>{editModal.dateLabel}</div>
          <div style={{display:"flex",gap:12,marginBottom:8}}>
            <label style={LS}>{t("inTime")}<input type="time" value={editModal.inVal} onChange={e=>setEditModal(p=>({...p,inVal:e.target.value}))} style={{...SS,width:"100%"}}/></label>
            <label style={LS}>{t("outTime")}<input type="time" value={editModal.outVal} onChange={e=>setEditModal(p=>({...p,outVal:e.target.value}))} style={{...SS,width:"100%"}}/></label>
          </div>
          <div style={{fontSize:11,color:C.muted,marginBottom:18}}>{t("clearNote")}</div>
          <button onClick={saveEdit} disabled={saving} style={PB(C.ink)}><Icon name="save" size={15}/>{saving?t("saving"):t("save")}</button>
          <button onClick={deleteDay} disabled={saving} style={{...PB("danger"),marginTop:8}}><Icon name="trash" size={15}/>{t("delDay")}</button>
        </Modal>
      )}
    </div>
  );
}

function WageView({staff,attendance,getShiftByDate,updateStaff,showToast}){
  const {t}=useI18n();
  const [editing,setEditing]=useState({});
  const [moOffset,setMoOffset]=useState(0);
  const [trModal,setTrModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const today=new Date();
  const base=new Date(today.getFullYear(),today.getMonth()+moOffset,1);
  const year=base.getFullYear(),month=base.getMonth();
  const ym=ymOf(year,month);
  const monthDates=Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>new Date(year,month,i+1));

  async function save(staffId,currentWage){
    const v=parseInt(editing[staffId]??currentWage);
    if(!v||v<900||v>5000){ showToast(t("wageErr"),"error"); return; }
    await updateStaff(staffId,{wage:v});
    setEditing(p=>({...p,[staffId]:undefined}));
  }
  function monthSummary(s){
    return monthDates.reduce((acc,d)=>{
      const sh=getShiftByDate(d,s.id),att=attendance.find(a=>a.staff_id===s.id&&a.date===toDateStr(d));
      const mins=sh&&att?.clock_in&&att?.clock_out?calcBillableMinutes(sh.start_time,sh.end_time,att.clock_in,att.clock_out,breaksForDate(s.breaks,d)):0;
      return {mins:acc.mins+mins,pay:acc.pay+Math.floor(mins/60*(s.wage||0))};
    },{mins:0,pay:0});
  }
  function openTransport(s){
    setTrModal({staffId:s.id,fixed:String(Number(s.transport_fixed)||0),override:hasTransportOverride(s,ym),monthAmt:String(transportForMonth(s,ym))});
  }
  async function saveTransport(){
    const sid=trModal.staffId, st=staff.find(x=>x.id===sid);
    const ov=parseTransportOverrides(st.transport_overrides);
    if(trModal.override) ov[ym]=Number(trModal.monthAmt)||0; else delete ov[ym];
    setSaving(true);
    await updateStaff(sid,{transport_fixed:Number(trModal.fixed)||0,transport_overrides:ov});
    setSaving(false); setTrModal(null);
  }

  const GRID="1fr 72px 80px 116px 116px 110px";
  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
        <SectionTitle icon="yen" title={t("wage_title")} sub={t("wage_sub")}/>
        <button onClick={()=>{
          const header=[t("col_staff"),t("col_uname"),t("w_hourly"),t("csv_workedMin"),t("w_workPay"),t("w_transport"),t("w_total"),t("csv_breakMin")];
          const rows=[header];
          staff.forEach(s=>{ const sum=monthSummary(s); const tr=transportForMonth(s,ym); rows.push([s.name,s.username,s.wage||0,sum.mins,sum.pay,tr,sum.pay+tr,breaksTotalMin(parseBreaks(s.breaks))]); });
          downloadCSV(`kintai_wage_${ym}.csv`, rows);
        }} style={{...csvBtnStyle(),marginTop:2,flexShrink:0}}><Icon name="download" size={14}/>{t("csv_export")}</button>
      </div>
      <WeekNavMonth year={year} month={month} offset={moOffset} setOffset={setMoOffset}/>
      <div style={{overflowX:"auto"}}>
      <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:C.shadow,minWidth:660}}>
        <div style={{background:HEAD_BG,padding:"10px 14px",fontSize:11,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:GRID,gap:8,alignItems:"center"}}>
          <span>{t("col_staff")}</span><span style={{textAlign:"right"}}>{t("w_hourly")}</span><span style={{textAlign:"center"}}>{t("w_worked")}</span><span style={{textAlign:"center"}}>{t("w_transport")}</span><span style={{textAlign:"right"}}>{t("w_total")}</span><span style={{textAlign:"center"}}>{t("w_change")}</span>
        </div>
        {staff.map((s,i)=>{
          const sum=monthSummary(s);
          const tr=transportForMonth(s,ym), isOv=hasTransportOverride(s,ym);
          return (
            <div key={s.id} style={{display:"grid",gridTemplateColumns:GRID,gap:8,alignItems:"center",padding:"12px 14px",borderBottom:i<staff.length-1?`1px solid ${C.border2}`:"none",background:i%2===0?ROW_A:ROW_B}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:SUBTLE,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,fontFamily:SERIF}}>{nameToAvatar(s.name)}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:10,color:C.muted}}>{t("breaksUnit",breaksTotalMin(parseBreaks(s.breaks)))}</div>
                </div>
              </div>
              <div style={{textAlign:"right",fontSize:13,fontWeight:600,fontFamily:SERIF,fontVariantNumeric:"tabular-nums"}}>¥{s.wage?.toLocaleString()}</div>
              <div style={{textAlign:"center",fontSize:12,color:C.muted,fontVariantNumeric:"tabular-nums"}}>{Math.floor(sum.mins/60)}h{sum.mins%60}m</div>
              <div style={{display:"flex",justifyContent:"center"}}>
                <button onClick={()=>openTransport(s)} title={t("w_transport")} style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:3,padding:"5px 9px",borderRadius:9,border:`1px solid ${isOv?C.gold:C.border}`,background:isOv?(isDarkTheme?"#241d0a":"#f4ecd6"):C.bg,cursor:"pointer",fontFamily:SANS}}>
                  <span style={{fontSize:12.5,fontWeight:700,color:C.ink,fontFamily:SERIF,fontVariantNumeric:"tabular-nums"}}>¥{tr.toLocaleString()}</span>
                  <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10,background:isOv?C.gold:SUBTLE,color:isOv?ON_GOLD:C.muted,display:"inline-flex",alignItems:"center",gap:3}}><Icon name={isOv?"pencil":"train"} size={9}/>{isOv?t("transport_overrideTag"):t("transport_fixedTag")}</span>
                </button>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13.5,fontWeight:700,color:C.accent,fontFamily:SERIF,fontVariantNumeric:"tabular-nums"}}>¥{(sum.pay+tr).toLocaleString()}</div>
                <div style={{fontSize:9.5,color:C.muted,fontVariantNumeric:"tabular-nums"}}>{t("w_workPay")} ¥{sum.pay.toLocaleString()}</div>
              </div>
              <div style={{display:"flex",gap:5,alignItems:"center",justifyContent:"flex-end"}}>
                <input type="number" value={editing[s.id]??s.wage??""} min={900} max={5000}
                  onChange={e=>setEditing(p=>({...p,[s.id]:e.target.value}))}
                  style={{width:58,padding:"6px 7px",borderRadius:7,border:`1px solid ${C.border}`,fontFamily:SANS,fontSize:12,textAlign:"right",outline:"none",background:C.bg,color:C.ink,WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
                <button onClick={()=>save(s.id,s.wage)} style={{padding:"6px 9px",borderRadius:8,border:"none",background:C.gold,color:ON_GOLD,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:SANS,whiteSpace:"nowrap"}}>{t("w_update")}</button>
              </div>
            </div>
          );
        })}
      </div>
      </div>
      <div style={{marginTop:11,fontSize:11,color:C.muted}}>{t("wageFoot")}</div>
      {trModal&&(()=>{ const st=staff.find(x=>x.id===trModal.staffId); return (
        <Modal onClose={()=>setTrModal(null)}>
          <div style={{fontSize:15,fontWeight:600,marginBottom:3,fontFamily:SERIF,display:"flex",alignItems:"center",gap:8}}><Icon name="train" size={18} style={{color:C.gold}}/>{t("transport_editTitle",st?.name)}</div>
          <div style={{fontSize:12,color:C.gold,marginBottom:18,fontWeight:700}}>{t("ym",year,month)}</div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5,fontWeight:600}}>{t("transport_monthFixed")}</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14,color:C.muted}}>¥</span>
              <input type="number" value={trModal.fixed} onChange={e=>setTrModal(p=>({...p,fixed:e.target.value}))} placeholder={t("f_transportPh")}
                style={{flex:1,padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:SANS,fontSize:14,background:C.bg,color:C.ink,outline:"none",boxSizing:"border-box",fontVariantNumeric:"tabular-nums",WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
            </div>
          </div>
          <div style={{borderTop:`1px dashed ${C.border}`,paddingTop:14,marginBottom:6}}>
            <label style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:trModal.override?12:0}}>
              <span onClick={()=>setTrModal(p=>({...p,override:!p.override}))} style={{width:42,height:24,borderRadius:14,background:trModal.override?C.gold:C.surface2,border:`1px solid ${trModal.override?C.gold:C.border}`,position:"relative",flexShrink:0,transition:"background .15s"}}><span style={{position:"absolute",top:2,left:trModal.override?20:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}/></span>
              {t("transport_useOverride")}
            </label>
            {trModal.override&&(
              <div>
                <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5,fontWeight:600}}>{t("transport_thisMonth")}</label>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14,color:C.muted}}>¥</span>
                  <input type="number" value={trModal.monthAmt} onChange={e=>setTrModal(p=>({...p,monthAmt:e.target.value}))}
                    style={{flex:1,padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.gold}`,fontFamily:SANS,fontSize:14,background:C.bg,color:C.ink,outline:"none",boxSizing:"border-box",fontVariantNumeric:"tabular-nums",WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
                </div>
              </div>
            )}
          </div>
          <div style={{fontSize:11,color:C.muted,margin:"12px 0 18px"}}>{t("transport_note")}</div>
          <button onClick={saveTransport} disabled={saving} style={PB(C.ink)}><Icon name="save" size={15}/>{saving?t("saving"):t("save")}</button>
        </Modal>
      ); })()}
    </div>
  );
}

function BreakEditor({breaks,setBreaks,templates,onPickTemplate}){
  const {t}=useI18n();
  function update(i,idx,val){
    const m=toMin(val);
    setBreaks(p=>p.map((row,ri)=>ri===i?(idx===0?[m,row[1]]:[row[0],m]):row));
  }
  function addRow(){ setBreaks(p=>[...p,[720,780]]); }
  function removeRow(i){ setBreaks(p=>p.filter((_,ri)=>ri!==i)); }
  const total=breaksTotalMin(breaks);
  return (
    <div>
      {templates&&templates.length>0&&(
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5,fontWeight:600}}>{t("be_fromTpl")}</label>
          <select value="" onChange={e=>{const tp=templates.find(x=>String(x.id)===e.target.value); if(tp) onPickTemplate(parseBreaks(tp.breaks));}}
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:SANS,fontSize:13,background:C.bg,color:C.ink,outline:"none",boxSizing:"border-box"}}>
            <option value="">{t("be_pick")}</option>
            {templates.map(tp=><option key={tp.id} value={tp.id}>{t("be_opt",tp.name,breaksTotalMin(parseBreaks(tp.breaks)))}</option>)}
          </select>
        </div>
      )}
      <div style={{fontSize:11,color:C.muted,marginBottom:6,display:"flex",justifyContent:"space-between"}}>
        <span>{t("be_slots")}</span><span style={{color:C.gold,fontWeight:700}}>{t("be_total",total)}</span>
      </div>
      {breaks.length===0&&<div style={{fontSize:12,color:C.muted,padding:"8px 0"}}>{t("noBreak")}</div>}
      {breaks.map((row,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
          <input type="time" value={minToHM(row[0])} onChange={e=>update(i,0,e.target.value)} style={{...SS,flex:1}}/>
          <span style={{color:C.muted}}>〜</span>
          <input type="time" value={minToHM(row[1])} onChange={e=>update(i,1,e.target.value)} style={{...SS,flex:1}}/>
          <span style={{fontSize:11,color:C.muted,width:48,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{t("minUnit",Math.max(0,row[1]-row[0]))}</span>
          <button onClick={()=>removeRow(i)} style={{padding:"5px 8px",borderRadius:7,border:`1px solid ${C.accent}55`,background:DANGER_BG,color:C.accent,cursor:"pointer",fontFamily:SANS,display:"inline-flex"}}><Icon name="trash" size={14}/></button>
        </div>
      ))}
      <button onClick={addRow} style={{width:"100%",padding:"9px",marginTop:4,borderRadius:8,border:`1.5px dashed ${C.border}`,background:"transparent",color:C.muted,fontFamily:SANS,fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7}}><Icon name="plus" size={15}/>{t("be_add")}</button>
    </div>
  );
}

function StaffBreakEditor({config,setConfig,templates}){
  const {t}=useI18n();
  const DAYS=t.arr("daysSun");
  const norm=c=>(c&&!Array.isArray(c)&&c.byDay)?{default:c.default||[],byDay:c.byDay||{}}:{default:Array.isArray(c)?c:[],byDay:{}};
  const cfg=norm(config);
  const order=[1,2,3,4,5,6,0]; // Mon-first weekday order (getDay values)
  const used=Object.keys(cfg.byDay).map(Number);
  const available=order.filter(d=>!used.includes(d));
  const setDefault=fn=>setConfig(c=>{const n=norm(c);return {...n,default:typeof fn==="function"?fn(n.default):fn};});
  const setDay=(dow,fn)=>setConfig(c=>{const n=norm(c);const cur=n.byDay[dow]||[];return {...n,byDay:{...n.byDay,[dow]:typeof fn==="function"?fn(cur):fn}};});
  const addDay=dow=>setConfig(c=>{const n=norm(c);return {...n,byDay:{...n.byDay,[dow]:(n.default||[]).map(r=>[...r])}};});
  const removeDay=dow=>setConfig(c=>{const n=norm(c);const b={...n.byDay};delete b[dow];return {...n,byDay:b};});
  return (
    <div>
      <div style={{fontSize:11.5,fontWeight:700,marginBottom:2}}>{t("be_baseTitle")}</div>
      <div style={{fontSize:10.5,color:C.muted,marginBottom:9}}>{t("be_baseSub")}</div>
      <BreakEditor breaks={cfg.default} setBreaks={setDefault} templates={templates} onPickTemplate={b=>setDefault(b)}/>
      <div style={{marginTop:16,paddingTop:13,borderTop:`1px dashed ${C.border}`}}>
        <div style={{fontSize:11.5,fontWeight:700,marginBottom:2,display:"flex",alignItems:"center",gap:6}}><Icon name="calendar" size={13} style={{color:C.gold}}/>{t("be_perDay")}</div>
        <div style={{fontSize:10.5,color:C.muted,marginBottom:10}}>{t("be_perDaySub")}</div>
        {order.filter(d=>used.includes(d)).map(dow=>(
          <div key={dow} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:10,background:C.bg}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
              <span style={{fontSize:12.5,fontWeight:700,display:"inline-flex",alignItems:"center",gap:7}}><span style={{width:24,height:24,borderRadius:7,background:C.gold,color:ON_GOLD,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11.5,fontWeight:700,fontFamily:SERIF}}>{DAYS[dow]}</span>{t("be_dayTitle",DAYS[dow])}</span>
              <button onClick={()=>removeDay(dow)} title={t("delete")} style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${C.accent}55`,background:DANGER_BG,color:C.accent,cursor:"pointer",fontFamily:SANS,fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><Icon name="x" size={13}/></button>
            </div>
            <BreakEditor breaks={cfg.byDay[dow]} setBreaks={fn=>setDay(dow,fn)}/>
          </div>
        ))}
        {available.length>0&&(
          <select value="" onChange={e=>{if(e.target.value!=="") addDay(Number(e.target.value));}}
            style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px dashed ${C.border}`,fontFamily:SANS,fontSize:12.5,fontWeight:700,background:"transparent",color:C.muted,outline:"none",boxSizing:"border-box",cursor:"pointer"}}>
            <option value="">＋ {t("be_addDay")}</option>
            {available.map(d=><option key={d} value={d}>{t("be_dayTitle",DAYS[d])}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function BreakTemplateView({templates,addTemplate,updateTemplate,deleteTemplate}){
  const {t}=useI18n();
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState(null);

  function openNew(){ setModal({name:"",breaks:[]}); }
  function openEdit(tp){ setModal({id:tp.id,name:tp.name,breaks:parseBreaks(tp.breaks)}); }

  async function save(){
    if(!modal.name.trim()) return;
    setSaving(true);
    if(modal.id) await updateTemplate(modal.id,modal.name.trim(),modal.breaks);
    else await addTemplate(modal.name.trim(),modal.breaks);
    setSaving(false); setModal(null);
  }

  return (
    <div>
      <SectionTitle icon="coffee" title={t("brk_title")} sub={t("brk_sub")}/>
      <button onClick={openNew} style={{width:"100%",padding:"12px",marginBottom:20,borderRadius:12,border:`1.5px dashed ${C.border}`,background:"transparent",color:C.muted,fontFamily:SANS,fontSize:13,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <Icon name="plus" size={16}/>{t("brk_new")}
      </button>
      <div style={{display:"grid",gap:12}}>
        {templates.length===0&&<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:20}}>{t("brk_none")}</div>}
        {templates.map(tp=>{
          const breaks=parseBreaks(tp.breaks);
          return (
            <div key={tp.id} style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,padding:16,boxShadow:C.shadow}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{width:34,height:34,borderRadius:9,background:isDarkTheme?"#241d0a":"#f4ecd6",color:C.gold,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Icon name="coffee" size={18}/></span>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,fontFamily:SERIF}}>{tp.name}</div>
                    <div style={{fontSize:11,color:C.gold,marginTop:2}}>{t("brk_count",breaksTotalMin(breaks),breaks.length)}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>openEdit(tp)} style={{padding:"6px 11px",borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.ink,fontSize:12,cursor:"pointer",fontFamily:SANS,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}><Icon name="pencil" size={13}/>{t("btn_edit")}</button>
                  <button onClick={()=>setDeleteConfirm(tp.id)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.accent}55`,background:DANGER_BG,color:C.accent,cursor:"pointer",fontFamily:SANS,display:"inline-flex"}}><Icon name="trash" size={14}/></button>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {breaks.length===0?<span style={{fontSize:12,color:C.muted}}>{t("noBreak")}</span>:breaks.map(([a,b],i)=>(
                  <span key={i} style={{fontSize:11.5,padding:"4px 10px",borderRadius:8,background:C.surface2,color:C.ink,fontWeight:600,fontVariantNumeric:"tabular-nums"}}>{minToHM(a)}〜{minToHM(b)}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{fontSize:15,fontWeight:600,marginBottom:14,fontFamily:SERIF}}>{modal.id?t("brk_editTitle"):t("brk_newTitle")}</div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5,fontWeight:600}}>{t("brk_name")}</label>
            <input type="text" value={modal.name} placeholder={t("brk_namePh")}
              onChange={e=>setModal(p=>({...p,name:e.target.value}))}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:SANS,fontSize:13,background:C.bg,color:C.ink,outline:"none",boxSizing:"border-box",WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
          </div>
          <BreakEditor breaks={modal.breaks} setBreaks={fn=>setModal(p=>({...p,breaks:typeof fn==="function"?fn(p.breaks):fn}))}/>
          <button onClick={save} disabled={saving||!modal.name.trim()} style={{...PB(C.ink),marginTop:16}}><Icon name="save" size={15}/>{saving?t("saving"):t("save")}</button>
        </Modal>
      )}
      {deleteConfirm&&(
        <Modal onClose={()=>setDeleteConfirm(null)}>
          <div style={{fontSize:15,fontWeight:600,marginBottom:8,fontFamily:SERIF,display:"flex",alignItems:"center",gap:8}}><Icon name="trash" size={18} style={{color:C.accent}}/>{t("brk_delTitle")}</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:20}}>{t("brk_delMsg",templates.find(x=>x.id===deleteConfirm)?.name)}<br/><span style={{color:C.accent,fontSize:12}}>{t("brk_delNote")}</span></div>
          <button onClick={async()=>{setSaving(true);await deleteTemplate(deleteConfirm);setDeleteConfirm(null);setSaving(false);}} disabled={saving} style={{...PB("danger"),marginBottom:8}}><Icon name="trash" size={15}/>{saving?t("deleting"):t("delete")}</button>
        </Modal>
      )}
    </div>
  );
}

function AccountsView({staff,addStaff,deleteStaff,updateStaff,templates}){
  const {t}=useI18n();
  const [showAdd,setShowAdd]=useState(false);
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({name:"",username:"",password:"",wage:"",transport_fixed:"",breaks:{default:[],byDay:{}}});
  const [errors,setErrors]=useState({});
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [saving,setSaving]=useState(false);

  function validate(f,currentId=null){
    const errs={};
    if(!f.name.trim()) errs.name=t("err_name");
    if(!f.username.trim()) errs.username=t("err_uname");
    else if(!/^[a-zA-Z0-9_]+$/.test(f.username)) errs.username=t("err_unameFmt");
    else if(staff.some(s=>s.username===f.username&&s.id!==currentId)) errs.username=t("err_unameDup");
    if(!f.password.trim()) errs.password=t("err_pw");
    else if(f.password.length<4) errs.password=t("err_pwLen");
    const w=parseInt(f.wage);
    if(!f.wage||isNaN(w)||w<900||w>5000) errs.wage=t("err_wage");
    return errs;
  }

  async function handleAdd(){
    const errs=validate(form); setErrors(errs);
    if(Object.keys(errs).length>0) return;
    setSaving(true);
    await addStaff(form.name.trim(),form.username.trim(),form.password,parseInt(form.wage),form.breaks,parseInt(form.transport_fixed)||0);
    setForm({name:"",username:"",password:"",wage:"",transport_fixed:"",breaks:{default:[],byDay:{}}}); setShowAdd(false); setErrors({}); setSaving(false);
  }

  function openEdit(s){
    setEditId(s.id);
    setForm({name:s.name,username:s.username,password:s.password,wage:String(s.wage||""),transport_fixed:String(s.transport_fixed||""),breaks:parseBreakConfig(s.breaks)});
    setErrors({});
  }

  async function handleUpdate(){
    const errs=validate(form,editId); setErrors(errs);
    if(Object.keys(errs).length>0) return;
    setSaving(true);
    await updateStaff(editId,{name:form.name.trim(),username:form.username.trim(),password:form.password,wage:parseInt(form.wage),transport_fixed:parseInt(form.transport_fixed)||0,breaks:form.breaks});
    setEditId(null); setErrors({}); setSaving(false);
  }

  function FField(key,label,placeholder,type="text"){
    return (
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5,fontWeight:600}}>{label}</label>
        <input type={type} value={form[key]} placeholder={placeholder}
          onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
          style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${errors[key]?C.accent:C.border}`,fontFamily:SANS,fontSize:13,background:C.bg,color:C.ink,outline:"none",boxSizing:"border-box",WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
        {errors[key]&&<div style={{fontSize:11,color:C.accent,marginTop:4,display:"flex",alignItems:"center",gap:4}}><Icon name="warn" size={12}/>{errors[key]}</div>}
      </div>
    );
  }

  function setBreaks(fn){ setForm(p=>({...p,breaks:typeof fn==="function"?fn(p.breaks):fn})); }

  return (
    <div>
      <SectionTitle icon="users" title={t("acc_title")} sub={t("acc_sub")}/>
      {showAdd?(
        <div style={{border:`1px solid ${C.gold}`,borderRadius:14,padding:20,marginBottom:20,background:C.paper,boxShadow:C.shadow}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:16,fontFamily:SERIF,display:"flex",alignItems:"center",gap:8}}><Icon name="plus" size={16} style={{color:C.gold}}/>{t("acc_newTitle")}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>{FField("name",t("f_name"),t("f_namePh"))}</div>
            <div>{FField("username",t("col_uname"),t("f_unamePh"))}</div>
            <div>{FField("password",t("password"),t("f_pwPh"),"password")}</div>
            <div>{FField("wage",t("f_wageYen"),t("f_wageYen"),"number")}</div>
            <div>{FField("transport_fixed",t("f_transport"),t("f_transportPh"),"number")}</div>
          </div>
          <div style={{marginTop:4,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.gold,display:"flex",alignItems:"center",gap:7}}><Icon name="coffee" size={15}/>{t("breakSetting")}</div>
            <StaffBreakEditor config={form.breaks} setConfig={setBreaks} templates={templates}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:12}}>
            <button onClick={handleAdd} disabled={saving} style={{...PB(C.ink),flex:1}}><Icon name="check" size={15}/>{saving?t("acc_issuing"):t("acc_issue")}</button>
            <button onClick={()=>{setShowAdd(false);setErrors({});setForm({name:"",username:"",password:"",wage:"",transport_fixed:"",breaks:{default:[],byDay:{}}});}} style={{...PB("ghost"),flex:1}}>{t("cancel")}</button>
          </div>
        </div>
      ):(
        <button onClick={()=>setShowAdd(true)} style={{width:"100%",padding:"12px",marginBottom:20,borderRadius:12,border:`1.5px dashed ${C.border}`,background:"transparent",color:C.muted,fontFamily:SANS,fontSize:13,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Icon name="plus" size={16}/>{t("acc_new")}
        </button>
      )}
      <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:C.shadow}}>
        <div style={{background:HEAD_BG,padding:"10px 16px",fontSize:11,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"1fr 110px 80px 90px",gap:8,alignItems:"center"}}>
          <span>{t("col_staff")}</span><span>{t("col_uname")}</span><span style={{textAlign:"right"}}>{t("w_hourly")}</span><span style={{textAlign:"center"}}>{t("col_actions")}</span>
        </div>
        {staff.map((s,i)=>{
          const brkTotal=breaksTotalMin(parseBreaks(s.breaks));
          return (
          <div key={s.id}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 110px 80px 90px",gap:8,alignItems:"center",padding:"12px 16px",borderBottom:editId===s.id||i<staff.length-1?`1px solid ${C.border2}`:"none",background:i%2===0?ROW_A:ROW_B}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:SUBTLE,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,flexShrink:0,fontFamily:SERIF}}>{nameToAvatar(s.name)}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:1,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span>{t("breaksUnit",brkTotal)}</span>
                    {hasPerDayBreaks(s.breaks)&&<span style={{padding:"1px 6px",borderRadius:10,background:isDarkTheme?"#241d0a":"#f4ecd6",color:C.gold,fontWeight:700}}>{t("be_varies")}</span>}
                    {(Number(s.transport_fixed)||0)>0&&<span style={{display:"inline-flex",alignItems:"center",gap:3}}><Icon name="train" size={11}/>¥{(Number(s.transport_fixed)||0).toLocaleString()}</span>}
                  </div>
                </div>
              </div>
              <div style={{fontSize:12,fontVariantNumeric:"tabular-nums",color:C.muted}}>{s.username}</div>
              <div style={{fontSize:13,fontWeight:600,textAlign:"right",fontFamily:SERIF,fontVariantNumeric:"tabular-nums"}}>¥{s.wage?.toLocaleString()}</div>
              <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                <button onClick={()=>openEdit(s)} style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,color:C.ink,cursor:"pointer",fontFamily:SANS,display:"inline-flex"}}><Icon name="pencil" size={14}/></button>
                <button onClick={()=>setDeleteConfirm(s.id)} style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${C.accent}55`,background:DANGER_BG,cursor:"pointer",fontFamily:SANS,color:C.accent,display:"inline-flex"}}><Icon name="trash" size={14}/></button>
              </div>
            </div>
            {editId===s.id&&(
              <div style={{padding:"16px",background:C.surface2,borderBottom:i<staff.length-1?`1px solid ${C.border}`:"none",borderTop:`1px solid ${C.gold}`}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:12}}>{t("acc_editName",s.name)}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>{FField("name",t("f_name"),t("f_name"))}</div>
                  <div>{FField("username",t("col_uname"),t("col_uname"))}</div>
                  <div>{FField("password",t("password"),t("password"),"password")}</div>
                  <div>{FField("wage",t("f_wageYen"),t("f_wageYen"),"number")}</div>
            <div>{FField("transport_fixed",t("f_transport"),t("f_transportPh"),"number")}</div>
                </div>
                <div style={{marginTop:4,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.gold,display:"flex",alignItems:"center",gap:7}}><Icon name="coffee" size={15}/>{t("breakSetting")}</div>
                  <StaffBreakEditor config={form.breaks} setConfig={setBreaks} templates={templates}/>
                </div>
                <div style={{display:"flex",gap:10,marginTop:12}}>
                  <button onClick={handleUpdate} disabled={saving} style={{...PB(C.ink),flex:1}}><Icon name="save" size={15}/>{saving?t("saving"):t("save")}</button>
                  <button onClick={()=>{setEditId(null);setErrors({});}} style={{...PB("ghost"),flex:1}}>{t("cancel")}</button>
                </div>
              </div>
            )}
          </div>
        );})}
      </div>
      {deleteConfirm&&(
        <Modal onClose={()=>setDeleteConfirm(null)}>
          <div style={{fontSize:15,fontWeight:600,marginBottom:8,fontFamily:SERIF,display:"flex",alignItems:"center",gap:8}}><Icon name="trash" size={18} style={{color:C.accent}}/>{t("acc_delTitle")}</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:20}}>{t("acc_delMsg",staff.find(s=>s.id===deleteConfirm)?.name)}<br/><span style={{color:C.accent,fontSize:12}}>{t("acc_delNote")}</span></div>
          <button onClick={async()=>{setSaving(true);await deleteStaff(deleteConfirm);setDeleteConfirm(null);setSaving(false);}} disabled={saving} style={{...PB("danger"),marginBottom:8}}><Icon name="trash" size={15}/>{saving?t("deleting"):t("delete")}</button>
        </Modal>
      )}
    </div>
  );
}

function StaffRequestView({currentUser,period,getRequest,saveRequest,deleteRequest,getShiftByDate,showToast}){
  const {t}=useI18n();
  const DAYS=t.arr("daysSun");
  const [offset,setOffset]=useState(1); // default: the upcoming period
  const [modal,setModal]=useState(null);
  const [editVal,setEditVal]=useState({type:"work",start:"10:00",end:"18:00"});
  const [saving,setSaving]=useState(false);
  const dates=getPeriodDates(period,offset);
  const sid=currentUser.id;
  const periodLabel = period==="month"
    ? t("ym",dates[0].getFullYear(),dates[0].getMonth())
    : `${fmtDate(dates[0])} 〜 ${fmtDate(dates[dates.length-1])}`;
  const notSet=dates.filter(d=>!getRequest(sid,d)&&!getShiftByDate(d,sid)).length;

  function openModal(d){
    const r=getRequest(sid,d);
    setEditVal(r?{type:r.status,start:r.start_time||"10:00",end:r.end_time||"18:00"}:{type:"work",start:"10:00",end:"18:00"});
    setModal({date:d});
  }
  async function save(){
    setSaving(true);
    await saveRequest(sid,modal.date,editVal.type,editVal.start,editVal.end);
    setSaving(false); setModal(null); showToast(t("req_saved"));
  }
  async function clear(){
    setSaving(true);
    await deleteRequest(sid,modal.date);
    setSaving(false); setModal(null); showToast(t("req_cleared"));
  }

  return (
    <div>
      <SectionTitle icon="calendar" title={t("req_title")} sub={t("req_sub")}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:C.paper,border:`1px solid ${C.border}`,borderRadius:12,padding:"8px 12px"}}>
        <button onClick={()=>setOffset(o=>o-1)} style={NB}><Icon name="chevL" size={15}/></button>
        <div style={{fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums",textAlign:"center"}}>{periodLabel}{notSet>0&&<div style={{fontSize:10,color:C.accent,fontWeight:600,marginTop:1}}>{t("req_countLeft",notSet)}</div>}</div>
        <button onClick={()=>setOffset(o=>o+1)} style={NB}><Icon name="chevR" size={15}/></button>
      </div>
      <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:C.shadow,marginBottom:14}}>
        {dates.map((d,i)=>{
          const r=getRequest(sid,d), sh=getShiftByDate(d,sid);
          const isWE=d.getDay()===0||d.getDay()===6, isToday=d.toDateString()===new Date().toDateString();
          return (
            <button key={i} onClick={()=>openModal(d)} style={{width:"100%",display:"grid",gridTemplateColumns:"56px 1fr auto",gap:10,alignItems:"center",padding:"11px 14px",border:"none",borderBottom:i<dates.length-1?`1px solid ${C.border2}`:"none",background:isToday?C.surface2:i%2===0?ROW_A:ROW_B,cursor:"pointer",textAlign:"left",fontFamily:SANS}}>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <span style={{fontSize:14,fontWeight:700,color:isToday?C.gold:C.ink,fontVariantNumeric:"tabular-nums"}}>{d.getDate()}</span>
                <span style={{fontSize:11,fontWeight:600,color:isWE?C.accent:C.muted}}>{DAYS[d.getDay()]}</span>
              </div>
              <div>
                {r&&r.status==="work"&&<span style={{fontSize:12.5,fontWeight:700,color:C.gold,fontVariantNumeric:"tabular-nums"}}>{t("req_work")}: {r.start_time}〜{r.end_time}</span>}
                {r&&r.status==="off"&&<span style={{fontSize:12.5,fontWeight:700,color:C.accent}}>{t("req_off")}</span>}
                {!r&&<span style={{fontSize:12,color:FAINT}}>{t("req_none")}</span>}
                {sh&&<div style={{fontSize:10.5,color:C.green,fontWeight:700,marginTop:2,display:"inline-flex",alignItems:"center",gap:4}}><Icon name="check" size={11}/>{t("req_done")}: {sh.start_time}〜{sh.end_time}</div>}
              </div>
              <Icon name={r?"pencil":"plus"} size={15} style={{color:C.muted}}/>
            </button>
          );
        })}
      </div>
      <button onClick={()=>showToast(t("req_submitted"))} style={{...PB(C.gold),marginBottom:8}}><Icon name="check" size={16}/>{t("req_submit")}</button>
      <div style={{fontSize:11,color:C.muted,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="signal" size={12}/>{t("req_note")}</div>

      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{fontSize:15,fontWeight:600,marginBottom:3,fontFamily:SERIF}}>{t("req_setTitle")}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{t("md",modal.date.getMonth(),modal.date.getDate())}（{DAYS[modal.date.getDay()]}）</div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {[["work",t("req_typeWork"),"check"],["off",t("req_typeOff"),"coffee"]].map(([v,label,ic])=>{
              const on=editVal.type===v;
              return <button key={v} onClick={()=>setEditVal(p=>({...p,type:v}))} style={{flex:1,padding:"11px 8px",borderRadius:10,border:`2px solid ${on?C.gold:C.border}`,background:on?C.gold:"transparent",color:on?ON_GOLD:C.muted,fontFamily:SANS,fontSize:13,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7}}><Icon name={ic} size={15}/>{label}</button>;
            })}
          </div>
          {editVal.type==="work"&&(
            <div style={{display:"flex",gap:12,marginBottom:20}}>
              <label style={LS}>{t("inTime")}<select value={editVal.start} onChange={e=>setEditVal(v=>({...v,start:e.target.value}))} style={SS}>{TIME_SLOTS.map(x=><option key={x}>{x}</option>)}</select></label>
              <label style={LS}>{t("outTime")}<select value={editVal.end} onChange={e=>setEditVal(v=>({...v,end:e.target.value}))} style={SS}>{TIME_SLOTS.map(x=><option key={x}>{x}</option>)}</select></label>
            </div>
          )}
          <button onClick={save} disabled={saving} style={PB(C.ink)}><Icon name="save" size={15}/>{saving?t("saving"):t("save")}</button>
          {getRequest(sid,modal.date)&&<button onClick={clear} disabled={saving} style={{...PB("danger"),marginTop:8}}><Icon name="trash" size={15}/>{t("req_clear")}</button>}
        </Modal>
      )}
    </div>
  );
}

function SettingsView({settings,setSettings,showToast}){
  const {t}=useI18n();
  const shiftP=settings.shiftPeriod||"week";
  const reqP=settings.requestPeriod||"week";
  function set(key,p){ setSettings(s=>({...s,[key]:p})); showToast(t("set_saved")); }
  const card={background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,padding:18,boxShadow:C.shadow,marginBottom:14};
  function Seg({value,onPick,opts}){
    return (
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {opts.map(([v,label])=>{
          const on=value===v;
          return (
            <button key={v} onClick={()=>onPick(v)} style={{flex:"1 1 90px",padding:"13px 8px",borderRadius:12,border:`2px solid ${on?C.gold:C.border}`,background:on?C.gold:"transparent",color:on?ON_GOLD:C.muted,fontFamily:SANS,fontSize:13.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,whiteSpace:"nowrap"}}>
              {on&&<Icon name="check" size={15}/>}{label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <SectionTitle icon="settings" title={t("set_title")} sub={t("set_sub")}/>
      <div style={card}>
        <div style={{fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:8,fontFamily:SERIF}}><Icon name="calendar" size={16} style={{color:C.gold}}/>{t("set_shiftPeriod")}</div>
        <div style={{fontSize:11.5,color:C.muted,marginTop:4,marginBottom:14}}>{t("set_shiftPeriodSub")}</div>
        <Seg value={shiftP} onPick={p=>set("shiftPeriod",p)} opts={[["week",t("set_week")],["month",t("set_month")]]}/>
      </div>
      <div style={card}>
        <div style={{fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:8,fontFamily:SERIF}}><Icon name="pencil" size={15} style={{color:C.gold}}/>{t("set_reqPeriod")}</div>
        <div style={{fontSize:11.5,color:C.muted,marginTop:4,marginBottom:14}}>{t("set_reqPeriodSub")}</div>
        <Seg value={reqP} onPick={p=>set("requestPeriod",p)} opts={[["week",t("req_week")],["2week",t("req_2week")],["month",t("req_month")]]}/>
      </div>
    </div>
  );
}

function SectionTitle({icon,title,sub}){
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:18,fontWeight:600,fontFamily:SERIF,letterSpacing:"0.03em",display:"flex",alignItems:"center",gap:9}}>
        {icon&&<Icon name={icon} size={20} style={{color:C.gold}}/>}{title}
      </div>
      {sub&&<div style={{fontSize:11.5,color:C.muted,marginTop:3}}>{sub}</div>}
      <div style={{height:1.5,background:`linear-gradient(to right,${C.gold2},transparent 65%)`,marginTop:9,borderRadius:2,opacity:0.7}}/>
    </div>
  );
}
function WeekNav({dates,offset,setOffset}){
  const {t}=useI18n();
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:C.paper,border:`1px solid ${C.border}`,borderRadius:12,padding:"8px 12px"}}><button onClick={()=>setOffset(o=>o-1)} style={NB}><Icon name="chevL" size={15}/>{t("prevWeek")}</button><div style={{fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{fmtDate(dates[0])} 〜 {fmtDate(dates[6])}{offset===0&&<span style={{fontSize:11,color:C.gold,marginLeft:8,fontWeight:700}}>{t("thisWeek")}</span>}</div><button onClick={()=>setOffset(o=>o+1)} style={NB}>{t("nextWeek")}<Icon name="chevR" size={15}/></button></div>;
}
function WeekNavMonth({year,month,offset,setOffset}){
  const {t}=useI18n();
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:C.paper,border:`1px solid ${C.border}`,borderRadius:12,padding:"8px 12px"}}><button onClick={()=>setOffset(o=>o-1)} style={NB}><Icon name="chevL" size={15}/>{t("prevMonth")}</button><div style={{fontSize:13,fontWeight:700}}>{t("ym",year,month)}{offset===0&&<span style={{fontSize:11,color:C.gold,marginLeft:8,fontWeight:700}}>{t("thisMonth")}</span>}</div><button onClick={()=>setOffset(o=>o+1)} style={NB}>{t("nextMonth")}<Icon name="chevR" size={15}/></button></div>;
}
function Modal({children,onClose}){
  const {t}=useI18n();
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{background:C.paper,borderRadius:18,padding:24,maxWidth:420,width:"100%",boxShadow:"0 8px 40px rgba(0,0,0,0.35)",maxHeight:"90vh",overflowY:"auto",border:`1px solid ${C.border}`}}>{children}<button onClick={onClose} style={{width:"100%",padding:"10px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,fontFamily:SANS,fontSize:13,color:C.muted,cursor:"pointer",marginTop:8}}>{t("cancel")}</button></div></div>;
}
const NB={padding:"6px 12px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",fontFamily:SANS,fontSize:12,color:C.muted,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5};
const LS={display:"flex",flexDirection:"column",gap:5,fontSize:12,color:C.muted,flex:1,fontWeight:600};
const SS={padding:"9px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontFamily:SANS,fontSize:13,background:C.bg,color:C.ink};
function chip(active){
  return {padding:"7px 14px",borderRadius:20,border:`1.5px solid ${active?C.gold:C.border}`,background:active?C.gold:"transparent",color:active?ON_GOLD:C.muted,fontFamily:SANS,fontSize:12,cursor:"pointer",fontWeight:600};
}
// PB: "danger"=delete, "ghost"=cancel, otherwise pass a background color
function PB(kind){
  const base={width:"100%",padding:"12px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:SANS,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8};
  if(kind==="danger") return {...base,background:DANGER_BG,color:C.accent,border:`1px solid ${C.accent}`};
  if(kind==="ghost")  return {...base,background:C.bg,color:C.muted,border:`1px solid ${C.border}`};
  const onGoldBgs=[C.gold,C.gold2];
  let color;
  if(onGoldBgs.includes(kind)) color=ON_GOLD;
  else if(kind===C.ink) color=INK_TEXT;   // ink button: dark text on dark theme, light text on light theme
  else color=ON_DARK;
  return {...base,background:kind,color,border:"none"};
}
