"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Building2, CircleAlert, CircleCheck, Send } from "lucide-react";
import { BoutonEnvoyer, CaseACocher, Champ, ContexteFormulaire, MessageEtat, TitreGroupe } from "@/components/formulaire";
import { creerNouvelleEntreprise } from "./actions";

type Gestion = "autonome" | "cabinet";

const STYLE_SAISIE =
  "h-11 w-full rounded-lg border border-bordure bg-surface px-3 text-base text-foreground outline-none transition focus:border-marque focus:ring-2 focus:ring-marque/20 aria-invalid:border-red-500";

function Erreur({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="flex items-center gap-1 text-sm text-red-700">
      <CircleAlert size={14} aria-hidden />
      {message}
    </p>
  ) : null;
}

// « Créer une nouvelle entreprise » : fiche, contact, puis qui fait la paie (puces).
// Avec un cabinet, la demande lui est transmise pour validation.
export function FormulaireCreation({ cabinets }: { cabinets: { id: string; nom: string }[] }) {
  const [etat, envoyer] = useActionState(creerNouvelleEntreprise, undefined);
  const [gestion, setGestion] = useState<Gestion | null>((etat?.valeurs?.gestion as Gestion) ?? null);
  const [cabinetId, setCabinetId] = useState(etat?.valeurs?.cabinet_id ?? "");
  const idCabinet = useId();
  const idSalaries = useId();
  const cabinet = cabinets.find((c) => c.id === cabinetId);

  if (etat?.succes) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-marque/20 bg-marque-claire px-5 py-8 text-center text-marque-fonce">
        <CircleCheck size={36} aria-hidden />
        <p className="font-medium">{etat.succes}</p>
        <Link href="/connexion" className="text-sm font-semibold underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <ContexteFormulaire value={etat}>
      <form action={envoyer} className="flex flex-col gap-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TitreGroupe>L&apos;entreprise</TitreGroupe>
          <Champ nom="raison_sociale" libelle="Raison sociale" requis pleineLargeur />
          <Champ nom="nif" libelle="NIF" />
          <Champ nom="rccm" libelle="RCCM" />
          <Champ nom="numero_cnss" libelle="N° employeur CNSS" />
          <Champ nom="numero_cnamgs" libelle="N° employeur CNAMGS" />
          <Champ nom="telephone" libelle="Téléphone" type="tel" />
          <Champ nom="email" libelle="Email de l'entreprise" type="email" />
          <Champ nom="adresse" libelle="Adresse" pleineLargeur />

          <TitreGroupe>Vous (personne à contacter)</TitreGroupe>
          <Champ nom="contact_nom" libelle="Votre nom complet" autoComplete="name" requis pleineLargeur />
          <Champ nom="contact_email" libelle="Votre email" type="email" autoComplete="email" requis />
          <Champ nom="contact_telephone" libelle="Votre téléphone" type="tel" autoComplete="tel" />

          <TitreGroupe>Qui fait la paie ?</TitreGroupe>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="sr-only">Gestion de la paie</legend>
            {(
              [
                { valeur: "autonome", titre: "Autonome", texte: "Nous faisons notre paie nous-mêmes dans DématPaie (essai gratuit 30 jours)." },
                { valeur: "cabinet", titre: "Paie gérée par un cabinet", texte: "Un cabinet comptable inscrit sur DématPaie fait notre paie." },
              ] as const
            ).map((o) => (
              <label
                key={o.valeur}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${gestion === o.valeur ? "border-marque bg-marque-claire/60" : "border-bordure hover:border-marque/40"}`}
              >
                <input
                  type="radio"
                  name="gestion"
                  value={o.valeur}
                  checked={gestion === o.valeur}
                  onChange={() => setGestion(o.valeur)}
                  className="mt-1 size-4 accent-[var(--marque)]"
                />
                <span>
                  <span className="block font-semibold">{o.titre}</span>
                  <span className="block text-sm text-doux">{o.texte}</span>
                </span>
              </label>
            ))}
            <Erreur id="erreur-gestion" message={etat?.erreurs?.gestion} />
          </fieldset>

          {gestion === "cabinet" && (
            <>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor={idCabinet} className="text-sm font-medium">
                  Cabinet qui fera votre paie<span className="text-red-600"> *</span>
                </label>
                <select
                  id={idCabinet}
                  name="cabinet_id"
                  value={cabinetId}
                  onChange={(e) => setCabinetId(e.target.value)}
                  aria-invalid={etat?.erreurs?.cabinet_id ? true : undefined}
                  className={STYLE_SAISIE}
                >
                  <option value="">Choisir un cabinet…</option>
                  {cabinets.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
                <Erreur id={`${idCabinet}-erreur`} message={etat?.erreurs?.cabinet_id} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={idSalaries} className="text-sm font-medium">
                  Nombre de salariés<span className="text-red-600"> *</span>
                </label>
                <input
                  id={idSalaries}
                  name="nb_salaries"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  defaultValue={etat?.valeurs?.nb_salaries ?? ""}
                  aria-invalid={etat?.erreurs?.nb_salaries ? true : undefined}
                  className={STYLE_SAISIE}
                />
                <Erreur id={`${idSalaries}-erreur`} message={etat?.erreurs?.nb_salaries} />
              </div>
            </>
          )}

          <CaseACocher nom="conditions">
            J&apos;accepte les{" "}
            <Link href="/conditions" target="_blank" className="font-medium text-marque underline">
              conditions d&apos;utilisation
            </Link>
          </CaseACocher>
        </div>

        <MessageEtat etat={etat} />
        <div className="flex justify-end">
          <BoutonEnvoyer>
            {gestion === "cabinet" ? (
              <>
                <Send size={16} aria-hidden />
                {cabinet ? `Transmettre au cabinet ${cabinet.nom}` : "Transmettre au cabinet"}
              </>
            ) : (
              <>
                <Building2 size={16} aria-hidden />
                Créer mon entreprise
              </>
            )}
          </BoutonEnvoyer>
        </div>
      </form>
    </ContexteFormulaire>
  );
}
