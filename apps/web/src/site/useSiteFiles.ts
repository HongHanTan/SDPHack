import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImportFiles } from '@floodops/engine/import/buildSite';
import { changedFiles, classifySiteFiles, WATCH_INTERVAL_MS } from './siteFiles';

// Minimal local typing for the File System Access API (not in every DOM lib).
interface FileHandleLike {
  name: string;
  getFile(): Promise<File>;
}
type OpenPicker = (opts: {
  multiple: boolean;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<FileHandleLike[]>;

export interface SiteFileEntry {
  name: string;
  handle?: FileHandleLike;
  file?: File;
}

function pickWithInput(): Promise<SiteFileEntry[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.inp,.geojson,.json,.asc';
    input.onchange = () => resolve(Array.from(input.files ?? []).map((file) => ({ name: file.name, file })));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

async function entryFile(e: SiteFileEntry): Promise<File> {
  if (e.handle) return e.handle.getFile();
  if (e.file) return e.file;
  throw new Error(`No data for ${e.name}`);
}

export function useSiteFiles({ onChange, onWatchError }: { onChange?: (names: string[]) => void; onWatchError?: (message: string) => void } = {}) {
  const [entries, setEntries] = useState<SiteFileEntry[]>([]);
  const [watching, setWatching] = useState(false);
  const [lastChange, setLastChange] = useState<{ names: string[]; at: Date } | null>(null);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onWatchError);
  onChangeRef.current = onChange;
  onErrorRef.current = onWatchError;
  // lastModified of each file as last read (Check files / apply); the watch compares against this.
  const baselineRef = useRef<Record<string, number> | null>(null);

  const canWatch = entries.length > 0 && entries.every((e) => !!e.handle);

  const pick = useCallback(async (): Promise<boolean> => {
    let picked: SiteFileEntry[];
    try {
      const picker = (window as unknown as { showOpenFilePicker?: OpenPicker }).showOpenFilePicker;
      if (picker) {
        const handles = await picker.call(window, {
          multiple: true,
          types: [{ description: 'Site files', accept: { 'text/plain': ['.inp', '.asc'], 'application/geo+json': ['.geojson', '.json'] } }],
        });
        picked = handles.map((handle) => ({ name: handle.name, handle }));
      } else {
        picked = await pickWithInput();
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false; // cancelled
      onErrorRef.current?.(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      return false;
    }
    if (picked.length === 0) return false;
    setWatching(false);
    baselineRef.current = null;
    setEntries(picked);
    return true;
  }, []);

  /** Reads the picked files; null when no .inp is present. Throws on read errors. */
  const read = useCallback(async (): Promise<ImportFiles | null> => {
    const cls = classifySiteFiles(entries.map((e) => e.name));
    if (!cls.inp) return null;
    const snap: Record<string, number> = {};
    const text = async (name: string) => {
      const e = entries.find((x) => x.name === name)!;
      const f = await entryFile(e);
      snap[name] = f.lastModified;
      return { name, text: await f.text() };
    };
    const files: ImportFiles = { inp: await text(cls.inp) };
    if (cls.geojson) files.geojson = await text(cls.geojson);
    if (cls.asc) files.asc = await text(cls.asc);
    baselineRef.current = snap;
    return files;
  }, [entries]);

  useEffect(() => {
    if (!watching || !canWatch) return;
    let cancelled = false;
    let prev: Record<string, number> | null = baselineRef.current;
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const next: Record<string, number> = {};
        for (const e of entries) next[e.name] = (await entryFile(e)).lastModified;
        if (cancelled) return;
        if (prev) {
          const names = changedFiles(prev, next);
          if (names.length > 0) {
            setLastChange({ names, at: new Date() });
            onChangeRef.current?.(names);
          }
        }
        prev = next;
        baselineRef.current = next;
      } catch (err) {
        if (cancelled) return;
        setWatching(false);
        onErrorRef.current?.(`Watching stopped: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        busy = false;
      }
    };
    void tick();
    const id = window.setInterval(tick, WATCH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [watching, canWatch, entries]);

  return { pick, files: entries, read, canWatch, watching, setWatching, lastChange };
}
