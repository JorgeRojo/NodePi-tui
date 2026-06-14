import { describe, expect, it } from 'vitest';

import { sortTopologically } from '../sorter.js';
import type { PackageMetadata } from '../types.js';

describe('sortTopologically', () => {
  it('should return packages in the same order if no dependencies', () => {
    const pkgs: PackageMetadata[] = [
      { name: 'A', version: '1.0.0' },
      { name: 'B', version: '1.0.0' },
    ];
    const result = sortTopologically(pkgs);
    expect(result.map(p => p.name)).toEqual(['A', 'B']);
  });

  it('should sort packages based on dependencies (B before A)', () => {
    const pkgs: PackageMetadata[] = [
      { name: 'A', version: '1.0.0', dependencies: { B: '1.0.0' } },
      { name: 'B', version: '1.0.0' },
    ];
    const result = sortTopologically(pkgs);
    expect(result.map(p => p.name)).toEqual(['B', 'A']);
  });

  it('should handle complex dependency chains', () => {
    const pkgs: PackageMetadata[] = [
      { name: 'A', version: '1.0.0', dependencies: { B: '1.0.0' } },
      { name: 'C', version: '1.0.0', devDependencies: { A: '1.0.0' } },
      { name: 'B', version: '1.0.0' },
    ];
    const result = sortTopologically(pkgs);
    expect(result.map(p => p.name)).toEqual(['B', 'A', 'C']);
  });

  it('should ignore external dependencies not in the list', () => {
    const pkgs: PackageMetadata[] = [
      {
        name: 'A',
        version: '1.0.0',
        dependencies: { external: '1.0.0', B: '1.0.0' },
      },
      { name: 'B', version: '1.0.0' },
    ];
    const result = sortTopologically(pkgs);
    expect(result.map(p => p.name)).toEqual(['B', 'A']);
  });

  it('should throw an error on circular dependencies', () => {
    const pkgs: PackageMetadata[] = [
      { name: 'A', version: '1.0.0', dependencies: { B: '1.0.0' } },
      { name: 'B', version: '1.0.0', dependencies: { A: '1.0.0' } },
    ];
    expect(() => sortTopologically(pkgs)).toThrowError(
      'Circular dependency detected'
    );
  });

  it('should throw an error on larger circular dependencies', () => {
    const pkgs: PackageMetadata[] = [
      { name: 'A', version: '1.0.0', dependencies: { B: '1.0.0' } },
      { name: 'B', version: '1.0.0', dependencies: { C: '1.0.0' } },
      { name: 'C', version: '1.0.0', dependencies: { A: '1.0.0' } },
      { name: 'D', version: '1.0.0' },
    ];
    expect(() => sortTopologically(pkgs)).toThrowError(
      'Circular dependency detected'
    );
  });
});
