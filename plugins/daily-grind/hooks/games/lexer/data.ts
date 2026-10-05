// Lexer content, indexed by days since EPOCH (shared.ts); the list cycles when it runs out.

/** Lexer answers: five-letter programming terms, in play order. */
export const ANSWERS = [
  'async', 'mutex', 'regex', 'yield', 'fetch', 'stash', 'tuple', 'react', 'panic', 'cache',
  'proxy', 'lexer', 'scope', 'merge', 'crate', 'queue', 'float', 'chmod', 'token', 'await',
  'shard', 'patch', 'trait', 'redis', 'mount', 'clone', 'array', 'defer', 'parse', 'shell',
  'debug', 'macro', 'index', 'retry', 'linux', 'blame', 'frame', 'stack', 'union', 'spawn',
  'route', 'class', 'guard', 'pixel', 'query', 'infer', 'batch', 'redux', 'slice', 'throw',
  'cargo', 'abort', 'state', 'swift', 'build', 'timer', 'catch', 'serde', 'split', 'props',
  'graph', 'modal', 'babel', 'rsync', 'const', 'flask', 'while', 'alias', 'mocha', 'mkdir',
  'break', 'scala', 'hover', 'unzip',
]

/** Other words a guess may be: everyday and dev-ish five-letter words. */
export const EXTRA = `
about above actor acute admin adopt after again agent agree ahead alarm album alert alien align alive allow alone along
alpha alter amber angle angry apple apply arena argue arise armor arrow asset audio audit avoid awake award aware bacon
badge basic basin beach beard beast begin being below bench berry bible birth black blade blank blast blend bless blind
block blood bloom board boost booth bound brain brand brave bread brick bride brief bring broad brown brush buddy bunch
burst buyer cabin cable camel candy canon carry cases chain chair chalk chaos charm chart chase cheap check cheek chess
chest chief child chill chips choir chunk cider civic claim clean clear clerk click cliff climb clock close cloud coach
coast codec color comet coral could count court cover crack craft crane crash crazy cream crisp cross crowd crown crude
cubic curve cycle daily dance datum dealt decay delta dense depth diary digit dirty disco ditto dodge donor draft drain
drama drawn dream dress drift drill drink drive eager early earth eight elbow elder elite email empty enemy enjoy enter
entry equal error essay event every exact exist extra fable faith false fancy fault feast fence fever fiber field fifth
fifty fight final first fixed flame flash fleet flood floor fluid flush focus force forge forth forum found frank fresh
front frost fruit funny fuzzy giant given glass globe glory glyph grace grade grain grand grant grape grass green greet
grind group grown guest guide habit happy harsh hash heart heavy hello hinge honey horse hotel house human humor ideal
image imply inbox inner input issue ivory jelly joint judge juice jumbo knife knock label laser later laugh layer learn
lease least legal lemon level light limit local logic login loose lucky lunch magic major maker mango maple march match
maybe media metal meter micro might minor minus mixed model money month moral motor mouse mouth movie music nerve never
night ninja noble noise north notch novel nudge nurse ocean offer often olive onion opera orbit order other outer owner
paint panel paper party pasta pause peace pearl phase phone photo piano piece pilot pitch pivot pizza place plain plane
plant plate plaza plugs point polar power press price pride prime print prior prize probe prompt proof proud prove pulse
punch pupil quick quiet quilt quota quote radar radio raise rally range rapid ratio reach ready realm relay renew reply
reset rider ridge right rigid rival river robin robot rocky roman rough round royal ruler rural salad sauce scale scene
score scrap screw sense serve setup seven shade shake shape share sharp sheep sheet shelf shift shine shirt shock short
shown sight since sixth sized skill slate sleep slide slope small smart smile smoke snack snake solar solid solve sorry
sound south space spare spark speak speed spend spice spike spine spoon sport squad staff stage stake stand start steam
steel stick still stone store storm story stove strip stuck study style sugar suite sunny super sweet swing sword table
taste teach tempo thank theme thick thing think third three throw thumb tiger tight title toast today topic torch total
touch tough tower trace track trade trail train trash treat trend trial tribe trick truck truly trunk trust truth twice
twist ultra uncle under unity until upper upset urban usage usual valid value vapor vault video vinyl virus visit vital
vivid vocal voice watch water wheel where which white whole widget width woman world worry worth would wrist write wrong
yacht young youth zebra
`.split(/\s+/).filter(w => w.length === 5)
