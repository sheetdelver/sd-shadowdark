import type { MundaneTable } from './mundane-tables';

/** SheetDelver Originals, revision 1. Independent prompts, not book table rows.
 * Equal-weight generation aids; benefits are descriptive, never executable effects. */
export const BOON_TABLES: Record<string, MundaneTable> = {
    'boon-oath': {name:'Favor or promise',rows:[
        {id:'ferry',text:'A ferrymaster promises to keep a boat ready for your party on one night of your choosing.'},
        {id:'archive',text:'An archivist promises to spend a week tracing the history of one object you bring them.'},
        {id:'signal',text:'A bell keeper promises to ring an agreed warning when a named visitor arrives in town.'},
        {id:'kennel',text:'A kennel keeper promises to house and feed your animals during your next expedition.'},
        {id:'stage',text:'A travelling troupe promises to carry one sealed message along its next tour.'},
        {id:'bridge',text:'A bridge steward promises toll-free passage for your household until the next winter.'},
    ]},
    'boon-secret-detail': {name:'Secret detail',rows:[
        {id:'ledger',text:'You have a duplicate ledger revealing the hidden debts of'},
        {id:'route',text:'You know an unguarded delivery route used by'},
        {id:'seal',text:'You can recognize the counterfeit seals commissioned by'},
        {id:'calendar',text:'You have decoded a calendar of clandestine meetings arranged by'},
        {id:'cargo',text:'You know what is really inside the next shipment ordered by'},
        {id:'agreement',text:'You possess an unsigned agreement exposing the ambitions of'},
    ]},
    'boon-secret-subject': {name:'Secret subject',rows:[
        {id:'cartographers',text:'the river cartographers’ society'},
        {id:'auctioneer',text:'the masked auctioneer of the winter market'},
        {id:'granary',text:'the keeper of the city’s emergency granaries'},
        {id:'couriers',text:'the couriers who serve the mountain observatory'},
        {id:'salvagers',text:'the salvage crews of the sunken district'},
        {id:'mint',text:'the last apprentice of the abandoned mint'},
    ]},
    'boon-blessing': {name:'Blessing benefit',rows:[
        {id:'echo',text:'Echo vessel. Once before the next full moon, hold a spoken sentence in an empty cup. The next person who drinks from it hears the sentence.'},
        {id:'thread',text:'Homeward thread. Until dawn, you can see a faint silver line along the route you most recently walked.'},
        {id:'ember',text:'Borrowed ember. Once, warm a shared meal without flame, smoke or fuel. The gift then fades.'},
        {id:'ink',text:'Faithful ink. For seven days, one message you write cannot be washed away by ordinary water.'},
        {id:'seed',text:'Patient seed. Once, cause a planted seed to flower immediately, provided the plant is mundane and no larger than your hand.'},
        {id:'bell',text:'Parting bell. Before your next rest, name one willing companion. You both hear a chime if you become separated beyond shouting distance.'},
    ]},
};
