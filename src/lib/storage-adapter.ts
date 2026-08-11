import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlayableVersion } from "@/types/domain";

export interface StorageAdapter {
  ensure(): Promise<void>;
  putArtifact(versionId: string, html: string): Promise<string>;
  putThumbnail(versionId: string, content: Buffer | string, extension: "png" | "svg"): Promise<string>;
  readArtifact(version: Pick<PlayableVersion, "artifactPath">): Promise<string>;
  readThumbnail(thumbnailKey: string): Promise<{ content: Buffer; contentType: string }>;
}

class FilesystemStorageAdapter implements StorageAdapter {
  async ensure(): Promise<void> {
    await mkdir(getArtifactDir(), { recursive: true });
    await mkdir(getThumbnailDir(), { recursive: true });
  }

  async putArtifact(versionId: string, html: string): Promise<string> {
    await this.ensure();
    const artifactPath = path.join(getArtifactDir(), `${versionId}.html`);
    await writeFile(artifactPath, html, "utf8");
    return artifactPath;
  }

  async putThumbnail(versionId: string, content: Buffer | string, extension: "png" | "svg"): Promise<string> {
    await this.ensure();
    const thumbnailPath = path.join(getThumbnailDir(), `${versionId}.${extension}`);
    await writeFile(thumbnailPath, content, typeof content === "string" ? "utf8" : undefined);
    return thumbnailPath;
  }

  async readArtifact(version: Pick<PlayableVersion, "artifactPath">): Promise<string> {
    return readFileWithRelocatedFallback(version.artifactPath, getArtifactDir(), "utf8");
  }

  async readThumbnail(thumbnailKey: string): Promise<{ content: Buffer; contentType: string }> {
    const content = await readFileWithRelocatedFallback(thumbnailKey, getThumbnailDir());
    const contentType = thumbnailKey.endsWith(".svg") ? "image/svg+xml" : "image/png";
    return { content, contentType };
  }
}

const filesystemStorageAdapter = new FilesystemStorageAdapter();

export function getStorageAdapter(): StorageAdapter {
  return filesystemStorageAdapter;
}

function getDataDir(): string {
  return path.join(process.cwd(), "data");
}

function getArtifactDir(): string {
  return path.join(getDataDir(), "artifacts");
}

function getThumbnailDir(): string {
  return path.join(getDataDir(), "thumbnails");
}

async function readFileWithRelocatedFallback(pathOrKey: string, currentDir: string, encoding: BufferEncoding): Promise<string>;
async function readFileWithRelocatedFallback(pathOrKey: string, currentDir: string): Promise<Buffer>;
async function readFileWithRelocatedFallback(
  pathOrKey: string,
  currentDir: string,
  encoding?: BufferEncoding
): Promise<string | Buffer> {
  try {
    return encoding ? await readFile(pathOrKey, encoding) : await readFile(pathOrKey);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    const relocatedPath = path.join(currentDir, path.basename(pathOrKey));
    if (relocatedPath === pathOrKey) throw error;
    return encoding ? readFile(relocatedPath, encoding) : readFile(relocatedPath);
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
