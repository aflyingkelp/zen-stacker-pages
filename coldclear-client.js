/** A bounded, local module worker. No game state is sent to a remote service. */
export class ColdClearClient{
 constructor(){
  this.name='Cold Clear 2';this.readyFlag=false;this.failed=false;this._requests=new Map();this._nextId=0;
  this.worker=new Worker(new URL('./coldclear-worker.js',import.meta.url),{type:'module',name:'Cold Clear 2'});
  this.ready=new Promise((resolve,reject)=>{this._readyResolve=resolve;this._readyReject=reject;});
  // An idle client may fail before the first suggestion is requested.
  this.ready.catch(()=>{});
  this._loadTimeout=setTimeout(()=>this._fail(Error('Cold Clear load timed out.')),8000);
  this.worker.onmessage=event=>{
   const data=event.data||{};
   if(data.type==='ready'){clearTimeout(this._loadTimeout);this.readyFlag=true;this._readyResolve();return;}
   if(data.id==null){if(data.type==='error')this._fail(Error(data.error||'Cold Clear failed.'));return;}
   const request=this._requests.get(data.id);if(!request)return;
   clearTimeout(request.timeout);this._requests.delete(data.id);
   if(data.type==='suggestion'){this.lastInfo=data.info;request.resolve(data.targets||[]);}else request.reject(Error(data.error||'Cold Clear search failed.'));
  };
  this.worker.onerror=event=>{event.preventDefault?.();this._fail(Error(event.message||'Cold Clear worker failed.'));};
 }
 _fail(error){
  clearTimeout(this._loadTimeout);this.failed=true;this.readyFlag=false;this._readyReject(error);
  for(const request of this._requests.values()){clearTimeout(request.timeout);request.reject(error);}
  this._requests.clear();
 }
 async suggest(state,difficulty){
  await this.ready;if(this.failed)throw Error('Cold Clear is unavailable.');
  const id=++this._nextId;
  return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{this._requests.delete(id);reject(Error('Cold Clear search timed out.'));},1000);
   this._requests.set(id,{resolve,reject,timeout});this.worker.postMessage({id,state,difficulty});
  });
 }
 dispose(){this._fail(Error('Cold Clear stopped.'));this.worker.terminate();}
}
