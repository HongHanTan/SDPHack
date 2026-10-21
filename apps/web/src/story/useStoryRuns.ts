import { useCallback, useEffect, useRef, useState } from 'react';
import { scenarioKey, type ScenarioSelection } from '../maintenance/model';
import { runStoryCase } from './run';
import type { StoryCase, StoryRun } from './model';

export function useStoryRuns(scenario: ScenarioSelection, visible: boolean) {
  const key = scenarioKey(scenario);
  const [cache, setCache] = useState<{ key: string; runs: Partial<Record<StoryCase, StoryRun>> }>({ key, runs: {} });
  const [busy, setBusy] = useState<StoryCase | null>(null);
  const [progress, setProgress] = useState({ timeS: 0, totalS: 1 });
  const [error, setError] = useState('');
  const token = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const cancel = useCallback(() => { token.current++; controller.current?.abort(); setBusy(null); }, []);
  useEffect(() => { cancel(); setError(''); setCache({ key, runs: {} }); }, [key, cancel]);
  useEffect(() => { if (!visible) cancel(); }, [visible, cancel]);
  useEffect(() => () => { token.current++; controller.current?.abort(); }, []);
  const runs = cache.key === key ? cache.runs : {};

  const calculate = async (id: StoryCase): Promise<StoryRun | null> => {
    if (runs[id]) return runs[id]!;
    cancel(); const mine = ++token.current;
    const abort = new AbortController(); controller.current = abort;
    setBusy(id); setProgress({ timeS: 0, totalS: 1 }); setError('');
    try {
      const result = await runStoryCase(id, scenario, abort.signal, (timeS, totalS) => {
        if (mine === token.current) setProgress({ timeS, totalS });
      });
      if (mine !== token.current) return null;
      setCache(previous => ({ key, runs: { ...(previous.key === key ? previous.runs : {}), [id]: result } }));
      return result;
    } catch (e) { if (mine === token.current) setError(e instanceof Error ? e.message : String(e)); return null; }
    finally { if (mine === token.current) setBusy(null); }
  };
  return { runs, calculate, busy, progress, error, cancel };
}
