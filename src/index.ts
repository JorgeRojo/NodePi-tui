#!/usr/bin/env node
import { intro, outro } from '@clack/prompts';
import pc from 'picocolors';

const banner = `
  _   _           _      ____  _ 
 | \\ | | ___   __| | ___|  _ \\(_)
 |  \\| |/ _ \\ / _\` |/ _ \\ |_) | |
 | |\\  | (_) | (_| |  __/  __/| |
 |_| \\_|\\___/ \\__,_|\\___|_|   |_|
`;

async function main(): Promise<void> {
  console.clear();
  console.log(pc.cyan(banner));
  intro(pc.inverse(' Bienvenido a NodePi '));

  // Aquí irá el Preflight y el resto del Wizard

  outro(pc.green('¡Entorno inicializado correctamente!'));
}

main().catch(console.error);
