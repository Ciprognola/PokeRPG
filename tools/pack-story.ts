// Packs a story folder into story_<id>.zip next to it, then checks the zip. See USAGE below.
// Exit code 0 = packed and no errors, 1 = packed but the check found errors, 2 = could not pack.
import { relative } from 'node:path';
import { checkStory, packStoryFolder } from './story-node.js';

const USAGE = `Impacchetta una cartella storia in story_<id>.zip e la controlla (Story Schema §1).

Uso:
  npm run story:pack -- <cartella storia>

  <cartella storia>  la cartella story_<id>/ (contiene story.json), es. stories/story_my-tale

Scrive story_<id>.zip accanto alla cartella (stesso nome, percorsi con "/", stessi byte a ogni
esecuzione), poi esegue lo stesso controllo di "npm run story:check" sullo zip.

Esempio:
  npm run story:pack -- stories/story_my-tale

Il "--" dopo "story:pack" è necessario: passa il resto a questo strumento.

Codice di uscita: 0 = impacchettata, nessun errore; 1 = impacchettata, ma il controllo ha trovato
errori (correggili e impacchetta di nuovo, non condividere quello zip); 2 = la cartella non è
stata impacchettata.`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const usageError = (message: string): never => {
  console.error(`${message}\n\n${USAGE}`);
  return process.exit(2);
};

const unknown = args.find((a) => a.startsWith('-'));
if (unknown) usageError(`Opzione sconosciuta "${unknown}".`);
if (args.length === 0)
  usageError('Nessuna storia indicata: dimmi quale cartella story_<id>/ impacchettare.');
if (args.length > 1) usageError('Indica una cartella storia alla volta.');

try {
  const { zipPath, files } = packStoryFolder(args[0]!);
  console.log(`Scritto ${relative(process.cwd(), zipPath) || zipPath} (${files} file)`);
  process.exit(checkStory(zipPath));
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
