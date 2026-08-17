import { useEffect, useRef, useState } from 'react';
import { Sparkles, SlidersHorizontal } from 'lucide-react';
import { fetchRegEmbeddings, type RegEmbedding } from '../../lib/api';
import { useStore } from '../../store';
import type { DiffusionConfig } from '../../types';

// DiffusionGemma REG settings: embedding picker + strength + mode, with a
// collapsible advanced area for sampling knobs. Reusable over a plain
// (value, onChange) contract so the same control works per-node (focus
// panel, writes via setNodeDiffusion) and as the landing composer's
// pre-selection (writes the store's defaultDiffusion for the next root node).

export default function DiffusionSettings({ nodeId }: { nodeId: string }) {
  const setNodeDiffusion = useStore((s) => s.setNodeDiffusion);
  const nodeDiffusion = useStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.diffusion);
  return <DiffusionPicker value={nodeDiffusion} onChange={(d) => setNodeDiffusion(nodeId, d)} />;
}

export function DiffusionPicker({ value, onChange }: { value?: DiffusionConfig; onChange: (d?: DiffusionConfig) => void }) {
  const [embeddings, setEmbeddings] = useState<RegEmbedding[]>([]);
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchRegEmbeddings()
      .then((list) => { if (alive) setEmbeddings(list); })
      .catch(() => { if (alive) setEmbeddings([]); });
    return () => { alive = false; };
  }, [open]);

  const d = value ?? {};
  const setField = (key: keyof DiffusionConfig, value: unknown) => {
    const next: DiffusionConfig = { ...d };
    if (value === undefined || value === '' || value === null) {
      delete next[key];
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  const inputCls = 'w-full text-xs text-ink bg-wash border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent/40';
  const labelCls = 'text-2xs text-ink-faint uppercase tracking-wider font-medium';

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="DiffusionGemma REG settings"
        className={`text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 max-w-[210px] ${d.embedding ? 'bg-pink-500/10 text-pink-500' : 'bg-wash hover:bg-line text-ink-muted'}`}
      >
        <Sparkles size={14} strokeWidth={1.75} className="shrink-0" />
        <span className="text-xs truncate font-medium">{d.embedding ? d.embedding.split('/').pop() : 'Base'}</span>
        {d.strength !== undefined && <span className="text-2xs shrink-0">×{d.strength}</span>}
      </button>

      {open && (
        <div className="absolute top-9 right-0 bg-card border border-line rounded-xl shadow-xl py-2 w-72 z-30 max-h-[60vh] overflow-y-auto">
          <p className={labelCls + ' px-3 pt-1 pb-1'}>REG embedding</p>
          <div className="px-3 pb-2">
            <select
              value={d.embedding ?? ''}
              onChange={(e) => setField('embedding', e.target.value || undefined)}
              className={inputCls}
            >
              <option value="">None (base)</option>
              {embeddings.map((emb) => (
                <option key={emb.id} value={emb.id}>{emb.id} ({emb.kind})</option>
              ))}
            </select>
          </div>

          <p className={labelCls + ' px-3 pt-1 pb-1'}>Strength</p>
          <div className="px-3 pb-2">
            <input
              type="number"
              step="0.1"
              min="0"
              max="32"
              value={d.strength ?? 1.0}
              onChange={(e) => setField('strength', e.target.value === '' ? undefined : Number(e.target.value))}
              className={inputCls}
            />
          </div>

          <p className={labelCls + ' px-3 pt-1 pb-1'}>Mode</p>
          <div className="px-3 pb-2 flex gap-1">
            {(['state', 'bias'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setField('strengthMode', mode)}
                className={`flex-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${(d.strengthMode ?? 'state') === mode ? 'bg-accent/10 border-accent/40 text-accent' : 'bg-wash border-line text-ink-muted hover:bg-line'}`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => setAdvanced((v) => !v)}
            className="w-full text-left px-3 py-1.5 text-xs text-ink-muted hover:bg-wash flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal size={12} strokeWidth={1.75} className="shrink-0" /> Advanced
          </button>

          {advanced && (
            <div className="border-t border-line mt-1 pt-2 px-3 pb-2 grid grid-cols-2 gap-2">
              <label className="col-span-2">
                <span className={labelCls}>Seed (empty = random)</span>
                <input type="number" min="0" max="9223372036854775807" value={d.seed ?? ''} onChange={(e) => setField('seed', e.target.value === '' ? undefined : Number(e.target.value))} className={inputCls} />
              </label>
              <label className="col-span-2">
                <span className={labelCls}>Max tokens (empty = 1024)</span>
                <input type="number" min="1" max="16384" value={d.maxTokens ?? ''} onChange={(e) => setField('maxTokens', e.target.value === '' ? undefined : Number(e.target.value))} className={inputCls} />
              </label>
              <label className="col-span-2">
                <span className={labelCls}>Steps</span>
                <input type="number" min="1" max="256" value={d.numInferenceSteps ?? 24} onChange={(e) => setField('numInferenceSteps', e.target.value === '' ? undefined : Number(e.target.value))} className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>Temperature</span>
                <input type="number" step="0.1" min="0" max="2" value={d.temperature ?? 0.7} onChange={(e) => setField('temperature', e.target.value === '' ? undefined : Number(e.target.value))} className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>Top P</span>
                <input type="number" step="0.05" min="0" max="1" value={d.topP ?? 0} onChange={(e) => setField('topP', e.target.value === '' ? undefined : Number(e.target.value))} className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>Top K</span>
                <input type="number" min="0" max="262144" value={d.topK ?? 0} onChange={(e) => setField('topK', e.target.value === '' ? undefined : Number(e.target.value))} className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>T Min</span>
                <input type="number" step="0.1" min="0" max="2" value={d.tMin ?? 0.4} onChange={(e) => setField('tMin', e.target.value === '' ? undefined : Number(e.target.value))} className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>T Max</span>
                <input type="number" step="0.1" min="0" max="2" value={d.tMax ?? 0.8} onChange={(e) => setField('tMax', e.target.value === '' ? undefined : Number(e.target.value))} className={inputCls} />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
