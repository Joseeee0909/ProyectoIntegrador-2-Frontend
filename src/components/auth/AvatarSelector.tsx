import { AVATAR_PRESETS, isAvatarPreset, normalizeAvatarValue, resolveAvatarSrc } from "../../auth/avatar";

interface AvatarSelectorProps {
  value: string;
  onChange: (url: string) => void;
}

export function AvatarSelector({ value, onChange }: AvatarSelectorProps) {
  const normalizedValue = normalizeAvatarValue(value);
  const selectedPreset = isAvatarPreset(normalizedValue);
  const customAvatarValue = selectedPreset ? "" : value;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 justify-items-center gap-2 sm:gap-3">
        {AVATAR_PRESETS.map((preset, idx) => {
          const src = resolveAvatarSrc(preset);
          const selected = normalizedValue === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(preset)}
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
            value={customAvatarValue}
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
