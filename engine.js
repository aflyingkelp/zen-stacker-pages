/** Standalone, deterministic falling-block engine. Coordinates include 20 hidden rows. */
export const WIDTH = 10;
export const HEIGHT = 40;
export const VISIBLE_START = 20;
export const COLORS = { I:'#45d4ed', O:'#f5d45a', T:'#b97aef', S:'#80d66d', Z:'#ec6d80', J:'#628fee', L:'#eea157', G:'#697c8b' };

const BASE = {
  I:[[0,1],[1,1],[2,1],[3,1]], O:[[1,0],[2,0],[1,1],[2,1]],
  T:[[1,0],[0,1],[1,1],[2,1]], S:[[1,0],[2,0],[0,1],[1,1]],
  Z:[[0,0],[1,0],[1,1],[2,1]], J:[[0,0],[0,1],[1,1],[2,1]], L:[[2,0],[0,1],[1,1],[2,1]]
};
export const SHAPES = Object.fromEntries(Object.entries(BASE).map(([type,base]) => {
  const rotations = [base.map(c=>[...c])];
  for(let r=1;r<4;r++) rotations.push(type==='O' ? base.map(c=>[...c]) : rotations[r-1].map(([x,y])=>[type==='I'?3-y:2-y,x]));
  return [type,rotations];
}));

// Official SRS offsets, converted from upward-positive to screen coordinates.
const KICKS = {
 '01':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
 '10':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
 '12':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
 '21':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
 '23':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
 '32':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
 '30':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
 '03':[[0,0],[1,0],[1,-1],[0,2],[1,2]]
};
const I_KICKS = {
 '01':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
 '10':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
 '12':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
 '21':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
 '23':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
 '32':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
 '30':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
 '03':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
};
// SRS+ mirrors the I-piece tests for symmetrical left/right behavior.
const I_PLUS_KICKS = {
 '01':[[0,0],[1,0],[-2,0],[-2,1],[1,-2]],
 '12':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
 '23':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
 '30':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
 '03':[[0,0],[-1,0],[2,0],[2,1],[-1,-2]],
 '10':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
 '21':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
 '32':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]]
};
const HALF_KICKS = {
 0:[[0,0],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0]],
 1:[[0,0],[1,0],[1,-2],[1,-1],[0,-2],[0,-1]],
 2:[[0,0],[0,1],[-1,1],[1,1],[-1,0],[1,0]],
 3:[[0,0],[-1,0],[-1,-2],[-1,-1],[0,-2],[0,-1]]
};
const DEFAULTS = {
 gravity:.8, gravityMode:'relaxed', lockDelay:500, maxLockResets:15,
 infiniteHold:false, leveling:'on', spinMode:'allspins+', comboMode:'multiplier', kickTable:'srsplus',
 topoutMode:'endless', garbageMode:'off', garbageAmount:1, garbageInterval:4, messiness:100, cheeseHeight:6
};
const emptyRow = () => Array(WIDTH).fill(null);
const emptyBoard = () => Array.from({length:HEIGHT},emptyRow);
const clone = value => JSON.parse(JSON.stringify(value));
const limit = (n,min,max,fallback) => Number.isFinite(Number(n)) ? Math.min(max,Math.max(min,Number(n))) : fallback;

export class ZenEngine {
 constructor(settings={}) {
  this.emit=()=>{};
  this.settings={...DEFAULTS,...settings};
  this.paused=false;
  this._history=[];this._future=[];
  this.reset();
 }

 reset() {
  this.dead=false;this.board=emptyBoard();this.queue=[];this.held=null;this.canHold=true;this.piece=null;
  this.stats={score:0,lines:0,level:1,pieces:0,time:0,combo:-1,b2b:-1,pps:0,apm:0,attack:0,xp:0,topouts:0,tspins:0,quads:0,perfectClears:0,lastClear:''};
  this._rngState=(Number(this.settings.seed)>>>0)||((Date.now()^(Math.random()*0xffffffff))>>>0)||1;
  this._garbageRngState=(this._rngState^0x9e3779b9)>>>0||1;this._fallTime=0;this._lockTime=0;this._lockResets=0;this._lastRotation=null;this._garbageClock=0;
  this._garbageHole=-1;this._pendingGarbage=0;this._garbageFraction=0;
  this._history=[];this._future=[];this.paused=false;
  this._fillQueue();
  if(this.settings.garbageMode==='cheese-layer') this._insertGarbage(Math.round(limit(this.settings.cheeseHeight,1,18,6)),false);
  this._spawn();this._event('reset');
  return this;
 }

 setSettings(patch={}) {
  const previous=this.settings.garbageMode;
  this.settings={...this.settings,...patch};
  this.settings.gravity=limit(this.settings.gravity,0,120,.8);
  this.settings.lockDelay=limit(this.settings.lockDelay,0,5000,500);
  this.settings.garbageInterval=limit(this.settings.garbageInterval,.25,300,4);
  this.settings.messiness=limit(this.settings.messiness,0,100,100);
  if(this.settings.infiniteHold) this.canHold=true;
  if(previous!==this.settings.garbageMode) {
   this._pendingGarbage=0;this._garbageFraction=0;this._garbageClock=0;
   if(this.settings.garbageMode==='cheese-layer') this._refillCheese();
  }
  this._event('settings');return this.settings;
 }

 _event(type,data={}) { this.emit?.({type,...data}); }
 _random() {
  let n=this._rngState; n^=n<<13;n^=n>>>17;n^=n<<5;this._rngState=n>>>0;
  return this._rngState/4294967296;
 }
 _garbageRandom(){let n=this._garbageRngState||1;n^=n<<13;n^=n>>>17;n^=n<<5;this._garbageRngState=n>>>0;return this._garbageRngState/4294967296;}
 _fillQueue() {
  while(this.queue.length<14) {
   const bag=Object.keys(BASE);
   for(let i=bag.length-1;i>0;i--) {const j=Math.floor(this._random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
   this.queue.push(...bag);
  }
 }
 cells(piece=this.piece) {
  if(!piece||!SHAPES[piece.type]) return [];
  return SHAPES[piece.type][piece.rotation].map(([x,y])=>[x+piece.x,y+piece.y]);
 }
 collides(x=this.piece?.x,y=this.piece?.y,rotation=this.piece?.rotation,type=this.piece?.type) {
  if(!SHAPES[type]) return true;
  return SHAPES[type][rotation].some(([cx,cy])=>{
   const bx=cx+x,by=cy+y;
   return bx<0||bx>=WIDTH||by<0||by>=HEIGHT||Boolean(this.board[by][bx]);
  });
 }
 _grounded() {return !!this.piece&&this.collides(this.piece.x,this.piece.y+1);}
 _spawn(type=null) {
  // Spawn inside the visible playfield so zero-gravity modes show an active piece.
  // Hidden rows remain available for kicks, garbage displacement, and recovery.
  this._fillQueue();this.piece={type:type||this.queue.shift(),x:3,y:VISIBLE_START,rotation:0};
  this._fillQueue();this.canHold=true;this._fallTime=0;this._lockTime=0;this._lockResets=0;this._lastRotation=null;
  if(this.collides()) this._recover();
  this._turnStart=this._capture();
  this._event('spawn',{piece:{...this.piece}});
 }
 _resetLock(wasGrounded) {
  if(wasGrounded&&this._lockResets<limit(this.settings.maxLockResets,0,1000,15)) {
   this._lockTime=0;this._lockResets++;
  }
 }
 move(dx) {
  if(this.dead||this.paused||!this.piece||!Number.isFinite(dx)||dx===0) return false;
  const step=Math.sign(dx),steps=Math.min(40,Math.abs(Math.trunc(dx)));let moved=0;
  for(let n=0;n<steps;n++) {
   const grounded=this._grounded();
   if(this.collides(this.piece.x+step,this.piece.y)) break;
   this.piece.x+=step;this._resetLock(grounded);moved++;
  }
  if(moved) {this._lastRotation=null;this._future=[];this._event('move',{dx:moved*step});}
  return moved>0;
 }
 rotate(direction=1) {
  if(this.paused||!this.piece) return false;
  const from=this.piece.rotation,to=(from+(direction===2?2:direction<0?3:1))%4;
  const grounded=this._grounded();let tests=[[0,0]];
  if(this.piece.type!=='O'&&this.settings.kickTable!=='none') {
   if(direction===2) tests=this.settings.kickTable==='srsplus'?(this.piece.type==='I'?HALF_KICKS[from].slice(0,2):HALF_KICKS[from]):[[0,0]];
   else tests=(this.piece.type==='I'?(this.settings.kickTable==='srsplus'?I_PLUS_KICKS:I_KICKS):KICKS)[`${from}${to}`];
  }
  for(let i=0;i<tests.length;i++) {
   const [dx,dy]=tests[i];
   if(this.collides(this.piece.x+dx,this.piece.y+dy,to)) continue;
   this.piece.x+=dx;this.piece.y+=dy;this.piece.rotation=to;
   this._lastRotation={from,to,kick:i,direction};this._resetLock(grounded);this._future=[];
   this._event('rotate',{direction,kick:i});return true;
  }
  return false;
 }
 softDrop(cells=1) {
  if(this.paused||!this.piece) return 0;
  let distance=0;
  const steps=cells===Infinity?HEIGHT:Math.round(limit(cells,0,HEIGHT,1));
  for(let i=0;i<steps;i++) {
   if(this.collides(this.piece.x,this.piece.y+1)) break;
   this.piece.y++;distance++;
  }
  if(distance) {this.stats.score+=distance;this._fallTime=0;this._lockTime=0;this._lastRotation=null;this._future=[];this._event('move',{dy:distance,soft:true});}
  return distance;
 }
 ghostY() {
  if(!this.piece) return 0;
  let y=this.piece.y;
  while(!this.collides(this.piece.x,y+1)) y++;
  return y;
 }
 hardDrop() {
  if(this.paused||!this.piece) return false;
  const distance=this.ghostY()-this.piece.y;
  this.piece.y+=distance;this.stats.score+=distance*2;this._future=[];
  if(distance>0)this._lastRotation=null;
  this._event('drop',{distance});this._lock();return true;
 }
 hold() {
  if(this.paused||!this.piece||(!this.canHold&&!this.settings.infiniteHold)) return false;
  const turn=this._turnStart,old=this.held;this.held=this.piece.type;
  this._spawn(old);this.canHold=!!this.settings.infiniteHold;this._turnStart=turn;this._future=[];
  this._event('hold',{held:this.held});return true;
 }

 _spin() {
  const p=this.piece;
  const mode=this.settings.spinMode;
  if(mode==='none')return null;
  if(mode==='stupid')return {type:p.type,mini:false};
  if(!this._lastRotation)return null;
  const occupied=(x,y)=>x<0||x>=WIDTH||y<0||y>=HEIGHT||Boolean(this.board[y][x]);
  if(p.type==='T') {
   const corners=[[0,0],[2,0],[0,2],[2,2]].map(([x,y])=>occupied(p.x+x,p.y+y));
   if(corners.filter(Boolean).length>=3) {
    const front=[[0,1],[1,3],[2,3],[0,2]][p.rotation];
    const full=(corners[front[0]]&&corners[front[1]])||(this._lastRotation.direction!==2&&this._lastRotation.kick===4);
    return {type:'T',mini:mode==='mini-only'||!full};
   }
  }
  if(mode==='handheld'&&['L','J','S','Z'].includes(p.type)) {
   const corners=[[0,0],[2,0],[0,2],[2,2]].filter(([x,y])=>occupied(p.x+x,p.y+y));
   if(corners.length>=3)return {type:p.type,mini:false,halfAttack:true};
  }
  const allowImmobile=p.type==='T' ? ['tspins+','allspins+','allmini+','mini-only'].includes(mode) : ['allspins','allmini','allspins+','allmini+','mini-only'].includes(mode);
  if(allowImmobile&&this.collides(p.x-1,p.y)&&this.collides(p.x+1,p.y)&&this.collides(p.x,p.y-1)&&this.collides(p.x,p.y+1))
   return {type:p.type,mini:p.type==='T'||['allmini','allmini+','mini-only'].includes(mode)};
  return null;
 }

 _lock() {
  if(!this.piece) return;
  const p={...this.piece},spin=this._spin();
  if(this._turnStart) {this._history.push(clone(this._turnStart));if(this._history.length>50)this._history.shift();}
  this._future=[];
  for(const [x,y] of this.cells()) if(y>=0&&y<HEIGHT&&x>=0&&x<WIDTH)this.board[y][x]=p.type;
  const full=[];for(let y=0;y<HEIGHT;y++)if(this.board[y].every(Boolean))full.push(y);
  for(const y of full)this.board.splice(y,1),this.board.unshift(emptyRow());
  const lines=full.length,perfect=lines>0&&this.board.every(row=>row.every(cell=>!cell));
  this.stats.pieces++;this.stats.lines+=lines;
  if(lines>0)this.stats.combo++;else this.stats.combo=-1;
  const difficult=lines===4||Boolean(spin&&lines>0),wasB2B=this.stats.b2b>=0;
  if(difficult)this.stats.b2b++;else if(lines>0)this.stats.b2b=-1;
  const mini=!!spin?.mini;
  let points=spin?(mini?[100,200,400][lines]||400:[400,800,1200,1600][lines]||1600):[0,100,300,500,800][lines]||0;
  if(difficult&&wasB2B)points=Math.round(points*1.5);
  if(lines>0&&this.settings.comboMode!=='none')points+=50*Math.max(0,this.stats.combo);
  if(perfect)points+=3500;
  // Zen level changes the pace, while clear points remain independent of level.
  this.stats.score+=points;
  let attack=spin?(mini?Math.max(0,lines-1):lines*2):[0,0,1,2,4][lines]||0;
  if(spin?.halfAttack)attack=Math.floor(attack/2);
  if(difficult&&wasB2B)attack++;
  if(lines>0&&this.settings.comboMode!=='none') {
   const combo=Math.max(0,this.stats.combo);
   attack+=this.settings.comboMode==='classic'?Math.min(5,Math.floor(combo/2)):this.settings.comboMode==='modern'?Math.min(5,Math.floor((combo+1)/2)):Math.floor(combo/2)+Math.floor(attack*combo*.25);
  }
  if(perfect)attack+=10;
  this.stats.attack+=attack;
  if(spin)this.stats.tspins+=spin.type==='T'?1:0;
  if(lines===4)this.stats.quads++;
  if(perfect)this.stats.perfectClears++;
  const names=['','SINGLE','DOUBLE','TRIPLE','QUAD'];
  const kind=perfect?'PERFECT CLEAR':spin?`${spin.type}-SPIN${mini?' MINI':''}${lines?' '+names[lines]:''}`:names[lines];
  this.stats.lastClear=kind;
  const oldLevel=this.stats.level;
  if(this.settings.leveling!=='off')this.stats.level=1+Math.floor(this.stats.lines/10);
  this._rates();
  this._event('lock',{piece:p,lines});
  if(lines||spin)this._event('clear',{lines,kind,score:points,combo:this.stats.combo,b2b:this.stats.b2b,perfect,attack,spin:spin?.type||null,mini:!!mini});
  if(this.stats.level!==oldLevel)this._event('level',{level:this.stats.level});
  // Cancel pending garbage with this piece's attack; remaining pending rises after a non-clear.
  let pending=Math.max(0,this._pendingGarbage-attack);this._pendingGarbage=0;
  if(pending>0) {if(lines>0)this._pendingGarbage=pending;else this._insertGarbage(pending,false);}
  const mode=this.settings.garbageMode;
  if((mode==='backfire'||mode==='unclear')&&attack>0) {
   this._garbageFraction+=attack*limit(this.settings.garbageAmount,0,10,1);
   const incoming=Math.floor(this._garbageFraction);this._garbageFraction-=incoming;
   if(mode==='unclear')this._insertGarbage(incoming,false);else this._pendingGarbage+=incoming;
  }
  if(mode==='cheese-layer')this._refillCheese(false);
  const lockedAbove=this.board.slice(0,VISIBLE_START).some(row=>row.some(Boolean));
  this._spawn();
  if(lockedAbove&&this.board.slice(0,VISIBLE_START).some(row=>row.some(Boolean)))this._recover();
  this._turnStart=this._capture();
 }

 _gravityRate() {
  const mode=this.settings.gravityMode;
  if(mode==='off'||mode==='subzero')return 0;
  if(mode==='static')return limit(this.settings.gravity,0,120,.8);
  const base={relaxed:.8,engaging:2,spicy:5}[mode]??limit(this.settings.gravity,0,120,.8);
  const progression=this.settings.leveling==='off'?1:Math.pow(1.12,Math.min(30,this.stats.level-1))*(1+(this.stats.lines%10)*.025);
  return Math.min(120,base*progression);
 }
 update(dt) {
  if(this.paused||!this.piece||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,1000);this.stats.time+=dt;this.stats.xp=Math.floor(this.stats.time/600);this._rates();
  const gravity=this.suppressGravity?0:this._gravityRate();
  if(gravity>0) {
   this._fallTime+=dt;const interval=1000/gravity;
   while(this._fallTime>=interval) {
    this._fallTime-=interval;
    if(this.collides(this.piece.x,this.piece.y+1)){this._fallTime=0;break;}
    this.piece.y++;this._lockTime=0;this._lastRotation=null;
   }
  }
  if(this.settings.gravityMode!=='subzero'&&this._grounded()) {
   this._lockTime+=dt;
   if(this._lockTime>=limit(this.settings.lockDelay,0,5000,500))this._lock();
  } else this._lockTime=0;
  if(this.settings.garbageMode==='cheese-timer') {
   this._garbageClock+=dt;const interval=1000*limit(this.settings.garbageInterval,.25,300,4);
   while(this._garbageClock>=interval){this._garbageClock-=interval;this.addGarbage(1);}
  }
 }
 _rates() {
  const seconds=this.stats.time/1000;
  this.stats.pps=seconds>0?this.stats.pieces/seconds:0;
  this.stats.apm=seconds>0?this.stats.attack*60/seconds:0;
 }

 _recover() {
  if(this.dead)return;
  if(this.settings.topoutMode==='eliminate'){this.dead=true;this.paused=true;this.stats.topouts++;this._event('eliminated');return;}
  let removed=0;
  while((this.collides()||this.board.slice(0,22).some(row=>row.some(Boolean)))&&removed<HEIGHT) {
   this.board.pop();this.board.unshift(emptyRow());removed++;
  }
  if(removed) {this.stats.topouts++;this._lockTime=0;this._event('recover',{rows:removed});}
 }
 clearBoard() {
  if(this._turnStart){this._history.push(this._capture());if(this._history.length>50)this._history.shift();}
  this.board=emptyBoard();this._pendingGarbage=0;this._future=[];
  this.piece={...this.piece,x:3,y:VISIBLE_START,rotation:0};this._fallTime=0;this._lockTime=0;this._lockResets=0;this._lastRotation=null;
  this._turnStart=this._capture();this._event('clearboard');return true;
 }
 _insertGarbage(lines,adjustPiece=true) {
  const amount=Math.round(limit(lines,0,HEIGHT-2,0));if(!amount)return 0;
  const cheese=String(this.settings.garbageMode).startsWith('cheese');
  if(!cheese&&(this._garbageHole<0||this._garbageRandom()<limit(this.settings.messiness,0,100,100)/100))this._garbageHole=Math.floor(this._garbageRandom()*WIDTH);
  for(let i=0;i<amount;i++) {
   if(cheese&&(this._garbageHole<0||this._garbageRandom()<limit(this.settings.messiness,0,100,100)/100))this._garbageHole=Math.floor(this._garbageRandom()*WIDTH);
   const row=Array(WIDTH).fill('G');row[this._garbageHole]=null;this.board.shift();this.board.push(row);
  }
  if(adjustPiece&&this.piece) {
   this.piece.y=Math.max(0,this.piece.y-amount);
   while(this.collides()&&this.piece.y>0)this.piece.y--;
   if(this.collides()||this.board.slice(0,VISIBLE_START).some(row=>row.some(Boolean)))this._recover();
  }
  this._event('garbage',{lines:amount});return amount;
 }
 addGarbage(lines=1) {
  if(this.dead||this.paused)return 0;
  this._future=[];return this._insertGarbage(lines,true);
 }
 _refillCheese(adjustPiece=true) {
  const count=this.board.filter(row=>row.includes('G')).length;
  const desired=Math.round(limit(this.settings.cheeseHeight,1,18,6));
  if(count<desired)this._insertGarbage(desired-count,adjustPiece);
 }

 _capture() {
  return clone({version:1,dead:this.dead,board:this.board,piece:this.piece,queue:this.queue,held:this.held,canHold:this.canHold,stats:this.stats,
   rng:this._rngState,garbageRng:this._garbageRngState,fallTime:this._fallTime,lockTime:this._lockTime,lockResets:this._lockResets,lastRotation:this._lastRotation,
   garbageClock:this._garbageClock,garbageHole:this._garbageHole,pendingGarbage:this._pendingGarbage,garbageFraction:this._garbageFraction});
 }
 _apply(data) {
  this.dead=data.dead===true;this.board=clone(data.board);this.piece={...data.piece};this.queue=[...data.queue];this.held=data.held||null;this.canHold=!!data.canHold;
  this.stats={...this.stats,...data.stats};this._rngState=(data.rng>>>0)||1;this._garbageRngState=(data.garbageRng>>>0)||((this._rngState^0x9e3779b9)>>>0)||1;this._fallTime=data.fallTime||0;this._lockTime=data.lockTime||0;
  this._lockResets=data.lockResets||0;this._lastRotation=data.lastRotation?{...data.lastRotation}:null;
  this._garbageClock=data.garbageClock||0;this._garbageHole=Number.isInteger(data.garbageHole)?data.garbageHole:-1;
  this._pendingGarbage=data.pendingGarbage||0;this._garbageFraction=data.garbageFraction||0;this._rates();
 }
 undo() {
  if(!this._history.length)return false;
  this._future.push(this._capture());const state=this._history.pop();this._apply(state);this._turnStart=this._capture();
  this._event('undo');return true;
 }
 redo() {
  if(!this._future.length)return false;
  this._history.push(this._capture());this._apply(this._future.pop());this._turnStart=this._capture();
  this._event('redo');return true;
 }
 serialize() {
  return {...this._capture(),settings:{...this.settings},paused:this.paused,history:this._history.slice(-30),future:this._future.slice(-30),turnStart:this._turnStart};
 }
 restore(input) {
  try {
   const data=typeof input==='string'?JSON.parse(input):input;
   const validCell=c=>c===null||Object.hasOwn(COLORS,c);
   const validState=s=>s&&s.version===1&&Array.isArray(s.board)&&s.board.length===HEIGHT&&s.board.every(row=>Array.isArray(row)&&row.length===WIDTH&&row.every(validCell))&&
    s.piece&&SHAPES[s.piece.type]&&Number.isInteger(s.piece.x)&&s.piece.x>=-3&&s.piece.x<WIDTH&&Number.isInteger(s.piece.y)&&s.piece.y>=0&&s.piece.y<HEIGHT&&
    Number.isInteger(s.piece.rotation)&&s.piece.rotation>=0&&s.piece.rotation<4&&Array.isArray(s.queue)&&s.queue.length<=100&&s.queue.every(type=>Boolean(SHAPES[type]))&&
    (s.held===null||Boolean(SHAPES[s.held]))&&s.stats&&Object.values(s.stats).every(value=>typeof value==='string'||typeof value==='number'&&Number.isFinite(value));
   if(!validState(data))return false;
   const prior=this._capture(),settings=this.settings;
   this.settings={...DEFAULTS,...(data.settings||{})};this._apply(data);
   if(this.collides()&&!this.dead) {this.settings=settings;this._apply(prior);return false;}
   this._history=Array.isArray(data.history)?data.history.filter(validState).slice(-30).map(clone):[];
   this._future=Array.isArray(data.future)?data.future.filter(validState).slice(-30).map(clone):[];
   this._turnStart=validState(data.turnStart)?clone(data.turnStart):this._capture();
   this.paused=this.dead||!!data.paused;this._fillQueue();this._event('restore');return true;
  } catch {return false;}
 }
}
