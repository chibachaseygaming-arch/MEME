const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = new Proxy({createLinearGradient:()=>({addColorStop(){}})}, { get: (o, k) => o[k] || ((...args) => {
  for (const value of args) if (typeof value === 'number') assert(Number.isFinite(value), 'Rendering must use finite coordinates');
}) });
const elements = {}, listeners = {}, storage = {};
function element(id) {
  return elements[id] ||= { id, style: {setProperty(){}}, value: '', classList: { add() {}, remove() {}, toggle() {} },
    replaceChildren() {}, appendChild() {}, getContext: () => context,
    addEventListener: (name, fn) => listeners[id + ':' + name] = fn,
    requestPointerLock: () => Promise.resolve() };
}
const sandbox = { console, assert, document: {
  getElementById: element, createElement: () => element(Math.random()),
  querySelectorAll: () => [{}, {}, {}], addEventListener: (name, fn) => listeners[name] = fn,
  exitPointerLock() {}, documentElement: {} }, window: { addEventListener() {} },
  localStorage: { getItem: k => storage[k] ?? null, setItem: (k, v) => storage[k] = v },
  performance: { now: () => 0 }, requestAnimationFrame() {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../game.js'), 'utf8'), sandbox);
vm.runInContext(`
muted=true; start();
assert.equal(actors.filter(a=>a.type==='enemy').length,5);
assert.equal(total,22); render();
 kills=4;updateDoorArrow();assert.equal($('doorwaypoint').hidden,true);
 kills=5;updateDoorArrow();assert.equal($('doorwaypoint').hidden,false);assert($('doorarrow').style.transform.includes('rotate'));
 p.x=5.5;p.y=11.5;updateDoorArrow();assert.equal($('doorwaypoint').hidden,true);p.x=15.5;p.y=11.5;kills=0;
assert.equal(map.length,28);assert.equal(map[0].length,40);
const exit=doors.find(d=>d.x===FPS_DOOR.x&&d.y===FPS_DOOR.y);assert(exit);
p.x=13.5;p.y=11.5;p.a=Math.PI;assert(toggleDoor());assert.equal(map[11][12],'0');assert(findRoute(p.x,p.y,5.5,11.5).length>0);
pause();goWork();pause();goWork();assert.equal(map[11][12],'0');assert(doors[0].open);
p.x=5.5;p.y=11.5;assert(!insideOffice(p.x,p.y));actors=[];update(6.1);assert(capturePoints[0].owned);render();
start();
// Weapon damage, combo, and economy must actually affect combat.
p={x:3.5,y:4.5,a:0,hp:100};actors=[{type:'enemy',role:'clerk',x:5,y:4.5,hp:2,maxHp:2,alive:true,phase:0,attack:3,talk:9}];
const initialMoney=money;weapon=2;shoot();assert.equal(kills,1);assert.equal(money,initialMoney+10);assert.equal(combo,1);
// Shockwave stuns enemies but never harms civilians.
actors=[{type:'enemy',x:5,y:4.5,hp:2,alive:true},{type:'civilian',x:5.5,y:4.5,hp:2,alive:true}];
pulse();assert.equal(actors[0].stunned,3);assert.equal(actors[1].hp,2);assert.equal(burstCooldown,10);
// Door-aware route generation preserves a path through every maze.
for(let i=0;i<30;i++){map=makeMaze();assert(doors[0].entrance);assert.equal(map[doors[0].y][doors[0].x],'4');assert.equal(Math.hypot(doors[0].x-1,doors[0].y-1),1);assert(findRoute(1.5,1.5,desk.x,desk.y,true).length>0);}
// Paused combat survives work mode transitions.
start();const savedActors=actors;pause();goWork();assert.equal(mode,'work');
const door=doors[0];assert(door);assert(blocked(door.x+.5,door.y+.5));
const adjacent=[[1,0],[-1,0],[0,1],[0,-1]].find(([x,y])=>!blocked(door.x+x+.5,door.y+y+.5));
p.x=door.x+adjacent[0]+.5;p.y=door.y+adjacent[1]+.5;assert(toggleDoor());assert(!blocked(door.x+.5,door.y+.5));
render();p.x=desk.x;p.y=desk.y+1.1;toggleComputer();assert.equal(state,'pc');assert(seated);
money=500;assert(buyUpgrade('pay'));assert.equal(money,400);assert(!buyUpgrade('pay'));
const before=money;useComputer();assert.equal(money,before+50);useComputer();assert.equal(money,before+50);
// A perfect rookie run pays its base reward plus the perfect bonus, once.
$('difficulty').value='rookie';startTraining();for(let i=0;i<6;i++)kick();
assert.equal(money,before+200);assert(!training.active);kick();assert.equal(money,before+200);
// Chaos uses a different target count and must fail after three expired targets.
$('difficulty').value='chaos';startTraining();for(let i=0;i<3;i++)updateTraining(2);
assert(!training.active);assert.equal(training.misses,3);assert.equal($('difficulty').disabled,false);
closePC();assert.equal(state,'playing');assert(!seated);pause();goWork();assert.equal(actors,savedActors);render();
// Keep every wave count and completion reward consistent with HUD totals.
for(wave=1;wave<=3;wave++){actors=[];nextWave();assert.equal(actors.filter(a=>a.type==='enemy'||a.type==='boss').length,[5,7,10][wave-1]);}
wave=3;const cash=money;finish(true);assert.equal(money,cash+250);
turnView(Math.PI*2001);assert(p.a>=0&&p.a<Math.PI*2);
console.log('PASS: rendering, combat rewards, shotgun, safe shockwave, 30 reachable mazes, doors, shop, training tiers, work restoration, waves, mission pay, 360-degree look');
`, sandbox);
