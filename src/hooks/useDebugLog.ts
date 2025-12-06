import { useCallback } from 'react';
import type { DebugLogEntry, DebugCategory } from '../types';
import { generateLogId } from '../utils/idGenerator';

export function useDebugLog(
  debugLog: DebugLogEntry[],
  setDebugLog: (log: DebugLogEntry[]) => void
) {
  const addLogEntry = useCallback(
    (category: DebugCategory, action: string, details: Record<string, unknown>) => {
      const entry: DebugLogEntry = {
        id: generateLogId(),
        timestamp: new Date().toISOString(),
        category,
        action,
        details,
      };

      setDebugLog([...debugLog, entry]);
    },
    [debugLog, setDebugLog]
  );

  const clearLog = useCallback(() => {
    setDebugLog([]);
  }, [setDebugLog]);

  const exportLog = useCallback(() => {
    const json = JSON.stringify(debugLog, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transport-poc-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [debugLog]);

  const filterLog = useCallback(
    (categories: DebugCategory[]) => {
      if (categories.length === 0) return debugLog;
      return debugLog.filter(entry => categories.includes(entry.category));
    },
    [debugLog]
  );

  return {
    addLogEntry,
    clearLog,
    exportLog,
    filterLog,
  };
}
