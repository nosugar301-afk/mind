/* 나의 마음 지킴이 — local-first interaction layer. Stitch page markup is retained. */
(() => {
  'use strict';
  const page = document.body.dataset.page;
  const $ = (s,root=document) => root.querySelector(s);
  const $$ = (s,root=document) => Array.from(root.querySelectorAll(s));
  const byId = id => document.getElementById(id);
  const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const storage = {get(k,f,session=false){try{return JSON.parse((session?sessionStorage:localStorage).getItem(k))??f}catch{return f}},set(k,v,session=false){try{(session?sessionStorage:localStorage).setItem(k,JSON.stringify(v));return true}catch{return false}}};
  const KEY='mindGuardian.v1.';
  const defaults={voice:true,rate:.85,inhale:3,exhale:4,rest:1,cycles:3,record:false,display:'normal',calmAllowed:null,aacAllowed:null,scenarioAllowed:null,customAAC:[]};
  let profiles=storage.get(KEY+'profiles',[{id:'friend1',name:'친구 1',settings:{...defaults}}]);
  if(!Array.isArray(profiles)||!profiles.length) profiles=[{id:'friend1',name:'친구 1',settings:{...defaults}}];
  const validProfile=id=>profiles.some(p=>p.id===id);
  let device=storage.get(KEY+'deviceMode',{mode:'shared',student:null});
  if(!device||!['shared','personal'].includes(device.mode))device={mode:'shared',student:null};
  if(device.mode==='personal'&&!validProfile(device.student)){device={mode:'shared',student:null};storage.set(KEY+'deviceMode',device);}
  let sessionStudent=storage.get(KEY+'sessionStudent',null,true);
  let active=device.mode==='personal'?device.student:validProfile(sessionStudent)?sessionStudent:storage.get(KEY+'active',profiles[0].id);
  if(!validProfile(active))active=profiles[0].id;
  const avatarChoices=['p1-0.png','p1-1.png','p1-2.png','p1-3.png','p1-4.png'];
  const avatarOf=p=>avatarChoices.includes(p.avatar)?p.avatar:avatarChoices[Math.max(0,profiles.indexOf(p))%avatarChoices.length];
  const current=()=>profiles.find(p=>p.id===active)||profiles[0];
  const settings=()=>({...defaults,...current().settings});
  let records=storage.get(KEY+'records',[]), helps=storage.get(KEY+'helps',[]);
  if(!Array.isArray(records))records=[];if(!Array.isArray(helps))helps=[];
  const localDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const uid=()=>`${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const fresh=()=>({id:uid(),profile:current().id,emotion:'',level:null,after:'',activities:[],breaths:0,help:false,practice:false,started:new Date().toISOString(),finished:false});
  let run=storage.get(KEY+'run',null,true); if(!run||run.profile!==current().id)run=fresh();
  function saveRun(){storage.set(KEY+'run',run,true)}
  function newRun(emotion='',practice=false){run=fresh();run.emotion=emotion;run.practice=practice;saveRun()}
  function ensureRun(){if(run.finished||run.profile!==current().id){newRun();}return run}
  function addActivity(a){ensureRun();if(!run.activities.includes(a))run.activities.push(a);saveRun()}
  function speak(text,explicit=false){
    if(!explicit&&!settings().voice)return false;
    if(!('speechSynthesis' in window)){notice('음성 재생을 사용할 수 없어요. 화면의 문장을 선생님께 보여 주세요.');return false;}
    try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=Number(settings().rate)||.85;u.pitch=1.02;
      const voices=speechSynthesis.getVoices();const ko=voices.find(v=>/^ko(-|_)/i.test(v.lang)&&v.localService)||voices.find(v=>/^ko(-|_)/i.test(v.lang));if(ko)u.voice=ko;
      u.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))notice('한국어 음성을 재생하지 못했어요. 태블릿의 TTS 설정을 확인해 주세요.');};speechSynthesis.speak(u);return true;
    }catch{notice('음성을 재생할 수 없어요. 화면을 선생님께 보여 주세요.');return false;}
  }
  function stopVoice(){try{speechSynthesis.cancel()}catch{}}
  function go(url){stopVoice();saveRun();location.href=url}
  let toastTimeout, suspendActive=null;
  function notice(text){let el=byId('appNotice');if(!el){el=document.createElement('div');el.id='appNotice';el.className='app-notice';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el)}el.textContent=text;el.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),4200)}
  function showHelp(openDialog=true){
    if(suspendActive)suspendActive();
    ensureRun();run.help=true;saveRun();
    if(settings().record){helps.unshift({id:uid(),profile:current().id,time:new Date().toISOString(),emotion:run.emotion||'선택하지 않음'});helps=helps.slice(0,500);storage.set(KEY+'helps',helps)}
    speak('선생님, 도와주세요!',true);
    if(!openDialog){notice('선생님, 도와주세요! · 이 태블릿에서만 목소리가 나와요.');return}
    let dlg=byId('helpDialog');if(!dlg){dlg=document.createElement('dialog');dlg.id='helpDialog';dlg.className='app-dialog';dlg.innerHTML=`<div class="help-symbol" aria-hidden="true">✋</div><h2>선생님, 도와주세요!</h2><p>이 태블릿에서 도움을 요청하는 목소리가 나와요.<br>선생님께 이 화면을 보여 주세요.</p><div class="dialog-actions"><button class="app-btn primary" id="helpRepeat">다시 말하기</button><button class="app-btn muted" id="helpAac">그림으로 더 말하기</button><button class="app-btn muted" id="helpClose">닫기</button></div>`;document.body.append(dlg);byId('helpRepeat').onclick=()=>speak('선생님, 도와주세요!',true);byId('helpAac').onclick=()=>go('aac.html');byId('helpClose').onclick=()=>dlg.close();dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()})}
    if(typeof dlg.showModal==='function'){if(!dlg.open)dlg.showModal()}else dlg.setAttribute('open','');
  }
  const guide={index:'안녕! 오늘 내 마음은 어떤가요? 화가 났거나, 슬프거나, 불안할 때 고양이를 눌러요. 선생님께 도움을 요청해도 괜찮아요.',emotion:'지금 내 마음과 가장 비슷한 그림을 골라요.',thermometer:'지금 내 마음이 얼마나 큰지 골라요. 괜찮아요, 조금 불편해요, 많이 불편해요.',stop:'잠깐! 손과 발을 멈춰요. 나와 친구를 안전하게 지켜요.',breathing:'코로 천천히 숨을 들이마시고, 입으로 내쉬어요. 불편하면 그냥 편안하게 숨 쉬어도 괜찮아요.',check:'숨을 고르고 난 뒤, 지금 내 마음은 어떤가요? 솔직하게 골라도 괜찮아요.',calm:'마음을 편안하게 해주는 방법을 골라보세요. 천천히 해도 괜찮아요.',aac:'말하기 어려울 때는 그림 카드를 골라요. 소리로 말하기 버튼을 누르면 읽어줘요.',complete:'내 마음을 돌보려고 노력했어요! 도움을 요청하는 것도 멋진 일이에요.',practice:'그림을 보고 나와 친구를 안전하게 지키는 방법을 골라요.',activity:'천천히 마음을 쉬어가요. 힘들면 선생님께 도움을 요청해요.',records:'내 마음을 돌보려고 노력한 발자국을 확인해요.'};
  function finish(){ensureRun();if(!run.finished){run.finished=true;run.ended=new Date().toISOString();saveRun();if(settings().record&&!records.some(r=>r.id===run.id)){records.unshift({...run,day:localDay()});records=records.slice(0,1000);if(!storage.set(KEY+'records',records))notice('기기 저장 공간을 확인해 주세요. 기록을 저장하지 못했어요.')}}go('complete.html')}
  function dateText(s){try{return new Date(s).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return ''}}
  const emotionLabels={angry:'화가 났어요',sad:'슬퍼요',anxious:'불안해요',practice:'연습',happy:'기뻐요'};
  function chooseStudent(id){
    if(!validProfile(id))return;
    active=id;sessionStudent=id;
    if(!storage.set(KEY+'sessionStudent',id,true)){notice('학생을 선택할 수 없어요. 브라우저 저장소를 확인해 주세요.');return;}
    storage.set(KEY+'active',id);newRun();go('index.html');
  }
  function endStudent(){
    stopVoice();try{sessionStorage.removeItem(KEY+'sessionStudent');sessionStorage.removeItem(KEY+'run');}catch{}
    location.replace('index.html');
  }
  function installStudentStyles(){
    const style=document.createElement('style');style.textContent=`
      .mg-student-picker{position:fixed;inset:0;z-index:9999;background:#fff8f3;overflow:auto;padding:clamp(20px,4vw,56px);display:flex;flex-direction:column;align-items:center;gap:20px;color:#201b14}
      .mg-student-picker h1{font-size:clamp(26px,4vw,44px);color:#006c47;font-weight:800;text-align:center;margin:0}
      .mg-student-picker p{font-size:clamp(18px,2.4vw,24px);text-align:center;margin:0}
      .mg-student-grid{width:min(100%,920px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:18px}
      .mg-student-card{border:2px solid transparent;border-radius:24px;background:#e3f4e9;color:#134d37;padding:20px;min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;box-shadow:0 3px 10px #0001}
      .mg-student-card:nth-child(4n+2){background:#e1efff;color:#164d77}.mg-student-card:nth-child(4n+3){background:#f8e6ce;color:#6e4723}.mg-student-card:nth-child(4n+4){background:#ece3fb;color:#523b82}
      .mg-student-card:focus-visible,.mg-student-card:hover{border-color:#006c47;outline:2px solid #006c47;outline-offset:2px}
      .mg-student-card img{width:100px;height:100px;object-fit:contain;background:#fff8f3;border-radius:50%;padding:5px}
      .mg-student-card strong{font-size:25px;overflow-wrap:anywhere}
      .mg-student-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#e3f4e9;color:#134d37;border-radius:16px;padding:10px 16px;margin:0 0 8px;font-weight:700}
      .mg-student-bar .app-btn{min-height:44px}
      .mg-device-panel{margin:16px 0;padding:16px;background:#f4f0e9;border-radius:16px}.mg-device-panel label{display:block;margin:10px 0}.mg-device-panel select,.mg-device-panel input{width:100%;margin-top:4px}.mg-device-panel h3{font-size:20px;font-weight:700;margin:0 0 8px}.mg-device-panel p{margin:8px 0}
      @media(max-width:600px){.mg-student-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mg-student-card{min-height:140px;padding:12px}.mg-student-card img{width:72px;height:72px}.mg-student-card strong{font-size:19px}}
    `;document.head.append(style);
  }
  function studentGate(){
    if(page==='teacher'||device.mode==='personal'||validProfile(sessionStudent))return false;
    if(page!=='index'){location.replace('index.html');return true;}
    // No activity may be attributed to the fallback profile before a selection.
    const view=document.createElement('section');view.className='mg-student-picker';view.setAttribute('aria-label','학생 선택');
    view.innerHTML='<h1>나의 마음 지킴이</h1><p>누가 사용할까요? 내 그림을 눌러요.</p><div class="mg-student-grid">'+profiles.map(p=>'<button type="button" class="mg-student-card" data-student-id="'+esc(p.id)+'"><img src="assets/'+avatarOf(p)+'" alt=""/><strong>'+esc(p.name)+'</strong></button>').join('')+'</div><button type="button" class="app-btn primary" id="mgUnassignedHelp">선생님, 도와주세요!</button><a class="app-btn muted" href="teacher.html">선생님 설정</a><p id="mgPickerHelp" role="status" hidden>선생님께 이 화면을 보여 주세요. 이 태블릿에서만 목소리가 나와요.</p>';
    [...document.body.children].forEach(el=>{if(!['SCRIPT','STYLE'].includes(el.tagName))el.inert=true;});
    document.body.append(view);
    view.querySelectorAll('[data-student-id]').forEach(b=>b.onclick=()=>chooseStudent(b.dataset.studentId));
    byId('mgUnassignedHelp').onclick=()=>{byId('mgPickerHelp').hidden=false;speak('선생님, 도와주세요!',true);};
    return true;
  }
  function studentBar(){
    if(page!=='index')return;
    const wrap=$('main>div>div')||$('main>div')||$('main');if(!wrap)return;
    const bar=document.createElement('div');bar.className='mg-student-bar';
    bar.innerHTML='<span>현재 학생: '+esc(current().name)+'</span>'+(device.mode==='shared'?'<button type="button" class="app-btn muted compact" id="mgSwitchStudent">학생 바꾸기</button>':'<span>나의 전용 태블릿</span>');
    wrap.prepend(bar);byId('mgSwitchStudent')?.addEventListener('click',endStudent);
  }
  function renderDevicePanel(selected){
    let panel=byId('mgDevicePanel');
    if(!panel){panel=document.createElement('div');panel.id='mgDevicePanel';panel.className='mg-device-panel';byId('profiles').append(panel);}
    const p=profiles.find(x=>x.id===selected)||current();
    panel.innerHTML='<h3>이 태블릿 사용 방식</h3><p>공용은 학생이 직접 선택하고, 전용은 지정된 학생으로 바로 시작합니다.</p><label>사용 방식<select id="mgMode"><option value="shared">공용 태블릿</option><option value="personal">학생 전용 태블릿</option></select></label><label id="mgAssignedLabel">전용 학생<select id="mgAssigned">'+profiles.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select></label><button type="button" class="app-btn primary" id="mgSaveMode">기기 설정 저장</button><p id="mgModeMessage" role="status"></p><h3 style="margin-top:20px">학생 별칭과 그림</h3><label>수정할 학생<select id="mgEditStudent">'+profiles.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select></label><label>별칭<input id="mgEditName" maxlength="20"/></label><label>그림<select id="mgEditAvatar">'+avatarChoices.map((x,i)=>'<option value="'+x+'">고양이 '+(i+1)+'</option>').join('')+'</select></label><img id="mgAvatarPreview" alt="선택한 고양이 그림" style="width:76px;height:76px;object-fit:contain;border-radius:16px;background:white"/><button type="button" class="app-btn muted" id="mgSaveProfile">별칭·그림 저장</button><p id="mgProfileMessage" role="status"></p>';
    const mode=byId('mgMode'),assigned=byId('mgAssigned'),edit=byId('mgEditStudent');
    mode.value=device.mode;assigned.value=validProfile(device.student)?device.student:active;
    const modeFields=()=>{byId('mgAssignedLabel').hidden=mode.value!=='personal';};mode.onchange=modeFields;modeFields();
    byId('mgSaveMode').onclick=()=>{const next={mode:mode.value,student:mode.value==='personal'?assigned.value:null};if(next.mode==='personal'&&!validProfile(next.student))return;if(!storage.set(KEY+'deviceMode',next)){byId('mgModeMessage').textContent='기기 설정을 저장하지 못했습니다.';return;}device=next;try{sessionStorage.removeItem(KEY+'sessionStudent');sessionStorage.removeItem(KEY+'run');}catch{}sessionStudent=null;if(device.mode==='personal'){active=device.student;storage.set(KEY+'active',active);}run=fresh();byId('mgModeMessage').textContent='저장했습니다. 학생 화면으로 돌아가면 적용됩니다.';};
    edit.value=p.id;const fields=()=>{const x=profiles.find(y=>y.id===edit.value)||current();byId('mgEditName').value=x.name;byId('mgEditAvatar').value=avatarOf(x);byId('mgAvatarPreview').src='assets/'+avatarOf(x);};edit.onchange=fields;fields();
    byId('mgEditAvatar').onchange=()=>{byId('mgAvatarPreview').src='assets/'+byId('mgEditAvatar').value;};
    byId('mgSaveProfile').onclick=()=>{const x=profiles.find(y=>y.id===edit.value),name=byId('mgEditName').value.trim();if(!x||!name||profiles.some(y=>y.id!==x.id&&y.name===name)){byId('mgProfileMessage').textContent='중복되지 않는 별칭을 입력해 주세요.';return;}const old={name:x.name,avatar:x.avatar};x.name=name;x.avatar=byId('mgEditAvatar').value;if(!storage.set(KEY+'profiles',profiles)){Object.assign(x,old);byId('mgProfileMessage').textContent='저장하지 못했습니다.';return;}byId('profileCards').querySelector('[data-activate="'+CSS.escape(x.id)+'"]')?.closest('.profile-card')?.querySelector('strong')?.replaceChildren(name);[byId('settingsProfile'),assigned,edit].forEach(sel=>{const opt=Array.from(sel.options).find(o=>o.value===x.id);if(opt)opt.textContent=name;});byId('mgProfileMessage').textContent='별칭과 그림을 저장했습니다.';};
  }
  function initHeader(){
    if(page==='teacher')return;
    const hdr=$('body>header'); if(!hdr)return;
    // Keep the Stitch header and its buttons; expose a compact AAC shortcut using existing help menu.
    const nav=$('body>header nav'); if(nav){nav.setAttribute('aria-label','마음 활동 메뉴');const target=['index','emotion','thermometer'].includes(page)?'emotion.html':['stop','breathing','check','practice'].includes(page)?'breathing.html':['calm','activity','aac'].includes(page)?'calm.html':'records.html';$$('a',nav).forEach(a=>{const yes=a.getAttribute('href')===target;a.classList.toggle('nav-current',yes);if(yes)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')})}
    const title=$('header .font-headline-md');if(title)title.title='현재 학생: '+current().name;studentBar();
    $$('body>header button').forEach(b=>{if(!b.dataset.action){b.dataset.action=b.textContent.includes('선생님')?'help':'guide'}});
    // Student mode can shorten descriptive secondary text without altering the original cards.
    if(settings().display==='simple')document.body.classList.add('simple-mode');if(page==='aac'&&settings().display==='sentence')document.body.classList.add('sentence-mode');
  }
  // Shared actions are handled in capture phase to avoid triggering old mock alert handlers.
  document.addEventListener('click',e=>{
    const el=e.target.closest('button,a');if(!el||el.closest('.mg-student-picker'))return;
    const action=el.dataset.action;
    if(action==='help'||action==='speak-help'){e.preventDefault();e.stopImmediatePropagation();showHelp(action==='help');return}
    if(action==='guide'){e.preventDefault();e.stopImmediatePropagation();speak(guide[page]||'천천히 마음을 돌봐요.',true);return}
    if(action==='finish'){e.preventDefault();e.stopImmediatePropagation();finish();return}
    if(action==='print'){e.preventDefault();e.stopImmediatePropagation();window.print();return}
    if(action==='share-stamp'){e.preventDefault();e.stopImmediatePropagation();speak('선생님, 저 오늘 내 마음을 돌보려고 노력했어요!',true);notice('선생님께 이 화면을 보여 주세요.');return}
    if(action==='skip-breath'){e.preventDefault();e.stopImmediatePropagation();addActivity('심호흡 건너뛰기');run.after='';saveRun();go('check.html');return}
    if(action==='teacher-exit'){storage.set(KEY+'teacherUnlocked',false,true);return}
    if(page==='complete'&&device.mode==='shared'&&(el.getAttribute('href')==='index.html'||el.dataset.go==='index.html')){e.preventDefault();e.stopImmediatePropagation();endStudent();return;}
    if(el.dataset.go){e.preventDefault();e.stopImmediatePropagation();go(el.dataset.go);return}
    if(el.dataset.emotionHome){e.preventDefault();const key=el.dataset.emotionHome;newRun(emotionLabels[key]||'',key==='practice');go(key==='angry'?'stop.html':key==='sad'?'calm.html':key==='anxious'?'breathing.html':'practice.html');return}
    if(page==='index'&&el.matches('a[href="emotion.html"]')){newRun();}
    if(page==='emotion'&&el.classList.contains('emotion-card')){ensureRun();run.emotion=el.dataset.emotion||el.querySelector('h2,h3')?.textContent.trim()||'';saveRun()}
    if(page==='thermometer'&&/^cardStage[123]$/.test(el.id)){ensureRun();run.level=Number(el.id.slice(-1));saveRun()}
    if(page==='stop'&&el.id==='btn-confirm-stop'){e.preventDefault();addActivity('멈추기');go('breathing.html');return}
    if(page==='check'&&/^emotion-card-[123]$/.test(el.id)){ensureRun();run.after=['','아직 많이 화나요','조금 나아졌어요','괜찮아졌어요'][Number(el.id.slice(-1))];saveRun()}
    if(page==='check'&&el.id==='btn-next-step'){e.preventDefault();if(!run.after){notice('지금 내 마음을 그림으로 골라요.');return}if(run.after==='아직 많이 화나요')go('breathing.html');else if(run.after==='조금 나아졌어요')go('calm.html');else finish();return}
    if(page==='calm'&&el.dataset.activity){ensureRun();run.selectedActivity=el.dataset.activity;saveRun()}
    if(page==='calm'&&el.id==='startActionBtn'){e.preventDefault();ensureRun();const visible=$$('[data-activity]').filter(b=>!b.hidden);if(!visible.length){notice('선생님께 활동을 설정해 달라고 말해요.');return}run.selectedActivity=visible.some(b=>b.dataset.activity===run.selectedActivity)?run.selectedActivity:visible[0].dataset.activity;saveRun();go('activity.html');return}
    if(page==='complete'&&device.mode==='shared'&&(el.getAttribute('href')==='index.html'||el.dataset.go==='index.html')){e.preventDefault();e.stopImmediatePropagation();endStudent();return;}
    if(el.matches('a[href$=".html"]')&&!e.defaultPrevented){stopVoice();saveRun()}
  },true);
  function initEmotion(){
    if(page==='emotion'){
      const selected=$$('.emotion-card').find(b=>b.dataset.emotion===run.emotion);if(selected&&run.emotion){try{window.selectEmotion(selected);stopVoice()}catch{}}
      const n=byId('btn-next-step');if(n)n.addEventListener('click',e=>{if(!run.emotion){e.preventDefault();notice('내 마음을 먼저 골라요.')}});
    }
    if(page==='thermometer'){
      if(run.level)try{window.selectStage(run.level)}catch{}else{const first=byId('cardStage1');if(first){first.classList.remove('ring-4','ring-primary','bg-primary-fixed/20','hover:bg-primary-fixed/30','shadow-md');first.classList.add('bg-surface-container','shadow-sm');const check=byId('check1');if(check){check.classList.add('opacity-0');check.parentElement.classList.remove('bg-primary','text-on-primary');check.parentElement.classList.add('bg-surface-container-high','text-on-surface-variant')}}const label=byId('levelLabel');if(label)label.textContent='내 마음을 골라요';}
      byId('nextStepBtn')?.addEventListener('click',e=>{if(!run.level){e.preventDefault();notice('지금 내 마음의 크기를 먼저 골라요.')}});
    }
    if(page==='check'){
      // Original card layout initialized to a sample. Clear selected data until student makes a choice.
      if(run.after){const idx=['아직 많이 화나요','조금 나아졌어요','괜찮아졌어요'].indexOf(run.after)+1;if(idx)try{window.selectEmotion(idx)}catch{}}
      else {$$('[id^="pathway-content-"]').forEach(x=>{x.classList.add('hidden');x.classList.remove('flex')});$$('[id^="emotion-card-"]').forEach(x=>{x.classList.remove('bg-error-container/20','bg-secondary-fixed/30','bg-primary-fixed/30','shadow-xl','scale-[1.02]');x.classList.add('bg-surface-container-low');x.setAttribute('aria-pressed','false');const i=$('.status-indicator',x);if(i){i.classList.remove('bg-primary','text-on-primary');i.classList.add('bg-surface-container-highest','text-on-surface-variant')}});byId('btn-next-step').querySelector('span:first-child').textContent='다음 단계로 가기'}
      $$('[id^="emotion-card-"]').forEach(x=>x.addEventListener('click',()=>{$$('[id^="emotion-card-"]').forEach(y=>y.setAttribute('aria-pressed',String(y===x)))}));
    }
    if(page==='calm'){const cfg=settings();const cards=$$('[data-activity]');let allowed=Array.isArray(cfg.calmAllowed)?cfg.calmAllowed:null;cards.forEach(b=>b.hidden=!!allowed&&!allowed.includes(b.dataset.activity));const selected=cards.find(b=>!b.hidden&&b.dataset.activity===run.selectedActivity)||cards.find(b=>!b.hidden&&b.dataset.activity==='doll')||cards.find(b=>!b.hidden);if(selected)selected.click();else{byId('startActionBtn').setAttribute('aria-disabled','true');byId('startActionBtn').classList.add('opacity-50');}}
  }
  function initBreathing(){
    ensureRun();const cfg=settings(), total=Math.max(1,Math.min(3,Number(cfg.cycles)||3)), durations=[Number(cfg.inhale)||3,Number(cfg.exhale)||4];
    let cycle=1,phase=0,remaining=durations[0]*1000,running=false,completed=false,started=false,last=0,interval=null,auto=null,sound=cfg.voice;
    const sphere=byId('breathSphere'), circle=byId('breathProgressCircle'), toggle=byId('togglePlayBtn'), finishBtn=byId('finishStepBtn'), playText=byId('playBtnText'), playIcon=byId('playBtnIcon');
    const set=(id,t)=>{const el=byId(id);if(el)el.textContent=t};
    const maxLen=276.46;
    function cards(){for(let i=1;i<=3;i++){const card=byId('stepCard'+i);if(!card)continue;card.hidden=i>total;const status=i<cycle||completed?'done':i===cycle?'active':'wait';card.className='flex items-center gap-space-sm p-space-sm rounded-2xl shadow-sm transition-all '+(status==='done'?'bg-surface-container-lowest':status==='active'?'bg-primary-fixed/50 ring-2 ring-primary':'bg-surface-container-highest/60 opacity-60');card.innerHTML=`<div class="w-12 h-12 rounded-xl ${status==='done'?'bg-primary-fixed text-primary':status==='active'?'bg-primary text-on-primary':'bg-surface-container text-outline'} flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-2xl">${status==='done'?'check':status==='active'?'air':'eco'}</span></div><div class="flex flex-col min-w-0"><span class="font-label-md text-label-md font-bold">${i}번째 숨</span><span class="font-body-md text-sm text-on-surface-variant">${status==='done'?'천천히 해냈어요!':status==='active'?(started?'지금 쉬고 있어요':'시작해요'):'기다리고 있어요'}</span></div>`;}set('globalCycleText',completed?`${total}회 호흡 완료`:`${total}회 중 ${cycle}회차`);set('stepCounterBadge',`${completed?total:cycle-1} / ${total} 완료`)}
    function visual(reset=false){const inhale=phase===0;const duration=durations[phase];set('breathActionText',completed?'다 쉬었어요!':!started?'준비됐나요?':inhale?'들이마셔요':'내쉬어요');set('breathSubText',completed?'내 마음을 확인해요':!started?`숨을 천천히 ${total}번 쉬어요`:inhale?`코로 쏘옥 (${duration}초)`:`입으로 후- (${duration}초)`);set('breathIcon',completed?'check':inhale?'air':'eco');set('sensoryTip',completed?'잘했어요! 지금 내 마음은 어떤가요?':!started?'시작하기 버튼을 누르면 호흡을 함께 해요.':inhale?'꽃 냄새를 맡듯 편안하게 숨을 들이마셔요.':'촛불을 끄듯 천천히 숨을 내쉬어요.');
      [sphere,byId('haloOuter'),byId('haloMiddle')].forEach((el,i)=>{if(!el)return;el.style.transition=`transform ${reset?0:remaining}ms linear, opacity 400ms ease`;el.style.transform=`scale(${!started||completed?1:inhale?[1.13,1.26,1.16][i]:[.88,.9,.94][i]})`});
      if(started&&running&&!completed&&sound)speak(inhale?'코로 천천히 들이마셔요.':'입으로 천천히 내쉬어요.',true);
    }
    function display(){set('breathCount',String(Math.max(0,Math.ceil(remaining/1000))));if(circle)circle.style.strokeDashoffset=String(maxLen*(1-remaining/(durations[phase]*1000)));set('playBtnText',completed?'다시 시작':running?'잠깐 멈추기':started?'이어서 쉬기':'시작하기');set('playBtnIcon',running?'pause_circle':'play_circle');}
    function pause(){running=false;clearInterval(interval);interval=null;stopVoice();[sphere,byId('haloOuter'),byId('haloMiddle')].forEach(el=>{if(el){const t=getComputedStyle(el).transform;el.style.transition='none';el.style.transform=t}});display()}
    function done(){pause();completed=true;remaining=0;run.breaths=Math.max(run.breaths||0,total);addActivity('심호흡 '+total+'회');cards();visual(true);display();finishBtn.classList.remove('opacity-50');finishBtn.removeAttribute('aria-disabled');if(sound)speak('숨을 쉬었어요. 지금 마음을 확인해요.');auto=setTimeout(()=>{run.after='';saveRun();go('check.html')},1700)}
    function tick(){if(!running)return;const now=performance.now();remaining-=Math.min(now-last,1500);last=now;if(remaining<=0){if(phase===1&&cycle===total){done();return}if(phase===1){cycle++;phase=0}else phase=1;remaining=durations[phase]*1000;cards();visual()}display()}
    function start(){if(completed){reset();return}running=true;started=true;last=performance.now();clearInterval(interval);interval=setInterval(tick,60);cards();visual();display()}
    function reset(){clearTimeout(auto);pause();cycle=1;phase=0;remaining=durations[0]*1000;completed=false;started=false;cards();visual(true);display();finishBtn.setAttribute('aria-disabled','true');finishBtn.classList.add('opacity-50')}
    toggle.addEventListener('click',()=>running?pause():start());byId('resetBreathBtn').addEventListener('click',reset);byId('ttsToggleBtn').addEventListener('click',()=>{sound=!sound;set('ttsIcon',sound?'volume_up':'volume_off');byId('ttsToggleBtn').setAttribute('aria-pressed',String(sound));if(!sound)stopVoice();else if(running)speak(phase===0?'코로 천천히 들이마셔요.':'입으로 천천히 내쉬어요.',true);});
    finishBtn.addEventListener('click',e=>{e.preventDefault();if(!completed){notice('시작하기를 누르거나 건너뛰기를 선택해요.');return}clearTimeout(auto);run.after='';saveRun();go('check.html')});
    suspendActive=()=>{if(running)pause();};document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause()});window.addEventListener('pagehide',()=>{clearInterval(interval);clearTimeout(auto)});reset();
    // Pausing is also useful when opening the help dialog.
    
  }
  const activityInfo={water:['시원한 물 마시기','물 한 모금씩 천천히 마셔요.','💧'],doll:['포근한 인형·쿠션 안기','편안한 인형이나 쿠션을 안고 힘을 살며시 빼요.','🧸'],music:['조용한 음악 듣기','선생님과 정한 잔잔한 음악을 작은 소리로 들어요. 음악이 싫으면 조용히 쉬어도 돼요.','🎧'],draw:['종이에 색칠하기','좋아하는 색을 골라 종이에 천천히 색칠해요.','🖍️'],rest:['조용한 쉼터 쉬기','편안한 자세로 잠깐 쉬어요. 더 쉬고 싶으면 시간을 늘려도 돼요.','🌿'],stretch:['가볍게 스트레칭','어깨와 팔을 천천히 펴고 힘을 빼요. 아프면 멈춰요.','🙆']};
  function initActivity(){
    ensureRun();const id=run.selectedActivity||'rest',info=activityInfo[id]||activityInfo.rest;byId('activityTitle').textContent=info[0];byId('activityDesc').textContent=info[1];byId('activityEmoji').textContent=info[2];const ctl=byId('restControls');if(id!=='rest'){ctl.hidden=true;byId('activityDone').textContent='다 했어요'}if(id==='music'){byId('musicControls').hidden=false;const audio=byId('calmAudio');audio.volume=.3;audio.addEventListener('play',stopVoice);}
    let duration=Number(settings().rest)*60000,remaining=duration,running=false,last=0,tid=null;
    function display(){let sec=Math.max(0,Math.ceil(remaining/1000));byId('timerText').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;byId('timerRing').style.setProperty('--progress',`${duration?remaining/duration*100:0}%`);byId('restStart').textContent=running?'잠깐 멈추기':remaining===duration?'쉬기 시작':remaining===0?'다시 쉬기':'이어서 쉬기';}
    function pause(){running=false;clearInterval(tid);display()}
    function tick(){const now=performance.now();remaining-=now-last;last=now;if(remaining<=0){remaining=0;pause();byId('restStatus').textContent='쉬는 시간이 끝났어요. 마음이 어떤가요?';speak('쉬는 시간이 끝났어요. 더 쉬어도 괜찮아요.')}display()}
    function choose(min){pause();duration=min*60000;remaining=duration;$$('[data-minutes]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.minutes)===min));byId('restStatus').textContent='';display()}
    $$('[data-minutes]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.minutes)));byId('restStart').onclick=()=>{if(running){pause();return}if(remaining<=0)remaining=duration;running=true;last=performance.now();tid=setInterval(tick,100);display()};byId('restReset').onclick=()=>{pause();remaining=duration;byId('restStatus').textContent='';display()};byId('restMore').onclick=()=>{duration+=60000;remaining+=60000;byId('restStatus').textContent='1분을 더 쉬어요.';display()};byId('activityDone').onclick=()=>{pause();byId('calmAudio')?.pause();addActivity(info[0]);run.after='';saveRun();go('check.html')};suspendActive=()=>{pause();byId('calmAudio')?.pause();};document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendActive()});window.addEventListener('pagehide',()=>{clearInterval(tid);byId('calmAudio')?.pause()});choose(Number(settings().rest)||1);
  }
  function initAAC(){
    const tray=byId('selectedCardsTray'), grid=$('.aac-card').parentElement;let chosen=[];const extra=[['😡','화가 났어요','마음이 답답해요','feeling'],['😢','속상해요','마음이 아파요','feeling'],['😟','불안해요','무섭고 걱정돼요','feeling'],['😊','괜찮아졌어요','마음이 편안해요','feeling'],['✋','싫어요','그만하고 싶어요','help'],['🙋','도와주세요','선생님 도움이 필요해요','help'],['🔊','소리가 너무 커요','조용한 곳이 필요해요','help'],['💬','친구 때문에 속상해요','선생님과 이야기할래요','help']];
    const custom=(settings().customAAC||[]).filter(x=>typeof x==='string').slice(0,6);custom.forEach(t=>extra.push(['💬',t,'내가 하고 싶은 말','help']));const source=$('.aac-card');extra.forEach(([emoji,title,desc,cat])=>{const b=source.cloneNode(true);b.dataset.aac=title;b.dataset.cat=cat;b.setAttribute('aria-pressed','false');b.querySelector('h3').textContent=title;const p=b.querySelector('p');if(p)p.textContent=desc;const emo=b.querySelector('.text-4xl,.text-5xl,.text-6xl');if(emo)emo.textContent=emoji;else{const v=b.querySelector('span');if(v)v.textContent=emoji}b.removeAttribute('onclick');grid.append(b)});
    // Move the most important emotions and help into All; original need cards remain unchanged.
    function render(){tray.innerHTML=chosen.length?chosen.map((t,i)=>`<button class="aac-strip" data-remove="${i}" title="카드 빼기">${esc(t)} <span aria-hidden="true">×</span></button>`).join(''):'<span class="text-on-surface-variant text-sm">그림을 골라 내 마음을 말해요.</span>';$$('.aac-card').forEach(b=>{const yes=chosen.includes(b.dataset.aac);b.setAttribute('aria-pressed',String(yes));b.classList.toggle('aac-selected',yes);const ck=b.querySelector('.check-icon');if(ck){ck.classList.toggle('hidden',!yes);ck.classList.toggle('flex',yes)}});byId('ttsSpeakBtn').disabled=!chosen.length;byId('ttsSpeakBtn').classList.toggle('opacity-50',!chosen.length)}
    grid.addEventListener('click',e=>{const b=e.target.closest('.aac-card');if(!b)return;const t=b.dataset.aac;if(chosen.includes(t))chosen=chosen.filter(x=>x!==t);else chosen.push(t);render()});tray.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(b){chosen.splice(Number(b.dataset.remove),1);render()}});
    byId('clearAllBtn').onclick=()=>{chosen=[];render()};byId('ttsSpeakBtn').onclick=()=>{if(!chosen.length)return;const phrase='선생님, '+chosen.map(t=>t.replace(/[.!?]+$/,'')).join('. ')+'.';speak(phrase,true);addActivity('그림 AAC로 말하기');notice(phrase)};
    function filter(cat){const allow=settings().aacAllowed;$$('.category-chip').forEach(b=>{const yes=b.dataset.filter===cat;b.classList.toggle('active-filter',yes);b.setAttribute('aria-pressed',String(yes))});$$('.aac-card').forEach(b=>b.hidden=!(cat==='all'||cat===b.dataset.cat)||(Array.isArray(allow)&&!allow.includes(b.dataset.aac)&&!custom.includes(b.dataset.aac)));if(!$$('.aac-card').some(b=>!b.hidden))notice('이 범주에 표시할 카드가 없어요. 다른 범주를 골라요.')}
    $$('.category-chip').forEach(b=>b.addEventListener('click',()=>filter(b.dataset.filter)));filter(settings().display==='sentence'?'all':'need');render();
  }
  const scenarios=[
    ['🧸','친구가 내가 가지고 놀던 장난감을 가져갔어요.',['친구를 밀어요.','멈추고 천천히 숨 쉬어요.','선생님께 말해요.'],[1,2]],
    ['🎲','게임에서 졌어요.',['물건을 던져요.','잠깐 쉬고 다시 해요.','속상하다고 말해요.'],[1,2]],
    ['🧩','하고 싶은 활동을 지금 할 수 없어요.',['기다릴 시간을 선생님께 물어요.','큰 소리로 계속 소리쳐요.','다른 활동을 골라요.'],[0,2]],
    ['🔊','교실 소리가 너무 커요.',['친구를 때려요.','조용한 곳에서 쉬고 싶다고 말해요.','선생님께 도움을 요청해요.'],[1,2]],
    ['✏️','어려운 문제가 잘 풀리지 않아요.',['도와달라고 말해요.','책을 던져요.','잠깐 쉬어요.'],[0,2]],
    ['🎒','친구가 내 물건을 허락 없이 만졌어요.',['싫어요, 먼저 물어봐요 하고 말해요.','선생님께 말해요.','친구의 물건을 던져요.'],[0,1]]
  ];
  function initPractice(){
    const allowed=settings().scenarioAllowed;const indices=scenarios.map((_,i)=>i).filter(i=>!Array.isArray(allowed)||allowed.includes(i));if(!indices.length){byId('practiceCases').textContent='선생님이 연습할 상황을 설정해 주세요.';return;}byId('practiceCases').innerHTML=indices.map(i=>{const [e,t]=scenarios[i];return `<button class="scenario-card" data-case="${i}"><span aria-hidden="true">${e}</span><strong>${esc(t)}</strong></button>`}).join('');let idx=indices[0];
    function choose(i){idx=i;const [emoji,title,choices,correct]=scenarios[i];byId('practiceQuestion').hidden=false;byId('practiceNumber').textContent=`상황 ${i+1} / ${scenarios.length}`;byId('scenarioEmoji').textContent=emoji;byId('scenarioTitle').textContent=title;byId('practiceChoices').innerHTML=choices.map((t,n)=>`<button class="choice-card" data-choice="${n}"><span aria-hidden="true">${correct.includes(n)?'💬':'✋'}</span>${esc(t)}</button>`).join('');byId('practiceFeedback').textContent='';byId('practiceAct').hidden=true;byId('practiceQuestion').scrollIntoView({block:'start',behavior:'smooth'});}
    byId('practiceCases').onclick=e=>{const b=e.target.closest('[data-case]');if(b)choose(Number(b.dataset.case))};byId('practiceChoices').onclick=e=>{const b=e.target.closest('[data-choice]');if(!b)return;const n=Number(b.dataset.choice),good=scenarios[idx][3].includes(n);$$('.choice-card').forEach(x=>x.classList.remove('chosen'));b.classList.add('chosen');const message=good?'잘 골랐어요! 나와 친구를 안전하게 지키는 방법이에요. 다른 안전한 방법도 있어요.':'다른 방법도 생각해 볼까요? 손과 발을 멈추고 말하거나 도움을 요청해요.';byId('practiceFeedback').textContent=message;byId('practiceFeedback').classList.toggle('good',good);speak(message);if(good){ensureRun();run.practice=true;addActivity('상황별 연습 '+(idx+1));byId('practiceAct').hidden=false}};byId('scenarioSpeak').onclick=()=>speak(scenarios[idx][1],true);byId('otherCase').onclick=()=>choose(indices[(indices.indexOf(idx)+1)%indices.length]);byId('practiceAct').onclick=()=>{ensureRun();run.practice=true;saveRun();go('stop.html')};
  }
  function weekDays(){const now=new Date();const mon=new Date(now);mon.setDate(now.getDate()-((now.getDay()+6)%7));return Array.from({length:5},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d})}
  function stampMarkup(){const my=records.filter(r=>r.profile===current().id);const doneDays=new Set(my.map(r=>r.day||localDay(new Date(r.ended||r.started))));if(run.finished&&run.profile===current().id&&run.ended)doneDays.add(localDay(new Date(run.ended)));const ds=weekDays();let count=0;const html=ds.map((d,i)=>{const yes=doneDays.has(localDay(d));if(yes)count++;return `<div class="stamp-tile ${yes?'earned':''}"><span>${['월요일','화요일','수요일','목요일','금요일'][i]}</span><div class="stamp-icon"><span class="material-symbols-outlined text-2xl">${yes?'pets':'favorite_border'}</span></div><small>${yes?`${d.getMonth()+1}.${d.getDate()} 완료`:'아직'}</small></div>`}).join('');return {html,count}}
  function initComplete(){const steps=byId('completedSteps');if(steps){const labels=(run.finished?run.activities:[]).filter(x=>!x.includes('건너뛰기')).slice(0,4);steps.innerHTML=(labels.length?labels:['내 마음 돌보기']).map(x=>`<span class="flex items-center gap-1 px-3 py-1 bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm rounded-full"><span class="material-symbols-outlined text-base text-primary">check_circle</span>${esc(x)}</span>`).join('');steps.style.flexWrap='wrap'}const st=stampMarkup();byId('stampBoard').innerHTML=st.html;byId('stampSummary').textContent=`이번 주 5칸 중 ${st.count}개 완성`;byId('stampPercent').textContent=`${st.count}/5일`;byId('stampProgress').style.width=`${st.count*20}%`;if(run.finished){const performed=run.activities.filter(x=>!x.includes('건너뛰기'));byId('completionMessage').textContent=(performed.length?`${performed.join(', ')}을(를) 해보았어요. `:'')+'내 마음을 돌보려고 노력한 나에게 박수를 보내요. 더 쉬고 싶어도 괜찮아요.';}else{byId('completionMessage').textContent='내 마음을 돌보려고 노력하는 모든 순간이 소중해요.'}
    byId('feel-btn-calm').onclick=()=>{byId('feel-btn-calm').classList.add('bg-primary','text-on-primary');byId('feel-btn-calm').classList.remove('bg-surface-container','text-on-surface');run.after='괜찮아졌어요';saveRun();if(run.finished&&settings().record){const rec=records.find(r=>r.id===run.id);if(rec){rec.after=run.after;storage.set(KEY+'records',records)}};notice('마음이 편안해졌어요.')};byId('feel-btn-rest').onclick=()=>{newRun(run.emotion||'');run.selectedActivity='rest';saveRun();go('activity.html')};
  }
  function initRecords(){const st=stampMarkup();byId('studentStamp').innerHTML=st.html;const list=records.filter(r=>r.profile===current().id).slice(0,20);byId('studentRecordList').innerHTML=list.length?list.map(r=>`<div class="record-row"><div><strong>${esc(r.emotion||'마음 돌보기')}</strong><span>${esc((r.activities||[]).join(' · ')||'활동 완료')}</span></div><span>${esc(dateText(r.ended))}</span></div>`).join(''):`<p class="empty-state">${settings().record?'아직 저장된 활동 기록이 없어요.':'활동 기록을 저장하지 않도록 설정되어 있어요. 선생님이 설정에서 켤 수 있어요.'}</p>`;}
  async function hashPin(pin){if(window.crypto?.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('mind-guardian-v1:'+pin));return 'sha256:'+Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}return 'local:'+Array.from(pin).reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0,2166136261)}
  const aacBase=['물 마실래요','조용히 쉴래요','인형 안을래요','선생님 안아주세요','잠깐 나갈래요','기다려 주세요','몸이 아파요','그만하고 싶어요','화가 났어요','속상해요','불안해요','괜찮아졌어요','싫어요','도와주세요','소리가 너무 커요','친구 때문에 속상해요'];
  function initTeacher(){let selected=active;let unlocked=storage.get(KEY+'teacherUnlocked',false,true);const lock=byId('teacherLock'),content=byId('teacherContent');
    const fields={voiceEnabled:['voice',v=>v==='1'],voiceRate:['rate',Number],inhaleSeconds:['inhale',Number],exhaleSeconds:['exhale',Number],restMinutes:['rest',Number],recordEnabled:['record',v=>v==='1'],displayMode:['display',String],breathCycles:['cycles',Number]};
    function show(){lock.hidden=unlocked;content.hidden=!unlocked;if(unlocked)render();}
    function render(){if(!unlocked)return;const today=localDay();const dayRecords=records.filter(r=>r.day===today);const dayHelps=helps.filter(h=>localDay(new Date(h.time))===today);byId('kpis').innerHTML=[['등록 학생',profiles.length+'명','groups'],['오늘 완료',dayRecords.length+'회','check_circle'],['오늘 도움 요청',dayHelps.length+'회','support_agent'],['누적 활동',records.length+'회','pets']].map(([t,v,ic])=>`<div class="kpi"><span class="material-symbols-outlined">${ic}</span><div><small>${t}</small><strong>${v}</strong></div></div>`).join('');byId('profileCards').innerHTML=profiles.map(p=>{const cnt=records.filter(r=>r.profile===p.id).length;return `<div class="profile-card"><div><strong>${esc(p.name)}</strong><small>${cnt}개 활동 · ${p.id===active?'현재 사용 중':'대기'}</small></div><button class="app-btn ${p.id===active?'primary':'muted'} compact" data-activate="${esc(p.id)}">${p.id===active?'사용 중':'사용하기'}</button></div>`}).join('');byId('settingsProfile').innerHTML=profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');if(!profiles.some(p=>p.id===selected))selected=active;byId('settingsProfile').value=selected;loadFields();renderRecords();renderDevicePanel(selected);}
    function loadFields(){const p=profiles.find(p=>p.id===selected)||current(),cfg={...defaults,...p.settings};for(const [id,[key]] of Object.entries(fields))byId(id).value=typeof cfg[key]==='boolean'?(cfg[key]?'1':'0'):String(cfg[key]);const checks=(id,items,allowed)=>{byId(id).innerHTML=items.map(([v,t])=>`<label><input type="checkbox" value="${esc(v)}" ${!Array.isArray(allowed)||allowed.includes(v)?'checked':''}>${esc(t)}</label>`).join('')};checks('calmOptions',Object.entries(activityInfo).map(([k,a])=>[k,a[0]]),cfg.calmAllowed);checks('aacOptions',aacBase.map(t=>[t,t]),cfg.aacAllowed);checks('scenarioOptions',scenarios.map((sc,i)=>[i,'상황 '+(i+1)]),cfg.scenarioAllowed);byId('customAAC').value=(cfg.customAAC||[]).join('\n');}
    const nameOf=id=>profiles.find(p=>p.id===id)?.name||'이전 학생';
    function renderRecords(){byId('recordList').innerHTML=records.length?records.map(r=>`<div class="record-row"><div><strong>${esc(nameOf(r.profile))} · ${esc(r.emotion||'마음 돌보기')}</strong><span>${esc((r.activities||[]).join(' · ')||'활동 완료')} · 처음 강도 ${esc(r.level??'미선택')} · 이후 ${esc(r.after||'미선택')} ${r.help?' · 도움 요청':''}</span></div><span>${esc(dateText(r.ended))}</span></div>`).join(''):'<p class="empty-state">저장된 활동 기록이 없습니다. 학생별 기록 저장을 켜면 활동 완료 시 기록됩니다.</p>';byId('helpList').innerHTML=helps.length?helps.map(r=>`<div class="record-row"><div><strong>${esc(nameOf(r.profile))} · 도움 요청</strong><span>${esc(r.emotion)}</span></div><span>${esc(dateText(r.time))}</span></div>`).join(''):'<p class="empty-state">저장된 도움 요청 기록이 없습니다.</p>'}
    async function unlock(){const pin=byId('pinInput').value;const msg=byId('pinMessage');if(!/^\d{4,12}$/.test(pin)){msg.textContent='숫자 4~12자리를 입력해 주세요.';return}const h=await hashPin(pin),old=storage.get(KEY+'pin',null);if(old&&old!==h){msg.textContent='PIN이 맞지 않습니다.';return}if(!old&&!storage.set(KEY+'pin',h)){msg.textContent='저장소를 사용할 수 없습니다.';return}unlocked=true;storage.set(KEY+'teacherUnlocked',true,true);byId('pinInput').value='';show()}
    byId('pinSubmit').onclick=unlock;byId('pinInput').addEventListener('keydown',e=>{if(e.key==='Enter')unlock()});byId('addProfile').onclick=()=>{const name=byId('newProfile').value.trim();if(!name){byId('profileMessage').textContent='별칭을 입력해 주세요.';return}if(profiles.some(p=>p.name===name)){byId('profileMessage').textContent='이미 있는 별칭입니다.';return}const p={id:uid(),name,settings:{...defaults}};profiles.push(p);storage.set(KEY+'profiles',profiles);selected=p.id;byId('newProfile').value='';byId('profileMessage').textContent='학생 프로필을 추가했습니다.';render()};
    byId('profileCards').onclick=e=>{const b=e.target.closest('[data-activate]');if(!b)return;active=b.dataset.activate;storage.set(KEY+'active',active);selected=active;if(device.mode==='shared'){sessionStudent=active;storage.set(KEY+'sessionStudent',active,true);}else{device.student=active;storage.set(KEY+'deviceMode',device);}newRun();render()};byId('settingsProfile').onchange=e=>{selected=e.target.value;loadFields()};
    byId('saveSettings').onclick=()=>{const p=profiles.find(p=>p.id===selected);if(!p)return;const s={...defaults};for(const [id,[key,parse]] of Object.entries(fields))s[key]=parse(byId(id).value);s.inhale=Math.max(2,Math.min(6,s.inhale||3));s.exhale=Math.max(2,Math.min(8,s.exhale||4));s.calmAllowed=$$('#calmOptions input:checked').map(x=>x.value);s.aacAllowed=$$('#aacOptions input:checked').map(x=>x.value);s.scenarioAllowed=$$('#scenarioOptions input:checked').map(x=>Number(x.value));s.customAAC=[...new Set(byId('customAAC').value.split(/\r?\n/).map(x=>x.trim().slice(0,45)).filter(Boolean))].slice(0,6);if(!s.calmAllowed.length||!s.aacAllowed.length||!s.scenarioAllowed.length){byId('settingsMessage').textContent='각 종류에서 최소 한 개의 카드를 선택해 주세요.';return}p.settings=s;storage.set(KEY+'profiles',profiles);byId('settingsMessage').textContent='설정을 저장했습니다.';loadFields()};
    byId('clearRecords').onclick=()=>{if(confirm('이 기기에 저장된 모든 활동 및 도움 요청 기록을 삭제할까요?')){records=[];helps=[];storage.set(KEY+'records',records);storage.set(KEY+'helps',helps);render()}};
    function csvCell(v){let t=String(v??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'}
    byId('exportRecords').onclick=()=>{const rows=[['학생 별칭','날짜','처음 감정','강도','활동','이후 감정','도움 요청','연습 여부'],...records.map(r=>[nameOf(r.profile),r.ended,r.emotion,r.level,(r.activities||[]).join(' / '),r.after,r.help?'예':'아니오',r.practice?'예':'아니오'])];const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='마음지킴이_활동기록_'+localDay()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
    byId('changePin').onclick=async()=>{const p=byId('newPin').value;if(!/^\d{4,12}$/.test(p)){byId('changePinMessage').textContent='숫자 4~12자리로 입력해 주세요.';return}storage.set(KEY+'pin',await hashPin(p));byId('newPin').value='';byId('changePinMessage').textContent='PIN을 변경했습니다.'};show();
    // Teacher state is only for the current tab and clears when leaving for student mode.
    $$('a[href="index.html"]').forEach(a=>a.addEventListener('click',()=>storage.set(KEY+'teacherUnlocked',false,true)));
  }
  installStudentStyles();
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if(page!=='teacher')storage.set(KEY+'teacherUnlocked',false,true);
  if(studentGate())return;
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  initHeader();initEmotion();
  if(page==='breathing')initBreathing();if(page==='activity')initActivity();if(page==='aac')initAAC();if(page==='practice')initPractice();if(page==='complete')initComplete();if(page==='records')initRecords();if(page==='teacher')initTeacher();
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
  // On file:// pages, provide a clear launch hint rather than making a false offline/install promise.
  if(location.protocol==='file:'&&page==='index'){notice('설치·기록 기능은 로컬 서버 또는 HTTPS 배포에서 사용해 주세요.');}
})();
