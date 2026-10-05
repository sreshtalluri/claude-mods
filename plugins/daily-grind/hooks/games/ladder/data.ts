// Ladder content. Dictionary: common, family-friendly four-letter words (inflections included),
// one paragraph per initial letter. PAIRS: daily [start, target, par]; par is the BFS optimum over WORDS
// (tests/ladder.test.ts re-checks every one).

export const WORDS: readonly string[] = `
able ache acid acne acre acts aged ages aide aids aims airs airy ajar akin alas ales ally alms aloe also alto
amid amps anew ante ants apes apex arch arcs area aria arid arms army arts ashy atom aunt aura auto avid away
awed awes awry axes axis axle
baby back bade bags bail bait bake bald bale ball balm band bane bang bank bans barb bard bare bark barn bars
base bash bask bass bath bats bead beak beam bean bear beat beds beef been beep beer bees beet begs bell belt
bend bent berg best bets bias bibs bide bike bile bill bind bins bird bite bits blab blah bled blew blip blob
bloc blog blot blow blue blur boar boas boat bobs bode body bogs boil bold bolt bomb bond bone bony book boom
boon boos boot bore born boss both bout bowl bows boxy boys brag bran brat bred brew brim brow buck buds buff
bugs bulb bulk bull bump bunk buns buoy burn burp bury bush busk bust busy buys buzz byte
cabs cafe cage cake calf call calm came camp cane cans cape caps card care carp cars cart case cash cask cast
cats cave cell cent chap char chat chef chew chin chip chop chow chug chum cite city clad clam clan clap claw
clay clip clod clog clot club clue coal coat coax cobs code coil coin cola cold colt comb come cone cook cool
coop cope cops copy cord core cork corn cost cosy cots coup cove cows cozy crab crew crib crop crow crux cube
cubs cued cues cuff cull cult cups curb curd cure curl curt cusp cute cuts
dabs dads daft dale dame damp dams dank dare dark darn dart dash data date dawn days daze dead deaf deal dean
dear debt deck deed deem deep deer deft defy deli dell demo dens dent deny desk dial dibs dice died dies diet
digs dill dime dims dine ding dins dips dire dirt disc dish disk diva dive dock docs dodo doer does dogs dole
doll dome done dons doom door dorm dose dote dots dove down doze dozy drab drag dram draw drew drip drop drum
dual duck duct dude duds duel dues duet duke dull duly dumb dump dune dunk duos dupe dusk dust duty
each earl earn ears ease east easy eats ebbs echo edge edgy edit eels eggs egos else emit ends envy epic even
ever eves evil exam exec exit expo eyed eyes
face fact fade fads fail fair fake fall fame fang fans fare farm fast fate fawn faze fear feat feed feel fees
feet fell felt fend fern feta feud fibs figs file fill film find fine fins fire firm fish fist fits five fizz
flag flak flap flat flaw flax flea fled flee flew flex flip flit flog flop flow flue flux foal foam foes fogs
foil fold folk fond font food fool foot ford fore fork form fort foul four fowl foxy fray free fret frog from
fuel full fume fund funk furs fury fuse fuss
gags gain gait gala gale gall gals game gang gape gaps garb gash gasp gate gave gawk gaze gear geek gels gems
gene gent germ gets gift gigs gild gill gilt girl gist give glad glee glen glib glow glue glum glut gnat gnaw
goad goal goat gobs gods goes gold golf gone gong good goof goon gosh gown grab gram gray grew grey grid grim
grin grip grit grow grub gulf gull gulp gums gunk guru gush gust guts guys gyms
hack hail hair half hall halo halt hams hand hang hard hare harm harp hash hate hats haul have hawk haze hazy
head heal heap hear heat heed heel heir held helm help hems hens herb herd here hero hers hide high hike hill
hilt hind hint hips hire hiss hits hive hoax hogs hold hole holy home hone honk hood hoof hook hoop hoot hope
hops horn hose host hour howl hubs hued hues huff huge hugs hulk hull hump hums hung hunk hunt hurl hurt hush
husk huts hymn
iced ices icon idea idle idly idol iffy inch info inks inky inns into ions iris iron isle itch item
jabs jack jade jail jams jars jaws jays jazz jeep jeer jell jerk jest jets jibe jigs jinx jobs jogs join joke
jolt jots joys judo jugs juke jump junk jury just jute
keel keen keep kegs kelp kept keys kick kids kiln kilo kilt kind king kink kiss kite kits kiwi knee knew knit
knob knot know
labs lace lack lacy lads lady laid lain lair lake lamb lame lamp land lane laps lard lark lash lass last late
lava lawn laws lays laze lazy lead leaf leak lean leap leek leer left legs lend lens lent less lest levy liar
lice lick lids lied lies life lift like lily limb lime limp line link lint lion lips lisp list live load loaf
loan lobe lock loft logo logs loin lone long look loom loon loop loot lord lore lose loss lost lots loud lout
love lows luck lull lump lung lure lurk lush lute
mace made maid mail maim main make male mall malt mama mane many maps mare mark mars mart mash mask mass mast
mate math mats maul maze mead meal mean meat meek meet meld melt memo mend menu meow mere mesh mess mice mild
mile milk mill mime mind mine mini mink mint miss mist mitt moan moat mobs mock mode mold mole molt monk mood
moon moor moot mope mops more moss most moth move mown mows much muck muds muff mugs mule mull mums murk muse
mush musk must mute mutt myth
nabs nags nail name nape naps navy near neat neck need neon nerd nest nets news newt next nibs nice nick nine
nips node nods none nook noon nope norm nose nosy note noun nova nuke null numb nuns nuts
oafs oaks oars oath oats obey oboe odds odes odor offs ogre oils oily okay okra omen omit once ones only onto
onus onyx oops ooze oozy opal open opts opus oral orbs orca ores ouch ours oust outs oval oven over owed owes
owls owns oxen
pace pack pact pads page paid pail pain pair pale palm pals pane pang pans pant papa pare park part pass past
pate path pats pave pawn paws pays peak peal pear peas peat peck peek peel peep peer pegs pelt pens pent perk
perm pert pest pets pews pick pier pies pigs pike pile pill pine ping pink pins pint pipe pita pith pity plan
play plea pled plod plop plot plow ploy plug plum plus pods poem poet poke poky pole poll polo pomp pond pony
pool poor pope pops pore pork port pose posh post posy pots pour pout pram pray prep prey prim prod prom prop
pros prow pubs puck puff pugs pull pulp puma pump punk puns punt puny pupa pups pure purr push puts putt
quad quay quip quit quiz
race rack racy raft rage rags raid rail rain rake ramp rams rang rank rant raps rare rash rasp rate rats rave
rays raze read real reap rear redo reed reef reek reel rein rely rent rest ribs rice rich ride rife rift rigs
rile rims rind ring rink riot ripe rips rise risk rite road roam roar robe robs rock rode rods role roll romp
roof rook room root rope rose rosy rots rout rove rows rubs ruby rude rued rues ruff rugs ruin rule rump rung
runs runt ruse rush rust ruts
sack safe saga sage said sail sake sale salt same sand sane sang sank saps sash sass sate save saws says scab
scam scan scar seal seam sear seas seat sect seed seek seem seen seep seer sees self sell semi send sent sets
sewn sews shag sham shed shin ship shoe shoo shop shot show shun shut sick side sift sigh sign silk sill silo
silt sing sink sins sips sire site sits size skew skid skim skin skip skis skit slab slag slam slap slat slaw
sled slew slid slim slip slit slob slop slot slow slug slum slur smog snag snap snip snob snow snub snug soak
soap soar sobs sock soda sofa soft soil sold sole solo some song sons soon soot sore sort soul soup sour sown
soya spam span spat spec sped spin spit spot spry spud spun spur stab stag star stay stem step stew stir stop
stow stub stud stun such suds sued sues suit sulk sumo sums sung sunk suns sure surf swab swam swan swap sway
swim swum
tabs tack taco tact tags tail take tale talk tall tame tank tans tape taps tarp tart task taut taxi teal team
tear teas tech teed teem teen tees tell temp tend tens tent term tern test text than that thaw thee them then
they thin this thud thug thus tick tide tidy tied tier ties tiff tile till tilt time tins tint tiny tips tire
toad toes tofu toga toil told toll tomb tome tone tong tons took tool toot tops tore torn toss tote tots tour
tout town tows toys tram trap tray tree trek trim trio trip trod trot true tuba tube tubs tuck tuft tugs tuna
tune turf turn tusk tutu twig twin twos type typo
ugly undo unit unto upon urge urns used user uses
vain vale vamp vane vans vary vase vast vats veal veer veil vein vent verb very vest veto vets vial vibe vice
view vile vine visa vise void vole volt vote vows
wade wads waft wage wags waif wail wait wake walk wall wand wane want ward ware warm warn warp wars wart wary
wash wasp watt wave wavy waxy ways weak wean wear webs weds weed week weep weld well welt went wept were west
wets what when whey whim whip whir whiz whom wick wide wife wigs wild will wilt wily wimp wind wine wing wink
wins wipe wire wiry wise wish wisp with wits woes woke woks wolf womb wont wood woof wool word wore work worm
worn wove wrap wren
yaks yams yank yaps yard yarn yawn yeah year yell yelp yeti yews yoga yoke yolk your yuck yule yurt
zany zaps zeal zero zest zinc zing zips zone zoom zoos
`.trim().split(/\s+/)

export const PAIRS: readonly (readonly [string, string, number])[] = [
  ['lake', 'pond', 5],
  ['hill', 'peak', 5],
  ['cart', 'mule', 4],
  ['drum', 'beat', 5],
  ['cold', 'warm', 4],
  ['cake', 'pies', 5],
  ['talk', 'chat', 6],
  ['gate', 'yard', 4],
  ['tune', 'band', 4],
  ['leaf', 'tree', 7],
  ['card', 'deal', 5],
  ['loan', 'debt', 6],
  ['camp', 'fire', 4],
  ['milk', 'cake', 4],
  ['snow', 'cold', 7],
  ['bean', 'soup', 5],
  ['silk', 'gown', 7],
  ['gold', 'mine', 4],
  ['mask', 'face', 4],
  ['mind', 'body', 4],
  ['bull', 'cows', 6],
  ['kite', 'wind', 4],
  ['glow', 'worm', 7],
  ['coal', 'fire', 5],
  ['tile', 'roof', 6],
  ['lion', 'mane', 7],
  ['love', 'hate', 4],
  ['soup', 'bowl', 4],
  ['lamp', 'dark', 4],
  ['pool', 'swim', 7],
  ['rake', 'leaf', 6],
  ['give', 'take', 4],
  ['boat', 'oars', 5],
  ['lock', 'door', 4],
  ['coat', 'warm', 5],
  ['poor', 'rich', 7],
  ['pony', 'ride', 5],
  ['cove', 'boat', 5],
  ['rock', 'hard', 5],
  ['mane', 'hair', 5],
  ['seed', 'corn', 5],
  ['chin', 'face', 6],
  ['word', 'game', 5],
  ['head', 'tail', 5],
  ['time', 'past', 5],
  ['moss', 'rock', 5],
  ['desk', 'work', 5],
  ['wave', 'surf', 5],
  ['kelp', 'reef', 4],
  ['mice', 'cats', 4],
  ['rain', 'drip', 4],
  ['fuel', 'fire', 4],
  ['hard', 'easy', 5],
  ['meek', 'bold', 5],
  ['weak', 'firm', 6],
  ['calm', 'wild', 4],
  ['lion', 'bear', 5],
  ['ship', 'dock', 6],
  ['hope', 'fear', 6],
  ['hawk', 'dove', 6],
  ['less', 'more', 4],
  ['gown', 'ball', 6],
  ['sink', 'swim', 6],
  ['colt', 'mare', 4],
  ['farm', 'crop', 6],
  ['dull', 'fine', 4],
  ['crow', 'corn', 5],
  ['duck', 'pond', 5],
  ['snow', 'melt', 6],
  ['fish', 'fins', 5],
  ['hive', 'bees', 6],
  ['fish', 'bird', 6],
  ['home', 'rest', 5],
  ['sand', 'dune', 4],
  ['wolf', 'fang', 7],
  ['worm', 'bird', 4],
  ['rice', 'corn', 5],
  ['note', 'song', 4],
  ['tent', 'camp', 6],
  ['moth', 'lamp', 5],
  ['past', 'gone', 5],
  ['pole', 'flag', 7],
  ['heat', 'warm', 5],
  ['hand', 'palm', 4],
  ['lose', 'find', 4],
  ['hare', 'slow', 7],
  ['salt', 'mine', 4],
  ['lazy', 'busy', 6],
  ['heat', 'cool', 5],
  ['hand', 'foot', 5],
  ['barn', 'hens', 5],
  ['road', 'trip', 7],
  ['tall', 'tiny', 4],
  ['sail', 'wind', 4],
  ['bite', 'food', 6],
  ['tide', 'moon', 6],
  ['jump', 'rope', 7],
  ['cash', 'rich', 6],
  ['rain', 'pool', 5],
  ['fast', 'slow', 6],
  ['bear', 'cave', 6],
  ['wish', 'hope', 5],
  ['star', 'wish', 7],
  ['huge', 'tiny', 6],
  ['bath', 'soap', 7],
  ['shoe', 'sock', 6],
  ['warm', 'cool', 5],
  ['rain', 'snow', 7],
  ['wild', 'tame', 5],
  ['dusk', 'dawn', 5],
  ['roof', 'wall', 6],
  ['corn', 'milk', 5],
  ['sofa', 'seat', 5],
  ['bird', 'nest', 5],
  ['pail', 'milk', 4],
  ['fawn', 'deer', 7],
  ['pear', 'tree', 6],
  ['flip', 'coin', 4],
  ['fire', 'wood', 4],
  ['mild', 'heat', 4],
  ['fern', 'moss', 6],
  ['coin', 'cash', 5],
  ['sour', 'milk', 6],
  ['rise', 'fall', 4],
  ['pear', 'plum', 5],
  ['nose', 'face', 5],
  ['ship', 'sink', 6],
  ['team', 'play', 4],
  ['mask', 'ball', 4],
  ['fork', 'dish', 6],
  ['ship', 'port', 5],
  ['sail', 'boat', 5],
  ['hunt', 'game', 6],
  ['reef', 'fish', 7],
  ['meal', 'dine', 5],
  ['ears', 'hear', 6],
  ['king', 'rule', 5],
  ['wine', 'beer', 6],
  ['wind', 'calm', 5],
  ['lamb', 'wool', 7],
  ['poem', 'song', 7],
  ['kiss', 'love', 5],
  ['rock', 'sand', 4],
  ['wolf', 'pack', 6],
  ['soil', 'seed', 5],
  ['bell', 'ring', 6],
  ['seed', 'tree', 5],
  ['cook', 'meal', 6],
  ['ship', 'mast', 6],
  ['ruby', 'gold', 7],
  ['dice', 'roll', 4],
  ['mint', 'leaf', 5],
  ['read', 'book', 5],
  ['foot', 'toes', 5],
  ['bark', 'bite', 4],
  ['moon', 'star', 6],
  ['sock', 'foot', 4],
  ['walk', 'ride', 5],
  ['goat', 'milk', 5],
]
