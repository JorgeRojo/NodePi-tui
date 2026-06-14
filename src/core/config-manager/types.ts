export interface NodePiConfig {
  containers: string[];
}

export interface PackageMetadata {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface AgyInferenceResult {
  dev: string | null;
  build: string | null;
  watch: string | null;
}
