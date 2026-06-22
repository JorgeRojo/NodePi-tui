#!/usr/bin/env node
import { runWizard } from './wizard.js';

runWizard().catch((err) => {
  console.error('Error fatal no controlado:', err.message);
  process.exit(1);
});
