/** Local, endless practice battle. Attack is measured in whole garbage rows. */
const MAX_PENDING = 40;
const GARBAGE_DELAY = 650;
const MAX_RISE_PER_PIECE = 8;
const whole = (value, maximum = 1000) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0;
const emptyStats = () => ({sent:0, received:0, pending:0, playerKOs:0, cpuKOs:0, cancelled:0, applied:0});

export class BattleSession {
 constructor(playerEngine, opponent, {emit = () => {}} = {}) {
  this.player = playerEngine;
  this.opponent = opponent;
  this.emit = typeof emit === 'function' ? emit : () => {};
  this.enabled = false;
  this.stats = emptyStats();this.result=null;
  this._incoming = [];
  this._queuedForSpawn = 0;
  this._applying = false;
  const previous = opponent.emit;
  opponent.emit = event => {
   this._handleOpponentEvent(event);
   if(typeof previous === 'function') previous.call(opponent, event);
  };
 }

 get pending() { return this.stats.pending; }

 _resetState() {
  this.stats = emptyStats();this.result=null;
  this._incoming = [];
  this._queuedForSpawn = 0;
  this._applying = false;
 }

 start() {
  this._resetState();
  this.enabled = true;
  this.opponent.start();
  return this;
 }

 stop() {
  this.result=null;this.enabled = false;
  this._incoming = [];
  this.stats.pending = 0;
  this._queuedForSpawn = 0;
  this.opponent.stop();
  return this;
 }

 reset() {
  const ended=!!this.result;
  this._resetState();
  if(this.enabled) ended?this.opponent.start():this.opponent.reset();
  return this;
 }

 setDifficulty(value) {
  return this.opponent.setDifficulty(value);
 }

 _finish(winner){if(this.result)return;this.result=winner;this.opponent.stop();this.player.paused=true;this.emit({type:'result',winner});}

 _syncPending() {
  this._incoming = this._incoming.filter(batch => batch.amount > 0);
  this.stats.pending = this._incoming.reduce((total, batch) => total + batch.amount, 0);
 }

 _take(amount, matureOnly = false) {
  const removed = [];
  let remaining = amount;
  for(const batch of this._incoming) {
   if(remaining <= 0) break;
   if(matureOnly && batch.age < GARBAGE_DELAY) continue;
   const taken = Math.min(remaining, batch.amount);
   if(taken) removed.push({amount:taken, age:batch.age});
   batch.amount -= taken;
   remaining -= taken;
  }
  this._syncPending();
  return removed;
 }

 _handleOpponentEvent(event) {
  if(!this.enabled || this.result || !event) return;
  if(event.type === 'attack') {
   const amount = Math.min(whole(event.amount), MAX_PENDING - this.stats.pending);
   if(!amount) return;
   this._incoming.push({amount, age:0});
   this.stats.received += amount;
   this._syncPending();
   this.emit({type:'incoming', amount, pending:this.stats.pending});
  } else if(['recover','eliminated'].includes(event.type)) {
   this.stats.cpuKOs++;if(event.type==='eliminated'&&!this.opponent.network?.active)this._finish('player');
   this.emit({type:'ko', side:'cpu', playerKOs:this.stats.playerKOs, cpuKOs:this.stats.cpuKOs});
  }
 }

 handlePlayerEvent(event) {
  if(!this.enabled || this.result || !event) return;
  if(event.type === 'clear') {
   if(whole(event.lines) > 0) this._queuedForSpawn = 0;
   const raw = whole(event.attack);
   if(!raw) return;
   const cancelled = Math.min(raw, this.stats.pending);
   if(cancelled) this._take(cancelled);
   this.stats.cancelled += cancelled;
   const amount = raw - cancelled;
   if(amount) {
    this.opponent.receiveAttack(amount);
    this.stats.sent += amount;
   }
   this.emit({type:'playerattack', amount, cancelled, raw, pending:this.stats.pending});
  } else if(event.type === 'lock') {
   this._queuedForSpawn = whole(event.lines) === 0 ? Math.min(MAX_RISE_PER_PIECE, this._incoming.reduce((sum, batch) => sum + (batch.age >= GARBAGE_DELAY ? batch.amount : 0), 0)) : 0;
  } else if(event.type === 'spawn') {
   this._applyQueuedGarbage();
  } else if(['recover','eliminated'].includes(event.type)) {
   this.stats.playerKOs++;if(event.type==='eliminated'&&!this.opponent.network?.active)this._finish('cpu');
   this.emit({type:'ko', side:'player', playerKOs:this.stats.playerKOs, cpuKOs:this.stats.cpuKOs});
  }
 }

 _applyQueuedGarbage() {
  if(this._applying || !this._queuedForSpawn || this.player.paused) return;
  const requested = this._queuedForSpawn;
  // Clear the latch before changing the player: garbage can emit nested events.
  this._queuedForSpawn = 0;
  const removed = this._take(requested, true);
  const amount = removed.reduce((sum, batch) => sum + batch.amount, 0);
  if(!amount) return;
  this._applying = true;
  let applied = 0;
  try {
   applied = whole(this.player.addGarbage(amount), amount);
  } catch(error) {
   this._incoming.unshift(...removed);
   this._syncPending();
   throw error;
  } finally {
   this._applying = false;
  }
  if(applied < amount) {
   let restore = amount - applied;
   const batches = [];
   for(let i = removed.length - 1; i >= 0 && restore > 0; i--) {
    const count = Math.min(restore, removed[i].amount);
    batches.unshift({amount:count, age:removed[i].age});
    restore -= count;
   }
   this._incoming.unshift(...batches);
   this._syncPending();
  }
  if(applied) {
   this.stats.applied += applied;
   this.emit({type:'garbage', amount:applied, pending:this.stats.pending});
  }
 }

 update(dt) {
  if(!this.enabled || this.result || (this.player.paused&&!this.player.dead) || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;
  const elapsed = Math.min(dt, 1000);
  for(const batch of this._incoming) batch.age += elapsed;
  this.opponent.update(elapsed);
 }
}
