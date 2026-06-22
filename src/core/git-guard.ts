import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface VersionMismatchResult {
  localVersion: string;
  targetVersion: string;
  hasMismatch: boolean;
  type: 'major' | 'minor' | 'patch' | null;
}

export interface GitStatus {
  isGit: boolean;
  branch?: string;
  hasUpstream?: boolean;
  isBehind?: boolean;
  behindCount?: number;
}

/**
 * Compares semantic version fields between local source package and target installed dependency.
 */
export async function getVersionMismatch(
  localPath: string,
  targetDepPath: string
): Promise<VersionMismatchResult> {
  const localPkg = JSON.parse(
    await fs.readFile(path.join(localPath, 'package.json'), 'utf-8')
  );
  const targetPkg = JSON.parse(
    await fs.readFile(path.join(targetDepPath, 'package.json'), 'utf-8')
  );

  const localVersion = localPkg.version || '0.0.0';
  const targetVersion = targetPkg.version || '0.0.0';

  if (localVersion === targetVersion) {
    return { localVersion, targetVersion, hasMismatch: false, type: null };
  }

  const [localMajor, localMinor, localPatch] = localVersion
    .split('.')
    .map(Number);
  const [targetMajor, targetMinor, targetPatch] = targetVersion
    .split('.')
    .map(Number);

  let type: 'major' | 'minor' | 'patch' | null = null;
  if (localMajor !== targetMajor) {
    type = 'major';
  } else if (localMinor !== targetMinor) {
    type = 'minor';
  } else if (localPatch !== targetPatch) {
    type = 'patch';
  }

  return {
    localVersion,
    targetVersion,
    hasMismatch: true,
    type,
  };
}

/**
 * Queries Git inside the given repository path to check branch, upstream connection, and behind-upstream counts.
 */
export async function getGitStatus(repoPath: string): Promise<GitStatus> {
  try {
    // 1. Verify inside git work tree
    const isGitCheck = await execa(
      'git',
      ['rev-parse', '--is-inside-work-tree'],
      { cwd: repoPath }
    );
    if (isGitCheck.stdout.trim() !== 'true') {
      return { isGit: false };
    }

    // 2. Get current branch name
    let branch = 'unknown';
    try {
      const branchCheck = await execa('git', ['branch', '--show-current'], {
        cwd: repoPath,
      });
      branch = branchCheck.stdout.trim();
      if (!branch) {
        // Fallback for older git versions or detached HEAD
        const refCheck = await execa(
          'git',
          ['rev-parse', '--abbrev-ref', 'HEAD'],
          { cwd: repoPath }
        );
        branch = refCheck.stdout.trim();
      }
    } catch {
      // Ignore branch check errors
    }

    // 3. Get upstream branch
    let hasUpstream = false;
    try {
      await execa('git', ['rev-parse', '--abbrev-ref', '@{u}'], {
        cwd: repoPath,
      });
      hasUpstream = true;
    } catch {
      // No upstream configured
    }

    if (!hasUpstream) {
      return { isGit: true, branch, hasUpstream: false };
    }

    // 4. Check if behind
    let isBehind = false;
    let behindCount = 0;
    try {
      const countCheck = await execa(
        'git',
        ['rev-list', '--count', 'HEAD..@{u}'],
        { cwd: repoPath }
      );
      behindCount = parseInt(countCheck.stdout.trim(), 10) || 0;
      isBehind = behindCount > 0;
    } catch {
      // Check behind failed, default to not behind
    }

    return {
      isGit: true,
      branch,
      hasUpstream: true,
      isBehind,
      behindCount,
    };
  } catch {
    return { isGit: false };
  }
}
