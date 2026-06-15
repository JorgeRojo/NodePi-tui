export interface CustomScript {
  type: string;
  name: string;
  command: string;
}

export interface NodePiConfig {
  containers: string[];
  dependencies?: Record<
    string,
    { type: string; enabled: boolean; version?: string; path?: string }
  >;
  customScripts?: CustomScript[];
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
