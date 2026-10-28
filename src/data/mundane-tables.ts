/** SheetDelver Originals, revision 1. Authored for this generator, not transcribed
 * from Shadowdark or an external SRD. All rows are equally likely within a table.
 * Prices are editable suggestions, never native-system price overrides. */
export const MUNDANE_TABLE_VERSION = 1;
export interface MundaneRow { id: string; text: string; followUp?: string; gp?: number }
export interface MundaneTable { name: string; rows: MundaneRow[] }
export const MUNDANE_TABLES: Record<string, MundaneTable> = {
    'luxury-form': { name: 'Luxury object', rows: [
        {id:'scent-capsule',text:'Scent capsule'},
        {id:'puzzle-casket',text:'Puzzle casket',followUp:'casket-detail'},
        {id:'star-dial',text:'Portable star dial'},
        {id:'chessmen',text:'Set of miniature chessmen'},
        {id:'fan',text:'Folding court fan'},
        {id:'seal-press',text:'Letter-seal press',followUp:'emblem-detail'},
        {id:'lens-frame',text:'Reading-lens frame'},
        {id:'perfume-pump',text:'Perfume pump'},
        {id:'music-cylinder',text:'Hand-cranked music cylinder'},
        {id:'ribbon-reel',text:'Ceremonial ribbon reel'},
        {id:'tea-strainer',text:'Tea strainer on a tiny stand'},
        {id:'balance',text:'Folding merchant’s balance'},
    ]},
    workmanship: { name: 'Material and workmanship', rows: [
        {id:'brass-mesh',text:'Brass-mesh'}, {id:'blue-enamel',text:'Blue-enamelled'},
        {id:'woven-wire',text:'Wire-woven'}, {id:'lacquer',text:'Layered-lacquer'},
        {id:'porcelain',text:'Porcelain-panelled'}, {id:'copper-inlay',text:'Copper-inlaid'},
        {id:'horn-laminate',text:'Horn-laminated'}, {id:'glass-beads',text:'Glass-beaded'},
        {id:'ebony',text:'Ebony-framed'}, {id:'leather',text:'Tooled-leather'},
        {id:'steel',text:'Blued-steel'}, {id:'shell-mosaic',text:'Shell-mosaic'},
    ]},
    'gem-identity': { name: 'Gemstone', rows: [
        {id:'agate',text:'Moss agate'}, {id:'carnelian',text:'Carnelian'},
        {id:'iolite',text:'Iolite'}, {id:'garnet',text:'Garnet'},
        {id:'sunstone',text:'Sunstone'}, {id:'tourmaline',text:'Tourmaline'},
        {id:'spinel',text:'Spinel'}, {id:'zircon',text:'Zircon'},
        {id:'moonstone',text:'Moonstone'}, {id:'quartz',text:'Smoky quartz'},
        {id:'chrysoprase',text:'Chrysoprase'}, {id:'andalusite',text:'Andalusite'},
    ]},
    'gem-finish': { name: 'Cut and appearance', rows: [
        {id:'tumbled',text:'River-tumbled'}, {id:'kite',text:'Kite-cut'},
        {id:'lentil',text:'Lentil-polished'}, {id:'drilled',text:'Centre-drilled'},
        {id:'stepped',text:'Step-faceted'}, {id:'rough',text:'Rough crystal'},
        {id:'twin',text:'Twin-pointed'}, {id:'lozenge',text:'Lozenge-cut'},
    ]},
    'jewelry-form': { name: 'Jewelry form', rows: [
        {id:'hair-slide',text:'Hair slide'}, {id:'ear-cuff',text:'Ear cuff'},
        {id:'collar-link',text:'Collar link'}, {id:'sleeve-clasp',text:'Sleeve clasp',followUp:'emblem-detail'},
        {id:'braid-weight',text:'Braid weight'}, {id:'veil-pin',text:'Veil pin'},
        {id:'sash-hook',text:'Sash hook'}, {id:'boot-chain',text:'Boot chain'},
    ]},
    'casket-detail': { name: 'Casket interior', rows: [
        {id:'shell',text:'The lid conceals a shallow compartment lined with tiny shells.'},
        {id:'drawers',text:'Three slender drawers open in a different order each time.'},
        {id:'fabric',text:'A padded cradle inside fits an object that is now missing.'},
        {id:'counterweight',text:'A concealed counterweight keeps the lid balanced upright.'},
    ]},
    'emblem-detail': { name: 'Emblem', rows: [
        {id:'moth',text:'Its emblem is a moth carrying a key.'},
        {id:'stairs',text:'Its emblem shows a staircase disappearing into a cloud.'},
        {id:'hare',text:'Its emblem shows two hares sharing a single shadow.'},
        {id:'rain',text:'Its emblem is a hand catching seven drops of rain.'},
    ]},
    'unique-feature': { name: 'Unique feature', rows: [
        {id:'reflection',text:'A tiny crescent appears in its reflection at one particular angle.'},
        {id:'scent',text:'Its wrapping carries the scent of a spice no local merchant recognizes.'},
        {id:'matching',text:'An accompanying sketch depicts a matching piece in someone else’s possession.'},
        {id:'weight',text:'Its old appraisal records a weight noticeably different from the present one.'},
        {id:'setting',text:'A fitted case has a second recess, left conspicuously empty.'},
        {id:'receipt',text:'A folded receipt records that it once settled a surprisingly small debt.'},
        {id:'colour',text:'It looks a different colour against dark cloth than against pale cloth.'},
        {id:'display',text:'A little display stand bears the name of a long-closed shop.'},
        {id:'thread',text:'A single bright thread is caught in the lining of its pouch.'},
        {id:'drawing',text:'It is recognizable in a child’s drawing tucked into the packaging.'},
        {id:'number',text:'Its appraisal tag uses an unfamiliar counting system.'},
        {id:'claim',text:'Two attached notes disagree about who should inherit it.'},
    ]},
    'luxury-value': { name: 'Luxury value each', rows: [
        {id:'8',text:'8 GP',gp:8}, {id:'18',text:'18 GP',gp:18},
        {id:'35',text:'35 GP',gp:35}, {id:'70',text:'70 GP',gp:70},
        {id:'125',text:'125 GP',gp:125}, {id:'200',text:'200 GP',gp:200},
    ]},
    'gemstone-value': { name: 'Gemstone value each', rows: [
        {id:'40',text:'40 GP',gp:40}, {id:'75',text:'75 GP',gp:75},
        {id:'125',text:'125 GP',gp:125}, {id:'200',text:'200 GP',gp:200},
        {id:'275',text:'275 GP',gp:275}, {id:'350',text:'350 GP',gp:350},
    ]},
    'jewelry-value': { name: 'Jewelry value each', rows: [
        {id:'15',text:'15 GP',gp:15}, {id:'30',text:'30 GP',gp:30},
        {id:'60',text:'60 GP',gp:60}, {id:'100',text:'100 GP',gp:100},
        {id:'175',text:'175 GP',gp:175}, {id:'300',text:'300 GP',gp:300},
    ]},
};
