import { execa } from 'execa';

import type { AgyInferenceResult } from './types.js';

export async function inferScripts(
  packageJsonContent: string
): Promise<AgyInferenceResult> {
  const prompt = `Given the following package.json content, infer the most likely commands to use for "dev", "build", and "watch" tasks.
Return ONLY a strictly valid JSON object with the exact keys: "dev", "build", and "watch".
If a command cannot be inferred, its value MUST be null.
Do not include any markdown formatting, code blocks (like \`\`\`json), or explanations. Return pure JSON.

package.json:
${packageJsonContent}`;

  const { stdout } = await execa('agy', [
    '--model',
    'gemini-1.5-flash',
    '--print',
    prompt,
  ]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error('Failed to parse Agy output as JSON', { cause: error });
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'dev' in parsed &&
    'build' in parsed &&
    'watch' in parsed
  ) {
    const record = parsed as Record<string, unknown>;
    const isValidValue = (val: unknown): val is string | null =>
      typeof val === 'string' || val === null;

    if (
      isValidValue(record.dev) &&
      isValidValue(record.build) &&
      isValidValue(record.watch)
    ) {
      return {
        dev: record.dev,
        build: record.build,
        watch: record.watch,
      };
    }
  }

  throw new Error('Invalid JSON shape returned by Agy');
}
