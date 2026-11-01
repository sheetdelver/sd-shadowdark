import type { MundaneTable } from './mundane-tables';

/** Independently authored, equally likely alternatives, not official table rows. */
export const REMAINING_TREASURE_TABLES:Record<string,MundaneTable>={
    'scroll-feature':{name:'Scroll feature',rows:[
        {id:'folds',text:'A concertina of paper sewn into a tiny travel case'},
        {id:'ribbon',text:'A long silk ribbon wound around a numbered spool'},
        {id:'tiles',text:'A chain of glazed tiles joined with brass rings'},
        {id:'map',text:'Writing hidden among the contours of an obsolete map'},
        {id:'knots',text:'Knotted cord with a paper key explaining the sequence'},
        {id:'mirror',text:'Lettering that must be read in a polished mirror'},
    ]},
    'wand-feature':{name:'Wand feature',rows:[
        {id:'joints',text:'Jointed like a folding ruler, with silver hinges'},
        {id:'chime',text:'A hollow handle containing a single quiet chime'},
        {id:'measure',text:'Marked with the measurements of forgotten constellations'},
        {id:'weave',text:'Braided reeds sealed beneath transparent lacquer'},
        {id:'thimble',text:'Capped with a seamstress’s engraved brass thimble'},
        {id:'spiral',text:'A spiral channel holds a freely moving drop of ink'},
    ]},
    'spell-tier':{name:'Spell tier',rows:[1,2,3,4,5].map(n=>({id:String(n),text:String(n)}))},
    'utility-form':{name:'Utility form',rows:[
        {id:'compass',text:'Surveyor’s compass'}, {id:'key',text:'Oversized clockwork key'},
        {id:'bell',text:'Travel bell on a short handle'}, {id:'hourglass',text:'Pocket sand timer'},
        {id:'spool',text:'Thread spool in a hinged case'}, {id:'brush',text:'Calligrapher’s brush'},
    ]},
    'utility-feature':{name:'Utility feature',rows:[
        {id:'stamps',text:'Covered with inspection stamps from impossible ports'},
        {id:'seams',text:'Its seams trace a map of underground rivers'},
        {id:'nested',text:'Contains a miniature wooden copy of itself'},
        {id:'calendar',text:'Engraved with a calendar that has thirteen seasons'},
        {id:'warm',text:'Feels like sun-warmed stone even in the shade'},
        {id:'notes',text:'Margin notes appear in a different hand each morning'},
    ]},
    'weapon-bonus':{name:'Weapon bonus',rows:[0,1,2,3].map(n=>({id:String(n),text:String(n)}))},
    'weapon-feature':{name:'Weapon feature',rows:[
        {id:'notches',text:'Small ivory tally marks commemorate rescued travelers'},
        {id:'wax',text:'A broken wax seal remains tied beneath the grip'},
        {id:'script',text:'Its maker’s instructions are written backward along one edge'},
        {id:'mosaic',text:'Tiny ceramic tiles form a landscape around the handle'},
        {id:'tune',text:'The fittings softly ring with a different note when tapped'},
        {id:'repairs',text:'Visible repairs use metal of six contrasting colors'},
    ]},
};
// Foundry artwork for original forms; edited/custom forms use the Basic default.
export const UTILITY_IMAGES:Record<string,string>={
    compass:'icons/tools/navigation/compass-brass-blue-red.webp',
    key:'icons/sundries/misc/key-steel.webp',
    bell:'icons/tools/instruments/bell-brass-brown.webp',
    hourglass:'icons/sundries/misc/hourglass-wood.webp',
    spool:'icons/tools/hand/needle-grey.webp',
    brush:'icons/tools/hand/brush-paint-brown-tan.webp',
};
