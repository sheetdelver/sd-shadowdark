import type { MundaneTable } from './mundane-tables';

/** SheetDelver Originals: independent feature alternatives, equally likely. */
export const POTION_TABLES:Record<string,MundaneTable>={
    'potion-feature-first':{name:'Potion feature 1',rows:[
        {id:'smoke',text:'Smells of toasted rye'},
        {id:'pearl',text:'Pearlescent gray liquid'},
        {id:'pine',text:'A sharp scent of pine resin'},
        {id:'velvet',text:'Thick and velvety, like melted wax'},
        {id:'amber',text:'Amber liquid that darkens in sunlight'},
        {id:'salt',text:'Leaves a ring of salt on the bottle’s neck'},
    ]},
    'potion-feature-second':{name:'Potion feature 2',rows:[
        {id:'ribbon',text:'A slender ribbon floats upright inside'},
        {id:'leaf',text:'A folded leaf unfolds whenever the bottle is tilted'},
        {id:'sand',text:'A layer of black sand slides up the sides'},
        {id:'key',text:'A tiny wooden key bobs beneath the stopper'},
        {id:'bead',text:'A porcelain bead circles the bottom without settling'},
        {id:'shadow',text:'A second, darker liquid forms a perfect square inside'},
    ]},
    'potion-feature-third':{name:'Potion feature 3',rows:[
        {id:'seal',text:'Sealed with wax bearing a fingerprint'},
        {id:'label',text:'The label is written backwards'},
        {id:'sleeve',text:'Wrapped in a knitted sleeve with a missing button'},
        {id:'glass',text:'The glass makes every nearby face look very old'},
        {id:'stopper',text:'The stopper is attached by a miniature brass chain'},
        {id:'tapping',text:'Makes three soft taps when placed on stone'},
    ]},
};
