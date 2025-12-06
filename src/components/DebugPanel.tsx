import { useState, useMemo } from 'react';
import type { DebugLogEntry, DebugCategory } from '../types';

interface DebugPanelProps {
  debugLog: DebugLogEntry[];
  onClearLog: () => void;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<DebugCategory, string> = {
  api: 'bg-blue-100 text-blue-700',
  algorithm: 'bg-purple-100 text-purple-700',
  booking: 'bg-green-100 text-green-700',
  trip: 'bg-orange-100 text-orange-700',
};

const CATEGORY_LABELS: Record<DebugCategory, string> = {
  api: 'API',
  algorithm: 'Algorithm',
  booking: 'Booking',
  trip: 'Trip',
};

export function DebugPanel({
  debugLog,
  onClearLog,
  onClose,
}: DebugPanelProps) {
  const [selectedCategories, setSelectedCategories] = useState<DebugCategory[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const filteredLog = useMemo(() => {
    if (selectedCategories.length === 0) return debugLog;
    return debugLog.filter(entry => selectedCategories.includes(entry.category));
  }, [debugLog, selectedCategories]);

  const toggleCategory = (category: DebugCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleExpanded = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExport = () => {
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
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Debug Log</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2">
          <span className="text-sm text-gray-600">Filter:</span>
          {(Object.keys(CATEGORY_COLORS) as DebugCategory[]).map(category => (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedCategories.length === 0 || selectedCategories.includes(category)
                  ? CATEGORY_COLORS[category]
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs text-gray-500">{filteredLog.length} entries</span>
        </div>

        {/* Log Entries */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {filteredLog.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No log entries yet</p>
              <p className="text-sm mt-1">Actions will be logged here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {[...filteredLog].reverse().map(entry => (
                <div
                  key={entry.id}
                  className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleExpanded(entry.id)}
                >
                  <div className="flex items-start gap-2">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${CATEGORY_COLORS[entry.category]}`}>
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{entry.action}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedEntries.has(entry.id) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {expandedEntries.has(entry.id) && (
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-between">
          <button
            onClick={onClearLog}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
          >
            Clear Log
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Export Log
          </button>
        </div>
      </div>
    </div>
  );
}
