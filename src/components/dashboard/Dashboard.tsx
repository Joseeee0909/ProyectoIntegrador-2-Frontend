import { useMemo, useState } from "react";
import type { AuthUser } from "../../auth/types";

type StudyRoom = {
  id: string;
  name: string;
  description: string;
  subject: string;
  isPrivate?: boolean;
  inviteCode?: string;
  ownerId: string;
  members: { userId: string; name: string }[];
  maxMembers: number;
  tags: string[];
  updatedAt: string;
};

const MOCK_ROOMS: StudyRoom[] = [
  { id: "room-1", name: "Cálculo Diferencial — Grupo A", description: "Repaso de límites, derivadas e integrales.", subject: "Matemáticas", ownerId: "user-1", members: [{ userId: "user-1", name: "Demo Usuario" }], maxMembers: 10, tags: ["cálculo", "examen"], updatedAt: new Date().toISOString() },
  { id: "room-2", name: "React & TypeScript — Avanzado", description: "Patrones y optimización.", subject: "Programación", ownerId: "user-1", members: [{ userId: "user-1", name: "Demo Usuario" }, { userId: "user-2", name: "Ana García" }], maxMembers: 6, tags: ["react", "typescript"], updatedAt: new Date().toISOString() },
];

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const letter = name ? name.charAt(0).toUpperCase() : "U";
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-lg" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white`} style={{ fontWeight: 700 }}>
      {letter}
    </div>
  );
}

interface DashboardProps {
  user: AuthUser;
  onLogout: () => void;
  flashMessage?: string;
  backendConnected: boolean;
}

export function Dashboard({ user, onLogout, flashMessage, backendConnected }: DashboardProps) {
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("Todas");
  const rooms = useMemo(() => MOCK_ROOMS, []);

  const allSubjects = useMemo(() => ["Todas", ...Array.from(new Set(rooms.map((r) => r.subject)))], [rooms]);

  const filtered = rooms.filter((r) => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase());
    const matchSubject = subjectFilter === "Todas" || r.subject === subjectFilter;
    return matchSearch && matchSubject;
  });

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /></svg>
          </div>
          <span className="text-white font-bold">StudyRoom</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-600 text-white">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="16" rx="2" /></svg>
            Mi salas
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 21l-6-6" /></svg>
            Explorar salas
          </button>

          <div className="pt-4">
            <p className="text-xs text-slate-600 px-4 mb-2 uppercase tracking-wider">Mis salas</p>
            {rooms.slice(0, 5).map((r) => (
              <button key={r.id} className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm">
                <div className={`w-2 h-2 rounded-full ${r.members.length > 0 ? "bg-emerald-500" : "bg-slate-600"}`} />
                <span className="truncate">{r.name}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.firstName || user.username} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate font-medium">{user.firstName} {user.lastName}</p>
              <p className="text-slate-500 text-xs truncate">{user.email}</p>
            </div>
            <button onClick={onLogout} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800">Salir</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-800 flex items-center gap-4 px-6">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-white text-sm" placeholder="Buscar salas..." />
          </div>
          <div className="ml-auto text-slate-400">Backend: {backendConnected ? "OK" : "offline"}</div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {flashMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-600 text-white">{flashMessage}</div>
          )}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-white text-2xl font-bold">Salas</h1>
              <p className="text-slate-400 text-sm mt-0.5">{rooms.length} salas disponibles</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl">Nueva sala</button>
          </div>

          <div className="flex gap-2 flex-wrap mb-6">
            {allSubjects.map((s) => (
              <button key={s} onClick={() => setSubjectFilter(s)} className={`px-4 py-1.5 rounded-full text-sm ${subjectFilter === s ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>
                {s}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <div className="w-12 h-12 mb-4 bg-slate-800 rounded-lg" />
              <p>No se encontraron salas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((room) => (
                <div key={room.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{room.subject}</span>
                        {room.isPrivate ? <span className="text-xs text-amber-400">Privada</span> : <span className="text-xs text-emerald-400">Pública</span>}
                      </div>
                      <h3 className="text-white font-semibold truncate">{room.name}</h3>
                    </div>
                  </div>

                  <p className="text-slate-400 text-sm line-clamp-2">{room.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {room.members.slice(0, 4).map((m) => (
                          <div key={m.userId} className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs border-2 border-slate-900" style={{ fontWeight: 600 }}>{m.name.charAt(0)}</div>
                        ))}
                      </div>
                      <span className="text-slate-500 text-xs">{room.members.length}/{room.maxMembers}</span>
                    </div>
                    <div className="text-slate-500 text-xs">{formatDate(room.updatedAt)}</div>
                  </div>

                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((room.members.length / room.maxMembers) * 100)}%` }} />
                  </div>

                  <button className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300">Unirse</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}