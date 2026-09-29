// Validates a story package: a story_<id>/ folder or a story_<id>.zip. See USAGE below.
// Exit code 0 = no errors (warnings are allowed), 1 = errors, 2 = could not read the package.
import { checkStory } from './story-node.js';

const USAGE = `Controlla un pacchetto storia rispetto allo Story Schema (docs/STORY_SCHEMA.md).

Uso:
  npm run story:check -- <cartella storia | zip storia> [--json] [--library <cartella assets>]

  <cartella storia>  una cartella story_<id>/ (contiene story.json), es. templates/story_template
  <zip storia>       la stessa cartella zippata
  --json             stampa il report completo come JSON invece che come testo
  --library <dir>    libreria di asset con cui controllare luoghi, musiche e suoni (default: assets/)
  --help, -h         mostra questo messaggio

Esempi:
  npm run story:check -- templates/story_template
  npm run story:check -- stories/story_my-tale

Il "--" dopo "story:check" è necessario: passa il resto a questo strumento.

Ogni riga è "livello · file:riga · percorso · messaggio". Gli errori vanno corretti; gli avvisi possono restare.
Esegui di nuovo il controllo dopo ogni correzione finché non stampa "0 errori".

Codice di uscita: 0 = nessun errore, 1 = errori trovati, 2 = il pacchetto non è leggibile.`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const KNOWN = new Set(['--json', '--library']);
const unknown = args.find((a) => a.startsWith('-') && !KNOWN.has(a));
const flag = (name: string): boolean => args.includes(name);
const libIndex = args.indexOf('--library');
const libValue = libIndex >= 0 ? args[libIndex + 1] : undefined;
const target = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '--library');

const usageError = (message: string): never => {
  console.error(`${message}\n\n${USAGE}`);
  return process.exit(2);
};

if (unknown) usageError(`Opzione sconosciuta "${unknown}".`);
if (libIndex >= 0 && (libValue === undefined || libValue.startsWith('-')))
  usageError('--library richiede una cartella, es. --library assets');
if (!target) usageError('Nessuna storia indicata: dimmi quale cartella o .zip controllare.');

process.exit(checkStory(target!, libValue, flag('--json')));
