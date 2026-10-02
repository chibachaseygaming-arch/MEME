/* Self-contained canvas raycaster: no engine, downloads, or build step. */
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d',{alpha:false});
const $=id=>document.getElementById(id), W=640,H=360;canvas.width=W;canvas.height=H;
let map=[
'11111111111111111111',
'10000000000000000001',
'10000200000030000001',
'10000200000030000001',
'10000000000000000001',
'10000000110000000001',
'10000000110000220001',
'10000000000000000001',
'10033000000000000001',
'10000000003300000001',
'10000000000000000001',
'10000022000000200001',
'10000000000000200001',
'10000000000000000001',
'11111111111111111111'];
let p={x:3.5,y:4.5,a:0,hp:100},actors=[],keys={},state='menu',wave=1,kills=0,total=0,score=0,rescued=0,accidents=0,ammo=12,reserve=72,reload=0,cooldown=0,flash=0,hurt=0,hit=0,bob=0,clock=0,msgTime=0,transition=0,muted=false,ac;
const combatMap=map.slice();
let mode='combat',money=(()=>{try{return Number(localStorage.getItem('debi-money')||0)||0;}catch{return 0;}})(),earned=0,payFlash=0,workCooldown=0,manualUnlock=false,combatSave=null;
let seated=false,standingPose=null,doors=[];
const desk={type:'desk',x:17.5,y:11.5,alive:true,phase:0};
function makeMaze(){
 const grid=Array.from({length:15},()=>Array(20).fill('2')),stack=[[1,1]],seen=new Set(['1,1']);grid[1][1]='0';
 while(stack.length){const [x,y]=stack[stack.length-1],choices=[[2,0],[-2,0],[0,2],[0,-2]].map(([dx,dy])=>[x+dx,y+dy,dx,dy]).filter(([nx,ny])=>nx>0&&ny>0&&nx<19&&ny<14&&!seen.has(nx+','+ny));
 if(!choices.length){stack.pop();continue;}const [nx,ny,dx,dy]=choices[Math.floor(Math.random()*choices.length)];grid[y+dy/2][x+dx/2]='0';grid[ny][nx]='0';seen.add(nx+','+ny);stack.push([nx,ny]);}
 // Leave room for a desk, chair, and a reachable seat.
 for(let y=10;y<=13;y++)for(let x=16;x<=18;x++)grid[y][x]='0';
 doors=[];
 const candidates=[];
 for(let y=1;y<14;y++)for(let x=1;x<19;x++)if(grid[y][x]==='0'&&(x<16||y<10)&&x+y>5&&((grid[y-1][x]!=='0'&&grid[y+1][x]!=='0'&&grid[y][x-1]==='0'&&grid[y][x+1]==='0')||(grid[y][x-1]!=='0'&&grid[y][x+1]!=='0'&&grid[y-1][x]==='0'&&grid[y+1][x]==='0')))candidates.push({x,y});
 candidates.sort(()=>Math.random()-.5);
 for(const c of candidates){if(doors.length>=8)break;if(doors.some(d=>Math.hypot(d.x-c.x,d.y-c.y)<3))continue;doors.push({...c,open:false});grid[c.y][c.x]='4';}
 return grid.map(r=>r.join(''));
}
function syncMode(){
 $('workprompt').hidden=mode!=='work';$('payflash').style.opacity=0;
 const labels=document.querySelectorAll('.panel small');labels[0].textContent=mode==='work'?'BANK BALANCE':'EMPLOYEE WELLBEING';labels[1].textContent=mode==='work'?'PAY PER TASK':'FOAM ROUNDS';labels[2].textContent=mode==='work'?'TASKS COMPLETED':'VILLAINS BONKED';
 $('reloadhint').textContent=mode==='work'?'LMB AT YOUR COMPUTER':'R TO RELOAD';$('tips').textContent=mode==='work'?'WASD MOVE · E LOCK / UNLOCK CURSOR · F DOORS / PC · LMB WORK · SHIFT SPRINT · ESC PAUSE':'WASD MOVE · MOUSE AIM · CLICK SHOOT · R RELOAD · SHIFT SPRINT · F RESCUE · E CURSOR LOCK · ESC PAUSE';
 $('work').textContent=mode==='work'?'RETURN TO SHOOTER →':'GO TO WORK · EARN MONEY →';
}
function goWork(){
 seated=false;standingPose=null;
 if(mode==='work'){doors=[];mode='combat';map=combatMap.slice();p=combatSave.p;actors=combatSave.actors;reload=combatSave.reload;flash=0;message('Back to villain bonking. Your money is safe.');}
 else{combatSave={p:{...p},actors,reload};mode='work';map=makeMaze();p={x:1.5,y:1.5,a:0,hp:100};actors=[{...desk}];reload=0;flash=0;earned=0;message('Find your desk! Follow the yellow beacon. LMB on the computer earns $25.');}
 state='playing';keys={};$('overlay').hidden=true;syncMode();lock();
}
function nearbyDoor(){
 return doors.filter(d=>Math.hypot(d.x+.5-p.x,d.y+.5-p.y)<1.65&&ray(p.x,p.y,Math.atan2(d.y+.5-p.y,d.x+.5-p.x)).d>=Math.hypot(d.x+.5-p.x,d.y+.5-p.y)-.74).sort((a,b)=>Math.hypot(a.x+.5-p.x,a.y+.5-p.y)-Math.hypot(b.x+.5-p.x,b.y+.5-p.y))[0];
}
function toggleDoor(){
 const d=nearbyDoor();if(!d)return false;
 if(d.open&&Math.abs(p.x-(d.x+.5))<.75&&Math.abs(p.y-(d.y+.5))<.75){message('Step away from the doorway before closing it.');return true;}
 d.open=!d.open;const row=map[d.y];map[d.y]=row.slice(0,d.x)+(d.open?'0':'4')+row.slice(d.x+1);sound(d.open?230:150,.18,'triangle');message(d.open?'Door opened. Please do not slam it. HR is listening.':'Door closed. This meeting is now private.');return true;
}
const upgrades=(()=>{try{return JSON.parse(localStorage.getItem('debi-upgrades'))||{};}catch{return {};}})();
const upgradeList=[{id:'power',name:'FOAM CANNON',desc:'Double blaster damage',price:150},{id:'armor',name:'HR BODY ARMOR',desc:'Take 40% less damage',price:200},{id:'pay',name:'SPREADSHEET TURBO',desc:'Earn $50 per work task',price:100},{id:'boots',name:'BREACH BOOTS',desc:'More time to click kick targets',price:125}];
let training={active:false,hits:0,misses:0,time:0};
function saveProgress(){try{localStorage.setItem('debi-money',String(money));localStorage.setItem('debi-upgrades',JSON.stringify(upgrades));}catch{}}
function updatePC(){
 $('pcbalance').textContent='$'+money.toLocaleString();$('task').textContent='COMPLETE TASK · +$'+(upgrades.pay?50:25);
 $('shop').replaceChildren();for(const item of upgradeList){const button=document.createElement('button');button.textContent=item.name+' · '+(upgrades[item.id]?'OWNED':'$'+item.price)+' — '+item.desc;button.disabled=!!upgrades[item.id]||money<item.price;button.onclick=()=>buyUpgrade(item.id);$('shop').appendChild(button);}
}
function buyUpgrade(id){const item=upgradeList.find(i=>i.id===id);if(!item||upgrades[id]||money<item.price)return false;money-=item.price;upgrades[id]=true;saveProgress();sound(700,.15,'sine');updatePC();return true;}
function openPC(){state='pc';keys={};$('pc').hidden=false;$('workprompt').hidden=true;document.exitPointerLock?.();updatePC();}
function closePC(){training.active=false;$('target').hidden=true;$('pc').hidden=true;state='playing';toggleComputer();lock();}
function nextKick(){training.time=upgrades.boots?2.3:1.5;$('target').hidden=false;$('target').style.left=(24+Math.random()*42)+'%';$('target').style.top=(15+Math.random()*52)+'%';}
function startTraining(){training={active:true,hits:0,misses:0,time:0};$('trainingdoor').classList.remove('down');$('trainstart').textContent='RESTART TRAINING →';nextKick();}
function kick(){if(!training.active)return;training.hits++;sound(100,.14,'sawtooth');$('trainingdoor').style.translate=(training.hits%2?4:-4)+'px';if(training.hits>=6){training.active=false;$('target').hidden=true;$('trainingdoor').classList.add('down');money+=100;saveProgress();updatePC();payFlash=.18;$('trainresult').textContent='DOOR DOWN! CERTIFIED MENACE · +$100';$('trainstats').textContent='6 / 6 KICKS · '+training.misses+' MISSES · TRAIN AGAIN ANYTIME';}else nextKick();}
function updateTraining(dt){workCooldown=Math.max(0,workCooldown-dt);payFlash=Math.max(0,payFlash-dt);$('payflash').style.opacity=payFlash*1.8;if(!training.active)return;training.time-=dt;if(training.time<=0){training.misses++;sound(70,.12);if(training.misses>=3){training.active=false;$('target').hidden=true;$('trainresult').textContent='THREE MISSES. THE DOOR HAS WON. TRY AGAIN.';return;}nextKick();}$('target').textContent=training.time.toFixed(1);$('trainresult').textContent=training.hits+' / 6 KICKS · '+training.misses+' / 3 MISSES';}
$('pcclose').onclick=closePC;$('task').onclick=()=>{useComputer();updatePC();};$('trainstart').onclick=startTraining;$('target').onclick=kick;$('training').addEventListener('click',e=>{if(e.target.id!=='target'&&training.active){training.time=0;}});
function toggleComputer(){
 if(mode!=='work'||state!=='playing')return;
 if(seated){p={...standingPose};seated=false;standingPose=null;keys={};message('Back on your feet. F to sit at the PC again.');return;}
 const d=Math.hypot(desk.x-p.x,desk.y-p.y),a=Math.atan2(desk.y-p.y,desk.x-p.x);
 if(d>1.9||ray(p.x,p.y,a).d<d-.2){message('Get close to your computer, then press F to hop on.');return;}
 standingPose={...p};seated=true;p.x=desk.x;p.y=desk.y+1.1;p.a=Math.PI*1.5;keys={};message('You hopped on your PC! LMB completes work for $25 · F stands up.');sound(500,.12,'triangle');openPC();
}
function useComputer(){
 if(!['playing','pc'].includes(state)||mode!=='work'||workCooldown>0)return;
 if(!seated){message('Press F near your PC to sit down first.');return;}
 const d=Math.hypot(desk.x-p.x,desk.y-p.y),angle=Math.atan2(desk.y-p.y,desk.x-p.x)-p.a,aim=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)));
 if(d>1.85||aim>.45||ray(p.x,p.y,p.a).d<d-.3){message('Get close to your desk and aim at the computer. Follow the yellow beam!');return;}
 const pay=upgrades.pay?50:25;money+=pay;earned++;workCooldown=.55;payFlash=.18;try{localStorage.setItem('debi-money',String(money));}catch{}sound(850,.14,'sine');message(['Spreadsheet successfully spreadsheeted. +$25!','You replied “Sounds good!” +$25!','One email deleted. Economy saved. +$25!','You moved a file into another folder. +$25!'][earned%4].replace('+$25','+$'+pay));
}
const depth=new Float32Array(W), jokes=['Your lunch is now company property!','I schedule meetings about meetings!','Reply-all is my love language!','Your password must contain a regret!','I microwave fish at work!','Unpaid overtime builds character!'];
const blocked=(x,y)=>!map[Math.floor(y)]||map[Math.floor(y)][Math.floor(x)]!=='0';
function ray(x,y,a,max=30){let dx=Math.cos(a)*.035,dy=Math.sin(a)*.035,d=0;while(d<max&&!blocked(x,y)){x+=dx;y+=dy;d+=.035}return {d,x,y,t:map[Math.floor(y)]?.[Math.floor(x)]||'1'};}
function move(o,dx,dy){const r=.22;if(!blocked(o.x+dx+Math.sign(dx)*r,o.y)&&!blocked(o.x+dx+Math.sign(dx)*r,o.y-r)&&!blocked(o.x+dx+Math.sign(dx)*r,o.y+r))o.x+=dx;if(!blocked(o.x,o.y+dy+Math.sign(dy)*r)&&!blocked(o.x-r,o.y+dy+Math.sign(dy)*r)&&!blocked(o.x+r,o.y+dy+Math.sign(dy)*r))o.y+=dy;}
function sound(freq=250,duration=.08,type='square',volume=.04){if(muted)return;try{ac ||= new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,ac.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.45),ac.currentTime+duration);g.gain.setValueAtTime(volume,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+duration);}catch{}}
function message(s){$('message').textContent=s;msgTime=3.5;}
function spawn(type,n){for(let i=0;i<n;i++){let x,y,tries=0;do{x=1.5+Math.random()*17;y=1.5+Math.random()*11}while((blocked(x,y)||Math.hypot(x-p.x,y-p.y)<4||actors.some(a=>Math.hypot(a.x-x,a.y-y)<.7))&&++tries<500);if(tries===500)continue;actors.push({type,x,y,hp:type==='boss'?5:2,phase:Math.random()*6.28,attack:2+Math.random()*3,talk:4+Math.random()*12,alive:true});}}
function nextWave(){spawn('enemy',wave===1?3:wave===2?4:4);if(wave===3)spawn('boss',1);spawn('civilian',3);spawn('coffee',3);spawn('ammo',3);message(['','SHIFT 1: Lunch thieves on the loose.','SHIFT 2: Middle management has entered the chat.','FINAL SHIFT: Defeat the Chief Monday Officer.'][wave]);}
function start(){doors=[];seated=false;standingPose=null;mode='combat';map=combatMap.slice();combatSave=null;payFlash=0;syncMode();p={x:3.5,y:4.5,a:0,hp:100};actors=[];wave=1;kills=0;score=0;rescued=0;accidents=0;ammo=12;reserve=72;reload=0;transition=0;total=12;state='playing';$('menu').style.display='none';$('overlay').hidden=true;$('hud').style.visibility='visible';$('crosshair').style.display='block';$('tips').style.display='block';nextWave();lock();}
const FULL_TURN=Math.PI*2;
function turnView(delta){if(Number.isFinite(delta))p.a=((p.a+delta)%FULL_TURN+FULL_TURN)%FULL_TURN;}
async function lock(){
 manualUnlock=false;
 try{
  // Relative movement keeps turning when the hidden cursor reaches a screen edge.
  try{await canvas.requestPointerLock({unadjustedMovement:true});}
  catch{await canvas.requestPointerLock();}
  if(document.pointerLockElement===canvas)message('360° mouse look on · E releases your cursor · Escape pauses');
 }catch{message('Click the game or press E to enable 360° mouse look. Arrow keys also turn.');}
}
function pause(){if(state!=='playing')return;state='paused';keys={};$('overlay').hidden=false;$('endlabel').textContent='ON YOUR COFFEE BREAK';$('endtitle').textContent='PAUSED';$('endtext').textContent='Your paperwork can wait. Click below to resume.';$('resume').hidden=false;$('work').hidden=false;syncMode();document.exitPointerLock?.();}
function finish(win){state=win?'won':'lost';$('overlay').hidden=false;$('endlabel').textContent=win?'EMPLOYEE OF THE EXTREMELY WEIRD MONTH':'PERFORMANCE REVIEW: NEEDS MORE COFFEE';$('endtitle').textContent=win?'MONDAY CANCELLED.':'CLOCKED OUT.';$('endtext').textContent=`${kills} villains bonked · ${rescued} civilians rescued · ${accidents} friendly-fire mistakes · ${score} points. ${win?'The break room is safe. Your reward: a pizza party with exactly one slice.':'The villains won this shift. Try again and keep moving!'}`;$('resume').hidden=true;$('work').hidden=true;document.exitPointerLock?.();}
function shoot(){if(mode==='work'){useComputer();return;}if(state!=='playing'||cooldown>0||reload>0)return;if(ammo<=0){sound(80);message('Empty! Press R to reload.');return}ammo--;cooldown=.22;flash=.12;sound(170,.11,'sawtooth',.08);const wall=ray(p.x,p.y,p.a).d;const targets=actors.filter(a=>a.alive&&['enemy','boss','civilian'].includes(a.type)).map(a=>{const d=Math.hypot(a.x-p.x,a.y-p.y),angle=Math.atan2(a.y-p.y,a.x-p.x)-p.a;return {a,d,angle:Math.atan2(Math.sin(angle),Math.cos(angle))}}).filter(t=>t.d<wall+.1&&Math.abs(t.angle)<Math.atan(.3/t.d)).sort((a,b)=>a.d-b.d);if(targets.length){let a=targets[0].a;hit=.15;if(a.type==='civilian'){score-=150;accidents++;p.hp=Math.max(0,p.hp-8);message('That is a civilian! Blue = good. HR deducted 150 points.');hurt=.2;a.phase+=1;}else{a.hp-=upgrades.power?2:1;sound(460,.08,'triangle');if(a.hp<=0){a.alive=false;a.dead=1;kills++;score+=a.type==='boss'?500:100;message(a.type==='boss'?'Chief Monday Officer has been promoted to unemployed.':['Bonked! Your lunch has been avenged.','A very constructive performance review.','That meeting could have been a foam dart.','Hostile work environment: resolved.'][kills%4]);}}}}
function beginReload(){if(mode==='work'||state!=='playing'||reload||ammo===12)return;if(!reserve){message('No spare rounds. Find an orange ammo crate!');return}reload=1.4;sound(320,.12,'triangle');message('Reloading the Complaint Dispenser…');}
document.addEventListener('keydown',e=>{if(state==='pc'){if(e.code==='KeyF'||e.code==='Escape'){e.preventDefault();closePC();}return;}if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='KeyR')beginReload();if(e.code==='Escape')pause();if(e.code==='Space')shoot();if(e.code==='KeyE'&&!e.repeat&&state==='playing'){if(document.pointerLockElement===canvas){manualUnlock=true;document.exitPointerLock?.();}else lock();}if(e.code==='KeyF'&&!e.repeat&&state==='playing'&&mode==='work'){if(seated||Math.hypot(desk.x-p.x,desk.y-p.y)<1.9)toggleComputer();else if(!toggleDoor())toggleComputer();return;}if(e.code==='KeyF'&&!e.repeat&&state==='playing'){const a=actors.find(a=>a.alive&&a.type==='civilian'&&Math.hypot(a.x-p.x,a.y-p.y)<1.8&&ray(p.x,p.y,Math.atan2(a.y-p.y,a.x-p.x)).d>=Math.hypot(a.x-p.x,a.y-p.y)-.2);if(a){a.alive=false;rescued++;score+=200;message('Civilian rescued! “Thank you! I just wanted to use the printer.”');sound(700,.2,'sine');}}});
document.addEventListener('keyup',e=>keys[e.code]=false);document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&state==='playing')turnView(e.movementX*.004);});canvas.addEventListener('mousedown',e=>{if(e.button!==0)return;if(state==='playing'){if(document.pointerLockElement!==canvas){lock();if(mode==='work')useComputer();}else shoot();}});document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='playing'&&!manualUnlock)pause();});window.addEventListener('blur',pause);$('work').onclick=goWork;$('start').onclick=start;$('restart').onclick=start;$('resume').onclick=()=>{state='playing';$('overlay').hidden=true;lock();};$('mute').onclick=()=>{muted=!muted;$('mute').textContent=muted?'SOUND OFF':'SOUND ON';};
function update(dt){clock+=dt;if(state==='pc'){updateTraining(dt);return;}if(state!=='playing')return;cooldown=Math.max(0,cooldown-dt);flash=Math.max(0,flash-dt);hurt=Math.max(0,hurt-dt);hit=Math.max(0,hit-dt);msgTime-=dt;if(msgTime<=0)$('message').textContent='';if(reload){reload-=dt;if(reload<=0){const amount=Math.min(12-ammo,reserve);ammo+=amount;reserve-=amount;reload=0;sound(420);}}let forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),side=(keys.KeyD?1:0)-(keys.KeyA?1:0);turnView(((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*dt*1.8);let speed=(keys.ShiftLeft||keys.ShiftRight?3.4:2.3)*dt/Math.max(1,Math.hypot(forward,side));if(!seated)move(p,(Math.cos(p.a)*forward-Math.sin(p.a)*side)*speed,(Math.sin(p.a)*forward+Math.cos(p.a)*side)*speed);if(!seated&&(forward||side))bob+=dt*10;
 payFlash=Math.max(0,payFlash-dt);workCooldown=Math.max(0,workCooldown-dt);$('payflash').style.opacity=payFlash*1.8;
 if(mode==='work'){
 $('health').textContent=String.fromCharCode(36)+money.toLocaleString();$('healthbar').style.width='100%';$('ammo').textContent='$25';$('kills').textContent=String(earned);$('score').textContent='FOLLOW THE YELLOW BEAM';$('status').textContent='WORK MODE · THE CUBICLE LABYRINTH';$('damage').style.opacity=0;$('hitmarker').style.opacity=0;
 const d=Math.hypot(desk.x-p.x,desk.y-p.y);$('workprompt').textContent=seated?'LMB TO WORK (+$25) · F TO STAND':d<1.9?'PRESS F TO HOP ON YOUR PC':nearbyDoor()?'F TO '+(nearbyDoor().open?'CLOSE':'OPEN')+' DOOR':'YOUR DESK · '+Math.round(d)+'m · YELLOW BEACON';$('workprompt').hidden=false;return;
 }$('workprompt').hidden=true;
for(const a of actors){if(!a.alive){if(a.dead)a.dead-=dt;continue}const d=Math.hypot(a.x-p.x,a.y-p.y);a.phase+=dt;if(['enemy','boss'].includes(a.type)){const angle=Math.atan2(p.y-a.y,p.x-a.x),visible=ray(a.x,a.y,angle).d>d-.2;if(visible){if(d>1.1)move(a,Math.cos(angle)*dt*(.55+wave*.12),Math.sin(angle)*dt*(.55+wave*.12));a.attack-=dt;if(a.attack<=0&&d<8){a.attack=2.1+Math.random();p.hp-=(a.type==='boss'?12:6)*(upgrades.armor?.6:1);hurt=.3;sound(80,.15);message('You were hit by a weaponized expense report!');}a.talk-=dt;if(a.talk<=0){a.talk=10+Math.random()*10;message(a.type==='boss'?'BOSS: “Every day is Monday now!”':`VILLAIN: “${jokes[Math.floor(Math.random()*jokes.length)]}”`);}}}else if(a.type==='coffee'&&d<.65&&p.hp<100){a.alive=false;p.hp=Math.min(100,p.hp+25);sound(600,.1,'sine');message('Coffee acquired. +25 employee wellbeing.');}else if(a.type==='ammo'&&d<.65){a.alive=false;reserve+=24;sound(350,.1);message('24 foam rounds. Aggressive stationery restocked.');}}
if(p.hp<=0){p.hp=0;finish(false);}else if(!actors.some(a=>a.alive&&['enemy','boss'].includes(a.type))){transition+=dt;if(transition<dt*2)message(wave===3?'All villains defeated!':'Wave clear! Next shift in 4 seconds. Rescue remaining civilians!');if(transition>4){if(wave===3)finish(true);else{wave++;transition=0;ammo=12;reserve+=24;p.hp=Math.min(100,p.hp+20);nextWave();}}}
$('health').textContent=Math.ceil(p.hp)+'%';$('healthbar').style.width=p.hp+'%';$('ammo').textContent=reload?'RELOADING':`${ammo} / ${reserve}`;$('kills').textContent=`${kills} / ${total}`;$('score').textContent=`${score} POINTS · ${rescued} RESCUED`;$('status').textContent=`SHIFT ${wave} / 3 · ${['THE PAPERWORK UPRISING','MEETING MAYHEM','CHIEF MONDAY OFFICER'][wave-1]}`;$('damage').style.opacity=hurt*2;$('hitmarker').style.opacity=hit*6;}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}function text(s,x,y,size=8,c='#f4efd8'){ctx.fillStyle=c;ctx.font=`bold ${size}px monospace`;ctx.textAlign='center';ctx.fillText(s,x,y);}
function sprite(a){const s=document.createElement('canvas');s.width=96;s.height=128;const c=s.getContext('2d');const r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};const t=(str,x,y,size,color)=>{c.font=`bold ${size}px monospace`;c.fillStyle=color;c.textAlign='center';c.fillText(str,x,y)};
if(['enemy','boss','civilian'].includes(a.type)){const civ=a.type==='civilian',boss=a.type==='boss';r(22,118,55,6,'#0005');r(29,88,14,31,'#23323c');r(54,88,14,31,'#23323c');r(25,116,19,7,'#131d26');r(54,116,19,7,'#131d26');r(23,49,50,44,civ?'#409dde':boss?'#863344':'#c53c38');r(14,52,11,38,civ?'#409dde':'#ac3431');r(73,52,11,38,civ?'#409dde':'#ac3431');r(15,85,9,9,'#efbc91');r(73,85,9,9,'#efbc91');r(38,48,20,12,'#f2eee0');r(46,54,5,26,civ?'#72e6be':'#f8c94c');r(32,16,32,34,'#edba8e');r(29,13,38,10,boss?'#eee2ad':'#433d32');r(31,21,5,13,'#433d32');r(39,30,4,4,'#182b2d');r(54,30,4,4,'#182b2d');r(40,41,17,3,'#633628');if(!civ){r(36,25,9,3,'#322b29');r(53,25,9,3,'#322b29');r(4,68,29,9,'#e5e2c6');r(8,62,23,19,'#eee8cc');t('BILL',20,73,7,'#a43c33');}else{t('♥',48,10,15,'#82ff9a');r(56,64,12,12,'#ebf5d8');t('ID',62,73,6,'#1c506c');}if(boss){r(27,5,43,9,'#ecc66b');r(30,0,7,10,'#ecc66b');r(45,0,7,10,'#ecc66b');r(61,0,7,10,'#ecc66b');t('CEO',48,96,10,'#f8d77b');}}
else if(a.type==='desk'){
 r(4,80,88,10,'#c19b63');r(4,90,88,6,'#815e3e');r(10,95,8,28,'#3e4a4e');r(78,95,8,28,'#3e4a4e');r(22,21,54,43,'#25343b');r(26,25,46,35,'#66d9a0');t('WORK PC',49,40,8,'#153e31');t('CLICK ME',49,53,7,'#153e31');r(45,64,8,12,'#32454b');r(33,74,33,4,'#32454b');r(23,83,44,4,'#ececd5');r(74,80,10,7,'#e5e8cb');t('YOUR DESK',48,14,9,'#ffe375');
 }
else if(a.type==='coffee'){r(25,91,43,5,'#0005');r(28,58,35,32,'#ece8cf');r(63,63,12,20,'#ece8cf');r(64,68,6,10,'#7e9b87');r(30,55,30,6,'#71432c');t('+',46,80,18,'#459b60');t('COFFEE',48,46,9,'#e7f9b5');}
else{r(18,74,61,24,'#cc7940');r(18,69,61,9,'#efa65b');r(43,69,10,29,'#f8d578');t('AMMO',48,91,10,'#392b21');t('+24',48,57,12,'#ffd28f');}return s;}
const sprites={};['enemy','boss','civilian','coffee','ammo','desk'].forEach(type=>sprites[type]=sprite({type}));
function render(){const horizon=H/2+Math.sin(bob)*1.5;rect(0,0,W,horizon,'#263b39');rect(0,horizon,W,H,'#3b433a');for(let y=0;y<horizon;y+=10){rect(0,y,W,1,'#314a4518');}for(let y=horizon+4;y<H;y+=3){let shade=Math.floor(40+(y-horizon)*.18);rect(0,y,W,3,`rgb(${shade},${shade+6},${shade-1})`);}for(let x=0;x<W;x+=2){const angle=p.a+Math.atan((x-W/2)/(W*.78)),r=ray(p.x,p.y,angle),dist=r.d*Math.cos(angle-p.a);depth[x]=depth[x+1]=dist;const height=Math.min(1500,H/dist),top=horizon-height/2;const tile=r.t;let fraction=(Math.abs(r.x-Math.round(r.x))<.04?r.y:r.x)%1;let light=Math.max(.17,1-dist/20);const palette=tile==='4'?[158,100,51]:tile==='2'?[88,115,119]:tile==='3'?[163,127,83]:[110,133,110];rect(x,top,2,height,`rgb(${palette.map(v=>v*light|0).join(',')})`);rect(x,top+height*.07,2,height*.04,`rgba(224,236,205,${light*.5})`);rect(x,top+height*.79,2,height*.03,'#233b35');rect(x,top+height*.95,2,height*.05,'#243833');if(fraction<.025)rect(x,top,2,height,'#203732');if(tile==='1'&&fraction>.18&&fraction<.83){rect(x,top+height*.29,2,height*.24,`rgba(19,51,48,${light})`);if(fraction>.25&&fraction<.76)rect(x,top+height*.35,2,height*.035,`rgba(201,227,159,${light})`);}if(tile==='4'){if(fraction<.07||fraction>.93)rect(x,top,2,height,'#3b3025');if(fraction>.15&&fraction<.85){rect(x,top+height*.18,2,height*.17,'#293b35');rect(x,top+height*.6,2,height*.25,'#76502f');}if(fraction>.73&&fraction<.84)rect(x,top+height*.48,2,height*.035,'#ffe37b');}if(tile==='3'&&fraction>.1&&fraction<.9){for(let j=0;j<4;j++)rect(x,top+height*(.23+j*.15),2,height*.06,`rgba(74,62,47,${light})`);}}
if(mode==='work'){drawDeskBeam(horizon);drawWorkDesk3D(horizon);}const sorted=actors.filter(a=>a.type!=='desk'&&(a.alive||a.dead>0)).map(a=>({a,d:Math.hypot(a.x-p.x,a.y-p.y)})).sort((a,b)=>b.d-a.d);for(const {a,d} of sorted){let angle=Math.atan2(a.y-p.y,a.x-p.x)-p.a;angle=Math.atan2(Math.sin(angle),Math.cos(angle));if(Math.abs(angle)>1.1||d<.15)continue;const z=d*Math.cos(angle),size=H/z*(a.type==='boss'?1.24:1),sx=W/2+Math.tan(angle)*W*.78,sy=horizon+H/z*.5-size+(a.alive?Math.sin(a.phase*3)*1.7: size*.7),sw=size*.75;ctx.globalAlpha=a.alive?1:Math.max(0,a.dead);for(let x=Math.max(0,Math.floor(sx-sw/2));x<Math.min(W,sx+sw/2);x++){if(z<depth[x])ctx.drawImage(sprites[a.type],(x-(sx-sw/2))/sw*96,0,1,128,x,sy,1,size);}ctx.globalAlpha=1;if(a.alive&&d<5&&z<depth[Math.max(0,Math.min(W-1,Math.floor(sx)))]){text(a.type==='desk'?'YOUR COMPUTER · LMB':a.type==='civilian'?'GOOD GUY · F TO RESCUE':a.type==='boss'?'CHIEF MONDAY OFFICER':a.type==='enemy'?'LUNCH THIEF':'',sx,sy-8,Math.max(5,Math.min(9,20/d)),a.type==='civilian'?'#a5ffc5':'#ffd7a3');}}
// Overhead fixtures and a perspective-projected 3D foam blaster.
for(let i=0;i<4;i++){let lx=((i*173-p.a*100)%800+800)%800-80;rect(lx,18,65,3,'#b7c7a750');}if(state!=='menu'&&mode==='combat')drawGun3D();drawMiniMap();}
const gunFaces=[];
function gunBox(x,y,z,w,h,d,color){
 const v=[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x,y+h,z+d]];
 [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]].forEach((indices,i)=>gunFaces.push({v:indices.map(j=>v[j]),color,light:[.65,.75,1.2,.42,.9,.6][i]}));
}
function gunTube(x,y,z,r,length,color){
 const n=12;
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;
 gunFaces.push({v:[[x+Math.cos(a)*r,y+Math.sin(a)*r,z],[x+Math.cos(b)*r,y+Math.sin(b)*r,z],[x+Math.cos(b)*r,y+Math.sin(b)*r,z+length],[x+Math.cos(a)*r,y+Math.sin(a)*r,z+length]],color,light:.8-Math.sin((a+b)/2)*.35});}
 gunFaces.push({v:Array.from({length:n},(_,i)=>[x+Math.cos(i/n*Math.PI*2)*r,y+Math.sin(i/n*Math.PI*2)*r,z+length]),color:[24,36,40],light:1});
}
// The mesh uses 3D vertices, depth sorting, face lighting, and perspective.
gunBox(.18,.39,.75,.48,.3,1.04,[218,149,54]);
gunBox(.21,.36,.85,.42,.045,.87,[252,204,102]);
gunBox(.23,.69,.81,.31,.48,.28,[44,63,66]);
gunBox(.28,.64,1.3,.23,.31,.24,[54,73,75]);
gunBox(.26,.65,1.57,.26,.055,.32,[39,54,60]);
gunBox(.26,.69,1.84,.26,.15,.045,[39,54,60]);
gunTube(.42,.5,1.7,.16,.79,[65,83,86]);
gunTube(.42,.5,2.32,.195,.16,[239,182,77]);
gunTube(.42,.5,2.48,.135,.03,[24,36,40]);
gunBox(.33,.29,.96,.18,.075,.28,[44,64,64]);
gunBox(.365,.255,1.01,.11,.035,.16,[194,243,103]);
gunBox(.385,.285,2.13,.07,.085,.08,[45,63,64]);
gunBox(.401,.271,2.145,.038,.018,.045,[212,253,121]);
for(let i=0;i<5;i++)gunBox(.665,.46,.96+i*.12,.014,.12,.055,[110,77,36]);
gunBox(.15,.75,.66,.44,.25,.31,[208,164,119]);
gunBox(.1,.94,.52,.46,.18,.34,[33,54,64]);
gunBox(.43,.73,1.45,.3,.19,.36,[208,164,119]);
gunBox(.55,.87,1.3,.35,.34,.29,[33,54,64]);
function drawGun3D(){
 const recoil=flash/.12,drop=reload?Math.sin(reload/1.4*Math.PI):0,pitch=-recoil*.12+drop*.62,yaw=drop*.22;
 const transform=v=>{let [x,y,z]=v;x-=.42;z-=1.1;const xx=x*Math.cos(yaw)-z*Math.sin(yaw),zz=x*Math.sin(yaw)+z*Math.cos(yaw);const yy=(y-.55)*Math.cos(pitch)-zz*Math.sin(pitch),zp=(y-.55)*Math.sin(pitch)+zz*Math.cos(pitch);return [xx+.42+Math.sin(bob)*.015,yy+.55+drop*.35+Math.abs(Math.cos(bob))*.012,zp+1.1-recoil*.09];};
 const project=v=>[W/2+v[0]*285/Math.max(.15,v[2]),H/2+v[1]*285/Math.max(.15,v[2])];
 const faces=gunFaces.map(f=>({...f,v:f.v.map(transform)})).sort((a,b)=>b.v.reduce((s,v)=>s+v[2],0)/b.v.length-a.v.reduce((s,v)=>s+v[2],0)/a.v.length);
 ctx.save();ctx.lineJoin='round';
 for(const f of faces){ctx.beginPath();f.v.forEach((v,i)=>{const q=project(v);if(i)ctx.lineTo(...q);else ctx.moveTo(...q);});ctx.closePath();ctx.fillStyle='rgb('+f.color.map(c=>Math.min(255,c*f.light)|0).join(',')+')';ctx.fill();ctx.strokeStyle='#182a2938';ctx.lineWidth=.55;ctx.stroke();}
 if(flash){const q=project(transform([.42,.5,2.55]));ctx.beginPath();for(let i=0;i<12;i++){const angle=i*Math.PI/6,r=i%2?8:20;const x=q[0]+Math.cos(angle)*r,y=q[1]+Math.sin(angle)*r;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle='#eeff9d';ctx.fill();ctx.beginPath();ctx.arc(q[0],q[1],6,0,Math.PI*2);ctx.fillStyle='#fffbea';ctx.fill();}
 ctx.restore();
}
// World-space solid meshes for the desk, tower, monitor, and keyboard.
const deskFaces=[];
function deskBox(x,h,z,w,height,d,color){
 const v=[[x,h,z],[x+w,h,z],[x+w,h+height,z],[x,h+height,z],[x,h,z+d],[x+w,h,z+d],[x+w,h+height,z+d],[x,h+height,z+d]];
 [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]].forEach((ids,i)=>deskFaces.push({v:ids.map(j=>v[j]),color,light:[1,.6,.5,1.2,.75,.85][i]}));
}
deskBox(-.62,.3,-.38,1.24,.075,.78,[177,126,70]);
for(const x of [-.55,.49])for(const z of [-.3,.31])deskBox(x,0,z,.06,.3,.06,[46,61,64]);
deskBox(-.18,.375,.16,.36,.025,.2,[45,54,62]);
deskBox(-.04,.4,.23,.08,.17,.055,[54,65,69]);
deskBox(-.32,.49,.2,.64,.4,.06,[35,43,55]);
deskBox(-.285,.52,.19,.57,.335,.009,[69,214,157]);
deskBox(-.255,.765,.178,.51,.035,.006,[177,255,208]);
deskBox(-.255,.67,.178,.31,.018,.006,[25,105,76]);
deskBox(-.255,.62,.178,.43,.018,.006,[25,105,76]);
deskBox(-.26,.375,-.28,.52,.027,.2,[196,204,201]);
for(let row=0;row<3;row++)for(let col=0;col<10;col++)deskBox(-.24+col*.048,.402,-.26+row*.05,.034,.01,.032,[57,74,76]);
deskBox(.35,.375,-.23,.08,.04,.12,[222,227,214]);
deskBox(.42,0,.03,.15,.29,.35,[39,49,57]);
deskBox(.46,.21,.025,.065,.024,.01,[169,241,112]);
function drawWorkDesk3D(horizon){
 const faces=deskFaces.map(f=>({...f,v:f.v.map(([x,h,z])=>{const dx=desk.x+x-p.x,dy=desk.y-z-p.y;return [(dy*Math.cos(p.a)-dx*Math.sin(p.a)),h,dx*Math.cos(p.a)+dy*Math.sin(p.a)];})})).filter(f=>f.v.every(v=>v[2]>.06)).sort((a,b)=>b.v.reduce((n,v)=>n+v[2],0)-a.v.reduce((n,v)=>n+v[2],0));
 for(const f of faces){const points=f.v.map(([side,h,z])=>[W/2+side*W*.78/z,horizon+(.5-h)*H/z]);const min=Math.max(0,Math.floor(Math.min(...points.map(q=>q[0])))),max=Math.min(W-1,Math.ceil(Math.max(...points.map(q=>q[0])))),z=f.v.reduce((n,v)=>n+v[2],0)/4;
 ctx.save();ctx.beginPath();for(let x=min;x<=max;x++)if(z<depth[x]+.1)ctx.rect(x,0,1,H);ctx.clip();ctx.beginPath();points.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();ctx.fillStyle='rgb('+f.color.map(c=>Math.min(255,c*f.light)|0).join(',')+')';ctx.fill();ctx.restore();}
 if(seated){text('PAYROLL ONLINE · LMB +$25',W/2,horizon-12,9,'#efffdc');text('BALANCE: $'+money.toLocaleString(),W/2,horizon+6,8,'#173c32');}
}
function drawDeskBeam(horizon){
 if(seated)return;
 const dx=desk.x-p.x,dy=desk.y-p.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx)-p.a,angle=Math.atan2(Math.sin(a),Math.cos(a));
 // The beacon is a waypoint: it intentionally remains visible through maze walls.
 if(Math.abs(angle)<.9){const sx=W/2+Math.tan(angle)*W*.78,z=Math.max(.5,d*Math.cos(angle)),width=Math.max(9,100/z),base=Math.min(H,horizon+H/z*.45);ctx.save();ctx.globalAlpha=.2+.07*Math.sin(clock*4);rect(sx-width*2,0,width*4,base,'#ffe333');ctx.globalAlpha=.6;rect(sx-width/2,0,width,base,'#ffe44b');ctx.globalAlpha=.9;rect(sx-1.5,0,3,base,'#fff6ad');ctx.restore();text('YOUR DESK',sx,52,9,'#ffe66b');}
 else{text(angle>0?'DESK →':'← DESK',angle>0?W-70:70,60,10,'#ffe66b');}
}
function drawMiniMap(){const scale=4,ox=W-94,oy=H-79;rect(ox-6,oy-15,91,80,'#101b18d0');text(mode==='work'?'DESK RADAR':'OFFICE RADAR',ox+39,oy-5,6,'#c4d7a4');for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)if(map[y][x]!=='0')rect(ox+x*scale,oy+y*scale,scale-1,scale-1,'#63735a');for(const a of actors)if(a.alive&&['enemy','boss','civilian','desk'].includes(a.type))rect(ox+a.x*scale-1,oy+a.y*scale-1,2,2,a.type==='desk'?'#ffe333':a.type==='civilian'?'#69bfff':'#fb7566');for(const d of doors)rect(ox+d.x*scale,oy+d.y*scale,3,3,d.open?'#8da966':'#e7b464');rect(ox+p.x*scale-1,oy+p.y*scale-1,3,3,'#d8f77a');ctx.strokeStyle='#d8f77a';ctx.beginPath();ctx.moveTo(ox+p.x*scale,oy+p.y*scale);ctx.lineTo(ox+p.x*scale+Math.cos(p.a)*5,oy+p.y*scale+Math.sin(p.a)*5);ctx.stroke();}
let last=performance.now();function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(frame);
}spawn('enemy',5);spawn('civilian',4);spawn('coffee',4);spawn('ammo',3);requestAnimationFrame(frame);
