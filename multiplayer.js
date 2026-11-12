import {RealtimeClient} from './vendor/realtime.js';
import {REALTIME_URL,PUBLISHABLE_KEY} from './network-config.js?v=7';
import {ZenEngine} from './engine.js?v=7';
import {Opponent} from './opponent.js?v=7';
const size=n=>Math.max(1,Math.min(4,Math.floor(Number(n)||1)));
const pps=n=>Math.max(.1,Math.min(10,Number(n)||1.1));
export class NetworkSession {
 constructor(){this.id=crypto.randomUUID();this.active=false;this.started=false;this.round=null;this.status='Offline';this.roster=[];this.sizes=[1,1];this.team=0;this.botPPS=1.1;this.onStart=()=>{};this.onStatus=()=>{};this.onRoster=()=>{};this.onAttack=()=>{};this.onState=()=>{};this.onKO=()=>{};this.onPause=()=>{};this.onBotAttack=()=>{};this.onEliminated=()=>{};this.onResult=()=>{};this.ended=false;this.seen=new Set();this.lastState=0;this.targets=new Map();}
 _status(text){this.status=text;this.onStatus(text);}
 async connect(code=null,options={}){
  await this.leave();this.role=code?'guest':'host';this.autoStart=options.autoStart!==false;this.team=options.team===1?1:0;this.sizes=[size(options.a),size(options.b)];this.botPPS=pps(options.pps);this.host=this.role==='host'?this.id:null;this.roster=this.role==='host'?[{id:this.id,team:this.team,bot:false,alive:true,name:'Host'}]:[];
  this.code=code?String(code).replace(/[^a-f0-9]/gi,'').toLowerCase():crypto.randomUUID().replaceAll('-','');if(!/^[a-f0-9]{32}$/.test(this.code))throw Error('Paste the full invite code or invite link.');
  // v2 separates team rooms from older two-player clients.
  this.client=new RealtimeClient(REALTIME_URL,{params:{apikey:PUBLISHABLE_KEY},transport:globalThis.WebSocket});
  this.channel=this.client.channel('zen-v2:'+this.code,{config:{broadcast:{self:false,ack:false},presence:{key:this.id},private:false}});
  this.channel.on('broadcast',{event:'game'},({payload})=>this._message(payload));
  this.channel.on('presence',{event:'leave'},({leftPresences})=>{for(const presence of leftPresences){const member=this.roster.find(m=>m.id===presence.id);if(!member||member.id===this.id)continue;if(this.started){this._status(member.name+' disconnected. Match paused; create a new room to continue.');this.onPause(true);this.send('pause',{paused:true});}else if(this.role==='host'){this.roster=this.roster.filter(m=>m.id!==member.id);this._lobby();}}});
  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Connection timed out. Try again.')),12000);this.channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);this.channel.track({id:this.id});resolve();}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timer);this._status('Connection lost. Rejoin the room.');reject(Error('Could not connect to multiplayer.'));}});});}catch(e){await this.leave();throw e;}
  this.active=true;this._status(this.role==='host'?'Room ready. Invite friends or fill empty seats with bots.':'Joining lobby…');this.timer=setInterval(()=>{if(!this.started&&this.role==='guest')this.send('hello',{team:this.team});else this.send('ping');},1500);if(this.role==='guest')this.send('hello',{team:this.team});else this._lobby();return this.code;
 }
 send(kind,data={}){if(!this.active||!this.channel)return;this.channel.send({type:'broadcast',event:'game',payload:{...data,kind,from:this.id,id:crypto.randomUUID(),round:this.round}}).catch(()=>this._status('Connection interrupted.'));}
 _validRoster(roster){return Array.isArray(roster)&&roster.length>=2&&roster.length<=8&&new Set(roster.map(m=>m.id)).size===roster.length&&roster.every(m=>typeof m.id==='string'&&m.id.length<100&&[0,1].includes(m.team)&&typeof m.bot==='boolean'&&typeof m.name==='string'&&m.name.length<=40)&&[0,1].every(t=>roster.filter(m=>m.team===t).length>=1&&roster.filter(m=>m.team===t).length<=4);}
 _lobby(){this.onRoster(this.roster);this.send('lobby',{roster:this.roster,sizes:this.sizes,botPPS:this.botPPS});}
 _message(p){
  if(!p||typeof p!=='object'||p.from===this.id||typeof p.from!=='string'||typeof p.id!=='string'||this.seen.has(p.id))return;this.seen.add(p.id);if(this.seen.size>1000)this.seen.delete(this.seen.values().next().value);
  if(p.kind==='hello'&&this.role==='host'){
   if(this.roster.some(m=>m.id===p.from)){this.started?this._announce():this._lobby();return;}
   if(this.started){this.send('busy',{to:p.from});return;}const preferred=p.team===1?1:0;let team=preferred;if(this.roster.filter(m=>m.team===team).length>=this.sizes[team])team=1-team;if(this.roster.filter(m=>m.team===team).length>=this.sizes[team]){this.send('busy',{to:p.from});return;}
   this.roster.push({id:p.from,team,bot:false,alive:true,name:'Player '+(this.roster.length+1)});this._lobby();if(this.autoStart&&this.roster.length===this.sizes[0]+this.sizes[1])this.startRound(false);return;
  }
  if(p.kind==='busy'&&p.to===this.id){this._status('This room is full or already playing.');return;}
  if((p.kind==='lobby'||p.kind==='start')&&this.role==='guest'){
   if(this.host&&this.host!==p.from)return;
   const valid=p.kind==='start'?this._validRoster(p.roster):Array.isArray(p.roster)&&p.roster.length<=8&&p.roster.every(m=>typeof m.id==='string'&&[0,1].includes(m.team)&&typeof m.bot==='boolean'&&typeof m.name==='string');
   if(!valid||!p.roster.some(m=>m.id===this.id)||!p.roster.some(m=>m.id===p.from&&!m.bot))return;this.host=p.from;this.roster=p.roster;this.team=this.roster.find(m=>m.id===this.id).team;this.sizes=Array.isArray(p.sizes)?p.sizes.map(size):[1,1];this.botPPS=pps(p.botPPS);this.onRoster(this.roster);
   if(p.kind==='lobby'){this._status('Lobby ready · you are on Team '+(this.team?'B':'A')+'. Waiting for host to start.');return;}
   if(!Number.isInteger(p.seed)||p.seed<1||typeof p.nextRound!=='string'||p.nextRound===this.round)return;this.seed=p.seed;this.round=p.nextRound;this.started=true;this.ended=false;this.targets.clear();this._status('Connected · '+this.sizes.join('v')+' team battle');this.onStart(this.seed);return;
  }
  const member=this.roster.find(m=>m.id===p.from&&!m.bot);if(!member||p.round!==this.round||!this.started)return;
  if(p.kind==='rematch'&&this.role==='host'){this.startRound(false);return;}
  if(p.kind==='attack'&&Number.isInteger(p.amount)&&p.amount>0&&p.amount<=20){if(this.role==='host')this.routeAttack(p.from,p.amount);return;}
  if(p.kind==='damage'&&p.from===this.host&&Number.isInteger(p.amount)&&p.amount>0&&p.amount<=20){this._deliver(p);return;}
  if(p.kind==='elimination'&&p.from===this.host){this._applyKO(p.actor);return;}if(p.kind==='result'&&p.from===this.host&&[0,1].includes(p.winner)){this.ended=true;this.onResult(p.winner);return;}
  const actor=this.roster.find(m=>m.id===(p.actor||p.from));if(!actor||(actor.id!==p.from&&!(p.from===this.host&&actor.bot)))return;
  if(p.kind==='state'&&(actor.alive!==false||p.state?.dead===true)&&p.state&&JSON.stringify(p.state).length<18000)this.onState(p.state,actor);
  if(p.kind==='ko'&&this.role==='host'&&actor.id===p.from)this._knockout(actor.id);
  if(p.kind==='pause'&&typeof p.paused==='boolean')this.onPause(p.paused);
 }
 _announce(){this.send('start',{nextRound:this.round,seed:this.seed,roster:this.roster,sizes:this.sizes,botPPS:this.botPPS});}
 startRound(fillBots=true){
  if(this.role!=='host')return false;
  if(fillBots)for(const team of [0,1])while(this.roster.filter(m=>m.team===team).length<this.sizes[team])this.roster.push({id:'bot-'+crypto.randomUUID(),team,bot:true,alive:true,name:'CPU '+(this.roster.filter(m=>m.bot).length+1)});
  if(this.roster.length!==this.sizes[0]+this.sizes[1]||!this._validRoster(this.roster)){this._status('Invite more players or enable Fill empty seats with bots.');return false;}
  this.seed=crypto.getRandomValues(new Uint32Array(1))[0]||1;this.round=crypto.randomUUID();this.started=true;this.ended=false;for(const m of this.roster)m.alive=true;this.targets.clear();this._announce();this.onRoster(this.roster);this._status('Connected · '+this.sizes.join('v')+' team battle');this.onStart(this.seed);return true;
 }
 routeAttack(actorId,amount){
  if(this.role!=='host'||!this.started||this.ended||!Number.isInteger(amount)||amount<1||amount>20)return 0;const actor=this.roster.find(m=>m.id===actorId);if(!actor||actor.alive===false)return 0;const foes=this.roster.filter(m=>m.team!==actor.team&&m.alive!==false);if(!foes.length)return 0;
  const cursor=this.targets.get(actorId)||0,target=foes[cursor%foes.length];this.targets.set(actorId,cursor+1);const packet={actor:actorId,target:target.id,amount};this.send('damage',packet);this._deliver(packet);return amount;
 }
 _deliver(p){const actor=this.roster.find(m=>m.id===p.actor),target=this.roster.find(m=>m.id===p.target);if(this.ended||!actor||!target||actor.alive===false||target.alive===false||actor.team===target.team)return;if(target.id===this.id)this.onAttack(p.amount,actor);else if(target.bot&&this.role==='host')this.onBotAttack(target.id,p.amount);}
 attack(amount){if(this.role==='host')return this.routeAttack(this.id,amount);this.send('attack',{amount});return amount;}
 _applyKO(actorId){const actor=this.roster.find(m=>m.id===actorId);if(!actor||actor.alive===false)return false;actor.alive=false;this.onKO(actor);this.onEliminated(actor);return true;}
 _knockout(actorId){if(this.role!=='host'||this.ended||!this._applyKO(actorId))return;this.send('elimination',{actor:actorId});const living=[0,1].filter(t=>this.roster.some(m=>m.team===t&&m.alive!==false));if(living.length===1){this.ended=true;this.send('result',{winner:living[0]});this.onResult(living[0]);}}
 eliminate(actorId=this.id){if(this.role==='host')this._knockout(actorId);else if(actorId===this.id)this.send('ko');}
 rematch(){if(this.role==='host')this.startRound(false);else this.send('rematch');}
 snapshot(engine){if(!this.started||performance.now()-this.lastState<180)return;this.lastState=performance.now();this.send('state',{state:engine._capture()});}
 async leave(){clearInterval(this.timer);this.timer=null;this.active=false;this.started=false;this.ended=false;this.host=null;this.roster=[];this.round=null;this.seen.clear();if(this.client){await this.client.removeAllChannels();this.client.disconnect();}this.client=null;this.channel=null;}
}
export class OpponentRouter {
 constructor(cpu,network,player){
  this.cpu=cpu;this.network=network;this.player=player;this.remote=new ZenEngine({gravityMode:'subzero'});this.remote.paused=true;this.units=new Map();this.bots=new Map();this.emit=()=>{};this.lastBotState=0;cpu.emit=e=>this.emit(e);
  network.onAttack=n=>this.emit({type:'attack',amount:n});network.onBotAttack=(id,n)=>this.bots.get(id)?.receiveAttack(n);
  network.onKO=actor=>{const unit=this.units.get(actor.id);if(unit){unit.dead=true;unit.paused=true;}this.bots.get(actor.id)?.stop();if(actor.team!==network.team)this.emit({type:'eliminated'});};
  network.onState=(data,actor)=>{const e=this.units.get(actor.id);if(e){e.restore({...data,settings:{gravityMode:'subzero'}});e.paused=true;}};
 }
 get players(){return this.network.active?this.network.roster.filter(m=>m.id!==this.network.id).map(m=>({...m,engine:this.units.get(m.id),pending:this.bots.get(m.id)?.pending||0})):[];}
 get primary(){return this.players.find(m=>m.team!==this.network.team);}
 get engine(){return this.network.active?(this.primary?.engine||this.remote):this.cpu.engine;}
 get name(){return this.network.active?(this.primary?.name||'TEAM BATTLE'):this.cpu.name;}
 get status(){return this.network.active?this.network.status:this.cpu.status;}
 get pending(){return this.network.active?(this.primary?.pending||0):this.cpu.pending;}
 _disposeBots(){for(const bot of this.bots.values()){bot.stop();bot._client?.dispose();}this.bots.clear();this.units.clear();}
 start(){if(!this.network.active)this.cpu.start();else this.reset();return this;}
 stop(){this.cpu.stop();this._disposeBots();return this;}
 reset(){
  if(!this.network.active){this.cpu.reset();return this;}this._disposeBots();
  for(const actor of this.network.roster){if(actor.id===this.network.id)continue;
   if(actor.bot&&this.network.role==='host'){
    const bot=new Opponent({difficulty:this.cpu.difficulty,pps:this.network.botPPS,emit:event=>{if(event.type==='attack')this.network.routeAttack(actor.id,event.amount);if(event.type==='eliminated'){this.network.send('state',{actor:actor.id,state:bot.engine._capture()});this.network.eliminate(actor.id);}}});
    bot.engine.settings.seed=this.network.seed;bot.engine.settings.topoutMode='eliminate';bot.start();this.bots.set(actor.id,bot);this.units.set(actor.id,bot.engine);
   }else{const e=new ZenEngine({gravityMode:'subzero',seed:this.network.seed});e.paused=true;this.units.set(actor.id,e);}
  }
  return this;
 }
 setDifficulty(v){return this.cpu.setDifficulty(v);}setPPS(v){return this.cpu.setPPS(v);}
 receiveAttack(n){if(this.network.active)return this.network.attack(Math.min(20,n));return this.cpu.receiveAttack(n);}
 update(dt){
  if(!this.network.active){this.cpu.update(dt);return;}if(this.network.ended)return;
  this.network.snapshot(this.player);for(const bot of this.bots.values())bot.update(dt);
  if(performance.now()-this.lastBotState>=180){this.lastBotState=performance.now();for(const [actor,bot]of this.bots)this.network.send('state',{actor,state:bot.engine._capture()});}
 }
}
