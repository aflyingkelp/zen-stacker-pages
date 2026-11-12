import {RealtimeClient} from './vendor/realtime.js';
import {REALTIME_URL,PUBLISHABLE_KEY} from './network-config.js?v=6';
import {ZenEngine} from './engine.js?v=6';
export class NetworkSession {
 constructor(){this.id=crypto.randomUUID();this.active=false;this.started=false;this.peer=null;this.round=null;this.status='Offline';this.onStart=()=>{};this.onStatus=()=>{};this.onAttack=()=>{};this.onState=()=>{};this.onKO=()=>{};this.onPause=()=>{};this.seen=new Set();this.lastState=0;}
 _status(text){this.status=text;this.onStatus(text);}
 async connect(code=null){await this.leave();this.role=code?'guest':'host';this.code=code?String(code).replace(/[^a-f0-9]/gi,'').toLowerCase():crypto.randomUUID().replaceAll('-','');if(!/^[a-f0-9]{32}$/.test(this.code))throw Error('Paste the full invite code or invite link.');this.client=new RealtimeClient(REALTIME_URL,{params:{apikey:PUBLISHABLE_KEY},transport:globalThis.WebSocket});this.channel=this.client.channel('zen-v1:'+this.code,{config:{broadcast:{self:false,ack:false},presence:{key:this.id},private:false}});this.channel.on('broadcast',{event:'game'},({payload})=>this._message(payload));this.channel.on('presence',{event:'leave'},({leftPresences})=>{if(leftPresences.some(p=>p.id===this.peer)){this._status('Opponent disconnected. Create a new room to play again.');this.onPause(true);}});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Connection timed out. Try again.')),12000);this.channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);this.channel.track({id:this.id,role:this.role});resolve();}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timer);this._status('Connection lost. Rejoin the room.');reject(Error('Could not connect to multiplayer.'));}});});this.active=true;this._status(this.role==='host'?'Room ready. Share the invite link.':'Waiting for the host…');this.timer=setInterval(()=>{if(!this.started&&this.role==='guest')this.send('hello',{});else this.send('ping',{});},1500);if(this.role==='guest')this.send('hello',{});return this.code;}
 send(kind,data={}){if(!this.active||!this.channel)return;this.channel.send({type:'broadcast',event:'game',payload:{...data,kind,from:this.id,id:crypto.randomUUID(),round:this.round}}).catch(()=>this._status('Connection interrupted.'));}
 _message(p){if(!p||typeof p!=='object'||p.from===this.id||typeof p.from!=='string'||typeof p.id!=='string')return;if(this.seen.has(p.id))return;this.seen.add(p.id);if(this.seen.size>1000)this.seen.delete(this.seen.values().next().value);
  if(p.kind==='hello'&&this.role==='host'){if(this.peer&&this.peer!==p.from){this.send('busy',{to:p.from});return;}this.peer=p.from;if(!this.started)this.startRound();else this._announce();return;}
  if(p.kind==='busy'&&p.to===this.id){this._status('This room already has two players.');return;}
  if(p.kind==='start'&&this.role==='guest'&&p.to===this.id){if(this.peer&&this.peer!==p.from)return;if(!Number.isInteger(p.seed)||p.seed<1||typeof p.nextRound!=='string')return;this.peer=p.from;if(p.nextRound===this.round)return;this.round=p.nextRound;this.seed=p.seed;this.started=true;this._status('Connected · live multiplayer');this.onStart(this.seed);return;}
  if(p.from!==this.peer)return;if(p.kind==='rematch'&&this.role==='host'){this.startRound();return;}if(p.round!==this.round)return;
  if(p.kind==='attack'&&Number.isInteger(p.amount)&&p.amount>0&&p.amount<=20)this.onAttack(p.amount);
  if(p.kind==='state'&&p.state&&JSON.stringify(p.state).length<18000)this.onState(p.state);
  if(p.kind==='ko')this.onKO();if(p.kind==='pause'&&typeof p.paused==='boolean')this.onPause(p.paused);
 }
 _announce(){this.send('start',{to:this.peer,nextRound:this.round,seed:this.seed});}
 startRound(){if(this.role!=='host'||!this.peer)return;this.seed=crypto.getRandomValues(new Uint32Array(1))[0]||1;this.round=crypto.randomUUID();this.started=true;this._announce();this._status('Connected · live multiplayer');this.onStart(this.seed);}
 rematch(){if(this.role==='host')this.startRound();else this.send('rematch');}
 snapshot(engine){if(!this.started||performance.now()-this.lastState<150)return;this.lastState=performance.now();this.send('state',{state:engine._capture()});}
 async leave(){clearInterval(this.timer);this.timer=null;this.active=false;this.started=false;this.peer=null;this.round=null;this.seen.clear();if(this.client){await this.client.removeAllChannels();this.client.disconnect();}this.client=null;this.channel=null;}
}
export class OpponentRouter {
 constructor(cpu,network,player){this.cpu=cpu;this.network=network;this.player=player;this.remote=new ZenEngine({gravityMode:'subzero'});this.remote.paused=true;this.emit=()=>{};cpu.emit=e=>this.emit(e);network.onAttack=n=>this.emit({type:'attack',amount:n});network.onKO=()=>this.emit({type:'recover'});network.onState=data=>{this.remote.restore({...data,settings:{gravityMode:'subzero'}});this.remote.paused=true;};}
 get engine(){return this.network.active?this.remote:this.cpu.engine;}get name(){return this.network.active?'LIVE PLAYER':this.cpu.name;}get status(){return this.network.active?this.network.status:this.cpu.status;}get pending(){return this.network.active?0:this.cpu.pending;}
 start(){if(!this.network.active)this.cpu.start();else this.remote.reset();return this;}
 stop(){this.cpu.stop();return this;}reset(){if(this.network.active)this.remote.reset();else this.cpu.reset();return this;}setDifficulty(v){return this.cpu.setDifficulty(v);}
 receiveAttack(n){if(this.network.active){this.network.send('attack',{amount:Math.min(20,n)});return n;}return this.cpu.receiveAttack(n);}
 update(dt){if(this.network.active)this.network.snapshot(this.player);else this.cpu.update(dt);}
}
