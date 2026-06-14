import { validateConfig } from './configValidator.js';
import { validateSystem } from './systemValidator.js';
import { validateTarget } from './targetValidator.js';

export const runPreflightValidations = async (): Promise<void> => {
  await validateSystem();
  await validateConfig();
  await validateTarget();
};
