import {createColdClear} from './coldclear-core.js?v=6';

let engine;
const ready=(async()=>{
 const response=await fetch(new URL('./coldclear.wasm',import.meta.url));
 if(!response.ok)throw Error('Cold Clear engine download failed.');
 engine=await createColdClear(await response.arrayBuffer());
 postMessage({type:'ready',name:engine.name});
})();
ready.catch(error=>postMessage({type:'error',error:error.message}));

self.onmessage=async event=>{
 const {id,state,difficulty}=event.data||{};
 try{await ready;const result=engine.suggest(state,difficulty);postMessage({id,type:'suggestion',...result});}
 catch(error){postMessage({id,type:'error',error:error.message});}
};
