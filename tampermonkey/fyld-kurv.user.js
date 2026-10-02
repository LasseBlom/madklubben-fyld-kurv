// ==UserScript==
// @name         Fyld kurv – Madklubben
// @namespace    madklubben-bestilling
// @version      0.2.1
// @description  Lægger optællingen fra kælderlisten i kurven hos leverandøren. Bestiller aldrig – det gør du selv.
// @homepageURL  https://github.com/LasseBlom/madklubben-fyld-kurv
// @updateURL    https://raw.githubusercontent.com/LasseBlom/madklubben-fyld-kurv/main/tampermonkey/fyld-kurv.user.js
// @downloadURL  https://raw.githubusercontent.com/LasseBlom/madklubben-fyld-kurv/main/tampermonkey/fyld-kurv.user.js
// @match        https://shop.carlsbergdanmark.dk/Favoritter/Favoritliste*
// @match        https://www.smvwines.dk/kundecenter/favoritlister*
// @match        https://b2b.philipsonwine.com/min-profil/mine-favoritter/produkter*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ---------- Leverandører ----------
   * Hver leverandør beskriver: navn (som i Google-arket), hvordan rækkerne på
   * favoritlisten findes, hvad der står i kurven, og hvor kurven er.
   * Kolonnen "varenr" i arket er webshoppens varenummer – hos Philipson, hvor
   * favoritlisten ikke viser varenumre, er det i stedet varens navn på listen.
   */
  const normNavn = s => String(s || '').toLowerCase().normalize('NFKC')
    .replace(/^\s*\d{4}\s+/, '')          // årgang ignoreres, så en ny årgang stadig matcher
    .replace(/[“”"']/g, '').replace(/\s+/g, ' ').trim();
  const erVarenr = v => /^\d{1,10}$/.test(String(v.varenr));
  const erNavn = v => typeof v.varenr === 'string' && v.varenr.length >= 2 && v.varenr.length <= 150 && !/[<>]/.test(v.varenr);

  // Den største forælder til et antalsfelt, der kun indeholder ét antalsfelt = varens "kort".
  const kortFor = (input, selector) => {
    let e = input;
    while (e.parentElement && e.parentElement.querySelectorAll(selector).length === 1) e = e.parentElement;
    return e;
  };
  // Læser "1.234,56 DKK"/"kr." eller et antal fra kurv-linket i toppen.
  const kurvTekst = el => {
    if (!el) return null;
    const t = el.textContent.replace(/\s+/g, ' ');
    const m = t.match(/([\d.]+,\d{2})\s*(DKK|kr\.)/);
    if (m) return m[1] === '0,00' ? null : `${m[1]} ${m[2]}`;
    const n = parseInt((t.match(/\d+/) || ['0'])[0], 10);
    return n > 0 ? `${n} ${n === 1 ? 'vare' : 'varer'}` : null;
  };

  const LEVERANDORER = {
    'shop.carlsbergdanmark.dk': {
      navn: 'Carlsberg',
      kurvUrl: '/Checkout',
      gyldig: erVarenr,
      noegle: v => String(v.varenr),
      // Én række pr. vare: antalsfelt + kurv-knap + "Varenr. 12345" i teksten.
      findRaekker() {
        const map = {};
        document.querySelectorAll('input[type="number"]').forEach(input => {
          let row = input;
          while (row.parentElement && !/Varenr\.\s*\d+/.test(row.textContent)) row = row.parentElement;
          while (row.parentElement && (row.parentElement.textContent.match(/Varenr\./g) || []).length === 1) row = row.parentElement;
          const m = row.textContent.match(/Varenr\.\s*(\d+)/);
          const knap = (input.closest('form') || row).querySelector('button[type="submit"]');
          if (m && knap && !map[m[1]]) map[m[1]] = { input, knap };
        });
        return map;
      },
      // Kurvens beløb står i et <span> øverst til højre ("0,00 kr.").
      kurvElement() {
        return [...document.querySelectorAll('span')].find(e =>
          /^[\d.]+,\d{2}\s*kr\.$/.test(e.textContent.trim()) && e.getBoundingClientRect().top < 80);
      },
    },

    'www.smvwines.dk': {
      navn: 'Sigurd Müller',
      kurvUrl: '/kurv',
      gyldig: erVarenr,
      noegle: v => String(v.varenr),
      // Antalsfelter hedder Quantity1, Quantity2 …; varenummeret står som "Varenr: 123456" på kortet.
      // Én fælles "Læg i kurv"-knap lægger alle udfyldte vine i kurven på én gang.
      samlet: true,
      findRaekker() {
        const map = {};
        document.querySelectorAll('input[name^="Quantity"]').forEach(input => {
          const kort = kortFor(input, 'input[name^="Quantity"]');
          const m = kort.textContent.match(/Varenr:\s*(\d+)/);
          if (m && !map[m[1]]) map[m[1]] = { input };
        });
        return map;
      },
      samletKnap() {
        return [...document.querySelectorAll('button, input[type="submit"]')]
          .find(b => /^\s*læg i kurv\s*$/i.test(b.textContent || b.value || ''));
      },
      kurvElement() { return document.querySelector('a[href="/kurv"]'); },
    },

    'b2b.philipsonwine.com': {
      navn: 'Philipson',
      kurvUrl: '/kurv',
      gyldig: erNavn,
      noegle: v => normNavn(v.varenr),
      // Felterne er forudfyldt med shoppens standardmængde (6, 12, 24 …) – vi overskriver kun dem, vi bruger.
      findRaekker() {
        const map = {};
        document.querySelectorAll('input[name^="Quantity"]').forEach(input => {
          const kort = kortFor(input, 'input[name^="Quantity"]');
          const navn = (kort.innerText || '').split('\n').map(x => x.trim()).find(Boolean);
          const knap = [...kort.querySelectorAll('button')].find(b => !/favorite/i.test(b.className));
          const k = normNavn(navn);
          if (k && knap && !map[k]) map[k] = { input, knap };
        });
        return map;
      },
      kurvElement() {
        return [...document.querySelectorAll('a')].find(a => /\/kurv\/?$/.test(a.getAttribute('href') || ''));
      },
      // Kurvbeløbet i toppen opdateres langsomt hos Philipson. Bekræft i stedet via popuppen
      // "Tilføjet til kurven": varen, der lige blev lagt i, står lige efter overskriften
      // (længere nede viser popuppen andre varer, "Fyld kassen op" – dem ser vi bort fra).
      bekraeftet(v) {
        const t = (document.body.innerText || '').toLowerCase();
        const i = t.search(/tilføjet til kurven/);
        if (i < 0) return false;
        let efter = t.slice(i + 'tilføjet til kurven'.length, i + 260);
        const j = efter.search(/fyld kassen op|andre købte også/);
        if (j >= 0) efter = efter.slice(0, j);
        return normNavn(efter).includes(normNavn(v.varenr));
      },
      // Luk popuppen, så den næste vares bekræftelse ikke blandes med den forrige.
      lukPopup() {
        const titel = [...document.querySelectorAll('h1, h2, h3, h4, div, span')].find(e =>
          e.offsetParent !== null && e.children.length <= 2 && /^\s*tilføjet til kurven\s*$/i.test(e.textContent));
        let boks = titel, knap = null;
        for (let n = 0; boks && n < 5 && !knap; n++, boks = boks.parentElement) {
          knap = [...boks.querySelectorAll('button, a, [role="button"]')].find(b =>
            b.offsetParent !== null && (/luk|close/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '')) || /^\s*[×✕]\s*$/.test(b.textContent)));
        }
        if (knap) knap.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      },
    },
  };

  const lev = LEVERANDORER[location.hostname];
  if (!lev) return;
  lev.kurvStatus = () => kurvTekst(lev.kurvElement());
  // "Fingeraftryk" af kurven i toppen af siden – ændrer sig, når webshoppen har taget imod en vare.
  const kurvSignatur = () => { const el = lev.kurvElement(); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  // Venter op til `ms` på bekræftelse: leverandørens egen bekræftelse af netop denne vare,
  // ellers at kurven i toppen har ændret sig fra `foer`.
  async function ventPaaBekraeftelse(v, foer, ms) {
    for (let t = 0; t < ms; t += 300) {
      await new Promise(r => setTimeout(r, 300));
      if (lev.bekraeftet ? lev.bekraeftet(v) : kurvSignatur() !== foer) return true;
    }
    return false;
  }

  /* ---------- Sikkerhed ----------
   * Scriptet læser kun varenumre og knapper på favoritlisten, og det eneste,
   * det henter udefra, er optællingen (varenavne og antal). Det sender aldrig
   * noget fra webshoppen videre, rører aldrig kassen og bestiller aldrig.
   * Data fra kælderlisten stoles ikke blindt på: varenumre/navne valideres,
   * antal skal være 1-99, og store antal skal bekræftes.
   */
  const MAKS_ANTAL = 99;
  const STORT_ANTAL = 30;

  /* ---------- Hjælpere ---------- */
  const vent = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const saetVaerdi = (input, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    input.focus();
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
  };

  function hentOptaelling(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url + (url.includes('?') ? '&' : '?') + 'format=json',
        timeout: 20000,
        onload: r => {
          try { resolve(JSON.parse(r.responseText)); }
          catch (e) { reject(new Error('Svaret fra kælderlisten kunne ikke læses. Er adressen rigtig?')); }
        },
        onerror: () => reject(new Error('Kunne ikke kontakte kælderlisten. Tjek internetforbindelsen.')),
        ontimeout: () => reject(new Error('Kælderlisten svarede ikke i tide. Prøv igen.')),
      });
    });
  }

  /* ---------- Brugerflade (i shadow DOM, så webshoppens CSS ikke blander sig) ---------- */
  const vaert = document.createElement('div');
  vaert.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;';
  document.body.appendChild(vaert);
  const rod = vaert.attachShadow({ mode: 'open' });
  rod.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      .fab { background: #8b2f1e; color: #fff; border: 0; border-radius: 999px; padding: 14px 22px; font-size: 16px; font-weight: 700;
             letter-spacing: .02em; box-shadow: 0 6px 20px rgba(0,0,0,.25); cursor: pointer; }
      .fab:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid #d86b52; outline-offset: 2px; }
      .panel { width: 360px; max-width: calc(100vw - 40px); max-height: 70vh; overflow: auto; background: #fff; color: #1a1d1c;
               border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.3); padding: 18px; }
      h2 { margin: 0 0 4px; font-size: 18px; }
      p { margin: 6px 0; font-size: 14px; line-height: 1.4; color: #3b423f; }
      .warn { background: #f7ecd3; color: #6b4600; padding: 8px 10px; border-radius: 8px; }
      .err { background: #f3e3df; color: #8b2f1e; padding: 8px 10px; border-radius: 8px; }
      ul { list-style: none; margin: 10px 0; padding: 0; border: 1px solid #e2e5e3; border-radius: 10px; }
      li { display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px; border-top: 1px solid #e2e5e3; font-size: 14px; }
      li:first-child { border-top: 0; }
      li .s { flex: 0 0 auto; font-variant-numeric: tabular-nums; color: #5d6663; }
      li[data-s="ok"] .s { color: #2c6e45; font-weight: 700; }
      li[data-s="fejl"] .s { color: #8b2f1e; font-weight: 700; }
      .row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
      button.p { flex: 1; background: #8b2f1e; color: #fff; border: 0; border-radius: 10px; padding: 12px; font-size: 15px; font-weight: 700; cursor: pointer; }
      button.g { background: none; border: 1px solid #d5d9d7; color: #3b423f; border-radius: 10px; padding: 12px 14px; font-size: 15px; cursor: pointer; }
      button:disabled { opacity: .5; cursor: default; }
      a.p { flex: 1; display: block; text-align: center; background: #2c6e45; color: #fff; text-decoration: none; border-radius: 10px; padding: 12px; font-weight: 700; font-size: 15px; }
      input { width: 100%; padding: 10px; border: 1px solid #d5d9d7; border-radius: 8px; font-size: 14px; margin-top: 6px; }
      .small { font-size: 12px; color: #5d6663; }
      .link { background: none; border: 0; color: #5d6663; text-decoration: underline; padding: 0; font-size: 12px; cursor: pointer; }
    </style>
    <button class="fab" id="fab" type="button">Fyld kurv</button>
    <div class="panel" id="panel" hidden></div>`;
  const fab = rod.getElementById('fab');
  const panel = rod.getElementById('panel');
  const vis = html => { panel.innerHTML = html; panel.hidden = false; fab.hidden = true; };
  const luk = () => { panel.hidden = true; fab.hidden = false; };

  fab.addEventListener('click', start);

  /* ---------- Trin 1: kend kælderlisten ---------- */
  function start() {
    const url = GM_getValue('kaelderlisteUrl', '');
    if (!url) return visOpsaetning();
    hent(url);
  }

  function visOpsaetning(fejl) {
    vis(`
      <h2>Forbind til kælderlisten</h2>
      <p>Indsæt adressen på jeres kælderliste (den der slutter på <b>/exec</b>). Det skal kun gøres én gang.</p>
      ${fejl ? `<p class="err">${esc(fejl)}</p>` : ''}
      <input id="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(GM_getValue('kaelderlisteUrl', ''))}">
      <div class="row"><button class="p" id="gem" type="button">Gem og fortsæt</button><button class="g" id="luk" type="button">Luk</button></div>`);
    rod.getElementById('luk').onclick = luk;
    rod.getElementById('gem').onclick = () => {
      const v = rod.getElementById('url').value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(v)) return visOpsaetning('Adressen skal starte med https://script.google.com/macros/s/ og slutte på /exec.');
      GM_setValue('kaelderlisteUrl', v);
      hent(v);
    };
  }

  /* ---------- Trin 2: hent optælling og vis hvad der sker ---------- */
  async function hent(url) {
    vis(`<h2>Henter optællingen …</h2>`);
    let data;
    try { data = await hentOptaelling(url); }
    catch (e) { return vis(`<h2>Noget gik galt</h2><p class="err">${esc(e.message)}</p><div class="row"><button class="p" id="igen" type="button">Prøv igen</button><button class="g" id="luk" type="button">Luk</button></div><p><button class="link" id="skift" type="button">Skift kælderliste-adresse</button></p>`), bind({ igen: () => hent(url), luk, skift: () => visOpsaetning() }); }

    const alle = (data.varer || []).filter(v => v && v.leverandor === lev.navn && Number(v.antal) > 0);
    const ugyldige = alle.filter(v => !lev.gyldig(v) || !Number.isInteger(Number(v.antal)) || Number(v.antal) > MAKS_ANTAL);
    const varer = alle.filter(v => !ugyldige.includes(v)).map(v => Object.assign({}, v, { antal: Number(v.antal) }));
    const store = varer.filter(v => v.antal > STORT_ANTAL);
    const opd = data.opdateret ? new Date(data.opdateret).toLocaleString('da-DK', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : 'ukendt';
    if (!varer.length) {
      return vis(`<h2>Intet at bestille hos ${esc(lev.navn)}</h2><p>Der er ikke talt nogen ${esc(lev.navn)}-varer på kælderlisten.</p><p class="small">Sidst ændret: ${esc(opd)}</p><div class="row"><button class="g" id="luk" type="button">Luk</button></div>`), bind({ luk });
    }

    const raekker = lev.findRaekker();
    if (!Object.keys(raekker).length) {
      return vis(`<h2>Favoritlisten er ikke klar</h2><p>Åbn jeres favoritliste hos ${esc(lev.navn)}, og vent til den er færdig med at indlæse. Tryk så igen.</p><div class="row"><button class="p" id="igen" type="button">Prøv igen</button><button class="g" id="luk" type="button">Luk</button></div>`), bind({ igen: () => hent(url), luk });
    }

    const iKurven = lev.kurvStatus();
    vis(`
      <h2>${varer.length} ${varer.length === 1 ? 'vare' : 'varer'} til ${esc(lev.navn)}</h2>
      <p class="small">${esc(data.restaurant || '')} · optælling sidst ændret ${esc(opd)}</p>
      ${iKurven ? `<p class="warn">Der ligger allerede ${esc(iKurven)} i kurven. De bliver liggende – de nye lægges oveni.</p>` : ''}
      ${store.length ? `<p class="warn">Usædvanligt stort antal: ${store.map(v => `${esc(v.antal)} × ${esc(v.navn)}`).join(', ')}. Tjek at det er rigtigt, før du fortsætter.</p>` : ''}
      ${ugyldige.length ? `<p class="err">${ugyldige.length} ${ugyldige.length === 1 ? 'vare' : 'varer'} på kælderlisten har ugyldige data og springes over: ${ugyldige.map(v => esc(v.navn)).join(', ')}.</p>` : ''}
      <ul>${varer.map(v => `<li data-id="${esc(v.id)}"><span>${esc(v.antal)} × ${esc(v.navn)} <span class="small">(${esc(v.enhed)})</span></span><span class="s">klar</span></li>`).join('')}</ul>
      <div class="row"><button class="p" id="go" type="button">Læg i kurven</button><button class="g" id="luk" type="button">Annuller</button></div>`);
    bind({ go: () => fyld(varer), luk });
  }

  function bind(handlers) {
    Object.entries(handlers).forEach(([id, fn]) => { const el = rod.getElementById(id); if (el) el.onclick = fn; });
  }

  /* ---------- Trin 3: læg i kurven ---------- */
  async function fyld(varer) {
    rod.getElementById('go').disabled = true;
    rod.getElementById('luk').disabled = true;
    const raekker = lev.findRaekker();
    const status = (v, s, t) => {
      const li = panel.querySelector(`li[data-id="${CSS.escape(v.id)}"]`);
      li.dataset.s = s; li.querySelector('.s').textContent = t;
    };
    const fejl = varer.filter(v => !raekker[lev.noegle(v)]);
    fejl.forEach(v => status(v, 'fejl', 'ikke på listen'));
    const fundne = varer.filter(v => raekker[lev.noegle(v)]);

    const ubekraeftet = [];
    if (lev.samlet) {
      // Udfyld alle felter (0 på resten), og tryk én gang på den fælles knap.
      const knap = lev.samletKnap();
      if (!knap) {
        fundne.forEach(v => status(v, 'fejl', 'ingen knap'));
        fejl.push(...fundne); fundne.length = 0;
      } else {
        const oensket = new Map(fundne.map(v => [raekker[lev.noegle(v)].input, v.antal]));
        Object.values(raekker).forEach(r => saetVaerdi(r.input, oensket.get(r.input) || 0));
        fundne.forEach(v => status(v, '', 'lægger i …'));
        await vent(400);
        const foer = kurvSignatur();
        knap.click();
        const ok = await ventPaaBekraeftelse(null, foer, 10000);
        fundne.forEach(v => ok ? status(v, 'ok', '✓') : (status(v, 'fejl', 'ikke bekræftet'), ubekraeftet.push(v)));
      }
    } else {
      // Én vare ad gangen – og kun ✓, når kurven i toppen faktisk har ændret sig.
      for (const v of fundne) {
        const r = raekker[lev.noegle(v)];
        status(v, '', 'lægger i …');
        r.input.scrollIntoView({ block: 'center' });
        let ok = false;
        for (let forsoeg = 1; forsoeg <= 2 && !ok; forsoeg++) {
          if (forsoeg === 2) status(v, '', 'prøver igen …');
          saetVaerdi(r.input, v.antal);
          await vent(400);
          const foer = kurvSignatur();
          r.knap.click();
          ok = await ventPaaBekraeftelse(v, foer, 8000);
        }
        if (lev.lukPopup) { lev.lukPopup(); await vent(500); }
        if (ok) status(v, 'ok', '✓');
        else { status(v, 'fejl', 'ikke bekræftet'); ubekraeftet.push(v); }
        await vent(800);
      }
    }

    const ok = fundne.length - ubekraeftet.length;
    const slut = panel.querySelector('.row');
    slut.outerHTML = `
      ${ubekraeftet.length ? `<p class="err">${ubekraeftet.length} ${ubekraeftet.length === 1 ? 'vare' : 'varer'} kunne ikke bekræftes i kurven: ${ubekraeftet.map(v => `${esc(v.antal)} × ${esc(v.navn)}`).join(', ')}. Tjek kurven, og læg dem i selv, hvis de mangler.</p>` : ''}
      ${fejl.length ? `<p class="err">${fejl.length} ${fejl.length === 1 ? 'vare' : 'varer'} kunne ikke findes på favoritlisten: ${fejl.map(v => esc(v.navn)).join(', ')}. Læg dem i kurven selv – eller føj dem til favoritlisten, så klarer knappen dem næste gang.</p>` : ''}
      <p>${ok} ${ok === 1 ? 'vare er' : 'varer er'} bekræftet i kurven. Tjek kurven, og bestil som du plejer.</p>
      <div class="row"><a class="p" href="${esc(lev.kurvUrl)}">Gå til kurven</a><button class="g" id="luk" type="button">Luk</button></div>`;
    bind({ luk });
  }
})();
