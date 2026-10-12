/**
 * @OnlyCurrentDoc
 * Fyld kurv – telefonside og data til Madklubbens varebestilling.
 *
 * Ligger som Google Apps Script bundet til et Google Sheet.
 * - Telefonsiden (doGet uden parametre) bruges i kælderen til at tælle.
 * - ?format=json bruges af "Fyld kurv"-knappen i Chrome (Tampermonkey).
 *
 * Alt gemmes i arket "Varer": én række pr. vare, antal i kolonnen "antal".
 * Kolonnen "omraade" deler telefonsiden op (Kælder, Gulv, Køkken). Samme vare kan stå
 * i flere områder (fx servietter på både gulv og køkken) – så har den en række pr. område.
 *
 * Sikkerhed: @OnlyCurrentDoc betyder, at scriptet kun har adgang til DETTE regneark,
 * ikke til resten af ejerens Google Drev. Arket må kun indeholde varer og antal –
 * aldrig navne, mailadresser, adgangskoder eller priser.
 */

const RESTAURANT = 'MKA (prøve)';
const MAKS_ANTAL = 99; // loft pr. vare – begrænser skaden, hvis nogen pjatter med telefonsiden
const ARK = 'Varer';
// Nye kolonner tilføjes altid til sidst, så "antal" bliver i kolonne K.
const KOLONNER = ['id', 'leverandor', 'kategori', 'navn', 'detalje', 'enhed', 'varenr', 'billede', 'note', 'sortering', 'antal', 'opdateret', 'omraade'];
// Fanerne på telefonsiden, i denne rækkefølge.
const OMRAADER = ['Kælder', 'Gulv', 'Køkken'];
const ML_BILLEDE = nr => 'https://d213yzj61vi89h.cloudfront.net/Bunzl-MLN-Site/images/1XS/' + nr + '.jpg';

// Prøvevarer fra MKA's favoritlister. opsaet() tilføjer dem, der mangler i arket – eksisterende rækker røres ikke.
// Det 11. felt er området; mangler det, er varen i "Kælder".
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
  // Multiline – ordreskabelonen "GULV MKA 2026". varenr = "Item #" på listen. Antal er i shoppens salgsenhed.
  ['mg-servietter', 'Multiline', 'Bord', 'Servietter, hvide', 'BulkySoft 40×40 cm, 2-lags', 'karton (20 × 100 stk)', '101468-1', ML_BILLEDE('101468-1'), '', 100, 'Gulv'],
  ['mg-bordflag', 'Multiline', 'Bord', 'Bordflag, Dannebrog', 'Zone Ø9×40 cm, stål', 'stk', '121115', ML_BILLEDE('121115'), '', 101, 'Gulv'],
  ['mg-fyrfadslys', 'Multiline', 'Lys', 'Fyrfadslys, hvide', '8 timers brændetid', 'karton (10 × 50 stk)', '107747-1', ML_BILLEDE('107747-1'), '', 110, 'Gulv'],
  ['mg-bloklys', 'Multiline', 'Lys', 'Bloklys, hvide', 'Ø78×145 mm, 81 timer', 'karton (6 stk)', '107071', ML_BILLEDE('107071'), '', 111, 'Gulv'],
  ['mg-sugeroer-store', 'Multiline', 'Bar', 'Sugerør, store', 'Papir, sort, Ø7×150 mm', 'pose (250 stk)', '124592', ML_BILLEDE('124592'), '', 120, 'Gulv'],
  ['mg-sugeroer-smaa', 'Multiline', 'Bar', 'Sugerør, små', 'Papir, sort, Ø5×125 mm', 'pose (250 stk)', '124583', ML_BILLEDE('124583'), '', 121, 'Gulv'],
  ['mg-tandstikker', 'Multiline', 'Bar', 'Tandstikker', 'Enkeltpakkede', 'pakke (1000 stk)', '4322', ML_BILLEDE('4322'), '', 122, 'Gulv'],
  ['mg-bonrulle-57', 'Multiline', 'Bonruller', 'Bonruller, små', '57 mm', 'karton (6 × 10 ruller)', '103244-4', ML_BILLEDE('103244-4'), '', 130, 'Gulv'],
  ['mg-bonrulle-80', 'Multiline', 'Bonruller', 'Bonruller, store', '80 mm', 'karton (10 × 3 ruller)', '102471-1', ML_BILLEDE('102471-1'), '', 131, 'Gulv'],
  ['mg-toiletpapir', 'Multiline', 'Toiletter', 'Toiletpapir', 'Tork Jumbo T1', 'karton (6 ruller)', '5255-1', ML_BILLEDE('5255-1'), '', 140, 'Gulv'],
  ['mg-haandklaeder', 'Multiline', 'Toiletter', 'Håndklædeark', 'Tork H2, Z-fold', 'karton (20 × 190 stk)', '12513-1', ML_BILLEDE('12513-1'), '', 141, 'Gulv'],
  ['mg-hygiejneposer', 'Multiline', 'Toiletter', 'Hygiejneposer, sorte', 'Madklubben', 'karton (5 × 100 stk)', '141376', ML_BILLEDE('141376'), '', 142, 'Gulv'],
  ['mg-salttabs', 'Multiline', 'Opvask', 'Salttabletter', 'Til opvaskemaskinen', 'sæk (10 kg)', '142171', ML_BILLEDE('142171'), '', 150, 'Gulv'],
  // Multiline – ordreskabelonen "KITCHEN TAW STUFFS (CORRECT ONE)".
  ['mk-salatskaal-rekt', 'Multiline', 'Salatskåle', 'Salatskål, firkantet', '950 ml, bagasse', 'karton (4 × 75 stk)', '144194', ML_BILLEDE('144194'), '', 200, 'Køkken'],
  ['mk-laag-salatskaal-rekt', 'Multiline', 'Salatskåle', 'Låg til firkantet salatskål', '230×160 mm', 'karton (300 stk)', '118791', ML_BILLEDE('118791'), '', 201, 'Køkken'],
  ['mk-salatskaal-rund', 'Multiline', 'Salatskåle', 'Salatskål, rund', '750 ml, brun kraft', 'karton (6 × 50 stk)', '121281-1', ML_BILLEDE('121281-1'), '', 202, 'Køkken'],
  ['mk-laag-salatskaal-rund', 'Multiline', 'Salatskåle', 'Låg til rund salatskål', 'Ø148 mm, klar', 'karton (6 × 50 stk)', '121284-1', ML_BILLEDE('121284-1'), '', 203, 'Køkken'],
  ['mk-suppe-50', 'Multiline', 'Suppe', 'Suppebæger, stort', '50 cl', 'karton (20 × 25 stk)', '113610', ML_BILLEDE('113610'), '', 210, 'Køkken'],
  ['mk-suppe-25', 'Multiline', 'Suppe', 'Suppebæger, lille', '25 cl', 'karton (16 × 50 stk)', '113608', ML_BILLEDE('113608'), '', 211, 'Køkken'],
  ['mk-laag-suppe', 'Multiline', 'Suppe', 'Låg til suppebæger', 'Ø96 mm', 'karton (20 × 25 stk)', '113611', ML_BILLEDE('113611'), '', 212, 'Køkken'],
  ['mk-dressing', 'Multiline', 'Dressing', 'Dressingbæger', '75 ml, klar', 'karton (10 × 96 stk)', '36271-2', ML_BILLEDE('36271-2'), '', 220, 'Køkken'],
  ['mk-laag-dressing', 'Multiline', 'Dressing', 'Låg til dressingbæger', 'Ø68 mm', 'karton (20 × 100 stk)', '36276-1', ML_BILLEDE('36276-1'), '', 221, 'Køkken'],
  ['mk-pommes-boks', 'Multiline', 'Takeaway', 'Pommes frites-boks', 'Med låg, 140×90×65 mm', 'karton (5 × 100 stk)', '110901', ML_BILLEDE('110901'), '', 230, 'Køkken'],
  ['mk-baerepose', 'Multiline', 'Takeaway', 'Bærepose, brun', '17 l, Madklubben', 'kasse (250 stk)', '140402', ML_BILLEDE('140402'), '', 231, 'Køkken'],
  ['mk-servietter', 'Multiline', 'Takeaway', 'Servietter, hvide', 'BulkySoft 40×40 cm, 2-lags', 'karton (20 × 100 stk)', '101468-1', ML_BILLEDE('101468-1'), '', 232, 'Køkken'],
  ['mk-bagepapir-catersource', 'Multiline', 'Køkken', 'Bagepapir', 'Catersource 30×52 cm', 'karton (500 ark)', '122925', ML_BILLEDE('122925'), '', 240, 'Køkken'],
  ['mk-bagepapir-silikone', 'Multiline', 'Køkken', 'Bagepapir med silikone', '52×30 cm, Svanemærket', 'karton (500 ark)', '4899', ML_BILLEDE('4899'), '', 241, 'Køkken'],
  ['mk-weck-glas', 'Multiline', 'Køkken', 'Weck-glas', '80 ml, uden låg', 'stk', '111019', ML_BILLEDE('111019'), '', 242, 'Køkken'],
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
  // Ældre ark mangler de nyeste kolonner (fx "omraade") – de tilføjes til sidst i overskriftsrækken.
  const head = ark.getRange(1, 1, 1, Math.max(ark.getLastColumn(), 1)).getValues()[0].map(String);
  KOLONNER.forEach((k, i) => {
    if (head[i] === k) return;
    if (!head[i] && !head.includes(k)) ark.getRange(1, i + 1).setValue(k);
    else throw new Error('Kolonnen "' + k + '" står det forkerte sted i arket – den skal være kolonne ' + (i + 1) + '.');
  });
  const findes = new Set(ark.getRange(1, 1, ark.getLastRow(), 1).getValues().map(r => String(r[0])));
  const nye = STARTVARER.filter(v => !findes.has(v[0])).map(v => v.slice(0, 10).concat([0, '', v[10] || OMRAADER[0]]));
  if (nye.length) ark.getRange(ark.getLastRow() + 1, 1, nye.length, KOLONNER.length).setValues(nye);
  // Rækker uden område hører til i kælderen.
  const n = ark.getLastRow() - 1;
  if (n > 0) {
    const kol = ark.getRange(2, KOLONNER.indexOf('omraade') + 1, n, 1);
    kol.setValues(kol.getValues().map(r => [r[0] || OMRAADER[0]]));
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
        omraade: String(r[idx.omraade] || OMRAADER[0]),
      };
    });
  return { restaurant: RESTAURANT, opdateret: senest, omraader: OMRAADER, varer: varer };
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

/** Sætter alle antal i ét område til 0. Kaldes fra telefonsiden ("Start ny optælling"). */
function nulstil(omraade) {
  if (!OMRAADER.includes(omraade)) throw new Error('Ukendt område.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ark = hentArk_();
    const n = ark.getLastRow() - 1;
    if (n > 0) {
      const nu = new Date();
      const omr = ark.getRange(2, KOLONNER.indexOf('omraade') + 1, n, 1).getValues();
      const felt = ark.getRange(2, KOLONNER.indexOf('antal') + 1, n, 2);
      felt.setValues(felt.getValues().map((r, i) => (omr[i][0] || OMRAADER[0]) === omraade ? [0, nu] : r));
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
