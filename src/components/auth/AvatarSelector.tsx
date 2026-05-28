interface AvatarSelectorProps {
  value: string;
  onChange: (url: string) => void;
}

const PRESETS = [
  new URL("../../assets/avatars/avatar1.svg", import.meta.url).href,
  new URL("../../assets/avatars/avatar2.svg", import.meta.url).href,
  new URL("../../assets/avatars/avatar3.svg", import.meta.url).href,
  new URL("../../assets/avatars/avatar4.svg", import.meta.url).href,
  new URL("../../assets/avatars/avatar5.svg", import.meta.url).href,
  new URL("../../assets/avatars/avatar6.svg", import.meta.url).href,
];

export function AvatarSelector({ value, onChange }: AvatarSelectorProps) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 justify-items-center gap-2 sm:gap-3">
        {PRESETS.map((src, idx) => {
          const selected = src === value;
          return (
            <button
              key={src}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(src)}
              className={`group h-16 w-16 overflow-hidden rounded-full p-0 transition sm:h-20 sm:w-20 ${selected ? "bg-cyan-400/10 ring-2 ring-cyan-400/50" : "bg-transparent hover:ring-1 hover:ring-white/10"}`}
            >
              <img src={src} alt={`Avatar preset ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-100">O usa un enlace personalizado</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={/^https?:\/\//i.test(value) ? value : ""}
            placeholder="https://..."
            onChange={(e) => onChange(e.target.value)}
            className="h-10 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 text-slate-100 outline-none"
          />
          <button type="button" onClick={() => onChange("")} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100">Limpiar</button>
        </div>
      </div>
    </div>
  );
}

export default AvatarSelector;
