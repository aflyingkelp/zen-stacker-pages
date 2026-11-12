import {SHAPES,HEIGHT} from './engine.js?v=8';

// TBP uses upward-positive centers; ZenEngine uses downward-positive matrix origins.
const CELLS={
 I:[[-1,0],[0,0],[1,0],[2,0]],O:[[0,0],[1,0],[0,1],[1,1]],T:[[-1,0],[0,0],[1,0],[0,1]],
 L:[[-1,0],[0,0],[1,0],[1,1]],J:[[-1,0],[0,0],[1,0],[-1,1]],
 S:[[-1,0],[0,0],[0,1],[1,1]],Z:[[-1,1],[0,1],[0,0],[1,0]]
};
const rotate={north:([x,y])=>[x,y],east:([x,y])=>[y,-x],south:([x,y])=>[-x,-y],west:([x,y])=>[-y,x]};

/** Match occupied cells rather than assuming the two rotation-center conventions agree. */
export function locationTargets(location){
 if(!CELLS[location?.type]||!rotate[location.orientation]||!Number.isInteger(location.x)||!Number.isInteger(location.y))return [];
 const desired=CELLS[location.type].map(rotate[location.orientation]).map(([x,y])=>[x+location.x,HEIGHT-1-y-location.y]);
 if(desired.some(([x,y])=>x<0||x>=10||y<0||y>=HEIGHT))return [];
 const keys=new Set(desired.map(([x,y])=>`${x},${y}`)),targets=[];
 for(let rotation=0;rotation<4;rotation++)for(const [anchorX,anchorY] of SHAPES[location.type][rotation]){
  const x=desired[0][0]-anchorX,y=desired[0][1]-anchorY;
  if(SHAPES[location.type][rotation].every(([dx,dy])=>keys.has(`${x+dx},${y+dy}`))){targets.push({type:location.type,x,y,rotation});break;}
 }
 return targets;
}

export async function createColdClear(bytes){
 const module=await WebAssembly.compile(bytes);
 if(WebAssembly.Module.imports(module).length)throw Error('This Cold Clear build requires unsupported host imports.');
 const instance=await WebAssembly.instantiate(module,{}),wasm=instance.exports;
 if(!wasm.memory||!wasm.cc2_alloc||!wasm.cc2_dealloc||!wasm.cc2_invoke)throw Error('Invalid Cold Clear build.');
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 function invoke(request){
  const input=encoder.encode(JSON.stringify(request)),pointer=wasm.cc2_alloc(input.length);
  new Uint8Array(wasm.memory.buffer,pointer,input.length).set(input);
  let output;
  try{output=wasm.cc2_invoke(pointer,input.length);}finally{wasm.cc2_dealloc(pointer,input.length);}
  const length=new DataView(wasm.memory.buffer,output,4).getUint32(0,true);
  let result;
  try{result=JSON.parse(decoder.decode(new Uint8Array(wasm.memory.buffer,output+4,length)));}finally{wasm.cc2_dealloc(output,length+4);}
  if(!result.ok)throw Error(result.error||'Cold Clear could not analyze this board.');
  return result.value;
 }
 return {
  name:'Cold Clear 2',
  suggest(state,difficulty='normal'){
   if(!state?.piece||!Array.isArray(state.board)||state.board.length!==HEIGHT)throw Error('Invalid opponent state.');
   const queue=[state.piece.type,...state.queue.slice(0,10)];
   const board=state.board.slice().reverse().map(row=>row.map(cell=>cell?String(cell)[0]:null));
   invoke({op:'start',config:null,searchSelectionLimit:String({easy:64,normal:128,hard:256}[difficulty]||128),searchSeed:'1',
    state:{board,queue,hold:state.held||null,combo:Math.max(0,(state.stats?.combo??-1)+1),back_to_back:(state.stats?.b2b??-1)>=0}});
   const suggestion=invoke({op:'suggest'});
   const targets=(suggestion?.moves||[]).flatMap(move=>locationTargets(move.location));
   return {targets,info:suggestion?.move_info||null,memory:wasm.memory.buffer.byteLength};
  },
  close(){invoke({op:'stop'});}
 };
}
