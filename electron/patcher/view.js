'use strict';

const copy = {
  de: {
    eyebrow: 'TORWACHE VON VALHORIA', title: ['Das Tor', 'nach Valhoria'],
    intro: 'Der Launcher hält deinen MMO-Client für Valhoria bereit.',
    retry: 'Erneut prüfen', installed: 'Installiert',
    check: ['Suche nach Updates', 'Verbinde mit dem Update-Kanal …'],
    download: ['Update wird geladen', 'Spieldateien werden heruntergeladen.'],
    verify: ['Versiegelung wird geprüft', 'Prüfsumme und Windows-Signatur werden abgeglichen.'],
    install: ['Update wird installiert', 'Fantasy Arena startet danach automatisch neu.'],
    ready: ['Valhoria öffnet sich', 'Dein Client ist aktuell.'],
    error: ['Das Tor ist noch geschlossen', 'Updateprüfung fehlgeschlagen. Bitte versuche es erneut.'],
    errors: {
      config: 'Der Update-Kanal dieser Installation ist nicht eingerichtet.',
      verify: 'Die Datei konnte nicht verifiziert werden. Bitte erneut prüfen.',
      install: 'Windows konnte das Update nicht starten. Bitte erneut prüfen.',
    },
  },
  en: {
    eyebrow: 'GATEKEEPER OF VALHORIA', title: ['The gate', 'to Valhoria'],
    intro: 'The launcher keeps your MMO client ready for Valhoria.',
    retry: 'Check again', installed: 'Installed',
    check: ['Checking for updates', 'Connecting to the update channel …'],
    download: ['Downloading the update', 'Retrieving the game files.'],
    verify: ['Verifying the seal', 'Checking the digest and Windows signature.'],
    install: ['Installing the update', 'Fantasy Arena will restart automatically.'],
    ready: ['Valhoria awaits', 'Your client is up to date.'],
    error: ['The gate is still closed', 'The update check failed. Please try again.'],
    errors: {
      config: 'The update channel for this installation is not configured.',
      verify: 'The file could not be verified. Please check again.',
      install: 'Windows could not start the update. Please check again.',
    },
  },
};
const el = (id) => document.getElementById(id);
const progress = el('progress');
const retry = el('retry');
const headline = el('headline');
retry.addEventListener('click', () => window.fantasyPatcher.retry());
let renderedLocale;
window.fantasyPatcher.onState(({ phase, locale, installed, version, percent, transferred, total, detail }) => {
  const words = copy[locale] ?? copy.en;
  if (renderedLocale !== locale) {
    document.documentElement.lang = locale;
    el('eyebrow').textContent = words.eyebrow;
    headline.replaceChildren(words.title[0], document.createElement('br'), words.title[1]);
    el('intro').textContent = words.intro;
    retry.firstChild.textContent = words.retry + ' ';
    renderedLocale = locale;
  }
  document.body.dataset.phase = phase;
  const [label, description] = words[phase];
  const size = (n) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n / 1048576) + ' MiB';
  el('status').textContent = label;
  const downloading = phase === 'download' && Number.isFinite(percent);
  el('detail').textContent = phase === 'error' ? words.errors[detail] ?? description
    : downloading && total > 0 ? size(transferred) + ' / ' + size(total) : description;
  el('percent').textContent = downloading ? Math.floor(percent) + ' %' : '';
  el('version').textContent = version ? 'v' + version : words.installed + ' · v' + installed;
  retry.hidden = phase !== 'error';
  if (downloading) progress.value = percent;
  else if (phase === 'ready') progress.value = 100;
  else progress.removeAttribute('value');
});
