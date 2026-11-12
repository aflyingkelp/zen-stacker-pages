import {ZenEngine,SHAPES,WIDTH,HEIGHT,VISIBLE_START} from './engine.js?v=6';
import {ColdClearClient} from './coldclear-client.js?v=6';

export const DIFFICULTIES=Object.freeze({easy:.55,normal:1.1,hard:2});
const FULL_ROW=(1<<WIDTH)-1;
const clampDifficulty=value=>Object.hasOwn(DIFFICULTIES,value)?value:'normal';
const now=()=>globalThis.performance?.now?.()??Date.now();

function scratchEngine(engine,piece=engine.piece){
 const scratch=Object.create(ZenEngine.prototype);
 Object.assign(scratch,{board:engine.board,piece:{...piece},settings:engine.settings,paused:false,
  stats:{score:0},_lastRotation:null,_lockTime:0,_lockResets:0,_fallTime:0,_future:[],_event:()=>{}});
 return scratch;
}

function boardRows(board){
 const rows=new Uint16Array(HEIGHT);
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(board[y][x])rows[y]|=1<<x;
 return rows;
}

function evaluate(rows,piece,pathLength,difficulty){
 const result=new Uint16Array(rows);
 for(const [x,y] of SHAPES[piece.type][piece.rotation])result[piece.y+y]|=1<<(piece.x+x);
 let lines=0,write=HEIGHT-1;
 for(let read=HEIGHT-1;read>=0;read--){if(result[read]===FULL_ROW)lines++;else result[write--]=result[read];}
 while(write>=0)result[write--]=0;
 const heights=new Uint8Array(WIDTH);
 let holes=0,aggregate=0,maxHeight=0,covered=0;
 for(let x=0;x<WIDTH;x++){
  let top=-1,blocks=0;
  for(let y=0;y<HEIGHT;y++){
   if(result[y]&(1<<x)){if(top<0)top=y;blocks++;}
   else if(top>=0){holes++;covered+=blocks;}
  }
  const height=top<0?0:HEIGHT-top;heights[x]=height;aggregate+=height;maxHeight=Math.max(maxHeight,height);
 }
 let bumpiness=0,wells=0;
 for(let x=0;x<WIDTH;x++){
  if(x<WIDTH-1)bumpiness+=Math.abs(heights[x]-heights[x+1]);
  wells+=Math.max(0,Math.min(x?heights[x-1]:HEIGHT,x<WIDTH-1?heights[x+1]:HEIGHT)-heights[x]);
 }
 const danger=Math.max(0,maxHeight-15);
 const score=lines*8+lines*lines*1.5-aggregate*.45-holes*(difficulty==='easy'?5.5:8)-covered*.15-
  bumpiness*.30-maxHeight*.65-wells*.15-danger*danger*1.5-pathLength*.003+(aggregate===0?100:0);
 return {score,lines,holes,height:maxHeight,aggregate,bumpiness};
}

function pathTo(nodes,index){
 const path=[];
 while(nodes[index].parent>=0){path.push(nodes[index].action);index=nodes[index].parent;}
 return path.reverse();
}

/** Search legal engine transitions. Does not alter the supplied engine or its RNG. */
function search(engine,{difficulty='normal',maxNodes=650,target=null}={}){
 const scratch=scratchEngine(engine),rows=boardRows(engine.board);
 if(scratch.collides())return null;
 const nodes=[{piece:{...engine.piece},parent:-1,action:null,depth:0}],visited=new Set();
 const stateKey=p=>`${p.x},${p.y},${p.rotation}`;
 visited.add(stateKey(engine.piece));
 let best=null,bestIndex=-1,scanned=0;
 const transitions=engine.piece.type==='O'?['left','right','down']:['left','right','cw','ccw','half','down'];
 if(target)transitions.push('fall');
 for(let cursor=0;cursor<nodes.length&&cursor<maxNodes;cursor++){
  scanned++;
  const node=nodes[cursor],p=node.piece;
  scratch.piece={...p};
  if(scratch.collides(p.x,p.y+1)){
   const matches=!target||(target.type===p.type&&target.x===p.x&&target.y===p.y&&target.rotation===p.rotation);
   if(matches){
    const rating=evaluate(rows,p,node.depth,difficulty);
    if(!best||rating.score>best.score){best={...rating,piece:{...p}};bestIndex=cursor;}
    if(target)break;
   }
  }
  if(nodes.length>=maxNodes)continue;
  for(const transition of transitions){
   scratch.piece={...p};scratch._lastRotation=null;scratch._lockResets=0;
   let action,success=false;
   if(transition==='left'||transition==='right'){
    const value=transition==='left'?-1:1;success=scratch.move(value);action={action:'move',value};
   }else if(transition==='down'||transition==='fall'){
    const distance=scratch.softDrop(transition==='fall'?1:Infinity);success=distance>0;action={action:'soft',value:distance};
   }else{
    const value=transition==='cw'?1:transition==='ccw'?-1:2;success=scratch.rotate(value);action={action:'rotate',value};
   }
   if(!success)continue;
   const next=scratch.piece,key=stateKey(next);
   if(visited.has(key))continue;
   visited.add(key);nodes.push({piece:{...next},parent:cursor,action,depth:node.depth+1});
   if(nodes.length>=maxNodes)break;
  }
 }
 return best?{...best,path:pathTo(nodes,bestIndex),nodes:scanned}:null;
}

/** A reachable one-ply placement; a target can constrain a trusted external advisor. */
export function choosePlacement(engine,{difficulty='normal',maxNodes=650,allowHold=true,target=null}={}){
 if(!engine?.piece||!SHAPES[engine.piece.type])return null;
 difficulty=clampDifficulty(difficulty);
 if(target)maxNodes=Math.max(maxNodes,1800);
 let best=search(engine,{difficulty,maxNodes,target});
 if(allowHold&&(engine.canHold||engine.settings.infiniteHold)&&(difficulty!=='easy'||target)){
  const type=engine.held||engine.queue[0];
  if(type&&type!==engine.piece.type){
   const held=scratchEngine(engine,{type,x:3,y:VISIBLE_START,rotation:0});
   const alternative=search(held,{difficulty,maxNodes,target});
   if(alternative&&(!best||alternative.score-1>best.score))best={...alternative,score:alternative.score-1,path:[{action:'hold'},...alternative.path],usedHold:true};
  }
 }
 return best?{...best,usedHold:!!best.usedHold}:null;
}

function animationPath(path){
 const result=[];
 for(const step of path){
  if(step.action==='soft'){
   // Descent is shown in small steps instead of teleporting the active piece.
   for(let remaining=step.value;remaining>0;remaining-=3)result.push({action:'soft',value:Math.min(3,remaining)});
  }else result.push(step);
 }
 result.push({action:'drop'});return result;
}

export class Opponent{
 constructor({difficulty='normal',emit=()=>{},advisor=null}={}){
  this.emit=typeof emit==='function'?emit:()=>{};
  this.enabled=false;this.difficulty=clampDifficulty(difficulty);this.name='Practice CPU';this.status='Local practice AI';
  this.pending=0;this._incoming=[];this._placementCleared=false;this.stats=this._freshStats();this._plan=null;this._clock=0;
  this.engine=new ZenEngine({gravityMode:'subzero',leveling:'off',garbageMode:'off',spinMode:'allspins+',comboMode:'multiplier'});
  this.engine.paused=true;this.engine.emit=event=>this._onEngine(event);
  this._advisor=null;this._advisorName='Cold Clear 2';this._adviceRequest=null;
  if(advisor)this.setAdvisor(advisor);
 }
 _freshStats(){return {sent:0,received:0,cancelled:0,applied:0,kos:0,pieces:0,time:0,thinkMs:0,advised:0,fallbacks:0};}
 _event(type,data={}){if(this.enabled)this.emit?.({type,...data});}
 _onEngine(event){
  if(!this.enabled)return;
  if(event.type==='clear'){
   const generated=Math.max(0,Math.floor(Number(event.attack)||0));
   const cancelled=Math.min(this.pending,generated);this.pending-=cancelled;let remaining=cancelled;for(const b of this._incoming){const n=Math.min(remaining,b.amount);b.amount-=n;remaining-=n;}this._incoming=this._incoming.filter(b=>b.amount>0);this.stats.cancelled+=cancelled;
   if(cancelled)this._event('cancel',{amount:cancelled,pending:this.pending});
   const amount=generated-cancelled;
   this._event('clear',{...event,generated,cancelled,sent:amount});
   if(amount){this.stats.sent+=amount;this._event('attack',{amount,generated,cancelled});}
  }else if(event.type==='recover'){
   this.stats.kos++;this._event('recover',{rows:event.rows,kos:this.stats.kos});
  }else if(event.type==='lock'){this._placementCleared=event.lines>0;
   this.stats.pieces=this.engine.stats.pieces;this._event('lock',{piece:event.piece,lines:event.lines,pieces:this.stats.pieces});
  }else if(['move','rotate','hold','drop','spawn'].includes(event.type))this._event(event.type,event);
 }
 start(){
  if(!this._advisor&&typeof Worker==='function'){
   try{this._client??=new ColdClearClient();this.setAdvisor(this._client);}catch{this.status='Practice CPU · AI unavailable';}
  }
  this.enabled=true;this.reset();this._event('start',{difficulty:this.difficulty,name:this.name});return this;
 }
 stop(){this.enabled=false;this.engine.paused=true;this._plan=null;this._clock=0;this._adviceRequest=null;this.status='Paused';return this;}
 reset(){
  this.pending=0;this._incoming=[];this._placementCleared=false;this.stats=this._freshStats();this._plan=null;this._clock=0;this._adviceRequest=null;this.name='Practice CPU';
  this.status=this._advisor?'Loading community AI…':'Local practice AI';
  this.engine.reset();this.engine.paused=!this.enabled;
  this._event('reset');return this;
 }
 setDifficulty(value){this.difficulty=clampDifficulty(value);this._event('difficulty',{difficulty:this.difficulty});return this.difficulty;}
 /** Advisor returns a promise of engine-coordinate {type,x,y,rotation}, or an array of alternatives. */
 setAdvisor(advisor,{name='Cold Clear 2'}={}){
  this._advisor=typeof advisor==='function'?advisor:typeof advisor?.suggest==='function'?advisor.suggest.bind(advisor):null;
  this._advisorName=String(advisor?.name||name);this._adviceRequest=null;this.name='Practice CPU';return this;
 }
 get thinking(){return !!this._adviceRequest&&!this._adviceRequest.done;}
 _requestAdvice(){
  const request={started:now(),done:false,value:null};this._adviceRequest=request;
  const e=this.engine,state={board:e.board.map(row=>[...row]),piece:{...e.piece},queue:[...e.queue],held:e.held,
   stats:{combo:e.stats.combo,b2b:e.stats.b2b,pieces:e.stats.pieces},pending:this.pending};
  Promise.resolve().then(()=>this._advisor(state,this.difficulty)).then(value=>{
   if(this.enabled&&this._adviceRequest===request){request.value=value;request.done=true;}
  }).catch(()=>{if(this._adviceRequest===request)request.done=true;});
 }
 receiveAttack(value){
  if(!this.enabled||!Number.isFinite(Number(value)))return 0;
  const amount=Math.min(40-this.pending,Math.max(0,Math.floor(Number(value))));
  if(!amount)return 0;
  this.pending+=amount;this._incoming.push({amount,age:0});this.stats.received+=amount;this._event('incoming',{amount,pending:this.pending});return amount;
 }
 _applyPending(){
  if(this._placementCleared)return;let allowance=8,total=0;for(const batch of this._incoming){if(batch.age<650||allowance<=0)continue;const n=Math.min(allowance,batch.amount);this.engine.addGarbage(n);batch.amount-=n;allowance-=n;total+=n;}this._incoming=this._incoming.filter(b=>b.amount>0);const amount=total;if(!amount)return;this.pending-=amount;this.stats.applied+=amount;
  // The queued garbage arrives between pieces; show the new piece at its spawn ceiling.
  const p=this.engine.piece;
  if(p&&!this.engine.collides(p.x,VISIBLE_START,p.rotation,p.type))p.y=VISIBLE_START;
  this._event('garbage',{amount,pending:this.pending});
 }
 _preparePlan(){
  let advice=null;
  if(this._advisor){
   if(!this._adviceRequest)this._requestAdvice();
   if(!this._adviceRequest.done&&now()-this._adviceRequest.started<1200){this.status=this._client&&!this._client.readyFlag?'Loading community AI…':'Thinking…';return false;}
   advice=this._adviceRequest.value;this._adviceRequest=null;
  }
  const before=now();
  let placement=null;
  for(const target of (Array.isArray(advice)?advice:[advice])){
   if(target&&SHAPES[target.type]&&Number.isInteger(target.x)&&Number.isInteger(target.y)&&Number.isInteger(target.rotation)){
    placement=choosePlacement(this.engine,{difficulty:this.difficulty,target});
    if(placement)break;
   }
  }
  const advised=!!placement;
  if(!placement)placement=choosePlacement(this.engine,{difficulty:this.difficulty});
  if(advised)this.stats.advised++;else if(this._advisor)this.stats.fallbacks++;
  const label=advised?this._advisorName:'Practice CPU';
  this.status=advised?'Community AI · local WebAssembly':this._advisor?'Practice CPU · AI fallback':'Local practice AI';
  if(this.name!==label){this.name=label;this._event('engine',{name:label,advised});}
  this.stats.thinkMs=now()-before;
  this._plan=animationPath(placement?.path||[]);
  this._stepMs=1000/DIFFICULTIES[this.difficulty]/this._plan.length;
  return true;
 }
 _step(){
  const step=this._plan?.shift();if(!step)return false;
  let successful=true;
  if(step.action==='move')successful=this.engine.move(step.value);
  else if(step.action==='rotate')successful=this.engine.rotate(step.value);
  else if(step.action==='soft')successful=this.engine.softDrop(step.value)>0;
  else if(step.action==='hold')successful=this.engine.hold();
  else if(step.action==='drop'){
   this.engine.hardDrop();this._applyPending();this._plan=null;
   this.stats.pieces=this.engine.stats.pieces;return true;
  }
  if(!successful){this._plan=null;this._clock=0;}
  return false;
 }
 update(dt){
  if(!this.enabled||this.engine.paused||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,1000);for(const batch of this._incoming)batch.age+=dt;this.engine.update(dt);this.stats.time=this.engine.stats.time;
  this._clock+=dt;let steps=0,placements=0;
  while(steps++<40&&placements<2){
   if(!this._plan&&!this._preparePlan())break;
   if(this._clock<this._stepMs)break;
   this._clock-=this._stepMs;
   if(this._step())placements++;
  }
  this.stats.pieces=this.engine.stats.pieces;
 }
}
