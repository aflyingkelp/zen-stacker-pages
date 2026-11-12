import {DEFAULT_KEYS} from './config.js?v=6';
export const keyName=code=>({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'Space',ControlLeft:'Ctrl',ControlRight:'Ctrl',ShiftLeft:'Shift',ShiftRight:'Shift',NumpadEnter:'Num Enter',Backspace:'Backspace'})[code]||code.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'Num ');
export function settingsView(ui,game,tab,captureKey){
 const group=title=>`<div class="settings-group-title">${title}</div>`;
 const select=(key,title,desc,options,source='game')=>`<label class="setting-row"><span class="setting-copy"><strong>${title}</strong><small>${desc}</small></span><select data-source="${source}" data-setting="${key}">${options.map(([v,t])=>`<option value="${v}"${String(v)===String((source==='ui'?ui:game)[key])?' selected':''}>${t}</option>`).join('')}</select></label>`;
 const toggle=(key,title,desc,source='ui')=>`<label class="setting-row"><span class="setting-copy"><strong>${title}</strong><small>${desc}</small></span><input class="setting-toggle" type="checkbox" data-source="${source}" data-setting="${key}" ${(source==='ui'?ui:game)[key]?'checked':''}></label>`;
 const range=(key,title,desc,min,max,step=1,unit='',source='ui',convert='')=>{const raw=(source==='ui'?ui:game)[key],value=convert==='frames'?Math.round(raw*.06*100)/100:convert==='sdf'?(raw===0?41:raw):convert==='percent'?Math.round(raw*100):raw;return `<label class="setting-row"><span class="setting-copy"><strong>${title}</strong><small>${desc}</small></span><span class="range-wrap"><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-source="${source}" data-setting="${key}" data-convert="${convert}"><input aria-label="${title} value" type="number" min="${min}" max="${max}" step="${step}" value="${value}" data-source="${source}" data-setting="${key}" data-convert="${convert}"><output>${convert==='sdf'&&raw===0?'∞':unit}</output></span></label>`;};
 let html='';
 if(tab==='game'){
 html+=group('ZEN OPTIONS');
 html+=select('leveling','Leveling','Advance every 10 lines. Discreet hides the level-up effect.',[['on','ON'],['discreet','DISCREET'],['off','OFF']]);
 html+=toggle('infiniteHold','Infinite hold','Allow multiple hold swaps before placing a piece.','game');
 html+=select('spinMode','Spins','Choose the pieces and detection rules that earn spin bonuses.',[['tspins','T-SPINS'],['tspins+','T-SPINS+'],['allspins+','ALL-SPINS+'],['allspins','ALL-SPINS'],['allmini+','ALL-MINI+'],['allmini','ALL-MINI'],['mini-only','MINI-ONLY'],['handheld','HANDHELD'],['stupid','STUPID'],['none','NONE']]);
 html+=select('comboMode','Combo','Choose how consecutive clears build attack.',[['multiplier','MULTIPLIER'],['classic','CLASSIC GUIDELINE'],['modern','MODERN GUIDELINE'],['none','NONE']]);
 html+=select('kickTable','Kick table','SRS+ has symmetric I-piece rotation and 180° kicks.',[['srsplus','SRS+'],['srs','SRS'],['none','NONE']]);
 html+=select('gravityMode','Gravity','Subzero disables gravity and automatic locking.',[['subzero','SUBZERO'],['off','OFF'],['relaxed','RELAXED'],['engaging','ENGAGING'],['spicy','SPICY'],['static','STATIC']]);
 if(game.gravityMode==='static')html+=range('gravity','Static gravity','Cells per second.',0,120,.1,'/s','game');
 html+=select('display','Display','Choose an additional live statistics panel.',[['off','OFF'],['versus','VERSUS'],['time','TIME'],['speed','SPEED'],['efficiency','EFFICIENCY']],'ui');
 html+=group('CPU PRACTICE');
 html+=select('botDifficulty','CPU speed','Choose the pace of the visible practice opponent.',[['easy','EASY · 0.55 PPS'],['normal','NORMAL · 1.1 PPS'],['hard','HARD · 2 PPS']],'ui');
 html+=group('GARBAGE');
 html+=select('garbageMode','Garbage','Reflect your attacks, maintain cheese, or add timed garbage.',[['off','OFF'],['backfire','BACKFIRE'],['unclear','UNCLEAR'],['cheese-layer','CHEESE LAYER'],['cheese-timer','CHEESE TIMER']]);
 if(['backfire','unclear'].includes(game.garbageMode))html+=select('garbageAmount','Garbage multiplier','Scale your reflected attack.',[[.5,'0.5×'],[1,'1×'],[2,'2×']]);
 if(game.garbageMode==='cheese-layer')html+=range('cheeseHeight','Cheese height','Keep this many garbage rows on the board.',1,18,1,'ROWS','game');
 if(game.garbageMode==='cheese-timer')html+=range('garbageInterval','Cheese timer','Time between incoming rows.',.5,30,.5,'SEC','game');
 if(game.garbageMode!=='off')html+=range('messiness','Messiness','Probability of changing the hole column.',0,100,1,'%','game');
 html+='<p class="settings-note">Settings follow TETR.IO Zen. This independent version implements SRS+, SRS and no kicks; other rotation tables are not included. Level progression and advanced attack scoring are approximations.</p>';
 }
 if(tab==='handling'){
 html+=group('HANDLING · VALUES IN FRAMES (60 F = 1 SECOND)');
 html+=range('arr','ARR','Auto Repeat Rate. 0 F instantly moves to the wall after DAS.',0,5,.1,'F','ui','frames');
 html+=range('das','DAS','Delayed Auto Shift. Hold a direction this long before repeat.',0,30,.1,'F','ui','frames');
 html+=range('dcd','DCD','DAS Cut Delay. Pause auto-shift after rotations and spawns.',0,30,.1,'F','ui','frames');
 html+=range('sdf','SDF','Soft Drop Factor. 41 on the slider means infinite / sonic drop.',1,41,1,'×','ui','sdf');
 html+=toggle('safelock','Prevent accidental hard drops','Briefly block hard drop after a piece locks automatically.');
 html+=toggle('cancel','Cancel DAS when changing directions','Charge DAS again after switching left or right.');
 html+=toggle('preferSoft','Prefer soft drop over movement','Process soft drop before horizontal movement.');
 html+=select('irs','Rotation buffering (IRS)','Apply held rotations on spawn, or taps entered while paused.',[['off','OFF'],['hold','HOLD'],['tap','TAP']],'ui');
 html+=select('ihs','Hold buffering (IHS)','Hold a spawning piece, or buffer a tap while paused.',[['off','OFF'],['hold','HOLD'],['tap','TAP']],'ui');
 html+=group('LOCKING');
 html+=range('lockDelay','Lock delay','Time a grounded piece stays movable.',0,1500,25,'MS','game');
 html+=range('maxLockResets','Lock resets','Maximum movement resets before the piece locks.',0,30,1,'','game');
 html+='<div class="preset-actions"><button data-preset="default">DEFAULT HANDLING</button><button data-preset="fast">FAST · 0 ARR / 7 DAS / ∞ SDF</button></div>';
 }
 if(tab==='look'){
 html+=group('GAMEPLAY & VIDEO');
 html+=select('theme','Accent color','Choose the atmosphere around the board.',[['violet','DUSK VIOLET'],['mint','QUIET MINT'],['rose','SOFT ROSE'],['blue','MIDNIGHT BLUE']],'ui');
 html+=select('pieceSkin','Tetromino skin','Apply the skin to your board, hold, next queue, and CPU.',[['color','STANDARD COLORS'],['gray','GRAY / MONOCHROME'],['solid','SOLID COLORS · NO BORDERS'],['solid-gray','SOLID GRAY · NO BORDERS']],'ui');
 html+=select('actionText','Action text','Show clear names and scoring feedback.',[['off','OFF'],['some','SOME'],['all','ALL']],'ui');
 html+=toggle('ghost','Show shadow piece','Preview the landing position.');
 html+=toggle('coloredShadow','Colored shadow piece','Match the shadow to the falling piece.');
 html+=toggle('grayHold','Gray out locked hold piece','Dim hold when another swap is unavailable.');
 html+=toggle('grid','Show board grid','Show cell guides behind the pieces.');
 html+=range('gridOpacity','Grid visibility','Control the strength of the grid.',0,1,.01,'%');
 html+=range('boardOpacity','Board visibility','Control the playfield background opacity.',0,1,.01,'%');
 html+=range('shadowOpacity','Ghost piece opacity','Opacity of the piece showing where your drop will land.',0,100,1,'%','ui','percent');
 html+=range('dropShadowOpacity','Drop shadow opacity','Opacity of the dark depth shadow beneath tetrominos.',0,100,1,'%','ui','percent');
 html+=toggle('showDamage','Show damage','Display attack totals, damage bursts, APM, and the incoming meter.');
 html+=range('bounciness','Board bounciness','Strength of the hard-drop impact.',0,1,.05,'%');
 html+=range('zoom','Board zoom','Scale your playfield.',.7,1.3,.05,'×');
 html+=toggle('glow','Bloom / piece glow','A subtle glow around the active piece.');
 html+=toggle('particles','Particles','Add a little feedback to line clears.');
 html+=range('particlesAmount','Particle count','Scale the number of clear particles.',0,2,.1,'×');
 html+=toggle('hardDropShake','Hard-drop shake','Enable or disable only the hard-drop board impact.');
 html+=toggle('motion','Motion effects','Enable impact and transitions.');
 html+=toggle('minimal','Focus mode','Hide the caption, control guide, and footer.');
 html+=group('VOLUME & AUDIO');
 html+=toggle('sound','Game sounds','Synthesized move, rotate, and clear effects.');
 html+=range('volume','SFX volume','Sound-effect volume.',0,1,.01,'%');
 html+=toggle('music','Music','Play an original ambient synth pad.');
 html+=range('musicVolume','Music volume','Ambient sound volume.',0,1,.01,'%');
 }
 if(tab==='keys'){
 html+=group('CUSTOM CONTROLS · CLICK TO REBIND');
 const names={left:['Move left','Hold to auto-repeat.'],right:['Move right','Hold to auto-repeat.'],soft:['Soft drop','Move down without locking.'],drop:['Hard drop','Drop and lock instantly.'],cw:['Rotate clockwise','90° rotation.'],ccw:['Rotate counterclockwise','90° rotation.'],half:['Rotate 180°','Use the selected 180° kick system.'],hold:['Swap hold piece','One swap per piece unless infinite hold is on.'],clear:['Clear board','Keep your score and level.'],garbage:['Add garbage','Insert one practice row.']};
 for(const[key,[title,desc]]of Object.entries(names))html+=`<div class="setting-row"><span class="setting-copy"><strong>${title}</strong><small>${desc}</small></span><button class="keybind-button ${captureKey===key?'listening':''}" data-bind="${key}">${captureKey===key?'Press a key…':[...new Set(ui.keys[key].map(keyName))].join(' / ')}</button></div>`;
 html+='<div class="settings-note">F2: restart game · Esc: pause / resume · Enter: start / resume · F: fullscreen<br>Ctrl / ⌘ + Z: undo · Ctrl / ⌘ + Y: redo<br>F2, Esc, Enter, F, and Tab remain reserved. Press Esc to cancel a binding.</div>';
 }
 if(tab==='transfer'){
 html+=group('BRING YOUR TETR.IO SETTINGS');
 html+='<p class="settings-note">In TETR.IO, open CONFIG → EXPORT SETTINGS. Import that .TTC file here to copy handling, supported keyboard bindings, volume, and board appearance. Your current stack and score stay saved.</p><label class="file-picker">CHOOSE .TTC OR .JSON FILE<input id="config-file" type="file" accept=".ttc,.json,application/json,text/plain"></label><label class="paste-label" for="config-paste">OR PASTE SETTINGS JSON</label><textarea id="config-paste" spellcheck="false" placeholder="Paste your exported settings here…"></textarea><div class="preset-actions"><button id="import-config">APPLY PASTED SETTINGS</button><button id="export-config">EXPORT ZEN SETTINGS ↗</button></div><p class="settings-note">TETR.IO files are read on this device. Only supported game settings are imported; nothing is uploaded. Zen JSON exports include all settings for this game.</p>';
 }
 return html;
}
