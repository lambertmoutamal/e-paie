"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Couleurs de la palette DématPaie (indigo, corail, puis couleurs des modules)
export const PALETTE = ["#4f46e5", "#f2665a", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6"];

const STYLE_INFOBULLE = { borderRadius: 12, border: "1px solid #e4e7f0", fontSize: 13, boxShadow: "0 8px 24px rgba(27,30,46,.12)" };
const AXE = { fontSize: 12, fill: "#5b6478" };

export function GraphiqueEffectif({ donnees }: { donnees: { mois: string; effectif: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={donnees} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="degradeEffectif" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
        <XAxis dataKey="mois" tick={AXE} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={STYLE_INFOBULLE} formatter={(v) => [v, "Effectif"]} />
        <Area type="monotone" dataKey="effectif" stroke="#4f46e5" strokeWidth={3} fill="url(#degradeEffectif)" dot={{ r: 3, fill: "#4f46e5" }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function GraphiqueMouvements({ donnees }: { donnees: { mois: string; entrees: number; sorties: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={donnees} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
        <XAxis dataKey="mois" tick={AXE} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={STYLE_INFOBULLE} cursor={{ fill: "rgba(79,70,229,.06)" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="entrees" name="Entrées" fill="#10b981" radius={[6, 6, 0, 0]} />
        <Bar dataKey="sorties" name="Sorties" fill="#f2665a" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Anneau (répartition) avec la valeur totale au centre
export function GraphiqueAnneau({ donnees, unite = "" }: { donnees: { nom: string; valeur: number }[]; unite?: string }) {
  const total = donnees.reduce((s, d) => s + d.valeur, 0);
  if (!total) return <p className="grid h-[220px] place-items-center text-sm text-doux">Aucune donnée pour l&apos;instant.</p>;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={donnees} dataKey="valeur" nameKey="nom" innerRadius={58} outerRadius={85} paddingAngle={2} stroke="none">
            {donnees.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={STYLE_INFOBULLE} formatter={(v, n) => [`${v}${unite}`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <span className="text-center">
          <span className="block text-2xl font-bold tabular-nums">{Math.round(total * 10) / 10}</span>
          <span className="block text-xs text-doux">total{unite}</span>
        </span>
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {donnees.map((d, i) => (
          <li key={d.nom} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            {d.nom} <strong className="tabular-nums">{d.valeur}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Barres horizontales (ex. absences par type, réclamations par sujet)
export function GraphiqueBarresHorizontales({ donnees, unite = "" }: { donnees: { nom: string; valeur: number }[]; unite?: string }) {
  if (!donnees.length) return <p className="grid h-[200px] place-items-center text-sm text-doux">Aucune donnée pour l&apos;instant.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, donnees.length * 44)}>
      <BarChart data={donnees} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="nom" width={150} tick={AXE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={STYLE_INFOBULLE} cursor={{ fill: "rgba(79,70,229,.06)" }} formatter={(v) => [`${v}${unite}`, ""]} />
        <Bar dataKey="valeur" radius={[0, 8, 8, 0]} label={{ position: "right", fontSize: 12, fill: "#1b1e2e" }}>
          {donnees.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
