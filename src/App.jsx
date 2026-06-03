import { useState, useEffect, useCallback } from "react";
import CONFIG from "@config";
import { createClient } from "@supabase/supabase-js";

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
const DAYS_JP = ["月","火","水","木","金","土","日"];
const STORE_LAT = CONFIG.storeLat, STORE_LNG = CONFIG.storeLng, STORE_RADIUS_M = CONFIG.storeRadiusM;

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
// ボタン等の上に乗る文字色（明るいテーマなら白、暗いテーマなら明色inkでも可）。inkの上に置く文字は反転色。
const ON_DARK = "#fffaf3";          // C.ink（濃色）ボタンの上の文字
const ON_GOLD = "#0a0a0a";          // gold/gold2ボタンの上の文字
// 行縞・微妙な背景
const ROW_A = C.paper;
const ROW_B = C.bg;
const HEAD_BG = C.surface2;
const HEAD_FG = C.muted;
const SUBTLE = C.surface2;          // アバター背景など
const FAINT = C.muted;              // 薄い文字（旧 #cbd5e1 等）
// 判定バッジ（両テーマで視認できるトーン）
const VD = {
  holiday:  {bg:C.surface2, color:C.muted},
  out:      {bg:C.blueBg,   color:C.blue},
  absent:   {bg:"#fde8e6",  color:C.accent},
  working:  {bg:C.greenBg,  color:C.green},
  late:     {bg:"#fff4d6",  color:"#b8860b"},
  early:    {bg:"#efe6ff",  color:"#7c5fd8"},
  lateEarly:{bg:"#fde8e6",  color:C.accent},
  normal:   {bg:C.greenBg,  color:C.green},
};
const isDarkTheme = (CONFIG.theme.bg||"").toLowerCase().match(/^#0|^#1/) ? true : false;
// ダークテーマ用にバッジ背景を上書き
if(isDarkTheme){
  VD.holiday={bg:"#161616",color:"#777"};
  VD.absent={bg:"#2a0d0d",color:C.accent};
  VD.late={bg:"#1a1400",color:C.gold};
  VD.early={bg:"#140d2a",color:"#9b7fe8"};
  VD.lateEarly={bg:"#2a0d0d",color:C.accent};
  VD.out={bg:"#0d1a2a",color:C.blue};
}

function getWeekDates(offset=0){
  const today=new Date(), mon=new Date(today);
  mon.setDate(today.getDate()-((today.getDay()+6)%7)+offset*7);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
}
function toDateStr(d){ return d.toISOString().split("T")[0]; }
function fmtDate(d){ return `${d.getMonth()+1}/${d.getDate()}`; }
function fmtHM(ts){ if(!ts) return "──"; const d=new Date(ts); return d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}); }
function fmtHMS(d){ return d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
function toMin(hhmm){ const[h,m]=hhmm.split(":").map(Number); return h*60+m; }
function minToHM(m){ const h=Math.floor(m/60), mm=m%60; return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`; }
function nameToAvatar(name){ return name.trim().charAt(0); }

function parseBreaks(raw){
  if(!raw) return [];
  try{ const a=typeof raw==="string"?JSON.parse(raw):raw; return Array.isArray(a)?a.filter(x=>Array.isArray(x)&&x.length===2):[]; }
  catch{ return []; }
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

export default function App(){
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("punch");
  const [now, setNow] = useState(new Date());
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);

  const loadAll = useCallback(async()=>{
    setLoading(true);
    const [s,sh,at,tp] = await Promise.all([
      supabase.from("staff").select("*").order("id"),
      supabase.from("shifts").select("*"),
      supabase.from("attendance").select("*"),
      supabase.from("break_templates").select("*").order("id"),
    ]);
    if(s.data) setStaff(s.data);
    if(sh.data) setShifts(sh.data);
    if(at.data) setAttendance(at.data);
    if(tp.data) setTemplates(tp.data);
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
    showToast("📅 シフトを保存しました");
  }
  async function deleteShift(staffId,date){
    const ds=toDateStr(date);
    const existing=shifts.find(s=>s.staff_id===staffId&&s.date===ds);
    if(!existing) return;
    await supabase.from("shifts").delete().eq("id",existing.id);
    setShifts(p=>p.filter(s=>s.id!==existing.id));
    showToast("🗑 シフトを削除しました");
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
    showToast("🍜 出勤打刻しました！");
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
    showToast("👋 退勤打刻しました！");
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

  async function addStaff(name,username,password,wage,breaks){
    const {data}=await supabase.from("staff").insert({name,username,password,wage,breaks:JSON.stringify(breaks||[])}).select().single();
    if(data){ setStaff(p=>[...p,data]); showToast(`✅ ${name} のアカウントを発行しました`); }
  }
  async function deleteStaff(id){
    await supabase.from("staff").delete().eq("id",id);
    setStaff(p=>p.filter(s=>s.id!==id));
    showToast("🗑 アカウントを削除しました");
  }
  async function updateStaff(id,fields){
    const payload={...fields};
    if(payload.breaks!==undefined) payload.breaks=JSON.stringify(payload.breaks||[]);
    const {data}=await supabase.from("staff").update(payload).eq("id",id).select().single();
    if(data){ setStaff(p=>p.map(s=>s.id===id?data:s)); showToast("✅ アカウントを更新しました"); }
  }

  async function addTemplate(name,breaks){
    const {data}=await supabase.from("break_templates").insert({name,breaks:JSON.stringify(breaks||[])}).select().single();
    if(data){ setTemplates(p=>[...p,data]); showToast(`✅ テンプレ「${name}」を作成しました`); }
  }
  async function updateTemplate(id,name,breaks){
    const {data}=await supabase.from("break_templates").update({name,breaks:JSON.stringify(breaks||[])}).eq("id",id).select().single();
    if(data){ setTemplates(p=>p.map(t=>t.id===id?data:t)); showToast("✅ テンプレを更新しました"); }
  }
  async function deleteTemplate(id){
    await supabase.from("break_templates").delete().eq("id",id);
    setTemplates(p=>p.filter(t=>t.id!==id));
    showToast("🗑 テンプレを削除しました");
  }

  if(loading && staff.length===0){
    return (
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
        {CONFIG.logoBase64
          ? <img src={CONFIG.logoBase64} alt={CONFIG.brandName} style={{width:48,height:48,objectFit:"contain"}}/>
          : <div style={{fontSize:36}}>{CONFIG.emoji}</div>
        }
        <div style={{fontSize:14,color:C.muted}}>読み込み中...</div>
      </div>
    );
  }

  if(!currentUser && !isAdmin){
    return <LoginPage onSuccess={handleLoginSuccess} staff={staff}/>;
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Serif JP','Hiragino Mincho ProN',serif",color:C.ink}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&display=swap" rel="stylesheet"/>
      <header style={{background:C.paper,color:C.ink,padding:"14px 18px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:C.shadow}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {CONFIG.logoBase64
            ? <img src={CONFIG.logoBase64} alt={CONFIG.brandName} style={{width:36,height:36,objectFit:"contain",borderRadius:6}}/>
            : <span style={{fontSize:22}}>{CONFIG.emoji}</span>
          }
          <div>
            <div style={{fontSize:14,fontWeight:700,letterSpacing:"0.08em"}}>勤怠管理システム</div>
            <div style={{fontSize:10,color:C.gold,letterSpacing:"0.12em"}}>{isAdmin?"管理者モード":CONFIG.brandName}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:16,fontWeight:700,fontVariantNumeric:"tabular-nums",color:C.gold,letterSpacing:"0.05em"}}>{fmtHMS(now)}</div>
            {!isAdmin&&<div style={{fontSize:10,color:C.muted}}>{currentUser?.name}</div>}
          </div>
          <button onClick={handleLogout} style={{padding:"6px 12px",borderRadius:16,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>🔒 ログアウト</button>
        </div>
      </header>

      {isAdmin?(
        <AdminLayout tab={tab} setTab={setTab} staff={staff} shifts={shifts}
          getShiftByDate={getShiftByDate} saveShift={saveShift} deleteShift={deleteShift}
          attendance={attendance} getAtt={getAtt} punchIn={punchIn} punchOut={punchOut}
          editAttendance={editAttendance} clearAttendanceDay={clearAttendanceDay}
          addStaff={addStaff} deleteStaff={deleteStaff} updateStaff={updateStaff}
          templates={templates} addTemplate={addTemplate} updateTemplate={updateTemplate} deleteTemplate={deleteTemplate}
          showToast={showToast} now={now}/>
      ):(
        <UserLayout tab={tab} setTab={setTab} currentUser={currentUser} now={now}
          getAtt={getAtt} punchIn={punchIn} punchOut={punchOut}
          getShiftByDate={getShiftByDate} attendance={attendance}/>
      )}

      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="ok"?C.ink:C.accent,color:ON_DARK,padding:"11px 26px",borderRadius:32,fontSize:13,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,0.28)",zIndex:999,whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function LoginPage({onSuccess,staff}){
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
    setError(next>=5?"試行回数が上限に達しました。ページを再読み込みしてください。":`ユーザー名またはパスワードが違います（${next}回失敗）`);
    setPassword("");
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Noto Serif JP','Hiragino Mincho ProN',serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&display=swap" rel="stylesheet"/>
      <div style={{marginBottom:28,textAlign:"center"}}>
        {CONFIG.logoWideBase64
          ? <img src={CONFIG.logoWideBase64} alt={CONFIG.brandName} style={{maxWidth:200,height:"auto",objectFit:"contain",marginBottom:12}}/>
          : CONFIG.logoBase64
            ? <img src={CONFIG.logoBase64} alt={CONFIG.brandName} style={{width:64,height:64,objectFit:"contain",marginBottom:8}}/>
            : <div style={{fontSize:42,marginBottom:8}}>{CONFIG.emoji}</div>
        }
        <div style={{fontSize:20,fontWeight:700,color:C.ink,letterSpacing:"0.08em"}}>勤怠管理システム</div>
        <div style={{fontSize:11,color:C.gold,letterSpacing:"0.14em",marginTop:3}}>{CONFIG.brandName}</div>
      </div>
      <div style={{background:C.paper,borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:360,boxShadow:C.shadow}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:20}}>ログイン</div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5}}>ユーザー名</label>
          <input type="text" value={username} onChange={e=>{setUsername(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&document.getElementById("pw-input").focus()}
            placeholder="例: tanaka / admin" disabled={locked}
            style={{width:"100%",padding:"11px 12px",borderRadius:10,border:`1.5px solid ${error?C.accent:C.border}`,background:C.bg,fontFamily:"inherit",fontSize:14,color:C.ink,outline:"none",boxSizing:"border-box",caretColor:C.gold,WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5}}>パスワード</label>
          <div style={{position:"relative"}}>
            <input id="pw-input" type={showPw?"text":"password"} value={password}
              onChange={e=>{setPassword(e.target.value);setError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              placeholder="パスワード" disabled={locked}
              style={{width:"100%",padding:"11px 40px 11px 12px",borderRadius:10,border:`1.5px solid ${error?C.accent:C.border}`,background:C.bg,fontFamily:"inherit",fontSize:14,color:C.ink,outline:"none",boxSizing:"border-box",caretColor:C.gold,WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
            <button onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:C.muted}}>{showPw?"🙈":"👁"}</button>
          </div>
        </div>
        {error&&<div style={{fontSize:12,color:C.accent,fontWeight:600,marginBottom:14,padding:"8px 12px",background:isDarkTheme?"#2a0d0d":"#fde8e6",borderRadius:8}}>{locked?"🚫 ":"❌ "}{error}</div>}
        <button onClick={handleLogin} disabled={!username||!password||locked}
          style={{width:"100%",padding:13,borderRadius:10,border:"none",background:!username||!password||locked?C.surface2:C.gold,color:!username||!password||locked?C.muted:ON_GOLD,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:!username||!password||locked?"not-allowed":"pointer"}}>
          ログイン
        </button>
      </div>
    </div>
  );
}

function UserLayout({tab,setTab,currentUser,now,getAtt,punchIn,punchOut,getShiftByDate,attendance}){
  const tabStyle=(active)=>({flex:1,padding:"11px 4px 9px",border:"none",cursor:"pointer",background:active?C.paper:"transparent",borderBottom:active?`3px solid ${C.accent}`:"3px solid transparent",color:active?C.accent:C.muted,fontFamily:"inherit",fontSize:11,fontWeight:active?700:400});
  return (
    <>
      <nav style={{display:"flex",background:C.surface2,borderBottom:`2px solid ${C.border}`}}>
        <button onClick={()=>setTab("punch")} style={tabStyle(tab==="punch")}><div style={{fontSize:16}}>⏱</div>打刻</button>
        <button onClick={()=>setTab("record")} style={tabStyle(tab==="record")}><div style={{fontSize:16}}>📊</div>勤務実績</button>
      </nav>
      <main style={{maxWidth:820,margin:"0 auto",padding:"18px 14px 60px"}}>
        {tab==="punch" && <PunchView staff={[currentUser]} now={now} getAtt={getAtt} punchIn={punchIn} punchOut={punchOut} getShiftByDate={getShiftByDate} singleUser={true}/>}
        {tab==="record" && <MyRecordView currentUser={currentUser} getAtt={getAtt} getShiftByDate={getShiftByDate} attendance={attendance}/>}
      </main>
    </>
  );
}

function AdminLayout({tab,setTab,staff,getShiftByDate,saveShift,deleteShift,attendance,getAtt,punchIn,punchOut,editAttendance,clearAttendanceDay,addStaff,deleteStaff,updateStaff,templates,addTemplate,updateTemplate,deleteTemplate,showToast,now}){
  const TABS=[
    {id:"shift",icon:"📅",label:"シフト入力"},
    {id:"punch",icon:"⏱",label:"打刻"},
    {id:"compare",icon:"🔍",label:"照合"},
    {id:"edit",icon:"✏️",label:"勤怠修正"},
    {id:"wage",icon:"💴",label:"時給設定"},
    {id:"breaks",icon:"☕",label:"休憩テンプレ"},
    {id:"accounts",icon:"👤",label:"アカウント"},
  ];
  const tabStyle=(active)=>({flex:1,padding:"10px 2px 8px",border:"none",cursor:"pointer",background:active?C.paper:"transparent",borderBottom:active?`3px solid ${C.accent}`:"3px solid transparent",color:active?C.accent:C.muted,fontFamily:"inherit",fontSize:10,fontWeight:active?700:400,whiteSpace:"nowrap"});
  return (
    <>
      <nav style={{display:"flex",background:C.surface2,borderBottom:`2px solid ${C.border}`,overflowX:"auto"}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={tabStyle(tab===t.id)}><div style={{fontSize:14}}>{t.icon}</div>{t.label}</button>)}
      </nav>
      <main style={{maxWidth:900,margin:"0 auto",padding:"18px 14px 60px"}}>
        {tab==="shift"    && <ShiftInputView staff={staff} getShiftByDate={getShiftByDate} saveShift={saveShift} deleteShift={deleteShift}/>}
        {tab==="punch"    && <PunchView staff={staff} now={now} getAtt={getAtt} punchIn={punchIn} punchOut={punchOut} getShiftByDate={getShiftByDate} singleUser={false}/>}
        {tab==="compare"  && <CompareView staff={staff} attendance={attendance} getShiftByDate={getShiftByDate} getAtt={getAtt}/>}
        {tab==="edit"     && <AttendanceEditView staff={staff} attendance={attendance} editAttendance={editAttendance} clearAttendanceDay={clearAttendanceDay} showToast={showToast} getShiftByDate={getShiftByDate}/>}
        {tab==="wage"     && <WageView staff={staff} attendance={attendance} getShiftByDate={getShiftByDate} updateStaff={updateStaff} showToast={showToast}/>}
        {tab==="breaks"   && <BreakTemplateView templates={templates} addTemplate={addTemplate} updateTemplate={updateTemplate} deleteTemplate={deleteTemplate}/>}
        {tab==="accounts" && <AccountsView staff={staff} addStaff={addStaff} deleteStaff={deleteStaff} updateStaff={updateStaff} templates={templates}/>}
      </main>
    </>
  );
}

function verdictOf(sh,att){
  if(!sh&&!att?.clock_in) return {label:"休日",...VD.holiday};
  if(!sh&& att?.clock_in) return {label:"シフト外",...VD.out};
  if( sh&&!att?.clock_in) return {label:"欠勤",...VD.absent};
  if(!att?.clock_out)     return {label:"勤務中",...VD.working};
  const aIn=new Date(att.clock_in),aOut=new Date(att.clock_out);
  const aInM=aIn.getHours()*60+aIn.getMinutes(),aOutM=aOut.getHours()*60+aOut.getMinutes();
  const late=aInM>toMin(sh.start_time)+5,early=aOutM<toMin(sh.end_time)-5;
  if(late&&early) return {label:"遅刻・早退",...VD.lateEarly};
  if(late)        return {label:"遅刻",...VD.late};
  if(early)       return {label:"早退",...VD.early};
  return              {label:"正常",...VD.normal};
}

function MonthTable({staff:s,getShiftByDate,getAtt,year,month,monthDates,today}){
  const DAYS_JA=["日","月","火","水","木","金","土"];
  const monthTotal=monthDates.reduce((acc,d)=>{
    const sh=getShiftByDate(d,s.id),att=getAtt(s.id,d);
    const mins=sh&&att?.clock_in&&att?.clock_out?calcBillableMinutes(sh.start_time,sh.end_time,att.clock_in,att.clock_out,s.breaks):0;
    return {mins:acc.mins+mins,pay:acc.pay+Math.floor(mins/60*(s.wage||0))};
  },{mins:0,pay:0});
  return (
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[["出勤日数",`${monthDates.filter(d=>{const a=getAtt(s.id,d);return a?.clock_in&&a?.clock_out;}).length}日`,C.green],["総勤務時間",`${Math.floor(monthTotal.mins/60)}h${monthTotal.mins%60}m`,C.ink],["合計給与",`¥${monthTotal.pay.toLocaleString()}`,C.accent]].map(([label,val,color])=>(
          <div key={label} style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:3}}>{label}</div>
            <div style={{fontSize:16,fontWeight:700,color}}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",background:C.paper,borderRadius:14,overflow:"hidden",boxShadow:C.shadow,fontSize:12,minWidth:440}}>
          <thead><tr style={{background:HEAD_BG,color:HEAD_FG}}>
            {["日付","曜","シフト","出勤","退勤","実働","判定"].map(h=><th key={h} style={{padding:"9px 6px",textAlign:"center",fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {monthDates.map((d,i)=>{
              const sh=getShiftByDate(d,s.id),att=getAtt(s.id,d),vd=verdictOf(sh,att);
              const mins=sh&&att?.clock_in&&att?.clock_out?calcBillableMinutes(sh.start_time,sh.end_time,att.clock_in,att.clock_out,s.breaks):0;
              const isWE=d.getDay()===0||d.getDay()===6,isToday=d.toDateString()===today.toDateString();
              return (
                <tr key={i} style={{borderBottom:`1px solid ${C.border2}`,background:isToday?C.surface2:i%2===0?ROW_A:ROW_B}}>
                  <td style={{padding:"7px 6px",textAlign:"center",fontWeight:isToday?700:400,color:isToday?C.gold:C.ink,whiteSpace:"nowrap"}}>{month+1}/{d.getDate()}{isToday&&" ✦"}</td>
                  <td style={{padding:"7px 4px",textAlign:"center",color:isWE?C.accent:C.muted,fontWeight:600}}>{DAYS_JA[d.getDay()]}</td>
                  <td style={{padding:"7px 6px",textAlign:"center",color:sh?C.green:FAINT,whiteSpace:"nowrap"}}>{sh?`${sh.start_time}〜${sh.end_time}`:"──"}</td>
                  <td style={{padding:"7px 6px",textAlign:"center"}}>{att?.clock_in?<span style={{color:C.blue}}>{fmtHM(att.clock_in)}</span>:<span style={{color:FAINT}}>──</span>}</td>
                  <td style={{padding:"7px 6px",textAlign:"center"}}>{att?.clock_out?<span style={{color:C.accent}}>{fmtHM(att.clock_out)}</span>:<span style={{color:FAINT}}>──</span>}</td>
                  <td style={{padding:"7px 6px",textAlign:"center",fontWeight:700,color:mins>0?C.ink:FAINT}}>{mins>0?`${Math.floor(mins/60)}h${mins%60}m`:"──"}</td>
                  <td style={{padding:"7px 6px",textAlign:"center"}}><span style={{fontSize:10,padding:"2px 6px",borderRadius:8,background:vd.bg,color:vd.color,fontWeight:700,whiteSpace:"nowrap"}}>{vd.label}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr style={{background:HEAD_BG,color:HEAD_FG}}>
            <td colSpan={5} style={{padding:"10px 12px",fontWeight:700,fontSize:12}}>月合計</td>
            <td style={{padding:"10px 6px",textAlign:"center",color:C.gold,fontWeight:700}}>{Math.floor(monthTotal.mins/60)}h{monthTotal.mins%60}m</td>
            <td style={{padding:"10px 6px",textAlign:"center",color:C.gold,fontWeight:700}}>¥{monthTotal.pay.toLocaleString()}</td>
          </tr></tfoot>
        </table>
      </div>
    </>
  );
}

function MyRecordView({currentUser,getAtt,getShiftByDate}){
  const [moOffset,setMoOffset]=useState(0);
  const today=new Date();
  const base=new Date(today.getFullYear(),today.getMonth()+moOffset,1);
  const year=base.getFullYear(),month=base.getMonth();
  const monthDates=Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>new Date(year,month,i+1));
  const s=currentUser;
  const brkTotal=breaksTotalMin(parseBreaks(s.breaks));
  return (
    <div>
      <SectionTitle icon="📊" title="勤務実績" sub={`自分のシフトと打刻の記録（休憩計${brkTotal}分）`}/>
      <WeekNavMonth year={year} month={month} offset={moOffset} setOffset={setMoOffset}/>
      <MonthTable staff={s} getShiftByDate={getShiftByDate} getAtt={getAtt} year={year} month={month} monthDates={monthDates} today={today}/>
    </div>
  );
}

function ShiftInputView({staff,getShiftByDate,saveShift,deleteShift}){
  const [weekOffset,setWeekOffset]=useState(0);
  const [modal,setModal]=useState(null);
  const [editVal,setEditVal]=useState({start:"10:00",end:"18:00"});
  const [saving,setSaving]=useState(false);
  const dates=getWeekDates(weekOffset);

  function openModal(staffId,dayIdx){
    const sh=getShiftByDate(dates[dayIdx],staffId);
    setEditVal(sh?{start:sh.start_time,end:sh.end_time}:{start:"10:00",end:"18:00"});
    setModal({staffId,dayIdx});
  }
  async function save(){
    setSaving(true);
    await saveShift(modal.staffId,dates[modal.dayIdx],editVal.start,editVal.end);
    setSaving(false); setModal(null);
  }
  async function remove(){
    setSaving(true);
    await deleteShift(modal.staffId,dates[modal.dayIdx]);
    setSaving(false); setModal(null);
  }

  return (
    <div>
      <SectionTitle icon="📅" title="シフト入力" sub="週ごとにスタッフのシフトを入力してください"/>
      <WeekNav dates={dates} offset={weekOffset} setOffset={setWeekOffset}/>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",background:C.paper,borderRadius:14,overflow:"hidden",boxShadow:C.shadow,fontSize:12,minWidth:560}}>
          <thead><tr style={{background:HEAD_BG,color:HEAD_FG}}>
            <th style={{padding:"10px 12px",textAlign:"left",width:88}}>スタッフ</th>
            {dates.map((d,i)=><th key={i} style={{padding:"10px 6px",textAlign:"center",color:i>=5?C.gold:HEAD_FG,minWidth:70}}><div>{DAYS_JP[i]}</div><div style={{fontSize:10,opacity:0.7}}>{fmtDate(d)}</div></th>)}
          </tr></thead>
          <tbody>
            {staff.map((s,si)=>(
              <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`,background:si%2===0?ROW_A:ROW_B}}>
                <td style={{padding:"10px",fontWeight:700}}>
                  <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:"50%",background:SUBTLE,color:C.muted,fontSize:11,fontWeight:700,marginRight:5}}>{nameToAvatar(s.name)}</span>
                  {s.name.split(" ")[0]}
                </td>
                {dates.map((_,dayIdx)=>{
                  const sh=getShiftByDate(dates[dayIdx],s.id);
                  return (
                    <td key={dayIdx} style={{padding:"5px 4px",textAlign:"center"}}>
                      {sh?(
                        <button onClick={()=>openModal(s.id,dayIdx)} style={{width:"100%",padding:"5px 2px",borderRadius:8,border:`1px solid ${C.greenBorder}`,background:C.greenBg,color:C.green,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",lineHeight:1.5}}>
                          {sh.start_time}<br/>〜{sh.end_time}
                        </button>
                      ):(
                        <button onClick={()=>openModal(s.id,dayIdx)} style={{width:"100%",padding:"13px 0",border:`1.5px dashed ${C.border}`,borderRadius:8,background:"transparent",color:C.muted,fontSize:18,cursor:"pointer"}}>+</button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:3}}>{staff.find(s=>s.id===modal.staffId)?.name}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:18}}>{DAYS_JP[modal.dayIdx]}曜日（{fmtDate(dates[modal.dayIdx])}）</div>
          <div style={{display:"flex",gap:12,marginBottom:20}}>
            <label style={LS}>出勤時刻<select value={editVal.start} onChange={e=>setEditVal(v=>({...v,start:e.target.value}))} style={SS}>{TIME_SLOTS.map(t=><option key={t}>{t}</option>)}</select></label>
            <label style={LS}>退勤時刻<select value={editVal.end} onChange={e=>setEditVal(v=>({...v,end:e.target.value}))} style={SS}>{TIME_SLOTS.map(t=><option key={t}>{t}</option>)}</select></label>
          </div>
          <button onClick={save} disabled={saving} style={PB(C.ink)}>{saving?"保存中...":"💾 保存する"}</button>
          {getShiftByDate(dates[modal.dayIdx],modal.staffId)&&<button onClick={remove} disabled={saving} style={{...PB("danger"),marginTop:8}}>🗑 削除する</button>}
        </Modal>
      )}
    </div>
  );
}

function PunchView({staff,now,getAtt,punchIn,punchOut,getShiftByDate,singleUser}){
  const [selected,setSelected]=useState(singleUser?staff[0]:null);
  const [gps,setGps]=useState("idle");
  const [gpsMsg,setGpsMsg]=useState("");
  const [punching,setPunching]=useState(false);
  const today=new Date();
  const att=selected?getAtt(selected.id,today):null;
  const shift=selected?getShiftByDate(today,selected.id):null;
  const status=!att?.clock_in?"absent":!att?.clock_out?"working":"done";

  async function handlePunch(type, skipGps=false){
    if(skipGps){
      setPunching(true);
      type==="in"?await punchIn(selected.id):await punchOut(selected.id);
      setPunching(false);
      return;
    }
    setGps("checking"); setGpsMsg("位置情報を確認中...");
    if(!navigator.geolocation){ setGps("error"); setGpsMsg("GPSに対応していません"); return; }
    navigator.geolocation.getCurrentPosition(
      async pos=>{
        const dist=calcDistanceM(pos.coords.latitude,pos.coords.longitude,STORE_LAT,STORE_LNG);
        if(dist<=STORE_RADIUS_M){
          setGps("ok"); setGpsMsg(`店舗から約${Math.round(dist)}m — 打刻OK`);
          setPunching(true);
          type==="in"?await punchIn(selected.id):await punchOut(selected.id);
          setPunching(false);
        } else { setGps("error"); setGpsMsg(`店舗から約${Math.round(dist)}m離れています（許容: ${STORE_RADIUS_M}m以内）`); }
      },
      ()=>{ setGps("denied"); setGpsMsg("位置情報が拒否されました。"); },
      {enableHighAccuracy:true,timeout:10000}
    );
  }

  const SL={absent:"未出勤",working:"勤務中",done:"退勤済"};
  const SC={absent:C.muted,working:C.green,done:C.blue};
  const SB={absent:C.surface2,working:C.greenBg,done:C.blueBg};
  const canIn=!att?.clock_in&&gps!=="checking"&&!punching;
  const canOut=att?.clock_in&&!att?.clock_out&&gps!=="checking"&&!punching;

  return (
    <div>
      <SectionTitle icon="⏱" title="出退勤 打刻" sub={singleUser?"打刻ボタンを押してください":"スタッフを選んで打刻してください"}/>
      {!singleUser&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(118px,1fr))",gap:10,marginBottom:22}}>
          {staff.map(s=>{
            const a=getAtt(s.id,today),st=!a?.clock_in?"absent":!a?.clock_out?"working":"done",isSel=selected?.id===s.id;
            return (
              <button key={s.id} onClick={()=>{setSelected(s);setGps("idle");setGpsMsg("");}} style={{background:isSel?C.gold:C.paper,border:`2px solid ${isSel?C.gold:C.border}`,borderRadius:14,padding:"12px 8px",cursor:"pointer",textAlign:"center",boxShadow:C.shadow}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:isSel?ON_GOLD:SUBTLE,color:isSel?C.gold:C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,margin:"0 auto 7px"}}>{nameToAvatar(s.name)}</div>
                <div style={{fontSize:12,fontWeight:700,color:isSel?ON_GOLD:C.ink,marginBottom:5}}>{s.name.split(" ")[0]}</div>
                <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:SB[st],color:SC[st],fontWeight:700}}>{SL[st]}</span>
              </button>
            );
          })}
        </div>
      )}
      {selected&&(
        <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:16,padding:20,boxShadow:C.shadow}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div style={{width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.gold2})`,color:ON_GOLD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700}}>{nameToAvatar(selected.name)}</div>
            <div>
              <div style={{fontSize:17,fontWeight:700}}>{selected.name}</div>
              {shift&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>シフト: {shift.start_time} 〜 {shift.end_time}</div>}
            </div>
            <span style={{marginLeft:"auto",fontSize:11,padding:"4px 12px",borderRadius:20,background:SB[status],color:SC[status],fontWeight:700}}>{SL[status]}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[["出勤","🟢",att?.clock_in],["退勤","🔵",att?.clock_out]].map(([label,icon,ts])=>(
              <div key={label} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{icon} {label}時刻</div>
                <div style={{fontSize:19,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{ts?fmtHM(ts):"──"}</div>
              </div>
            ))}
          </div>
          {gps!=="idle"&&<div style={{marginBottom:14,padding:"9px 14px",borderRadius:10,fontSize:12,fontWeight:600,background:gps==="ok"?C.greenBg:gps==="checking"?C.surface2:(isDarkTheme?"#2a0d0d":"#fde8e6"),color:gps==="ok"?C.green:gps==="checking"?C.gold:C.accent,display:"flex",alignItems:"center",gap:8}}><span>{gps==="checking"?"📡":gps==="ok"?"📍":"🚫"}</span>{gpsMsg}</div>}
          <div style={{display:"flex",gap:10}}>
            <button disabled={!canIn} onClick={()=>handlePunch("in",!singleUser)} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:canIn?C.green:C.surface2,color:canIn?ON_DARK:C.muted,fontSize:13,fontWeight:700,cursor:canIn?"pointer":"not-allowed",fontFamily:"inherit"}}>🟢 出勤打刻</button>
            <button disabled={!canOut} onClick={()=>handlePunch("out",!singleUser)} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:canOut?C.blue:C.surface2,color:canOut?ON_DARK:C.muted,fontSize:13,fontWeight:700,cursor:canOut?"pointer":"not-allowed",fontFamily:"inherit"}}>🔵 退勤打刻</button>
          </div>
          {singleUser&&<div style={{marginTop:8,textAlign:"center",fontSize:11,color:C.muted}}>🔒 {CONFIG.storeAddress}から{STORE_RADIUS_M}m以内の位置情報が必要です</div>}
          {!singleUser&&<div style={{marginTop:8,textAlign:"center",fontSize:11,color:C.gold}}>⚡ 管理者モード：位置情報チェックなし</div>}
        </div>
      )}
      {!singleUser&&(
        <div style={{marginTop:24}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:10}}>📋 本日の出勤状況</div>
          <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            {staff.map((s,i)=>{
              const a=getAtt(s.id,today),st=!a?.clock_in?"absent":!a?.clock_out?"working":"done";
              const SL2={absent:"未出勤",working:"勤務中",done:"退勤済"};
              const SC2={absent:C.muted,working:C.green,done:C.blue};
              const SB2={absent:C.surface2,working:C.greenBg,done:C.blueBg};
              return (
                <div key={s.id} style={{display:"flex",alignItems:"center",padding:"10px 14px",gap:10,borderBottom:i<staff.length-1?`1px solid ${C.border}`:"none"}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:SUBTLE,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>{nameToAvatar(s.name)}</div>
                  <div style={{flex:1,fontSize:13,fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:11,color:C.muted,textAlign:"right",minWidth:100}}>
                    {a?.clock_in&&<div>出勤 {fmtHM(a.clock_in)}</div>}
                    {a?.clock_out&&<div>退勤 {fmtHM(a.clock_out)}</div>}
                    {!a?.clock_in&&<div style={{color:FAINT}}>未出勤</div>}
                  </div>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:SB2[st],color:SC2[st],fontWeight:700,minWidth:44,textAlign:"center"}}>{SL2[st]}</span>
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
  const [selStaff,setSelStaff]=useState(staff[0]);
  const [moOffset,setMoOffset]=useState(0);
  const today=new Date();
  const base=new Date(today.getFullYear(),today.getMonth()+moOffset,1);
  const year=base.getFullYear(),month=base.getMonth();
  const monthDates=Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>new Date(year,month,i+1));
  if(!selStaff) return null;
  const brkTotal=breaksTotalMin(parseBreaks(selStaff.breaks));
  return (
    <div>
      <SectionTitle icon="🔍" title="シフト照合" sub="シフト予定と実際の出退勤を比較します"/>
      <WeekNavMonth year={year} month={month} offset={moOffset} setOffset={setMoOffset}/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {staff.map(s=><button key={s.id} onClick={()=>setSelStaff(s)} style={chip(selStaff.id===s.id)}>{nameToAvatar(s.name)} {s.name}</button>)}
      </div>
      <div style={{fontSize:11,color:C.muted,marginBottom:10}}>休憩: <span style={{color:C.gold,fontWeight:700}}>計{brkTotal}分</span></div>
      <MonthTable staff={selStaff} getShiftByDate={getShiftByDate} getAtt={getAtt} year={year} month={month} monthDates={monthDates} today={today}/>
    </div>
  );
}

function AttendanceEditView({staff,attendance,editAttendance,clearAttendanceDay,showToast,getShiftByDate}){
  const [selStaff,setSelStaff]=useState(staff[0]);
  const [moOffset,setMoOffset]=useState(0);
  const [editModal,setEditModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const today=new Date();
  const base=new Date(today.getFullYear(),today.getMonth()+moOffset,1);
  const year=base.getFullYear(),month=base.getMonth();
  const monthDates=Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>new Date(year,month,i+1));
  const DAYS_JA=["日","月","火","水","木","金","土"];

  function getAttD(date){ return attendance.find(a=>a.staff_id===selStaff?.id&&a.date===toDateStr(date))||null; }

  function openEdit(d){
    const att=getAttD(d);
    setEditModal({
      dateStr:toDateStr(d),
      dateLabel:`${month+1}/${d.getDate()}（${DAYS_JA[d.getDay()]}）`,
      inVal:att?.clock_in?new Date(att.clock_in).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}):"",
      outVal:att?.clock_out?new Date(att.clock_out).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}):"",
    });
  }
  async function saveEdit(){
    setSaving(true);
    await editAttendance(selStaff.id,editModal.dateStr,"in",editModal.inVal||null);
    await editAttendance(selStaff.id,editModal.dateStr,"out",editModal.outVal||null);
    setSaving(false); setEditModal(null); showToast("✏️ 勤怠を修正しました");
  }
  async function deleteDay(){
    setSaving(true);
    await clearAttendanceDay(selStaff.id,editModal.dateStr);
    setSaving(false); setEditModal(null); showToast("🗑 打刻記録を削除しました");
  }

  if(!selStaff) return null;
  return (
    <div>
      <SectionTitle icon="✏️" title="勤怠修正" sub="スタッフの出退勤時刻を手動で変更・追加・削除できます"/>
      <WeekNavMonth year={year} month={month} offset={moOffset} setOffset={setMoOffset}/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {staff.map(s=><button key={s.id} onClick={()=>setSelStaff(s)} style={chip(selStaff.id===s.id)}>{nameToAvatar(s.name)} {s.name}</button>)}
      </div>
      <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:C.shadow}}>
        <div style={{background:HEAD_BG,padding:"9px 14px",display:"grid",gridTemplateColumns:"60px 30px 90px 80px 80px 60px",gap:8,fontSize:11,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`}}>
          <span>日付</span><span>曜</span><span>シフト</span><span>出勤</span><span>退勤</span><span style={{textAlign:"center"}}>修正</span>
        </div>
        {monthDates.map((d,i)=>{
          const att=getAttD(d),sh=getShiftByDate(d,selStaff.id);
          const isWE=d.getDay()===0||d.getDay()===6,isToday=d.toDateString()===today.toDateString();
          const hasRecord=att?.clock_in||att?.clock_out;
          return (
            <div key={i} style={{display:"grid",gridTemplateColumns:"60px 30px 90px 80px 80px 60px",gap:8,alignItems:"center",padding:"8px 14px",borderBottom:i<monthDates.length-1?`1px solid ${C.border}`:"none",background:isToday?C.surface2:i%2===0?ROW_A:ROW_B}}>
              <span style={{fontSize:12,fontWeight:isToday?700:400,color:isToday?C.gold:C.ink}}>{month+1}/{d.getDate()}{isToday?" ✦":""}</span>
              <span style={{fontSize:12,color:isWE?C.gold:C.muted,fontWeight:600}}>{DAYS_JA[d.getDay()]}</span>
              <span style={{fontSize:11,color:sh?C.green:FAINT}}>{sh?`${sh.start_time}〜${sh.end_time}`:"──"}</span>
              <span style={{fontSize:12,color:att?.clock_in?C.blue:FAINT,fontWeight:att?.clock_in?600:400}}>{att?.clock_in?fmtHM(att.clock_in):"──"}</span>
              <span style={{fontSize:12,color:att?.clock_out?C.accent:FAINT,fontWeight:att?.clock_out?600:400}}>{att?.clock_out?fmtHM(att.clock_out):"──"}</span>
              <button onClick={()=>openEdit(d)} style={{padding:"4px 8px",borderRadius:8,border:`1px solid ${C.border}`,background:hasRecord?C.surface2:C.bg,color:C.ink,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>
                {hasRecord?"✏️ 編集":"➕ 追加"}
              </button>
            </div>
          );
        })}
      </div>
      {editModal&&(
        <Modal onClose={()=>setEditModal(null)}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:3}}>{selStaff.name}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:20}}>{editModal.dateLabel}</div>
          <div style={{display:"flex",gap:12,marginBottom:8}}>
            <label style={LS}>出勤時刻<input type="time" value={editModal.inVal} onChange={e=>setEditModal(p=>({...p,inVal:e.target.value}))} style={{...SS,width:"100%"}}/></label>
            <label style={LS}>退勤時刻<input type="time" value={editModal.outVal} onChange={e=>setEditModal(p=>({...p,outVal:e.target.value}))} style={{...SS,width:"100%"}}/></label>
          </div>
          <div style={{fontSize:11,color:C.muted,marginBottom:18}}>※ 空欄にすると該当の打刻を削除します</div>
          <button onClick={saveEdit} disabled={saving} style={PB(C.ink)}>{saving?"保存中...":"💾 保存する"}</button>
          <button onClick={deleteDay} disabled={saving} style={{...PB("danger"),marginTop:8}}>🗑 この日の記録を全削除</button>
        </Modal>
      )}
    </div>
  );
}

function WageView({staff,attendance,getShiftByDate,updateStaff,showToast}){
  const [editing,setEditing]=useState({});
  const today=new Date(),base=new Date(today.getFullYear(),today.getMonth(),1);
  const monthDates=Array.from({length:new Date(base.getFullYear(),base.getMonth()+1,0).getDate()},(_,i)=>new Date(base.getFullYear(),base.getMonth(),i+1));

  async function save(staffId,currentWage){
    const v=parseInt(editing[staffId]??currentWage);
    if(!v||v<900||v>5000){ showToast("❌ 有効な時給を入力してください（900〜5000円）","error"); return; }
    await updateStaff(staffId,{wage:v});
    setEditing(p=>({...p,[staffId]:undefined}));
  }
  function monthSummary(s){
    return monthDates.reduce((acc,d)=>{
      const sh=getShiftByDate(d,s.id),att=attendance.find(a=>a.staff_id===s.id&&a.date===toDateStr(d));
      const mins=sh&&att?.clock_in&&att?.clock_out?calcBillableMinutes(sh.start_time,sh.end_time,att.clock_in,att.clock_out,s.breaks):0;
      return {mins:acc.mins+mins,pay:acc.pay+Math.floor(mins/60*(s.wage||0))};
    },{mins:0,pay:0});
  }

  return (
    <div>
      <SectionTitle icon="💴" title="時給・給与設定" sub="スタッフごとの時給と今月の給与を確認できます"/>
      <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{background:HEAD_BG,padding:"9px 14px",fontSize:11,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"1fr 90px 130px 100px 120px",gap:8,alignItems:"center"}}>
          <span>スタッフ</span><span style={{textAlign:"right"}}>時給</span><span style={{textAlign:"center"}}>今月実働</span><span style={{textAlign:"right"}}>今月給与</span><span style={{textAlign:"center"}}>変更</span>
        </div>
        {staff.map((s,i)=>{
          const sum=monthSummary(s);
          const brkTotal=breaksTotalMin(parseBreaks(s.breaks));
          return (
            <div key={s.id} style={{display:"grid",gridTemplateColumns:"1fr 90px 130px 100px 120px",gap:8,alignItems:"center",padding:"12px 14px",borderBottom:i<staff.length-1?`1px solid ${C.border}`:"none",background:i%2===0?ROW_A:ROW_B}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:SUBTLE,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{nameToAvatar(s.name)}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:10,color:C.muted}}>休憩計{brkTotal}分</div>
                </div>
              </div>
              <div style={{textAlign:"right",fontSize:13,fontWeight:700}}>¥{s.wage?.toLocaleString()}</div>
              <div style={{textAlign:"center",fontSize:12,color:C.muted}}>{Math.floor(sum.mins/60)}h{sum.mins%60}m</div>
              <div style={{textAlign:"right",fontSize:13,fontWeight:700,color:C.accent}}>¥{sum.pay.toLocaleString()}</div>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                <input type="number" value={editing[s.id]??s.wage??""} min={900} max={5000}
                  onChange={e=>setEditing(p=>({...p,[s.id]:e.target.value}))}
                  style={{width:65,padding:"5px 6px",borderRadius:7,border:`1px solid ${C.border}`,fontFamily:"inherit",fontSize:12,textAlign:"right",outline:"none",background:C.bg,color:C.ink,WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
                <button onClick={()=>save(s.id,s.wage)} style={{padding:"5px 8px",borderRadius:8,border:"none",background:C.gold,color:ON_GOLD,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>更新</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:10,fontSize:11,color:C.muted}}>※ シフト時間で計算（早出・残業は一切カウントしません）。休憩は各スタッフの休憩設定に応じて差し引きます。</div>
    </div>
  );
}

function BreakEditor({breaks,setBreaks,templates,onPickTemplate}){
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
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>テンプレから取り込む</label>
          <select value="" onChange={e=>{const t=templates.find(t=>String(t.id)===e.target.value); if(t) onPickTemplate(parseBreaks(t.breaks));}}
            style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${C.border}`,fontFamily:"inherit",fontSize:13,background:C.bg,color:C.ink,outline:"none",boxSizing:"border-box"}}>
            <option value="">選択して取り込み...</option>
            {templates.map(t=><option key={t.id} value={t.id}>{t.name}（計{breaksTotalMin(parseBreaks(t.breaks))}分）</option>)}
          </select>
        </div>
      )}
      <div style={{fontSize:11,color:C.muted,marginBottom:6,display:"flex",justifyContent:"space-between"}}>
        <span>休憩時間帯</span><span style={{color:C.gold,fontWeight:700}}>合計 {total}分</span>
      </div>
      {breaks.length===0&&<div style={{fontSize:12,color:C.muted,padding:"8px 0"}}>休憩なし</div>}
      {breaks.map((row,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
          <input type="time" value={minToHM(row[0])} onChange={e=>update(i,0,e.target.value)} style={{...SS,flex:1}}/>
          <span style={{color:C.muted}}>〜</span>
          <input type="time" value={minToHM(row[1])} onChange={e=>update(i,1,e.target.value)} style={{...SS,flex:1}}/>
          <span style={{fontSize:11,color:C.muted,width:40,textAlign:"right"}}>{Math.max(0,row[1]-row[0])}分</span>
          <button onClick={()=>removeRow(i)} style={{padding:"4px 8px",borderRadius:7,border:`1px solid ${C.accent}55`,background:isDarkTheme?"#2a0d0d":"#fde8e6",color:C.accent,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
        </div>
      ))}
      <button onClick={addRow} style={{width:"100%",padding:"8px",marginTop:4,borderRadius:9,border:`1px dashed ${C.border}`,background:"transparent",color:C.muted,fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>＋ 休憩を追加</button>
    </div>
  );
}

function BreakTemplateView({templates,addTemplate,updateTemplate,deleteTemplate}){
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState(null);

  function openNew(){ setModal({name:"",breaks:[]}); }
  function openEdit(t){ setModal({id:t.id,name:t.name,breaks:parseBreaks(t.breaks)}); }

  async function save(){
    if(!modal.name.trim()) return;
    setSaving(true);
    if(modal.id) await updateTemplate(modal.id,modal.name.trim(),modal.breaks);
    else await addTemplate(modal.name.trim(),modal.breaks);
    setSaving(false); setModal(null);
  }

  return (
    <div>
      <SectionTitle icon="☕" title="休憩テンプレート" sub="休憩パターンのひな形を作成・編集します（スタッフに取り込んで使います）"/>
      <button onClick={openNew} style={{width:"100%",padding:"12px",marginBottom:20,borderRadius:12,border:`1px dashed ${C.border}`,background:"transparent",color:C.muted,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>
        ＋ 新規テンプレートを作成する
      </button>
      <div style={{display:"grid",gap:12}}>
        {templates.length===0&&<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:20}}>テンプレートがありません</div>}
        {templates.map(t=>{
          const breaks=parseBreaks(t.breaks);
          return (
            <div key={t.id} style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,padding:16,boxShadow:C.shadow}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>☕ {t.name}</div>
                  <div style={{fontSize:11,color:C.gold,marginTop:2}}>休憩計 {breaksTotalMin(breaks)}分・{breaks.length}本</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>openEdit(t)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.ink,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✏️ 編集</button>
                  <button onClick={()=>setDeleteConfirm(t.id)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${C.accent}55`,background:isDarkTheme?"#2a0d0d":"#fde8e6",color:C.accent,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {breaks.length===0?<span style={{fontSize:12,color:C.muted}}>休憩なし</span>:breaks.map(([a,b],i)=>(
                  <span key={i} style={{fontSize:11,padding:"3px 9px",borderRadius:8,background:C.surface2,color:C.ink,fontWeight:600}}>{minToHM(a)}〜{minToHM(b)}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>{modal.id?"テンプレートを編集":"新規テンプレート"}</div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>テンプレ名</label>
            <input type="text" value={modal.name} placeholder="例: デフォルト / CS"
              onChange={e=>setModal(p=>({...p,name:e.target.value}))}
              style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${C.border}`,fontFamily:"inherit",fontSize:13,background:C.bg,color:C.ink,outline:"none",boxSizing:"border-box",WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
          </div>
          <BreakEditor breaks={modal.breaks} setBreaks={fn=>setModal(p=>({...p,breaks:typeof fn==="function"?fn(p.breaks):fn}))}/>
          <button onClick={save} disabled={saving||!modal.name.trim()} style={{...PB(C.ink),marginTop:16}}>{saving?"保存中...":"💾 保存する"}</button>
        </Modal>
      )}
      {deleteConfirm&&(
        <Modal onClose={()=>setDeleteConfirm(null)}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>🗑 テンプレート削除</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:20}}>{templates.find(t=>t.id===deleteConfirm)?.name} を削除しますか？<br/><span style={{color:C.accent,fontSize:12}}>※ 既にスタッフに取り込んだ休憩には影響しません。</span></div>
          <button onClick={async()=>{setSaving(true);await deleteTemplate(deleteConfirm);setDeleteConfirm(null);setSaving(false);}} disabled={saving} style={{...PB("danger"),marginBottom:8}}>{saving?"削除中...":"削除する"}</button>
        </Modal>
      )}
    </div>
  );
}

function AccountsView({staff,addStaff,deleteStaff,updateStaff,templates}){
  const [showAdd,setShowAdd]=useState(false);
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({name:"",username:"",password:"",wage:"",breaks:[]});
  const [errors,setErrors]=useState({});
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [saving,setSaving]=useState(false);

  function validate(f,currentId=null){
    const errs={};
    if(!f.name.trim()) errs.name="名前を入力してください";
    if(!f.username.trim()) errs.username="ユーザー名を入力してください";
    else if(!/^[a-zA-Z0-9_]+$/.test(f.username)) errs.username="半角英数字・アンダースコアのみ使用可";
    else if(staff.some(s=>s.username===f.username&&s.id!==currentId)) errs.username="このユーザー名は既に使用されています";
    if(!f.password.trim()) errs.password="パスワードを入力してください";
    else if(f.password.length<4) errs.password="4文字以上で入力してください";
    const w=parseInt(f.wage);
    if(!f.wage||isNaN(w)||w<900||w>5000) errs.wage="時給は900〜5000円で入力してください";
    return errs;
  }

  async function handleAdd(){
    const errs=validate(form); setErrors(errs);
    if(Object.keys(errs).length>0) return;
    setSaving(true);
    await addStaff(form.name.trim(),form.username.trim(),form.password,parseInt(form.wage),form.breaks);
    setForm({name:"",username:"",password:"",wage:"",breaks:[]}); setShowAdd(false); setErrors({}); setSaving(false);
  }

  function openEdit(s){
    setEditId(s.id);
    setForm({name:s.name,username:s.username,password:s.password,wage:String(s.wage||""),breaks:parseBreaks(s.breaks)});
    setErrors({});
  }

  async function handleUpdate(){
    const errs=validate(form,editId); setErrors(errs);
    if(Object.keys(errs).length>0) return;
    setSaving(true);
    await updateStaff(editId,{name:form.name.trim(),username:form.username.trim(),password:form.password,wage:parseInt(form.wage),breaks:form.breaks});
    setEditId(null); setErrors({}); setSaving(false);
  }

  function FField(key,placeholder,type="text"){
    return (
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>{placeholder}</label>
        <input type={type} value={form[key]} placeholder={placeholder}
          onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
          style={{width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${errors[key]?C.accent:C.border}`,fontFamily:"inherit",fontSize:13,background:C.bg,color:C.ink,outline:"none",boxSizing:"border-box",WebkitTextFillColor:C.ink,WebkitBoxShadow:`0 0 0 100px ${C.bg} inset`}}/>
        {errors[key]&&<div style={{fontSize:11,color:C.accent,marginTop:3}}>⚠ {errors[key]}</div>}
      </div>
    );
  }

  function setBreaks(fn){ setForm(p=>({...p,breaks:typeof fn==="function"?fn(p.breaks):fn})); }

  return (
    <div>
      <SectionTitle icon="👤" title="アカウント管理" sub="スタッフアカウントの発行・編集・削除"/>
      {showAdd?(
        <div style={{border:`1px solid ${C.gold}44`,borderRadius:14,padding:20,marginBottom:20,background:C.paper,boxShadow:C.shadow}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>➕ 新規アカウント発行</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>{FField("name","氏名（例: 山本 花子）")}</div>
            <div>{FField("username","ユーザー名（半角英数字）")}</div>
            <div>{FField("password","パスワード（4文字以上）","password")}</div>
            <div>{FField("wage","時給（円）","number")}</div>
          </div>
          <div style={{marginTop:4,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.gold}}>☕ 休憩設定</div>
            <BreakEditor breaks={form.breaks} setBreaks={setBreaks} templates={templates} onPickTemplate={b=>setBreaks(b)}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:12}}>
            <button onClick={handleAdd} disabled={saving} style={{...PB(C.ink),flex:1}}>{saving?"発行中...":"✅ 発行する"}</button>
            <button onClick={()=>{setShowAdd(false);setErrors({});setForm({name:"",username:"",password:"",wage:"",breaks:[]});}} style={{...PB("ghost"),flex:1}}>キャンセル</button>
          </div>
        </div>
      ):(
        <button onClick={()=>setShowAdd(true)} style={{width:"100%",padding:"12px",marginBottom:20,borderRadius:12,border:`1px dashed ${C.border}`,background:"transparent",color:C.muted,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          ＋ 新規アカウントを発行する
        </button>
      )}
      <div style={{background:C.paper,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:C.shadow}}>
        <div style={{background:HEAD_BG,padding:"9px 16px",fontSize:11,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"1fr 110px 80px 90px",gap:8,alignItems:"center"}}>
          <span>スタッフ</span><span>ユーザー名</span><span style={{textAlign:"right"}}>時給</span><span style={{textAlign:"center"}}>操作</span>
        </div>
        {staff.map((s,i)=>{
          const brkTotal=breaksTotalMin(parseBreaks(s.breaks));
          return (
          <div key={s.id}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 110px 80px 90px",gap:8,alignItems:"center",padding:"12px 16px",borderBottom:editId===s.id||i<staff.length-1?`1px solid ${C.border}`:"none",background:i%2===0?ROW_A:ROW_B}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:SUBTLE,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0}}>{nameToAvatar(s.name)}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>{s.name}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:1}}>休憩計{brkTotal}分</div>
                </div>
              </div>
              <div style={{fontSize:12,fontFamily:"monospace"}}>{s.username}</div>
              <div style={{fontSize:13,fontWeight:700,textAlign:"right"}}>¥{s.wage?.toLocaleString()}</div>
              <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                <button onClick={()=>openEdit(s)} style={{padding:"4px 8px",borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,color:C.ink,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✏️</button>
                <button onClick={()=>setDeleteConfirm(s.id)} style={{padding:"4px 8px",borderRadius:7,border:`1px solid ${C.accent}55`,background:isDarkTheme?"#2a0d0d":"#fde8e6",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:C.accent}}>🗑</button>
              </div>
            </div>
            {editId===s.id&&(
              <div style={{padding:"16px 16px",background:C.surface2,borderBottom:i<staff.length-1?`1px solid ${C.border}`:"none",borderTop:`1px solid ${C.gold}`}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:12}}>{s.name} を編集</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>{FField("name","氏名")}</div>
                  <div>{FField("username","ユーザー名")}</div>
                  <div>{FField("password","パスワード","password")}</div>
                  <div>{FField("wage","時給（円）","number")}</div>
                </div>
                <div style={{marginTop:4,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.gold}}>☕ 休憩設定</div>
                  <BreakEditor breaks={form.breaks} setBreaks={setBreaks} templates={templates} onPickTemplate={b=>setBreaks(b)}/>
                </div>
                <div style={{display:"flex",gap:10,marginTop:12}}>
                  <button onClick={handleUpdate} disabled={saving} style={{...PB(C.ink),flex:1}}>{saving?"保存中...":"💾 保存する"}</button>
                  <button onClick={()=>{setEditId(null);setErrors({});}} style={{...PB("ghost"),flex:1}}>キャンセル</button>
                </div>
              </div>
            )}
          </div>
        );})}
      </div>
      {deleteConfirm&&(
        <Modal onClose={()=>setDeleteConfirm(null)}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>🗑 アカウント削除</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:20}}>{staff.find(s=>s.id===deleteConfirm)?.name} のアカウントを削除しますか？<br/><span style={{color:C.accent,fontSize:12}}>この操作は取り消せません。</span></div>
          <button onClick={async()=>{setSaving(true);await deleteStaff(deleteConfirm);setDeleteConfirm(null);setSaving(false);}} disabled={saving} style={{...PB("danger"),marginBottom:8}}>{saving?"削除中...":"削除する"}</button>
        </Modal>
      )}
    </div>
  );
}

function SectionTitle({icon,title,sub}){
  return <div style={{marginBottom:18}}><div style={{fontSize:17,fontWeight:700}}>{icon} {title}</div>{sub&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</div>}<div style={{height:2,background:`linear-gradient(to right,${C.gold}88,transparent)`,marginTop:7,borderRadius:2}}/></div>;
}
function WeekNav({dates,offset,setOffset}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:C.paper,border:`1px solid ${C.border}`,borderRadius:12,padding:"9px 14px"}}><button onClick={()=>setOffset(o=>o-1)} style={NB}>‹ 前週</button><div style={{fontSize:13,fontWeight:700}}>{fmtDate(dates[0])} 〜 {fmtDate(dates[6])}{offset===0&&<span style={{fontSize:11,color:C.gold,marginLeft:8}}>今週</span>}</div><button onClick={()=>setOffset(o=>o+1)} style={NB}>次週 ›</button></div>;
}
function WeekNavMonth({year,month,offset,setOffset}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:C.paper,border:`1px solid ${C.border}`,borderRadius:12,padding:"9px 14px"}}><button onClick={()=>setOffset(o=>o-1)} style={NB}>‹ 前月</button><div style={{fontSize:13,fontWeight:700}}>{year}年{month+1}月{offset===0&&<span style={{fontSize:11,color:C.gold,marginLeft:8}}>今月</span>}</div><button onClick={()=>setOffset(o=>o+1)} style={NB}>次月 ›</button></div>;
}
function Modal({children,onClose}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{background:C.paper,borderRadius:18,padding:24,maxWidth:420,width:"100%",boxShadow:"0 8px 40px rgba(0,0,0,0.35)",maxHeight:"90vh",overflowY:"auto"}}>{children}<button onClick={onClose} style={{width:"100%",padding:"10px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,fontFamily:"inherit",fontSize:13,color:C.muted,cursor:"pointer",marginTop:8}}>キャンセル</button></div></div>;
}
const NB={padding:"6px 14px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:12,color:C.muted};
const LS={display:"flex",flexDirection:"column",gap:5,fontSize:12,color:C.muted,flex:1};
const SS={padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontFamily:"inherit",fontSize:13,background:C.bg,color:C.ink};
function chip(active){
  return {padding:"7px 14px",borderRadius:20,border:`1.5px solid ${active?C.gold:C.border}`,background:active?C.gold:"transparent",color:active?ON_GOLD:C.muted,fontFamily:"inherit",fontSize:12,cursor:"pointer",fontWeight:600};
}
// PB: "danger"=削除系, "ghost"=キャンセル系, それ以外は背景色を渡す
function PB(kind){
  if(kind==="danger"){
    return {width:"100%",padding:"12px",background:isDarkTheme?"#2a0d0d":"#fde8e6",color:C.accent,border:`1px solid ${C.accent}`,borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"block"};
  }
  if(kind==="ghost"){
    return {width:"100%",padding:"12px",background:C.bg,color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"block"};
  }
  const bg=kind;
  const onGoldBgs=[C.gold,C.gold2];
  const color=onGoldBgs.includes(bg)?ON_GOLD:ON_DARK;
  return {width:"100%",padding:"12px",background:bg,color,border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"block"};
}
