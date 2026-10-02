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

// Prøvevarer fra MKA's favoritlister. opsaet() tilføjer dem, der mangler i arket – eksisterende rækker røres ikke.
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
  // Philipson viser ikke varenumre på favoritlisten – her er "varenr" varens navn på listen (årgang ignoreres).
  ['p-rodolia-tinto', 'Philipson', 'Rødvin', 'Rodolia Tinto', 'Tempranillo-Syrah', 'flaske', '2024 Rodolia Tempranillo-Syrah Bodegas Mureda', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/16441324.png', 'Rabatpris ved 6 stk.', 20],
  ['p-rodolia-blanco', 'Philipson', 'Hvidvin', 'Rodolia Blanco', 'Sauvignon Blanc-Verdejo', 'flaske', '2025 Rodolia Sauvignon Blanc-Verdejo Bodegas Mureda', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/16441125.png', 'Rabatpris ved 6 stk.', 21],
  ['p-vidal-fleury', 'Philipson', 'Rødvin', 'Côtes du Rhône', 'J.V. Fleury', 'flaske', '2019 Côtes-du-Rhône Rouge J.V. Fleury', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/47331319.png', '', 22],
  ['p-barolo', 'Philipson', 'Rødvin', 'Barolo', 'Terre del Barolo', 'flaske', '2019 Barolo Cantina Terre del Barolo', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/68491319.png', 'Stor rabat ved 12 stk.', 23],
  ['p-longford', 'Philipson', 'Rødvin', 'Pinot Noir', 'Longford Estate', 'flaske', '2020 Longford Estate Pinot Noir Monterey', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/23131320.png', '', 24],
  ['p-beaune-rouge', 'Philipson', 'Rødvin', 'Beaune La Montée Rouge', 'Domaine de la Vougeraie', 'flaske', '2020 Beaune La Montée Rouge Domaine de La Vougeraie', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/18841320.png', '', 25],
  ['p-noble-semillon', 'Philipson', 'Dessertvin', 'Noble Semillon', 'Viu Manent', 'flaske', '2022 Viu Manent Noble Semillon Botrytis Selection Colchagua', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/27542422.png', '', 26],
  ['p-tonic', 'Philipson', 'Mixere', 'Fever Tree Mediterranean Tonic', '20 cl', 'flaske', 'Fever Tree - Mediterranean Tonic Water 20 Cl.', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/90011315.png', 'Rabatpris ved 24 stk.', 27],
  ['p-aperol', 'Philipson', 'Spiritus', 'Aperol', '70 cl', 'flaske', 'Aperol 70 cl.', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/91000401.png', '', 30],
  ['p-kahlua', 'Philipson', 'Spiritus', 'Kahlúa', '70 cl', 'flaske', 'Kahlua Kaffe Likør', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/90011308.png', '', 31],
  ['p-beefeater', 'Philipson', 'Spiritus', 'Beefeater Gin', '70 cl', 'flaske', 'Beefeater Gin', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/92900000.png', '', 32],
  ['p-four-roses', 'Philipson', 'Spiritus', 'Four Roses Bourbon', '70 cl', 'flaske', 'Four Roses Bourbon', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/92920000.png', '', 33],
  ['p-hendricks', 'Philipson', 'Spiritus', 'Hendrick\'s Gin', '70 cl', 'flaske', 'Hendricks Gin', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/90000062.png', '', 34],
  ['p-monkey47', 'Philipson', 'Spiritus', 'Monkey 47 Gin', '50 cl', 'flaske', 'Monkey 47 Dry Gin Schwarzwald', 'https://d1fjp8wkdq1msu.cloudfront.net/Admin/Public/GetImage.ashx?width=160&height=160&image=/Files/Images/Ecom/Products/93300400.png', '', 35],
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
  const findes = new Set(ark.getRange(1, 1, ark.getLastRow(), 1).getValues().map(r => String(r[0])));
  const nye = STARTVARER.filter(v => !findes.has(v[0])).map(v => v.concat([0, '']));
  if (nye.length) ark.getRange(ark.getLastRow() + 1, 1, nye.length, KOLONNER.length).setValues(nye);
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
