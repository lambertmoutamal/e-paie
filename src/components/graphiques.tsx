"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Couleurs de la palette DématPaie (indigo, corail, puis couleurs des modules)
export const PALETTE = ["#4f46e5", "#f2665a", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6"];

const STYLE_INFOBULLE = { borderRadius: 12, border: "1px solid #e4e7f0", fontSize: 13, boxShadow: "0 8px 24px rgba(27,30,46,.12)" };
const AXE = { fontSize: 11, fill: "#5b6478" };
const VIDE = <p className="grid h-full min-h-24 place-items-center text-sm text-doux">Aucune donnée pour l&apos;instant.</p>;

// Tous les graphiques remplissent la hauteur de leur carte (tableau de bord sur un seul écran).

export function GraphiqueEffectif({ donnees }: { donnees: { mois: string; effectif: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={donnees} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="degradeEffectif" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
        <XAxis dataKey="mois" tick={AXE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={AXE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={STYLE_INFOBULLE} formatter={(v) => [v, "Effectif"]} />
        <Area type="monotone" dataKey="effectif" stroke="#4f46e5" strokeWidth={3} fill="url(#degradeEffectif)" dot={{ r: 2.5, fill: "#4f46e5" }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Pyramide des âges : hommes à gauche (valeurs négatives), femmes à droite
export function GraphiquePyramide({ donnees }: { donnees: { tranche: string; hommes: number; femmes: number }[] }) {
  if (!donnees.some((d) => d.hommes || d.femmes)) return VIDE;
  const lignes = donnees.map((d) => ({ tranche: d.tranche, hommes: -d.hommes, femmes: d.femmes }));
  const max = Math.max(1, ...donnees.map((d) => Math.max(d.hommes, d.femmes)));
  // Graduations symétriques autour de 0 (nombres entiers)
  const pas = Math.max(1, Math.ceil(max / 2));
  const borne = pas * 2;
  const graduations = [-borne, -pas, 0, pas, borne];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={lignes} layout="vertical" stackOffset="sign" margin={{ top: 0, right: 8, left: 8, bottom: 0 }} barCategoryGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" horizontal={false} />
        <XAxis type="number" domain={[-borne, borne]} ticks={graduations} tick={AXE} axisLine={false} tickLine={false} tickFormatter={(v: number) => String(Math.abs(v))} />
        <YAxis type="category" dataKey="tranche" width={92} tick={AXE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={STYLE_INFOBULLE} cursor={{ fill: "rgba(79,70,229,.06)" }} formatter={(v, n) => [Math.abs(Number(v)), n]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="hommes" name="Hommes" stackId="age" fill="#4f46e5" radius={[6, 0, 0, 6]} />
        <Bar dataKey="femmes" name="Femmes" stackId="age" fill="#f2665a" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Anneau (répartition) avec le total au centre et la légende à côté
export function GraphiqueAnneau({ donnees }: { donnees: { nom: string; valeur: number }[] }) {
  const total = donnees.reduce((s, d) => s + d.valeur, 0);
  if (!total) return VIDE;
  return (
    <div className="flex h-full items-center gap-3">
      <div className="relative h-full min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={donnees} dataKey="valeur" nameKey="nom" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none">
              {donnees.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={STYLE_INFOBULLE} />
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-xl font-bold tabular-nums">{total}</span>
      </div>
      <ul className="flex max-w-[45%] flex-col gap-1 text-xs">
        {donnees.map((d, i) => (
          <li key={d.nom} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="truncate">{d.nom}</span>
            <strong className="ml-auto pl-1 tabular-nums">{d.valeur}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Barres horizontales (ex. absences par type, réclamations par sujet)
export function GraphiqueBarresHorizontales({ donnees, unite = "" }: { donnees: { nom: string; valeur: number }[]; unite?: string }) {
  if (!donnees.length) return VIDE;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={donnees.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 28, left: 4, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="nom" width={120} tick={AXE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={STYLE_INFOBULLE} cursor={{ fill: "rgba(79,70,229,.06)" }} formatter={(v) => [`${v}${unite}`, ""]} />
        <Bar dataKey="valeur" radius={[0, 8, 8, 0]} label={{ position: "right", fontSize: 11, fill: "#1b1e2e" }}>
          {donnees.slice(0, 6).map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
