import type { MundaneTable } from './mundane-tables';

/** Original alternatives; equal-weight choices, not the book's table distribution. */
export const ARMOR_TABLES:Record<string,MundaneTable>={
    'armor-bonus':{name:'Armor bonus',rows:[
        {id:'none',text:'0'},{id:'one',text:'1'},{id:'two',text:'2'},{id:'three',text:'3'},
    ]},
    'armor-feature':{name:'Armor feature',rows:[
        {id:'festival',text:'Painted bands of faded festival colors'},
        {id:'tally',text:'Tiny brass tally plates recording past journeys'},
        {id:'quilt',text:'Patchwork lining sewn from old expedition banners'},
        {id:'map',text:'An engraved street map of a vanished city'},
        {id:'letters',text:'Hidden pockets filled with unfinished letters'},
        {id:'hinges',text:'Fastenings shaped like miniature puzzle locks'},
        {id:'maker',text:'A maker’s signature repeated in several unfamiliar scripts'},
        {id:'pebbles',text:'Smooth river pebbles set into the buckles'},
    ]},
};
