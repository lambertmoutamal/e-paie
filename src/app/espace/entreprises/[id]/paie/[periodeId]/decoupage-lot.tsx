"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Eye, FileStack, KeyRound, LoaderCircle, Upload, UserPlus } from "lucide-react";
import { libellePages, MOTIFS_DECOUPAGE, reconnaitreSalarie, regrouperPages, type Reconnaissance } from "@/lib/bulletins/decoupage";
import { TAILLE_MAX_BULLETIN } from "@/lib/bulletins/regles";
import { extraireFicheBulletin } from "@/lib/bulletins/extraction-fiche";
import { classesBouton } from "@/components/ui";
import { creerSalarieDepuisBulletin, deposerBulletin } from "../actions";
import { champsManquants, FicheNouveauSalarie, ficheProposee, type FicheProposee } from "./fiche-nouveau-salarie";

type SalarieAttendu = { id: string; matricule: string; nom: string; prenoms: string; aBulletin: boolean };

// Valeur du choix « créer ce salarié à partir du bulletin »
const NOUVEAU = "__nouveau__";

type Groupe = {
  pages: number[];
  salarieId: string; // "" = non attribué ; NOUVEAU = salarié à créer
  fiche?: FicheProposee; // informations lues sur le bulletin (salarié à créer)
  integre?: string; // salarié intégré pendant la revue
  ignore?: boolean; // « Non » à la revue : bulletin non déposé
  motif?: string;
  methode?: "libelle" | "recherche" | "nom";
  resultat?: { ok: boolean; message: string };
};

const TAILLE_MAX_LOT = 50 * 1024 * 1024; // 50 Mo

// Lecture du texte de chaque page avec pdf.js (chargé seulement quand on en a besoin).
// Version « legacy » : compatible avec les navigateurs et téléphones moins récents.
// Les fichiers de polices (cmaps, standard_fonts) sont copiés dans public/pdfjs par scripts/copier-pdfjs.mjs.
async function lireTextePages(
  donnees: Uint8Array,
  motDePasse: string | undefined,
  avancer: (page: number, total: number) => void,
): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const chargement = pdfjs.getDocument({
    data: donnees,
    password: motDePasse,
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  });
  const document = await chargement.promise;
  const textes: string[] = [];
  for (let n = 1; n <= document.numPages; n++) {
    const page = await document.getPage(n);
    const contenu = await page.getTextContent();
    textes.push(contenu.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    avancer(n, document.numPages);
  }
  await chargement.destroy();
  return textes;
}

// Fabrique le PDF individuel d'un bulletin à partir des pages du lot.
// Les PDF protégés (chiffrés par le logiciel de paie) sont déchiffrés : le bulletin produit ne l'est plus.
// Le lot n'est analysé qu'une fois, même pour des centaines de bulletins.
type Lot = { nom: string; donnees: Uint8Array; motDePasse?: string };
const lotsCharges = new WeakMap<Lot, Promise<import("@cantoo/pdf-lib").PDFDocument>>();

async function extrairePages(lot: Lot, pages: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  if (!lotsCharges.has(lot)) lotsCharges.set(lot, PDFDocument.load(lot.donnees, { password: lot.motDePasse ?? "" }));
  const source = await lotsCharges.get(lot)!;
  const bulletin = await PDFDocument.create();
  const copies = await bulletin.copyPages(source, pages.map((p) => p - 1));
  copies.forEach((c) => bulletin.addPage(c));
  return bulletin.save();
}

// Un seul PDF contenant tous les bulletins : découpage page par page,
// reconnaissance du matricule, vérification par l'utilisateur, puis envoi.
export function DecoupageLot({
  entrepriseId,
  periodeId,
  annee,
  mois,
  salaries,
}: {
  entrepriseId: string;
  periodeId: string;
  annee: number;
  mois: number;
  salaries: SalarieAttendu[];
}) {
  const router = useRouter();
  const [lot, setLot] = useState<Lot | null>(null);
  // Fichier en attente du mot de passe d'ouverture
  const [protege, setProtege] = useState<{ fichier: File; incorrect: boolean } | null>(null);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [analyse, setAnalyse] = useState<{ page: number; total: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<{ faits: number; total: number } | null>(null);
  // Fiche lue sur chaque page, une seule fois à l'analyse (salariés absents à créer)
  const [fichesLues, setFichesLues] = useState<FicheProposee[]>([]);
  // Salariés intégrés pendant la revue (absents de la liste reçue du serveur)
  const [ajoutes, setAjoutes] = useState<SalarieAttendu[]>([]);
  // Revue des salariés absents, un bulletin après l'autre : « Intégrer ce salarié ? »
  const [revue, setRevue] = useState<{ file: number[]; position: number; fiche: FicheProposee; erreur?: string; enCours?: boolean } | null>(null);

  const tous = [...salaries, ...ajoutes];
  const parId = new Map(tous.map((s) => [s.id, s]));
  const suffixe = `${annee}-${String(mois).padStart(2, "0")}`;

  async function analyser(fichier: File | undefined, motDePasse?: string) {
    setErreur(null);
    setGroupes([]);
    setLot(null);
    setProtege(null);
    if (!fichier) return;
    if (fichier.size > TAILLE_MAX_LOT) return setErreur("Fichier trop lourd (50 Mo maximum) : découpez-le en plusieurs lots.");
    const donnees = new Uint8Array(await fichier.arrayBuffer());
    if (!(donnees[0] === 0x25 && donnees[1] === 0x50 && donnees[2] === 0x44 && donnees[3] === 0x46)) {
      return setErreur("Ce fichier n'est pas un PDF.");
    }
    try {
      setAnalyse({ page: 0, total: 0 });
      // pdf.js peut « consommer » le tableau transmis : on lui en donne une copie
      const textes = await lireTextePages(donnees.slice(), motDePasse, (page, total) => setAnalyse({ page, total }));
      const reconnus: Reconnaissance[] = textes.map((t) => reconnaitreSalarie(t, salaries));
      const fiches = textes.map((t) => ficheProposee(extraireFicheBulletin(t)));
      setFichesLues(fiches);
      const nouveauxGroupes: Groupe[] = regrouperPages(reconnus).map((g) => {
        const r = reconnus[g.pages[0] - 1];
        return {
          pages: g.pages,
          salarieId: g.salarieId ?? "",
          motif: g.motif ? MOTIFS_DECOUPAGE[g.motif] : undefined,
          methode: g.salarieId && "methode" in r ? r.methode : undefined,
        };
      });
      setGroupes(nouveauxGroupes);
      // Salariés absents : on propose de les intégrer, un par un
      const file = nouveauxGroupes.map((g, i) => (creableAvec(g, fiches) ? i : -1)).filter((i) => i >= 0);
      setRevue(file.length ? { file, position: 0, fiche: { ...fiches[nouveauxGroupes[file[0]].pages[0] - 1] } } : null);
      setLot({ nom: fichier.name, donnees, motDePasse });
      if (reconnus.every((r) => "motif" in r && r.motif === "aucun_texte")) {
        setErreur("Aucun texte trouvé : ce PDF semble scanné. Exportez les bulletins directement depuis le logiciel de paie, ou attribuez les pages à la main.");
      }
    } catch (e) {
      console.error(e);
      const nom = e instanceof Error ? e.name : "";
      if (nom === "PasswordException") {
        setProtege({ fichier, incorrect: Boolean(motDePasse) });
      } else if (nom === "InvalidPDFException") {
        setErreur("Ce PDF est endommagé ou incomplet. Exportez-le à nouveau depuis le logiciel de paie.");
      } else {
        setErreur(`Le PDF n'a pas pu être lu. Détail technique : ${e instanceof Error ? `${e.name} — ${e.message}` : String(e)}`);
      }
    } finally {
      setAnalyse(null);
    }
  }

  const lireFiche = (g: Groupe) => ({ ...(fichesLues[g.pages[0] - 1] ?? ficheProposee(extraireFicheBulletin(""))) });
  // Page non attribuée (hors doublon) où un salarié a pu être lu : salarié absent à proposer
  function creableAvec(g: Groupe, fiches: FicheProposee[]) {
    const f = fiches[g.pages[0] - 1];
    return !g.salarieId && g.motif !== MOTIFS_DECOUPAGE.doublon && !!(f?.matricule || f?.nom);
  }
  const absents = groupes.map((g, i) => (creableAvec(g, fichesLues) && !g.ignore ? i : -1)).filter((i) => i >= 0);

  // Passe au salarié absent suivant (ou termine la revue)
  function suivant(r: NonNullable<typeof revue>) {
    const position = r.position + 1;
    if (position >= r.file.length) return setRevue(null);
    setRevue({ file: r.file, position, fiche: lireFiche(groupes[r.file[position]]) });
  }

  // « Oui » : le salarié est créé tout de suite ; son bulletin lui sera joint au dépôt
  async function integrer() {
    if (!revue) return;
    const manquants = champsManquants(revue.fiche);
    if (manquants.length) return setRevue({ ...revue, erreur: `Complétez d'abord : ${manquants.join(", ")}.` });
    setRevue({ ...revue, enCours: true, erreur: undefined });
    try {
      const c = await creerSalarieDepuisBulletin(entrepriseId, revue.fiche);
      if (!c.ok) return setRevue({ ...revue, enCours: false, erreur: c.erreur });
      const f = revue.fiche;
      if (!parId.has(c.salarieId)) setAjoutes((a) => [...a, { id: c.salarieId, matricule: f.matricule.trim(), nom: f.nom.trim().toUpperCase(), prenoms: f.prenoms.trim(), aBulletin: false }]);
      const index = revue.file[revue.position];
      setGroupes((avant) =>
        avant.map((x, i) =>
          i === index ? { ...x, salarieId: c.salarieId, motif: undefined, methode: "libelle", integre: c.existant ? "Rattaché au salarié existant" : "Salarié intégré" } : x,
        ),
      );
      suivant(revue);
    } catch {
      setRevue({ ...revue, enCours: false, erreur: "Le salarié n'a pas pu être intégré (connexion ?). Réessayez." });
    }
  }

  // « Non » : le bulletin de ce salarié n'est pas déposé
  function refuser() {
    if (!revue) return;
    const index = revue.file[revue.position];
    setGroupes((avant) => avant.map((x, i) => (i === index ? { ...x, ignore: true, motif: "Salarié non intégré : bulletin non déposé." } : x)));
    suivant(revue);
  }

  async function apercu(pages: number[]) {
    if (!lot) return;
    const octets = await extrairePages(lot, pages);
    const url = URL.createObjectURL(new Blob([octets as BlobPart], { type: "application/pdf" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // Un même salarié choisi pour deux bulletins du lot : on bloque l'envoi.
  // (pour un salarié à créer, la clé est son matricule)
  const cle = (g: Groupe) => (g.salarieId === NOUVEAU ? `nouveau:${(g.fiche?.matricule ?? "").trim().toUpperCase()}` : g.salarieId);
  const comptes = new Map<string, number>();
  for (const g of groupes) if (g.salarieId) comptes.set(cle(g), (comptes.get(cle(g)) ?? 0) + 1);
  const enDouble = new Set([...comptes].filter(([, n]) => n > 1).map(([id]) => id));
  const incomplets = groupes.filter((g) => g.salarieId === NOUVEAU && !g.resultat?.ok && (!g.fiche || champsManquants(g.fiche).length > 0));
  const aEnvoyer = groupes.filter((g) => g.salarieId && !g.resultat?.ok && !incomplets.includes(g));
  const sansBulletinDansLot = salaries.filter((s) => !comptes.has(s.id));

  async function envoyer() {
    if (!lot || enDouble.size) return;
    setEnvoi({ faits: 0, total: aEnvoyer.length });
    for (const g of aEnvoyer) {
      let resultat: Groupe["resultat"];
      try {
        // Salarié absent : création à partir de la fiche lue sur le bulletin
        let salarieId = g.salarieId;
        let matricule = parId.get(g.salarieId)?.matricule ?? "";
        let creation = "";
        if (g.salarieId === NOUVEAU && g.fiche) {
          const c = await creerSalarieDepuisBulletin(entrepriseId, g.fiche);
          if (!c.ok) throw new Error(c.erreur);
          salarieId = c.salarieId;
          matricule = g.fiche.matricule.trim();
          creation = c.existant ? "Rattaché au salarié existant · " : "Salarié créé · ";
        }
        const octets = await extrairePages(lot, g.pages);
        if (octets.length > TAILLE_MAX_BULLETIN) {
          resultat = { ok: false, message: `${creation}Bulletin trop lourd (2 Mo maximum).` };
        } else {
          const formulaire = new FormData();
          formulaire.set("fichier", new File([octets as BlobPart], `${matricule}_${suffixe}.pdf`, { type: "application/pdf" }));
          const r = await deposerBulletin(entrepriseId, periodeId, salarieId, formulaire);
          resultat = r.ok ? { ok: true, message: `${creation}${r.remplace ? "Remplacé" : "Déposé"}` } : { ok: false, message: `${creation}${r.erreur}` };
        }
      } catch (e) {
        resultat = { ok: false, message: e instanceof Error && e.message && !e.message.includes("fetch") ? e.message : "Envoi interrompu (connexion ?). Réessayez." };
      }
      setGroupes((avant) => avant.map((x) => (x === g ? { ...x, resultat } : x)));
      setEnvoi((e) => e && { ...e, faits: e.faits + 1 });
    }
    setEnvoi(null);
    router.refresh();
  }

  const occupe = analyse !== null || envoi !== null || revue !== null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-doux">
        Déposez le PDF unique produit par votre logiciel de paie. Chaque page est lue, le <strong className="text-foreground">matricule</strong> est
        recherché puis comparé aux salariés de l&apos;entreprise. <strong className="text-foreground">Une page = un bulletin</strong> : chaque
        salarié ne reçoit que sa page. Vérifiez
        l&apos;aperçu avant l&apos;envoi. Le fichier est découpé sur votre ordinateur : seuls les bulletins individuels sont envoyés.
      </p>

      <label
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-bordure px-4 py-8 text-center hover:border-marque/50 hover:bg-marque-claire/40 ${occupe ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!occupe) analyser(e.dataTransfer.files[0]);
        }}
      >
        <FileStack size={28} className="text-marque" aria-hidden />
        <span className="font-semibold">{lot ? `Lot : ${lot.nom} — cliquez pour en choisir un autre` : "Glissez le PDF de tous les bulletins ou cliquez pour le choisir"}</span>
        <span className="text-sm text-doux">Un seul fichier PDF, 50 Mo maximum</span>
        <input type="file" accept="application/pdf" className="sr-only" disabled={occupe} onChange={(e) => analyser(e.target.files?.[0])} />
      </label>

      {analyse && (
        <p className="flex items-center gap-2 text-sm text-doux" role="status">
          <LoaderCircle size={16} className="animate-spin" aria-hidden />
          Lecture du fichier{analyse.total ? ` : page ${analyse.page} sur ${analyse.total}` : "…"}
        </p>
      )}
      {protege && (
        <form
          className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const motDePasse = String(new FormData(e.currentTarget).get("mot_de_passe") ?? "");
            if (motDePasse) analyser(protege.fichier, motDePasse);
          }}
        >
          <label htmlFor="mot-de-passe-lot" className="flex items-center gap-2 font-medium text-amber-900">
            <KeyRound size={16} aria-hidden />
            {protege.incorrect ? "Mot de passe incorrect. Réessayez :" : "Ce PDF est protégé par un mot de passe à l'ouverture. Saisissez-le :"}
          </label>
          <div className="flex gap-2">
            <input
              id="mot-de-passe-lot"
              name="mot_de_passe"
              type="password"
              autoComplete="off"
              autoFocus
              className="h-10 flex-1 rounded-lg border border-bordure bg-surface px-3 text-base"
            />
            <button type="submit" className={classesBouton("principal", "petit")}>
              Ouvrir
            </button>
          </div>
          <p className="text-xs text-amber-900/80">Le mot de passe sert uniquement à ouvrir le fichier sur votre ordinateur : il n&apos;est ni envoyé ni enregistré.</p>
        </form>
      )}
      {erreur && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          {erreur}
        </p>
      )}

      {groupes.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-black/[.03] px-3 py-2 text-sm">
            <span>
              <strong>{groupes.length}</strong> bulletin(s) détecté(s) : <strong className="text-marque">{groupes.filter((g) => g.salarieId).length}</strong> attribué(s)
              {groupes.some((g) => !g.salarieId) && (
                <>
                  , <strong className="text-red-700">{groupes.filter((g) => !g.salarieId).length}</strong> à attribuer (sinon ignoré)
                </>
              )}
            </span>
            <button type="button" className={classesBouton("principal", "petit")} disabled={occupe || aEnvoyer.length === 0 || enDouble.size > 0} onClick={envoyer}>
              {envoi ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
              {envoi ? `Envoi ${envoi.faits}/${envoi.total}…` : `Déposer ${aEnvoyer.length} bulletin(s)`}
            </button>
          </div>
          {revue && (() => {
            const g = groupes[revue.file[revue.position]];
            return (
              <section aria-live="polite" className="flex flex-col gap-3 rounded-2xl border-2 border-marque/40 bg-marque-claire/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <UserPlus size={18} className="text-marque" aria-hidden />
                    Salarié absent {revue.position + 1} sur {revue.file.length} · {libellePages(g.pages)}
                  </h3>
                  <button type="button" className={classesBouton("secondaire", "petit")} onClick={() => apercu(g.pages)}>
                    <Eye size={14} aria-hidden />
                    Voir le bulletin
                  </button>
                </div>
                <p className="text-sm">
                  Ce bulletin concerne un salarié qui n&apos;existe pas encore dans DématPaie. Voici les informations reconnues sur le bulletin (vous
                  pouvez les corriger). <strong>Voulez-vous intégrer ce salarié ?</strong>
                </p>
                <FicheNouveauSalarie fiche={revue.fiche} desactive={revue.enCours} onChange={(fiche) => setRevue({ ...revue, fiche, erreur: undefined })} />
                {revue.erreur && (
                  <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
                    {revue.erreur}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={classesBouton("principal", "petit")} disabled={revue.enCours} onClick={integrer}>
                    {revue.enCours ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <UserPlus size={14} aria-hidden />}
                    Oui, intégrer ce salarié
                  </button>
                  <button type="button" className={classesBouton("secondaire", "petit")} disabled={revue.enCours} onClick={refuser}>
                    Non, passer au bulletin suivant
                  </button>
                  <button type="button" className="ml-auto text-sm text-doux underline" disabled={revue.enCours} onClick={() => setRevue(null)}>
                    Décider plus tard
                  </button>
                </div>
              </section>
            );
          })()}
          {!revue && absents.length > 0 && (
            <button
              type="button"
              className={`${classesBouton("secondaire", "petit")} self-start`}
              disabled={occupe}
              onClick={() => setRevue({ file: absents, position: 0, fiche: lireFiche(groupes[absents[0]]) })}
            >
              <UserPlus size={14} aria-hidden />
              Revoir les salariés absents ({absents.length})
            </button>
          )}
          {incomplets.length > 0 && (
            <p role="alert" className="text-sm text-red-700">
              {incomplets.length} fiche(s) de nouveau salarié incomplète(s) : complétez les champs marqués d&apos;une étoile (sinon le bulletin n&apos;est pas envoyé).
            </p>
          )}
          {enDouble.size > 0 && (
            <p role="alert" className="text-sm text-red-700">
              Un même salarié est choisi pour plusieurs bulletins : corrigez les lignes signalées avant l&apos;envoi.
            </p>
          )}
          {envoi && (
            <div className="h-2 overflow-hidden rounded-full bg-black/[.06]" role="progressbar" aria-valuemin={0} aria-valuemax={envoi.total} aria-valuenow={envoi.faits}>
              <div className="h-full bg-marque transition-all" style={{ width: `${(envoi.faits / Math.max(1, envoi.total)) * 100}%` }} />
            </div>
          )}

          <ul className="divide-y divide-bordure rounded-lg border border-bordure text-sm">
            {groupes.map((g, i) => {
              const s = g.salarieId ? parId.get(g.salarieId) : undefined;
              const double = g.salarieId !== "" && enDouble.has(cle(g));
              const nouveau = g.salarieId === NOUVEAU && g.fiche;
              const manquants = nouveau ? champsManquants(g.fiche!) : [];
              const aVerifier = g.methode === "recherche" || g.methode === "nom";
              return (
                <li key={g.pages.join("-")} className="flex flex-col gap-2 px-3 py-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {g.resultat?.ok ? (
                      <CircleCheck size={16} className="shrink-0 text-marque" aria-hidden />
                    ) : !g.salarieId || double || (g.resultat && !g.resultat.ok) ? (
                      <CircleAlert size={16} className="shrink-0 text-red-600" aria-hidden />
                    ) : (
                      <CircleCheck size={16} className="shrink-0 text-doux" aria-hidden />
                    )}
                    <span className="w-24 shrink-0 font-medium">{libellePages(g.pages)}</span>
                    <span className={`min-w-0 truncate ${!g.salarieId || double || (g.resultat && !g.resultat.ok) ? "text-red-700" : "text-doux"}`}>
                      {g.resultat?.message ??
                        (g.integre && g.salarieId === s?.id
                          ? `${g.integre} : ${s.matricule} · ${s.nom} ${s.prenoms}`
                          : double
                          ? "Salarié choisi plusieurs fois."
                          : nouveau
                            ? manquants.length
                              ? `Nouveau salarié : à compléter (${manquants.join(", ")})`
                              : `Nouveau salarié : ${g.fiche!.matricule} · ${g.fiche!.nom} ${g.fiche!.prenoms}`
                          : !g.salarieId
                            ? (g.motif ?? "Choisissez le salarié.")
                            : `${aVerifier ? "À vérifier (matricule trouvé sans libellé)" : "Matricule lu"}${s?.aBulletin ? " · remplacera le bulletin actuel" : ""}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`groupe-${i}`}>
                      Salarié pour {libellePages(g.pages)}
                    </label>
                    <select
                      id={`groupe-${i}`}
                      value={g.salarieId}
                      disabled={occupe || g.resultat?.ok}
                      onChange={(e) =>
                        setGroupes((avant) =>
                          avant.map((x) =>
                            x === g
                              ? { ...x, salarieId: e.target.value, methode: "libelle", resultat: undefined, integre: undefined, ignore: false, fiche: e.target.value === NOUVEAU ? (x.fiche ?? lireFiche(x)) : x.fiche }
                              : x,
                          ),
                        )
                      }
                      className="h-9 max-w-64 rounded-lg border border-bordure bg-surface px-2 text-sm"
                    >
                      <option value="">— Ne pas déposer —</option>
                      <option value={NOUVEAU}>+ Créer un nouveau salarié (fiche lue sur le bulletin)</option>
                      {tous.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.matricule} · {x.nom} {x.prenoms}
                        </option>
                      ))}
                    </select>
                    <button type="button" className={classesBouton("secondaire", "petit")} onClick={() => apercu(g.pages)} aria-label={`Voir ${libellePages(g.pages)}`} title="Voir">
                      <Eye size={14} aria-hidden />
                    </button>
                  </div>
                  </div>
                  {nouveau && !g.resultat?.ok && (
                    <details open={manquants.length > 0} className="rounded-lg border border-bordure bg-black/[.015]">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-marque">Voir la fiche du nouveau salarié</summary>
                      <div className="border-t border-bordure p-3">
                        <FicheNouveauSalarie
                          fiche={g.fiche!}
                          desactive={occupe}
                          onChange={(fiche) => setGroupes((avant) => avant.map((x) => (x === g ? { ...x, fiche, resultat: undefined } : x)))}
                        />
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>

          {sansBulletinDansLot.length > 0 && (
            <p className="text-sm text-doux">
              <strong className="text-foreground">Sans bulletin dans ce lot ({sansBulletinDansLot.length}) :</strong>{" "}
              {sansBulletinDansLot.map((s) => `${s.nom} ${s.prenoms} (${s.matricule})`).join(", ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
