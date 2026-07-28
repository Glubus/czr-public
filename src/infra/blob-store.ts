export interface BlobStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export function createFileBlobStore(root: string): BlobStore {
  const normalizedRoot = root.replace(/\/+$/, "");
  if (!normalizedRoot) throw new Error("CLIENT_BLOB_ROOT must not be empty");

  return {
    async put(key, bytes) {
      const path = blobPath(normalizedRoot, key);
      await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
      const temporary = `${path}.${crypto.randomUUID()}.tmp`;
      try {
        await Deno.writeFile(temporary, bytes, { createNew: true });
        await Deno.rename(temporary, path);
      } finally {
        await Deno.remove(temporary).catch((error) => {
          if (!(error instanceof Deno.errors.NotFound)) throw error;
        });
      }
    },
    async get(key) {
      try {
        return await Deno.readFile(blobPath(normalizedRoot, key));
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) return null;
        throw error;
      }
    },
    async delete(key) {
      await Deno.remove(blobPath(normalizedRoot, key)).catch((error) => {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      });
    },
    async deletePrefix(prefix) {
      const path = blobPath(normalizedRoot, prefix);
      await Deno.remove(path, { recursive: true }).catch((error) => {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      });
    },
    async exists(key) {
      try {
        return (await Deno.stat(blobPath(normalizedRoot, key))).isFile;
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) return false;
        throw error;
      }
    },
  };
}

export function clientRunPrefix(runId: string) {
  assertSafeSegment(runId);
  return `client-runs/${runId}`;
}

export function clientChunkStorageKey(runId: string, sequence: number, sha256: string) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("invalid chunk sequence");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("invalid chunk SHA-256");
  return `${clientRunPrefix(runId)}/chunks/${String(sequence).padStart(8, "0")}-${sha256}.gz`;
}

export function clientManifestStorageKey(runId: string) {
  return `${clientRunPrefix(runId)}/manifest.json`;
}

function blobPath(root: string, key: string) {
  if (!key || key.startsWith("/") || key.includes("\\")) throw new Error("invalid blob key");
  for (const segment of key.split("/")) assertSafeSegment(segment);
  return `${root}/${key}`;
}

function assertSafeSegment(segment: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(segment) || segment === "." || segment === "..") {
    throw new Error("invalid blob key segment");
  }
}
