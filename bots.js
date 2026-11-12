export const BOTS=Object.freeze({
 upstream:{name:'Cold Clear 2',tag:'BALANCED SEARCH',file:'coldclear.wasm',source:'https://github.com/MinusKelvin/cold-clear-2',description:'Balanced versus opponent. Plans ahead through the next pieces with the original Cold Clear 2 evaluation. A baseline for stacking and attack practice.'},
 chouhy:{name:'CC2 · chouhy',tag:'ALL-SPIN EVALUATOR',file:'coldclear-chouhy.wasm',source:'https://github.com/chouhy/cold-clear-2',description:'Spin-aware alternative. The chouhy fork uses an all-spin evaluator, so non-T spin opportunities matter to its search. Pick it for a different attack style.'},
 practice:{name:'Practice CPU',tag:'SIMPLE / LOCAL',file:null,source:null,description:'This game’s own one-ply bot. It favors low, flat stacks, fewer holes and line clears. A lighter opponent for learning and slower devices.'}
});
export const botProfile=value=>Object.hasOwn(BOTS,value)?value:'upstream';
