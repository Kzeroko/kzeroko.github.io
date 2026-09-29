import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDialogue, renameState, deleteState, nextStateId, parseWorkspace, emptyWorkspace, validateWorkspace } from '../src/lib/dialogue/model.mjs';
import { generate, templates } from '../src/lib/dialogue/templates.mjs';
import { zip } from '../src/lib/dialogue/archive.mjs';
import { buildResourceFiles, seedTranslations, mergeTranslations, translationCatalog } from '../src/lib/dialogue/export.mjs';
import { describeText, editText, nextReplyKey } from '../src/lib/dialogue/editing.mjs';
import { autoLayout, removeStates, planPaste, rekeyDialogue, keyPrefix, unreachableStates } from '../src/lib/dialogue/graph.mjs';
import { zipCompressed, unzip, decodeText } from '../src/lib/dialogue/archive.mjs';
import { classifyImport, dialoguePath } from '../src/lib/dialogue/importer.mjs';
import { subsetWorkspace, unusedTranslationKeys } from '../src/lib/dialogue/export.mjs';
import { Store } from '../src/scripts/dialogue-studio/store.mjs';
const fresh=()=>structuredClone(templates.choice.document);
test('rename and delete rewire actual destinations and start without losing metadata',()=>{
 const doc=fresh();doc.extension={emotion:'calm'};doc.states.accept.extra={n:1};
 renameState(doc,'accept','new');assert.equal(doc.states.line.choices[0].next,'new');assert.deepEqual(doc.states.new.extra,{n:1});
 deleteState(doc,'line','new');assert.equal(doc.start_at,'new');assert.deepEqual(doc.extension,{emotion:'calm'});assert.equal(validateDialogue(doc).errors.length,0);
});
test('cycles without endings, dangling targets and singular action fail',()=>{
 const doc=fresh();doc.states.accept.choices[0].next='line';doc.states.line.choices[1].next='line';assert.ok(validateDialogue(doc).errors.some(e=>e.includes('no reachable')));
 doc.states.line.choices[0].next='missing';doc.states.line.action={type:'blabber:command'};assert.ok(validateDialogue(doc).errors.some(e=>e.includes('singular')));assert.ok(validateDialogue(doc).errors.some(e=>e.includes('destination')));
});
test('state creation never reuses existing sparse IDs',()=>{const doc=fresh();doc.states.state_1={};doc.states.state_3={};assert.equal(nextStateId(doc),'state_2');});

test('only the runtime start_at field is accepted and malformed state input reports errors',()=>{
 const doc=fresh();doc.start=doc.start_at;delete doc.start_at;
 assert.ok(validateDialogue(doc).errors.some(e=>e.includes('start_at')));
 doc.start_at=doc.start;assert.ok(validateDialogue(doc).errors.some(e=>e.includes('not a runtime')));
 delete doc.start;doc.states.line.choices={next:'end'};
 assert.ok(validateDialogue(doc).errors.some(e=>e.includes('must be an array')));
});
test('bulk paths and allegiance use the runtime grammar',()=>{
 const result=generate({scope:'allegiance',subjects:'elf,human',bond:'contract',routes:'talk',phases:'initial,repeat',template:'conversation'});
 assert.equal(result.documents.length,4);assert.equal(result.documents[0].path,'npc/allegiance/elf/contract/talk/initial.json');
 for(const entry of result.documents)assert.deepEqual(validateDialogue(entry.dialogue).errors,[]);
 assert.throws(()=>generate({scope:'unique',subjects:'../escape',template:'conversation'}));
 assert.throws(()=>generate({scope:'unique',subjects:'npc',variants:6,template:'conversation'}));
});
test('workspace roundtrip rejects obsolete versions and duplicate paths but allows empty localization',()=>{
 const ws=emptyWorkspace();ws.documents=[{path:'npc/test.json',dialogue:fresh()}];assert.deepEqual(parseWorkspace(JSON.parse(JSON.stringify(ws))),ws);
 assert.deepEqual(validateWorkspace(ws).errors,[]);assert.throws(()=>parseWorkspace({...ws,version:0}));
 assert.throws(()=>parseWorkspace({...ws,documents:[...ws.documents,...ws.documents]}));
});
test('ZIP contains standard local and end-of-directory signatures',async()=>{const data=new DataView(await zip({'text/中文.json':'{"x":"你好"}'}).arrayBuffer());assert.equal(data.getUint32(0,true),0x04034b50);assert.equal(data.getUint32(data.byteLength-22,true),0x06054b50);});

test('blank translations export every referenced key in both languages with AI source context',()=>{
 const ws=emptyWorkspace();ws.documents=[{path:'npc/test.json',dialogue:fresh()}];
 const files=buildResourceFiles(ws), en=JSON.parse(files['language_assemble/categories/dialogues/en_us.json']), zh=JSON.parse(files['language_assemble/categories/dialogues/zh_cn.json']);
 assert.equal(Object.keys(en).length,5);assert.deepEqual(en,zh);assert.ok(Object.values(en).every(value=>value===''));
 const todo=JSON.parse(files['translation-todo.json']);assert.equal(todo.entries.length,5);
 const accept=todo.entries.find(entry=>entry.key==='$key.accept');
 assert.deepEqual(accept.missing,['en_us','zh_cn']);assert.deepEqual(accept.sources,[{path:'npc/test.json',pointer:'/states/line/choices/0/text'}]);
 assert.deepEqual(ws.translations.en_us,{},'export must not mutate the workspace');
});

test('partial translations preserve written values and only flag missing languages',()=>{
 const ws=emptyWorkspace();ws.documents=[{path:'npc/test.json',dialogue:fresh()}];
 ws.translations.en_us['$key.line']=' Welcome, traveller. ';ws.translations.zh_cn['$key.line']='  ';
 seedTranslations(ws);assert.equal(ws.translations.zh_cn['$key.accept'],'');
 const files=buildResourceFiles(ws), todo=JSON.parse(files['translation-todo.json']);
 assert.equal(JSON.parse(files['language_assemble/categories/dialogues/en_us.json'])['$key.line'],' Welcome, traveller. ');
 assert.equal(JSON.parse(files['language_assemble/categories/dialogues/zh_cn.json'])['$key.line'],'');
 assert.deepEqual(todo.entries.find(entry=>entry.key==='$key.line').missing,['zh_cn']);
});

test('AI translation roundtrip merges filled values without blanking completed text',()=>{
 const ws=emptyWorkspace();ws.documents=[{path:'npc/test.json',dialogue:fresh()}];seedTranslations(ws);
 mergeTranslations(ws,'en_us',{'$key.line':'Welcome','$key.accept':'Yes'});
 mergeTranslations(ws,'en_us',{'$key.line':'','$key.accept':'Certainly'});
 assert.equal(ws.translations.en_us['$key.line'],'Welcome');assert.equal(ws.translations.en_us['$key.accept'],'Certainly');
 assert.throws(()=>mergeTranslations(ws,'en_us',{bad:10}));assert.throws(()=>mergeTranslations(ws,'fr_fr',{}));
});

test('resource export still rejects a broken graph',()=>{
 const ws=emptyWorkspace();ws.documents=[{path:'npc/test.json',dialogue:fresh()}];
 ws.documents[0].dialogue.states.line.choices[0].next='missing';assert.throws(()=>buildResourceFiles(ws),/destination/);
});

test('shared keys retain each source reference and escape JSON pointer segments',()=>{
 const ws=emptyWorkspace(), doc=fresh();doc.states.line['custom/field~']={translate:'shared'};
 ws.documents=[{path:'a.json',dialogue:doc},{path:'b.json',dialogue:structuredClone(doc)}];
 assert.deepEqual(translationCatalog(ws).find(entry=>entry.key==='shared').sources,[{path:'a.json',pointer:'/states/line/custom~1field~0'},{path:'b.json',pointer:'/states/line/custom~1field~0'}]);
});

test('form edits preserve formatting and advanced components until explicitly replaced',()=>{
 const original={translate:'old',color:'gold',extra:[{text:'!'}],custom:{mood:'calm'}};
 assert.deepEqual(editText(original,'key','new'),{...original,translate:'new'});
 assert.deepEqual(editText(original,'literal','Hello'),{color:'gold',extra:[{text:'!'}],custom:{mood:'calm'},text:'Hello'});
 assert.equal(original.translate,'old');
 const rich=[{text:'A'},{translate:'b'}];assert.equal(describeText(rich).mode,'advanced');assert.deepEqual(editText(rich,'advanced','ignored'),rich);
});

test('new replies never reuse text belonging to deleted or unsaved replies',()=>{
 const ws=emptyWorkspace();ws.translations.en_us['dialogue.isekaiexpansion.npc.test.line.reply_1']='Old answer';
 const draft={choices:[{text:{translate:'dialogue.isekaiexpansion.npc.test.line.reply_2'},next:'end'}]};
 assert.equal(nextReplyKey(ws,'npc/test.json','line',draft),'dialogue.isekaiexpansion.npc.test.line.reply_3');
});

test('validator issues point at the state and reply they belong to',()=>{
 const doc=fresh();doc.states.line.choices[1].next='';
 const issue=validateDialogue(doc).issues.find(item=>item.level==='error');
 assert.equal(issue.state,'line');assert.equal(issue.choice,1);assert.match(issue.message,/not linked/);
});
test('auto layout keeps every edge pointing right and puts unreachable states in their own band',()=>{
 const doc=fresh();doc.states.orphan={type:'end_dialogue'};
 const pos=autoLayout(doc,{heights:{line:100,accept:80,end:40,orphan:40}});
 assert.deepEqual(Object.keys(pos).sort(),['accept','end','line','orphan']);
 assert.ok(pos.line[0]<pos.accept[0]&&pos.accept[0]<pos.end[0],'end sits right of every path into it');
 assert.ok(pos.orphan[1]>Math.max(pos.line[1],pos.accept[1],pos.end[1]),'unreachable band is below');
 assert.deepEqual(unreachableStates(doc),['orphan']);
});
test('canvas deletion unlinks incoming replies and moves the start',()=>{
 const doc=fresh();assert.equal(removeStates(doc,['accept']),1);
 assert.equal(doc.states.line.choices[0].next,'');assert.ok(validateDialogue(doc).errors.some(e=>e.includes('not linked')));
 removeStates(doc,['line']);assert.equal(doc.start_at,'end');assert.throws(()=>removeStates(doc,['end']));
});
test('paste renames collisions, keeps internal links, rekeys owned text and shares common keys',()=>{
 const doc=fresh();doc.states.accept.choices[0].text={translate:'shared.continue'};
 const fragment={path:'npc/a.json',states:{line:structuredClone(doc.states.line),accept:structuredClone(doc.states.accept)},layout:{line:[0,0],accept:[300,0]}};
 fragment.states.line.text={translate:keyPrefix('npc/a.json')+'.line'};
 const plan=planPaste({doc,path:'npc/b.json',fragment,usedKeys:new Set(),offset:[20,20]});
 assert.deepEqual(plan.rename,{line:'line_2',accept:'accept_2'});
 assert.equal(plan.states.line_2.choices[0].next,'accept_2');assert.equal(plan.states.line_2.choices[1].next,'end');
 assert.equal(plan.states.line_2.text.translate,'dialogue.isekaiexpansion.npc.b.line_2');
 assert.equal(plan.states.accept_2.choices[0].text.translate,'shared.continue');
 assert.deepEqual(plan.layout.accept_2,[320,20]);
 assert.deepEqual(plan.texts[0],{key:'dialogue.isekaiexpansion.npc.b.line_2',from:'dialogue.isekaiexpansion.npc.a.line'});
});
test('rekeying a moved dialogue only touches keys under its old prefix',()=>{
 const doc={start_at:'a',states:{a:{text:{translate:'dialogue.isekaiexpansion.x.a'},choices:[{text:{translate:'dialogue.isekaiexpansion.allegiance.continue'},next:'b'}]},b:{type:'end_dialogue'}}};
 const {dialogue,pairs}=rekeyDialogue(doc,'dialogue.isekaiexpansion.x','dialogue.isekaiexpansion.y');
 assert.equal(dialogue.states.a.text.translate,'dialogue.isekaiexpansion.y.a');
 assert.equal(dialogue.states.a.choices[0].text.translate,'dialogue.isekaiexpansion.allegiance.continue');
 assert.deepEqual(pairs,[['dialogue.isekaiexpansion.x.a','dialogue.isekaiexpansion.y.a']]);assert.equal(doc.states.a.text.translate,'dialogue.isekaiexpansion.x.a');
});
test('compressed bundles read back byte for byte, including stored entries',async()=>{
 const text=JSON.stringify({x:'你好'.repeat(400)});
 const files=await unzip(await zipCompressed({'a/中文.json':text,'b.txt':'short'}));
 assert.equal(decodeText(files['a/中文.json']),text);assert.equal(decodeText(files['b.txt']),'short');
 assert.equal(decodeText((await unzip(zip({'c.json':'{}'})))['c.json']),'{}');
 await assert.rejects(()=>unzip(new Uint8Array([1,2,3])));
});
test('imports map mod folders to resource paths and sort out every file kind',()=>{
 assert.equal(dialoguePath('src/main/resources/data/isekaiexpansion/blabber/blabber_dialogues/npc/x.json'),'npc/x.json');
 assert.equal(dialoguePath('picked/npc/x.json',{stripRoot:true}),'npc/x.json');
 const doc=JSON.stringify(fresh());
 const result=classifyImport([
  {path:'blabber_dialogues/npc/a.json',text:doc},{path:'npc/a.json',text:doc},{path:'en_us.json',text:'{"k":"v"}'},
  {path:'Bad Name.json',text:doc},{path:'broken.json',text:'{'},{path:'manifest.json',text:'{}'},{path:'notes.txt',text:''},
  {path:'brief.json',text:JSON.stringify({format:'isekai-dialogue-text-brief',entries:[{key:'k2',en_us:'Hi',zh_cn:'你好'}]})},
 ]);
 assert.deepEqual(result.dialogues.map(item=>item.path),['npc/a.json']);
 assert.deepEqual(result.skipped.map(item=>item.reason),['duplicate','path','json']);
 assert.deepEqual(result.dictionaries.map(item=>[item.lang,Object.keys(item.values)]),[['en_us',['k']],['en_us',['k2']],['zh_cn',['k2']]]);
 assert.equal(result.ignored,2);
 const ws=emptyWorkspace();assert.equal(classifyImport([{path:'backup.json',text:JSON.stringify(ws)}]).workspace.value.format,ws.format);
});
test('workspace layout survives a roundtrip; bad layout is dropped, not fatal',()=>{
 const ws=emptyWorkspace();ws.documents=[{path:'npc/a.json',dialogue:fresh(),layout:{line:[0,20],bad:['x',1]}}];
 assert.deepEqual(parseWorkspace(ws).documents[0].layout,{line:[0,20]});
 ws.documents[0].layout='nope';assert.equal('layout' in parseWorkspace(ws).documents[0],false);
});
test('subsets carry only their own text; unused keys are reported for cleanup',()=>{
 const ws=emptyWorkspace();ws.documents=[{path:'a.json',dialogue:fresh()},{path:'b.json',dialogue:{start_at:'e',states:{e:{type:'end_dialogue',text:{translate:'only.b'}}}}}];
 ws.translations.en_us={'$key.line':'Hi','only.b':'B','stale':'old'};
 const part=subsetWorkspace(ws,['b.json']);assert.deepEqual(part.documents.map(d=>d.path),['b.json']);assert.deepEqual(part.translations.en_us,{'only.b':'B'});
 assert.deepEqual(unusedTranslationKeys(ws),['stale']);
 assert.ok(buildResourceFiles(part,{includeWorkspace:true})['studio/workspace.json']);
});
test('store transactions undo, redo, coalesce typing and roll back failures',()=>{
 const store=new Store(), ws=emptyWorkspace();ws.documents=[{path:'npc/a.json',dialogue:fresh()}];store.load(ws);
 const id=store.documents[0].id;
 store.mutate('rename',tx=>{tx.edit(id).path='npc/b.json';});
 store.mutate('type',tx=>tx.text('en_us','k','H'),{coalesce:'k'});store.mutate('type',tx=>tx.text('en_us','k','Hi'),{coalesce:'k'});
 assert.equal(store.undoStack.length,2);store.undo();assert.equal(store.text('en_us','k'),'');
 store.undo();assert.equal(store.doc(id).path,'npc/a.json');store.redo();assert.equal(store.doc(id).path,'npc/b.json');
 assert.throws(()=>store.mutate('fail',tx=>{tx.edit(id).dialogue.start_at='zzz';tx.remove(id);throw Error('nope');}));
 assert.equal(store.doc(id).dialogue.start_at,'line');assert.equal(store.redoStack.length,1,'a failed edit leaves history alone');
 store.mutate('delete',tx=>tx.remove(id));assert.equal(store.documents.length,0);store.undo();assert.equal(store.doc(id).path,'npc/b.json');
 assert.deepEqual(Object.keys(store.serialize()),['format','version','documents','translations']);
});
