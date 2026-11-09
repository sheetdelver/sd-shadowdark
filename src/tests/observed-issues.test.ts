/** Reported November 8 cases, using pinned native sources. No live documents. */
import assert from 'node:assert/strict';
import { creatorRows as rows } from './fixtures/creator';
import { primLike } from './fixtures/native-406';
import { ownedCopy } from '../logic/identity';
import { prepareActorCore } from '../logic/actor-preparation';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { buildOwnedItemCard } from '../logic/resource-cards';
import { getActiveEffectKeys } from '../logic/roll-keys';
import { buildRoll } from '../logic/actions';
import { advancementHitPoints } from '../logic/advancement';
import { presentReferenceDescription } from '../logic/description';
const checks: Array<{name:string;passed:boolean;error?:string}> = [];
const check=(name:string,fn:()=>void)=>{try{fn();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,error:String(e)});}};
const native=(name:string)=>{const row=rows.find(r=>r.name===name);assert.ok(row,name);return structuredClone(row);};
const actor=()=>{const a:any=primLike();a.effects=[];a.items=[];return a;};
check('24: native Backstab with absent bonus resolves; independent grants stack',()=>{
    const a=actor();a.system.level.value=4;delete a.system.bonus;
    a.items=[{...ownedCopy(native('Backstab')),_id:'backstab'}];
    let core=prepareActorCore(a);assert.equal(core.effective.bonus.backstabdice,0);assert.ok(!core.diagnostics.some(d=>d.includes('@bonus.backstabdice')));
    for(let i=0;i<2;i++)a.items.push({...ownedCopy(native('Backstab +1 Damage Dice')),_id:'extra'+i});
    core=prepareActorCore(a);assert.equal(core.effective.bonus.backstabdice,2);assert.ok(!core.diagnostics.some(d=>d.includes('@bonus.backstabdice')));
    const backstab=core.effects.find(e=>e.name==='Backstab')!;
    const bonus=getActiveEffectKeys(core.effects,buildRoll(core),'roll.attack.extra-damage-die',0,{id:'club',name:'Club',propertyNames:[]},{selected:[backstab.ref]});
    assert.equal(bonus.value,5,'base die + two talent dice + half level');
    assert.equal(getActiveEffectKeys(core.effects,buildRoll(core),'roll.attack.extra-damage-die',0,{id:'club',name:'Club',propertyNames:[]}).value,0,'situational selection still required');
    assert.equal(a.system.bonus,undefined,'source never gains a persisted default');
});
check('26: Stout adds two once across consecutive level-ups, preserving wounds',()=>{
    const a=actor();a.system.attributes.hp={value:5,max:3};a.items=[{...ownedCopy(native('Stout')),_id:'stout'}];
    assert.equal(prepareActorCore(a).hp.max,5);
    a.system.attributes.hp=advancementHitPoints(prepareActorCore(a),2,4);
    assert.deepEqual(a.system.attributes.hp,{value:9,max:7});assert.deepEqual(prepareActorCore(a).hp,{value:9,max:9});
    a.system.attributes.hp.value=6;
    a.system.attributes.hp=advancementHitPoints(prepareActorCore(a),3,3);
    assert.deepEqual(prepareActorCore(a).hp,{value:9,max:12});
});
check('26: newly granted HP effects remain effects instead of becoming base HP',()=>{
    const a=actor();a.system.attributes.hp={value:4,max:6};a.items=[{...ownedCopy(native('Stout')),_id:'stout'}];
    a.system.attributes.hp=advancementHitPoints(prepareActorCore(a),3,3);
    assert.deepEqual(a.system.attributes.hp,{value:7,max:9});assert.equal(prepareActorCore(a).hp.max,11);
});
check('27/30: damage operation selects the correct label; weapon attack has distinct fact',()=>{
    for(const shape of ['legacy','v14'])for(const [mode,label] of [[2,'Weapon Attack Damage Bonus'],[1,'Damage Multiplier']] as const){
        const a=actor();const item:any={...ownedCopy(native('Longsword')),_id:'weapon'};item.system.equipped=true;
        item.effects=[{_id:'bonus',name:'Weapon bonus',transfer:true,changes:[{key:'system.roll.attack.damage.this',mode,value:1}]}];a.items=[item];
        if(shape==='v14'){item.effects[0].system={changes:item.effects[0].changes.map((c:any)=>({key:c.key,type:mode===2?'add':'multiply',value:c.value,phase:'initial'}))};delete item.effects[0].changes;}
        const view=prepareShadowdarkView(a),card=buildOwnedItemCard(view,item);assert.ok(card);
        const facts=card.sections.find(s=>s.title==='Effects')!.entries[0].facts!;assert.ok(facts.some(f=>f.label===label));
        assert.equal(card.facts.filter(f=>f.label==='Type').length,0);assert.ok(card.facts.some(f=>f.label==='Attack'&&f.value.includes('Melee')));
    }
});
check('25: spell picker description labels survive without raw enrichers or controls',()=>{
    const rendered=presentReferenceDescription(native('Cure Wounds').system.description)+presentReferenceDescription(native('Holy Weapon').system.description);
    assert.ok(!rendered.includes('[['));assert.ok(!rendered.includes('@UUID['));assert.ok(!rendered.includes('<button'));assert.match(rendered,/half your level/);assert.match(rendered,/Spell Effect: Holy Weapon/);
});
check('28: malformed owned spells stay disabled with actionable recovery guidance',()=>{
    const a=actor();const spell=native('Magic Missile');spell._id='old-spell';spell.system.class=[];a.items=[spell];a.effects=[{_id:'casting',changes:[{key:'system.spellcasting.classes',mode:2,value:'wizard'}]}];
    const before=structuredClone(a),view=prepareShadowdarkView(a);const action=view.actions.find(a=>a.itemId==='old-spell'&&a.kind==='spell');
    assert.equal(action?.available,false);assert.match(action!.reason!,/GM.*Foundry.*Class/);assert.deepEqual(a,before);
});
console.log(JSON.stringify(checks,null,2));if(checks.some(c=>!c.passed))process.exitCode=1;
