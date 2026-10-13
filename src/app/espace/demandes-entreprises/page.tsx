import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Inbox, Mail, Phone, Users } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { ActionEnLigne, Formulaire, ZoneTexte } from "@/components/formulaire";
import { Badge, Carte, EnTetePage, EtatVide, Page } from "@/components/ui";
import { accepterDemande, demanderInformations, refuserDemande } from "./actions";

export const metadata: Metadata = { title: "Demandes d'entreprises" };

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Libreville" });

type Demande = {
  id: string;
  raison_sociale: string;
  nif: string | null;
  rccm: string | null;
  numero_cnss: string | null;
  numero_cnamgs: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  nb_salaries: number;
  contact_nom: string;
  contact_email: string;
  contact_telephone: string | null;
  statut: "en_attente" | "acceptee" | "refusee";
  entreprise_id: string | null;
  informations_demandees_le: string | null;
  traitee_le: string | null;
  cree_le: string;
  cabinets: unknown;
};

// Entreprises qui souhaitent confier leur paie au cabinet : accepter, refuser ou
// demander des informations par email. La base ne montre que les demandes du cabinet.
export default async function PageDemandesEntreprises() {
  const { supabase } = await exigerUtilisateur();
  const { data } = await supabase
    .from("demandes_entreprise")
    .select("*, cabinets(nom)")
    .order("cree_le", { ascending: false })
    .limit(200);
  const demandes = (data ?? []) as Demande[];
  const enAttente = demandes.filter((d) => d.statut === "en_attente");
  const traitees = demandes.filter((d) => d.statut !== "en_attente");

  return (
    <Page>
      <EnTetePage titre="Demandes d'entreprises" description="Entreprises qui souhaitent confier leur paie à votre cabinet." />

      {!enAttente.length ? (
        <Carte>
          <EtatVide icone={Inbox} titre="Aucune demande en attente" texte="Les entreprises qui choisissent votre cabinet sur DématPaie apparaîtront ici." />
        </Carte>
      ) : (
        enAttente.map((d) => (
          <Carte key={d.id} titre={d.raison_sociale} description={`Reçue le ${DATE.format(new Date(d.cree_le))} · Cabinet ${(d.cabinets as { nom?: string } | null)?.nom ?? ""}`}>
            <div className="flex flex-col gap-5">
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Info icone={Users} libelle="Nombre de salariés" valeur={String(d.nb_salaries)} />
                <Info icone={Building2} libelle="NIF / RCCM" valeur={[d.nif, d.rccm].filter(Boolean).join(" · ") || "—"} />
                <Info libelle="N° CNSS employeur" valeur={d.numero_cnss ?? "—"} />
                <Info libelle="N° CNAMGS employeur" valeur={d.numero_cnamgs ?? "—"} />
                <Info libelle="Adresse" valeur={d.adresse ?? "—"} />
                <Info libelle="Téléphone / email de l'entreprise" valeur={[d.telephone, d.email].filter(Boolean).join(" · ") || "—"} />
                <Info icone={Mail} libelle="Contact" valeur={`${d.contact_nom} · ${d.contact_email}`} />
                <Info icone={Phone} libelle="Téléphone du contact" valeur={d.contact_telephone ?? "—"} />
              </dl>
              {d.informations_demandees_le && (
                <p className="text-sm text-doux">Informations demandées le {DATE.format(new Date(d.informations_demandees_le))}.</p>
              )}
              <div className="flex flex-wrap items-start gap-3">
                <ActionEnLigne action={accepterDemande.bind(null, d.id)} libelle="Accepter et créer l'entreprise" />
                <ActionEnLigne action={refuserDemande.bind(null, d.id)} libelle="Refuser" variante="danger" />
              </div>
              <details className="rounded-xl border border-bordure">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Demander des informations à l&apos;entreprise (email)</summary>
                <div className="border-t border-bordure p-4">
                  <Formulaire action={demanderInformations.bind(null, d.id)} libelleBouton="Envoyer l'email">
                    <ZoneTexte nom="message" libelle={`Votre message à ${d.contact_nom}`} aide="L'entreprise vous répondra directement à votre adresse email." />
                  </Formulaire>
                </div>
              </details>
            </div>
          </Carte>
        ))
      )}

      {!!traitees.length && (
        <Carte titre="Demandes traitées" sansMarge>
          <ul className="divide-y divide-bordure text-sm">
            {traitees.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                <span>
                  <span className="font-semibold">{d.raison_sociale}</span>
                  <span className="text-doux"> · {d.nb_salaries} salarié(s){d.traitee_le ? ` · ${DATE.format(new Date(d.traitee_le))}` : ""}</span>
                </span>
                <span className="flex items-center gap-3">
                  {d.statut === "acceptee" ? <Badge teinte="vert">Acceptée</Badge> : <Badge teinte="rouge">Refusée</Badge>}
                  {d.entreprise_id && (
                    <Link href={`/espace/entreprises/${d.entreprise_id}`} className="font-medium text-marque hover:underline">
                      Ouvrir
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </Page>
  );
}

function Info({ icone: Icone, libelle, valeur }: { icone?: typeof Users; libelle: string; valeur: string }) {
  return (
    <div className="flex items-start gap-2">
      {Icone && <Icone size={15} className="mt-0.5 shrink-0 text-doux" aria-hidden />}
      <div>
        <dt className="text-xs text-doux">{libelle}</dt>
        <dd className="font-medium">{valeur}</dd>
      </div>
    </div>
  );
}
