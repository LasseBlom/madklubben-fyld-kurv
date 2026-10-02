/**
 * @OnlyCurrentDoc
 * Fyld kurv – telefonside og data til Madklubbens varebestilling.
 *
 * Ligger som Google Apps Script bundet til et Google Sheet.
 * - Telefonsiden (doGet uden parametre) bruges i kælderen til at tælle.
 * - ?format=json bruges af "Fyld kurv"-knappen i Chrome (Tampermonkey).
 *
 * Alt gemmes i arket "Varer": én række pr. vare, antal i kolonnen "antal".
 *
 * Sikkerhed: @OnlyCurrentDoc betyder, at scriptet kun har adgang til DETTE regneark,
 * ikke til resten af ejerens Google Drev. Arket må kun indeholde varer og antal –
 * aldrig navne, mailadresser, adgangskoder eller priser.
 */

const RESTAURANT = 'MKA (prøve)';
const MAKS_ANTAL = 99; // loft pr. vare – begrænser skaden, hvis nogen pjatter med telefonsiden
const ARK = 'Varer';
const KOLONNER = ['id', 'leverandor', 'kategori', 'navn', 'detalje', 'enhed', 'varenr', 'billede', 'note', 'sortering', 'antal', 'opdateret'];

// Prøvevarer: Carlsbergs favoritliste "MKA". Bruges kun af opsaet(), når arket er tomt.
const STARTVARER = [
  ['c-tuborg-groen', 'Carlsberg', 'Fadøl', 'Tuborg Grøn', 'Grøn Tuborg Modular 20 l', 'fustage 20 l', '15285', 'https://shop.carlsbergdanmark.dk/-/media/Products/1528515285dk114jpg.jpg', '', 1],
  ['c-tuborg-classic', 'Carlsberg', 'Fadøl', 'Tuborg Classic', 'Tuborg Classic Modular 20 l', 'fustage 20 l', '67130', 'https://shop.carlsbergdanmark.dk/-/media/Products/6713067130dk111jpg.jpg', '', 2],
  ['c-1664-blanc', 'Carlsberg', 'Fadøl', 'Kronenbourg Blanc', '1664 Blanc Modular 20 l', 'fustage 20 l', '16342', 'https://shop.carlsbergdanmark.dk/-/media/Products/1634216342dk19jpg.jpg', '', 3],
  ['c-mikkeller-burst', 'Carlsberg', 'Fadøl', 'Mikkeller Burst IPA', 'Mikkeller Burst IPA Modular 20 l', 'fustage 20 l', '35878', 'https://shop.carlsbergdanmark.dk/-/media/Products/3587835878dk12jpg.jpg', '', 4],
  ['c-mikkeller-sun', 'Carlsberg', 'Øl på flaske og dåse', "Mikkeller Drink'in the Sun 0,3%", '33 cl dåse', 'kasse á 12', '35646', 'https://shop.carlsbergdanmark.dk/-/media/Products/3564635646dk12jpg.jpg', '', 5],
  ['c-brooklyn', 'Carlsberg', 'Øl på flaske og dåse', 'Brooklyn Special Effects 0,4%', '33 cl flaske', 'kasse á 24', '24821', 'https://shop.carlsbergdanmark.dk/-/media/Products/2482124821dk19jpg.jpg', '', 6],
  ['c-coca-cola', 'Carlsberg', 'Sodavand', 'Coca-Cola', '33 cl dåse', 'bakke á 24', '64550', 'https://shop.carlsbergdanmark.dk/-/media/Products/6455064550dk17jpg.jpg', '', 7],
  ['c-coca-cola-zero', 'Carlsberg', 'Sodavand', 'Coca-Cola Zero', '33 cl dåse', 'bakke á 24', '25566', 'https://shop.carlsbergdanmark.dk/-/media/Products/2556625566dk18jpg.jpg', '', 8],
  ['c-fanta', 'Carlsberg', 'Sodavand', 'Fanta', '33 cl dåse', 'bakke á 24', '34712', 'https://shop.carlsbergdanmark.dk/-/media/Products/3471234712dk13jpg.jpg', '', 9],
];

/** Kør én gang fra Apps Script-editoren. Opretter arket og lægger prøvevarerne ind. */
function opsaet() {
  const ss = SpreadsheetApp.getActive();
  let ark = ss.getSheetByName(ARK);
  if (!ark) ark = ss.insertSheet(ARK);
  if (ark.getLastRow() === 0) {
    ark.appendRow(KOLONNER);
    ark.setFrozenRows(1);
  }
  if (ark.getLastRow() === 1) {
    const rows = STARTVARER.map(v => v.concat([0, '']));
    ark.getRange(2, 1, rows.length, KOLONNER.length).setValues(rows);
  }
  ark.autoResizeColumns(1, KOLONNER.length);
}

function hentArk_() {
  const ark = SpreadsheetApp.getActive().getSheetByName(ARK);
  if (!ark) throw new Error('Kør opsaet() i Apps Script-editoren først.');
  return ark;
}

/** Alle varer med antal. Bruges af både telefonsiden og "Fyld kurv". */
function hentData() {
  const ark = hentArk_();
  const values = ark.getDataRange().getValues();
  const head = values.shift();
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  let senest = '';
  const varer = values
    .filter(r => r[idx.id])
    .map(r => {
      const opd = r[idx.opdateret] ? new Date(r[idx.opdateret]).toISOString() : '';
      if (opd > senest) senest = opd;
      return {
        id: String(r[idx.id]),
        leverandor: String(r[idx.leverandor]),
        kategori: String(r[idx.kategori]),
        navn: String(r[idx.navn]),
        detalje: String(r[idx.detalje]),
        enhed: String(r[idx.enhed]),
        varenr: String(r[idx.varenr]),
        billede: String(r[idx.billede]),
        note: String(r[idx.note]),
        sortering: Number(r[idx.sortering]) || 0,
        antal: Number(r[idx.antal]) || 0,
      };
    });
  return { restaurant: RESTAURANT, opdateret: senest, varer: varer };
}

/** Gemmer antallet for én vare. Kaldes fra telefonsiden. */
function gemAntal(id, antal) {
  antal = Math.max(0, Math.min(MAKS_ANTAL, Math.round(Number(antal) || 0)));
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(id)) throw new Error('Ugyldig vare.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ark = hentArk_();
    const ids = ark.getRange(2, 1, Math.max(ark.getLastRow() - 1, 1), 1).getValues().map(r => String(r[0]));
    const row = ids.indexOf(String(id));
    if (row < 0) throw new Error('Ukendt vare: ' + id);
    const nu = new Date();
    ark.getRange(row + 2, KOLONNER.indexOf('antal') + 1, 1, 2).setValues([[antal, nu]]);
    return { id: id, antal: antal, opdateret: nu.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

/** Sætter alle antal til 0. Kaldes fra telefonsiden ("Start ny optælling"). */
function nulstil() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ark = hentArk_();
    const n = ark.getLastRow() - 1;
    if (n > 0) {
      const nu = new Date();
      ark.getRange(2, KOLONNER.indexOf('antal') + 1, n, 2).setValues(Array.from({ length: n }, () => [0, nu]));
    }
    return hentData();
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.format === 'json') {
    return ContentService.createTextOutput(JSON.stringify(hentData()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutputFromFile('Telefon')
    .setTitle('Kælderliste')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}
