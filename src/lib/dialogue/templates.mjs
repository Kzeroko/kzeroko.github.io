import { clone, safePath, translationKeys } from './model.mjs';

export const templates = {
  conversation: { label: 'Conversation / 对话', document: { start_at: 'line', unskippable: true, states: { line: { text: { translate: '$key.line' }, choices: [{ text: { translate: '$key.continue' }, next: 'end' }] }, end: { type: 'end_dialogue' } } } },
  choice: { label: 'Branching / 分支', document: { start_at: 'line', unskippable: true, states: { line: { text: { translate: '$key.line' }, choices: [{ text: { translate: '$key.accept' }, next: 'accept' }, { text: { translate: '$key.decline' }, next: 'end' }] }, accept: { text: { translate: '$key.accepted' }, choices: [{ text: { translate: '$key.continue' }, next: 'end' }] }, end: { type: 'end_dialogue' } } } },
  trade: { label: 'NPC trade / NPC 交易', document: { start_at: 'line', unskippable: true, states: { line: { text: { translate: '$key.line' }, choices: [{ text: { translate: '$key.browse' }, next: 'trade' }, { text: { translate: '$key.leave' }, next: 'end' }] }, trade: { type: 'end_dialogue', actions: [{ type: 'isekaiexpansion:open_npc_trade' }] }, end: { type: 'end_dialogue' } } } },
  requirement: { label: 'Requirement / 条件', document: { start_at: 'line', unskippable: true, states: { line: { text: { translate: '$key.line' }, choices: [{ text: { translate: '$key.accept' }, requirement: { type: 'blabber:player_level', value: 10 }, requirement_tip: { translate: '$key.requirement' }, next: 'accept' }, { text: { translate: '$key.leave' }, next: 'end' }] }, accept: { text: { translate: '$key.accepted' }, choices: [{ text: { translate: '$key.continue' }, next: 'end' }] }, end: { type: 'end_dialogue' } } } },
};
export const routes = ['talk','trade','farewell','bond','married_distance','mode_follow','mode_follow_denied','mode_stay','mode_patrol','mode_wander','gift_confirm','gift_confirm_invalid','gift_cancel','engage_confirm','engage_denied_unready','engage_denied_already','outfit_unlock','talk_quest'];
export const races = ['demon','dragon','raevyx','stegonaut','cindervane','varasuchus','ignivorus','volitans','atroxiia','dwarf','elf','human','kitsune','feline','mermaid','oni','slime','wingedspirit'];
const tokens = value => [...new Set(String(value).split(',').map(v => v.trim()).filter(Boolean))];
const token = value => { if (!/^[a-z0-9_]+$/.test(value)) throw Error(`Invalid path token: ${value}`); return value; };
function substitute(value, key) {
  if (typeof value === 'string') return value.replaceAll('$key', key);
  if (Array.isArray(value)) return value.map(v => substitute(v, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,substitute(v,key)]));
  return value;
}

/** Strict Cartesian generation: no silent token rewriting or accidental overwrites. */
export function generate(options, customTemplate) {
  const output = [], warnings = [], seen = new Set();
  const phases = tokens(options.phases || 'initial,repeat');
  const tiers = tokens(options.tiers || 'normal');
  const selectedRoutes = tokens(options.routes || 'talk');
  const subjects = tokens(options.subjects || (options.scope === 'allegiance' ? 'human' : 'isekaiexpansion_citizen'));
  const genders = tokens(options.genders || 'male,female');
  const variants = Number(options.variants || 0);
  if (!Number.isInteger(variants) || variants < 0 || variants > 5) throw Error('Runtime supports 0–5 scenario variants.');
  if (!['unique','common','simple','combat','citizen','villager','allegiance'].includes(options.scope)) throw Error('Select a scope.');
  phases.forEach(p => { if (!['initial','repeat','rapid_repeat'].includes(p)) throw Error(`Unknown phase: ${p}`); });
  tiers.forEach(p => { if (!['normal','friendly','trust','married'].includes(p)) throw Error(`Unknown relationship tier: ${p}`); });
  genders.forEach(p => { if (!['male','female'].includes(p)) throw Error(`Unknown gender: ${p}`); });
  if (options.scope === 'allegiance' && !['contract','dark_magic'].includes(options.bond)) throw Error('Select an allegiance bond.');
  for (const subject of subjects) for (const route of selectedRoutes) {
    token(subject); token(route);
    if (options.scope === 'allegiance' && !races.includes(subject)) throw Error(`Unknown race: ${subject}`);
    const scopeGenders = ['unique','allegiance','villager'].includes(options.scope) ? [''] : genders;
    for (const gender of scopeGenders) for (const tier of options.scope === 'allegiance' || options.scope === 'villager' ? ['normal'] : tiers) for (const phase of phases) {
      const eligible = { trade:['trust','married'], mode_follow:['trust','married'], mode_follow_denied:['trust','married'], mode_stay:['trust','married'], mode_patrol:['friendly','trust','married'], mode_wander:['friendly','trust','married'], engage_confirm:['trust'], engage_denied_already:['married'], married_distance:['normal'] };
      if (!['allegiance','villager'].includes(options.scope) && eligible[route] && !eligible[route].includes(tier)) { warnings.push(`${route}/${tier}: route is unavailable at this tier.`); continue; }
      const event = route === 'trade' ? 'trade' : 'interact';
      let base;
      if (options.scope === 'allegiance') base = `npc/allegiance/${subject}/${options.bond}/${route}`;
      else if (options.scope === 'villager') base = `villager/${subject}`;
      else {
        const scope = options.scope === 'citizen' ? 'simple' : options.scope;
        const stem = scope === 'common' ? `npc/common/${gender}` : `npc/${scope}/${subject}${gender ? `/${gender}` : ''}`;
        base = `${stem}/menu/${route}/${event}/relationship/${tier}`;
      }
      const suffixes = options.scope === 'allegiance' ? [phase] : options.scope === 'villager' ? ['scenario_1','scenario_2','scenario_3'] : [phase, ...Array.from({length:variants},(_,i)=>`${phase}_scenario_${i+1}`)];
      for (const suffix of suffixes) {
        const path = `${base}/${suffix}.json`;
        if (seen.has(path)) continue;
        if (!safePath(path)) throw Error(`Unsafe path: ${path}`);
        seen.add(path);
        if (output.length >= 5000) throw Error('Generate at most 5,000 files in one workspace.');
        const key = `dialogue.isekaiexpansion.${path.slice(0,-5).replaceAll('/','.')}`;
        const source = customTemplate || templates[options.template]?.document;
        if (!source) throw Error('Select a template.');
        const doc = substitute(clone(source), key);
        if (options.scope === 'villager') for (const state of Object.values(doc.states)) for (const action of state.actions ?? []) if (action.type === 'isekaiexpansion:open_npc_trade') action.type = 'blabber:open_trade';
        output.push({ path, dialogue:doc });
      }
    }
  }
  return { documents:output, warnings:[...new Set(warnings)], keys:[...new Set(output.flatMap(e => [...translationKeys(e.dialogue)]))] };
}
