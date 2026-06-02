import { useEditorStore } from "@/state/editorStore";
import { useOverridesStore } from "@/state/overridesStore";

export function SymbolOverridePanel() {
  const selection = useEditorStore(s => s.selection);
  const patchLocal = useOverridesStore(s => s.patchLocal);
  const localMap = useOverridesStore(s => s.local);

  if (selection?.kind !== 'symbol') return null;

  const key = selection.key; // e.g. "symbol:1:2:5:1:3"
  const override = localMap[key] ?? {};

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <h3 className="text-sm font-bold mb-4">Tajweed Symbol Overrides</h3>
      
      <label className="block text-xs mb-2">Color</label>
      <input 
        type="color" 
        value={override.color ?? '#ff0000'}
        onChange={e => patchLocal(key, { color: e.target.value })}
        className="mb-4"
      />

      <label className="block text-xs mb-2">Scale ({override.scale ?? 1})</label>
      <input 
        type="range" min="0.5" max="2" step="0.1" 
        value={override.scale ?? 1}
        onChange={e => patchLocal(key, { scale: parseFloat(e.target.value) })}
        className="mb-4 w-full"
      />

      <div className="flex gap-4">
        <div>
          <label className="block text-xs mb-2">Move X (dx)</label>
          <input 
            type="number" 
            value={override.dx ?? 0}
            onChange={e => patchLocal(key, { dx: parseInt(e.target.value, 10) })}
            className="w-full border p-1"
          />
        </div>
        <div>
          <label className="block text-xs mb-2">Move Y (dy)</label>
          <input 
            type="number" 
            value={override.dy ?? 0}
            onChange={e => patchLocal(key, { dy: parseInt(e.target.value, 10) })}
            className="w-full border p-1"
          />
        </div>
      </div>
    </div>
  );
}
