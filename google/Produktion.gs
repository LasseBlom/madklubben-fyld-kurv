/**
 * Produktion – premix og sirup, der skal laves, regnet om til indkøb.
 *
 * Man skriver på telefonsiden, hvad der skal laves ("2 kondi Julep", "10 L rabarbersirup"),
 * og får:
 *  - flasker hos leverandøren (fx Philipson). De lægges OVEN I kælderoptællingen, når man trykker
 *    "Fyld kurv" – personalets antal i arket "Varer" røres aldrig, så der altid er flasker til overs.
 *  - en indkøbsliste over alt det, der købes et andet sted (bær, sukker, juice, mælk). Den står også
 *    i arket "Indkøbsliste", så den kan åbnes fra en anden computer.
 *
 * Opskrifterne ligger i arkene "Opskrifter" og "Ingredienser" og kan rettes direkte i arket.
 * opsaet() lægger kun de opskrifter ind, der mangler – rettelser i arket bevares.
 *
 * Opskrifter: [navn, type, måles i, giver liter pr. batch, note]
 *   Ingredienserne er altid pr. batch, og en batch giver "giver_l" liter.
 *   "kondi": batchen er én kondi. Man kan vælge antal kondier ELLER liter (kolonnen "enhed" husker valget).
 *   "L":     man vælger liter.
 * Ingredienser: [opskrift, ingrediens, mængde, enhed, kilde]
 *   kilde = id i arket "Varer" (flasker – mængden er i liter, flaskestørrelsen læses af "detalje", fx "70 cl"),
 *           navnet på en anden opskrift (fx en sirup),
 *           "køb" (kommer på indkøbslisten) eller "nej" (vand – købes ikke).
 */

const PROD_ARK = 'Opskrifter';
const PROD_INGR_ARK = 'Ingredienser';
const PROD_INDKOEB_ARK = 'Indkøbsliste';
// Nye kolonner tilføjes til sidst. "enhed" = det, man har valgt på telefonen ("kondi" eller "L").
const PROD_KOLONNER = ['opskrift', 'type', 'maales_i', 'giver_l', 'skal_laves', 'note', 'opdateret', 'enhed'];
const PROD_INGR_KOLONNER = ['opskrift', 'ingrediens', 'maengde', 'enhed', 'kilde'];
const PROD_MAKS = { kondi: 20, L: 100 };

// Frugtsirup laves 1:1:1 (bær, sukker, vand). 5 + 5 + 5 giver 10-12 L – vi regner med 10 L, så der hellere er for meget.
// giver_l for premix = liter i én kondi (fx 4,2 L Julep i en 5 L kondi) – bruges, når man vælger liter.
// Rhubarb Bomb og Espresso Martini er pr. liter (fra "MKA premix cheat sheet") – vi kender ikke deres kondi.
const PROD_OPSKRIFTER = [
  ['Julep premix', 'Premix', 'kondi', 4.2, '5 L kondi'],
  ['Hula Hula premix', 'Premix', 'kondi', 5, '5 L kondi'],
  ['Woo Woo premix', 'Premix', 'kondi', 5, '5 L kondi'],
  ['Slam Dunk premix', 'Premix', 'kondi', 4.7, '5 L kondi. Milk-washes med sødmælk i en anden kondi, står min. 5 timer, strain dagen efter.'],
  ['Oliveto premix', 'Premix', 'kondi', 3, '3 L kondi'],
  ['Rhubarb Bomb premix', 'Premix', 'L', 1, 'Pr. liter. Resten (ca. 0,23 L pr. liter) står ikke i cheat sheet\'et'],
  ['Espresso Martini premix', 'Premix', 'L', 1, 'Pr. liter'],
  ['Brombærsirup', 'Sirup', 'L', 10, '5 kg bær + 5 kg sukker + 5 L vand ≈ 10-12 L'],
  ['Havtornsirup', 'Sirup', 'L', 10, '5 kg bær + 5 kg sukker + 5 L vand ≈ 10-12 L'],
  ['Rabarbersirup', 'Sirup', 'L', 10, '5 kg rabarber + 5 kg sukker + 5 L vand ≈ 10-12 L'],
  ['Fersken/hibiscus-sirup', 'Sirup', 'L', 10, 'Opskrift mangler – skriv ingredienserne i arket "Ingredienser"'],
  ['Tranebærsirup', 'Sirup', 'L', 10, 'Opskrift mangler – købes den færdig?'],
  ['Sukkersirup', 'Sirup', 'L', 1.6, '1 kg sukker + 1 L vand ≈ 1,6 L'],
  ['Rørsukkersirup', 'Sirup', 'L', 1.6, '1 kg rørsukker + 1 L vand ≈ 1,6 L'],
];

const PROD_INGREDIENSER = [
  ['Julep premix', 'Four Roses Bourbon', 2.1, 'L', 'p-four-roses'],
  ['Julep premix', 'Brombærsirup', 2.1, 'L', 'Brombærsirup'],
  ['Hula Hula premix', 'Olmeca tequila', 2, 'L', 'p-olmeca'],
  ['Hula Hula premix', 'Fersken likør', 1, 'L', 'p-cartron-peche'],
  ['Hula Hula premix', 'Fersken/hibiscus-sirup', 2, 'L', 'Fersken/hibiscus-sirup'],
  ['Woo Woo premix', 'Absolut vodka', 1.25, 'L', 'p-absolut'],
  ['Woo Woo premix', 'Fersken likør', 1.25, 'L', 'p-cartron-peche'],
  ['Woo Woo premix', 'Tranebærsirup', 2.5, 'L', 'Tranebærsirup'],
  ['Slam Dunk premix', 'Havana Club 3', 0.7, 'L', 'p-havana-3'],
  ['Slam Dunk premix', 'Amaretto', 0.7, 'L', 'p-amaretto'],
  ['Slam Dunk premix', 'Campari', 0.175, 'L', 'p-campari'],
  ['Slam Dunk premix', 'Ananasjuice', 1.2, 'L', 'køb'],
  ['Slam Dunk premix', 'Limejuice', 0.75, 'L', 'køb'],
  ['Slam Dunk premix', 'Rørsukkersirup', 0.45, 'L', 'Rørsukkersirup'],
  ['Slam Dunk premix', 'Sødmælk', 1, 'L', 'køb'],
  ['Oliveto premix', 'Licor 43', 2, 'L', 'p-licor43'],
  ['Oliveto premix', 'Absolut vodka', 0.5, 'L', 'p-absolut'],
  ['Oliveto premix', 'Sukkersirup', 0.5, 'L', 'Sukkersirup'],
  ['Rhubarb Bomb premix', 'Beefeater gin', 0.31, 'L', 'p-beefeater'],
  ['Rhubarb Bomb premix', 'Rabarbersirup', 0.46, 'L', 'Rabarbersirup'],
  ['Espresso Martini premix', 'Kahlúa', 0.4, 'L', 'p-kahlua'],
  ['Espresso Martini premix', 'Absolut vodka', 0.4, 'L', 'p-absolut'],
  ['Espresso Martini premix', 'Frangelico', 0.2, 'L', 'p-frangelico'],
  ['Brombærsirup', 'Brombær', 5, 'kg', 'køb'],
  ['Brombærsirup', 'Sukker', 5, 'kg', 'køb'],
  ['Brombærsirup', 'Vand', 5, 'L', 'nej'],
  ['Havtornsirup', 'Havtornbær', 5, 'kg', 'køb'],
  ['Havtornsirup', 'Sukker', 5, 'kg', 'køb'],
  ['Havtornsirup', 'Vand', 5, 'L', 'nej'],
  ['Rabarbersirup', 'Rabarber', 5, 'kg', 'køb'],
  ['Rabarbersirup', 'Sukker', 5, 'kg', 'køb'],
  ['Rabarbersirup', 'Vand', 5, 'L', 'nej'],
  ['Sukkersirup', 'Sukker', 1, 'kg', 'køb'],
  ['Sukkersirup', 'Vand', 1, 'L', 'nej'],
  ['Rørsukkersirup', 'Rørsukker', 1, 'kg', 'køb'],
  ['Rørsukkersirup', 'Vand', 1, 'L', 'nej'],
];

/** Kaldes fra opsaet(). Opretter arkene og lægger de opskrifter ind, der mangler. */
function opsaetProduktion_() {
  const ss = SpreadsheetApp.getActive();
  const ark = arkMedOverskrift_(ss, PROD_ARK, PROD_KOLONNER);
  const ingr = arkMedOverskrift_(ss, PROD_INGR_ARK, PROD_INGR_KOLONNER);
  arkMedOverskrift_(ss, PROD_INDKOEB_ARK, ['Indkøbsliste']);

  const findes = ark.getRange(1, 1, ark.getLastRow(), 1).getValues().map(r => String(r[0]));
  const nye = PROD_OPSKRIFTER.filter(o => !findes.includes(o[0]));
  if (nye.length) {
    ark.getRange(ark.getLastRow() + 1, 1, nye.length, PROD_KOLONNER.length)
      .setValues(nye.map(o => [o[0], o[1], o[2], o[3], 0, o[4], '', o[2]]));
    // Ingredienser kun til de nye opskrifter – en opskrift, der er rettet i arket, røres ikke.
    const navne = nye.map(o => o[0]);
    const rk = PROD_INGREDIENSER.filter(i => navne.includes(i[0]));
    if (rk.length) ingr.getRange(ingr.getLastRow() + 1, 1, rk.length, PROD_INGR_KOLONNER.length).setValues(rk);
  }
  ark.autoResizeColumns(1, PROD_KOLONNER.length);
  ingr.autoResizeColumns(1, PROD_INGR_KOLONNER.length);
  skrivIndkoebsliste_(beregnProduktion_());
}

function arkMedOverskrift_(ss, navn, kolonner) {
  let ark = ss.getSheetByName(navn);
  if (!ark) ark = ss.insertSheet(navn);
  if (ark.getLastRow() === 0) {
    ark.appendRow(kolonner);
    ark.setFrozenRows(1);
  }
  // Ældre ark mangler de nyeste kolonner – de tilføjes til sidst i overskriftsrækken.
  const head = ark.getRange(1, 1, 1, kolonner.length).getValues()[0].map(String);
  kolonner.forEach((k, i) => { if (!head[i]) ark.getRange(1, i + 1).setValue(k); });
  return ark;
}

// Arkets rækker som objekter (overskriftsrækken giver feltnavnene). Mangler arket, er listen tom.
function laesArk_(navn) {
  const ark = SpreadsheetApp.getActive().getSheetByName(navn);
  if (!ark || ark.getLastRow() < 2) return [];
  const values = ark.getDataRange().getValues();
  const head = values.shift().map(String);
  return values.map((r, i) => Object.assign({ raekke: i + 2 }, Object.fromEntries(head.map((h, j) => [h, r[j]]))));
}

const tal_ = x => Number(String(x).replace(',', '.')) || 0;

// Flaskens størrelse i liter ud fra "70 cl", "1 l" eller "1,5 liter" i varens beskrivelse. Ellers 70 cl.
function flaskeLiter_(v) {
  const t = [v.detalje, v.navn, v.enhed].join(' ').toLowerCase();
  const cl = t.match(/(\d+(?:[.,]\d+)?)\s*cl\b/);
  if (cl) return tal_(cl[1]) / 100;
  const l = t.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter)\b/);
  if (l) return tal_(l[1]);
  return 0.7;
}

// Rund op, så der aldrig mangler: kg til nærmeste halve, liter til nærmeste deciliter, resten til hele.
function rundOp_(m, enhed) {
  const trin = enhed === 'kg' ? 0.5 : enhed === 'L' ? 0.1 : 1;
  return Math.round(Math.ceil(m / trin - 1e-9) * trin * 10) / 10;
}

/**
 * Regner alt det, der skal laves, om til flasker og indkøb.
 * varer = rækkerne fra arket "Varer" (fra hentData) – bruges til flaskestørrelse og navn.
 */
function beregnProduktion_(varer) {
  varer = varer || [];
  const opskrifter = laesArk_(PROD_ARK).filter(o => o.opskrift).map(o => ({
    navn: String(o.opskrift),
    type: String(o.type || ''),
    maalesI: String(o.maales_i) === 'kondi' ? 'kondi' : 'L',
    // Valgt enhed: kondi kun for opskrifter, der laves i kondier. Tom = som "maales_i".
    enhed: String(o.maales_i) === 'kondi' && String(o.enhed || 'kondi') !== 'L' ? 'kondi' : 'L',
    giverL: tal_(o.giver_l),
    skalLaves: tal_(o.skal_laves),
    note: String(o.note || ''),
    ingredienser: [],
  }));
  const efterNavn = new Map(opskrifter.map(o => [o.navn, o]));
  laesArk_(PROD_INGR_ARK).forEach(i => {
    const o = efterNavn.get(String(i.opskrift));
    if (o && i.ingrediens) o.ingredienser.push({ ingrediens: String(i.ingrediens), maengde: tal_(i.maengde), enhed: String(i.enhed || ''), kilde: String(i.kilde || '').trim() });
  });

  const vareEfterId = new Map(varer.map(v => [v.id, v]));
  const liter = new Map();     // vare-id -> liter
  const koeb = new Map();      // "navn|enhed" -> { navn, enhed, maengde, til:Set }
  const behov = new Map();     // sirup -> liter, som premixene skal bruge
  const ukendt = [];           // kilder, der hverken er en vare, en opskrift, "køb" eller "nej"

  opskrifter.filter(o => o.skalLaves > 0).forEach(o => {
    // Ingredienserne er pr. batch (én kondi eller giver_l liter).
    const faktor = o.enhed === 'kondi' ? o.skalLaves : (o.giverL > 0 ? o.skalLaves / o.giverL : 0);
    o.ingredienser.forEach(i => {
      const m = i.maengde * faktor;
      const k = i.kilde.toLowerCase();
      if (k === 'nej' || !m) return;
      if (k === 'køb' || k === 'koeb' || !i.kilde) {
        const key = i.ingrediens.toLowerCase() + '|' + i.enhed;
        const x = koeb.get(key) || { navn: i.ingrediens, enhed: i.enhed, maengde: 0, til: new Set() };
        x.maengde += m; x.til.add(o.navn); koeb.set(key, x);
      } else if (vareEfterId.has(i.kilde)) {
        liter.set(i.kilde, (liter.get(i.kilde) || 0) + m);
      } else if (efterNavn.has(i.kilde)) {
        behov.set(i.kilde, (behov.get(i.kilde) || 0) + m);
      } else if (!ukendt.includes(i.kilde)) {
        ukendt.push(i.kilde);
      }
    });
  });

  const flasker = [...liter].map(([id, l]) => {
    const v = vareEfterId.get(id);
    return { id: id, navn: v.navn, leverandor: v.leverandor, liter: Math.round(l * 1000) / 1000, antal: Math.ceil(l / flaskeLiter_(v) - 1e-9) };
  });
  const indkoeb = [...koeb.values()].map(x => ({ navn: x.navn, enhed: x.enhed, maengde: rundOp_(x.maengde, x.enhed), til: [...x.til] }))
    .sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
  // Sirup, som premixene skal bruge – og hvor meget der allerede er sat til at blive lavet.
  const sirup = [...behov].map(([navn, l]) => {
    const o = efterNavn.get(navn);
    return { navn: navn, behovL: Math.round(l * 100) / 100, planlagtL: o.skalLaves, manglerOpskrift: !o.ingredienser.length };
  });
  const manglerOpskrift = opskrifter.filter(o => o.skalLaves > 0 && !o.ingredienser.length).map(o => o.navn);

  return {
    opskrifter: opskrifter.map(o => Object.assign({}, o, { manglerOpskrift: !o.ingredienser.length })),
    flasker: flasker, indkoeb: indkoeb, sirup: sirup, manglerOpskrift: manglerOpskrift, ukendt: ukendt,
  };
}

/** Flasker til premix pr. vare-id – lægges oven i optællingen, når "Fyld kurv" henter data. */
function premixFlasker_(varer) {
  return Object.fromEntries(beregnProduktion_(varer).flasker.map(f => [f.id, f.antal]));
}

const fmtTal_ = n => String(Math.round(n * 100) / 100).replace('.', ',');

// Indkøbslisten som almindelig tekst – til arket og til "Del"-knappen på telefonen.
function indkoebTekst_(b) {
  const laves = b.opskrifter.filter(o => o.skalLaves > 0).map(o => `${fmtTal_(o.skalLaves)} ${o.enhed} ${o.navn}`);
  if (!laves.length) return '';
  const linjer = ['Indkøb til premix og sirup – ' + RESTAURANT, 'Skal laves: ' + laves.join(', '), ''];
  if (b.indkoeb.length) linjer.push('KØBES:', ...b.indkoeb.map(x => `- ${fmtTal_(x.maengde)} ${x.enhed} ${x.navn}`), '');
  const lev = [...new Set(b.flasker.map(f => f.leverandor))];
  lev.forEach(l => linjer.push(`${l.toUpperCase()} (kommer med i "Fyld kurv"):`, ...b.flasker.filter(f => f.leverandor === l).map(f => `- ${f.antal} fl. ${f.navn}`), ''));
  if (b.sirup.length) linjer.push('SIRUP, SOM PREMIX SKAL BRUGE (lav den, eller tjek køl):', ...b.sirup.map(x => `- ${fmtTal_(x.behovL)} L ${x.navn}${x.manglerOpskrift ? ' (opskrift mangler)' : ''}`), '');
  if (b.manglerOpskrift.length) linjer.push('Mangler opskrift: ' + b.manglerOpskrift.join(', '));
  return linjer.join('\n').trim();
}

function skrivIndkoebsliste_(b) {
  const ark = SpreadsheetApp.getActive().getSheetByName(PROD_INDKOEB_ARK);
  if (!ark) return;
  const tekst = indkoebTekst_(b) || 'Der er ikke sat noget til at blive lavet.';
  const linjer = [['Indkøbsliste – opdateret ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd/M HH:mm')]]
    .concat(tekst.split('\n').map(l => [l]));
  ark.clearContents();
  ark.getRange(1, 1, linjer.length, 1).setValues(linjer);
}

/** Alt til fanen "Produktion" på telefonsiden. */
function hentProduktion() {
  const b = beregnProduktion_(laesVarer_());
  return Object.assign(b, { tekst: indkoebTekst_(b) });
}

/**
 * Gemmer, hvor meget der skal laves af én opskrift. Kaldes fra telefonsiden.
 * enhed = "kondi" eller "L" (kun opskrifter, der laves i kondier, kan tælles i kondier).
 */
function gemProduktion(navn, maengde, enhed) {
  if (typeof navn !== 'string' || !navn || navn.length > 80) throw new Error('Ukendt opskrift.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const o = laesArk_(PROD_ARK).find(r => String(r.opskrift) === navn);
    if (!o) throw new Error('Ukendt opskrift: ' + navn);
    const kondi = String(o.maales_i) === 'kondi' && enhed !== 'L';
    // Kondier i hele tal, liter i deciliter.
    maengde = Math.max(0, Math.min(PROD_MAKS[kondi ? 'kondi' : 'L'], kondi ? Math.round(tal_(maengde)) : Math.round(tal_(maengde) * 10) / 10));
    const ark = SpreadsheetApp.getActive().getSheetByName(PROD_ARK);
    ark.getRange(o.raekke, PROD_KOLONNER.indexOf('skal_laves') + 1).setValue(maengde);
    ark.getRange(o.raekke, PROD_KOLONNER.indexOf('opdateret') + 1).setValue(new Date());
    ark.getRange(o.raekke, PROD_KOLONNER.indexOf('enhed') + 1).setValue(kondi ? 'kondi' : 'L');
    const b = hentProduktion();
    skrivIndkoebsliste_(b);
    return b;
  } finally {
    lock.releaseLock();
  }
}

/** Sætter alt, der skal laves, til 0 (når der er bestilt). Kaldes fra telefonsiden. */
function nulstilProduktion() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ark = SpreadsheetApp.getActive().getSheetByName(PROD_ARK);
    const n = ark ? ark.getLastRow() - 1 : 0;
    if (n > 0) {
      const felt = ark.getRange(2, PROD_KOLONNER.indexOf('skal_laves') + 1, n, 1);
      felt.setValues(felt.getValues().map(r => [r[0] === '' ? '' : 0]));
    }
    const b = hentProduktion();
    skrivIndkoebsliste_(b);
    return b;
  } finally {
    lock.releaseLock();
  }
}
