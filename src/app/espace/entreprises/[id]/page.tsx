import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libelleRole } from "@/lib/auth/roles";
import { champLie } from "@/lib/supabase/relations";
import { ROLES_ENTREPRISE } from "@/lib/validation/schemas";
import { Champ, ChoixListe, Formulaire } from "@/components/formulaire";
import { Carte, Chargement, EnTete, PageEspace, Section, Vide } from "@/components/mise-en-page";
import { ajouterUtilisateur, changerAcces, modifierEntreprise } from "../actions";
import { ChampsEntreprise } from "../champs-entreprise";

export const metadata: Metadata = { title: "Entreprise" };

export default function PageEntreprise({ params }: PageProps<"/espace/entreprises/[id]">) {
  return (
    <PageEspace>
      <Suspense fallback={<Chargement />}>
        <DetailEntreprise params={params} />
      </Suspense>
    </PageEspace>
  );
}

async function DetailEntreprise({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigerUtilisateur();

  // La RLS ne renvoie l'entreprise qu'aux personnes qui y ont accès.
  const { data: entreprise } = await supabase
    .from("entreprises")
    .select("id, raison_sociale, nif, rccm, numero_cnss, adresse, telephone, email, mode, statut, cabinets(nom)")
    .eq("id", id)
    .maybeSingle();
  if (!entreprise) notFound();

  const [{ data: gere }, { data: affectations }] = await Promise.all([
    supabase.rpc("peut_gerer_entreprise", { p_entreprise_id: id }),
    supabase
      .from("affectations")
      .select("profil_id, role, actif, profils(nom_complet, email)")
      .eq("entreprise_id", id)
      .order("actif", { ascending: false }),
  ]);
  const peutGerer = gere === true;

  return (
    <>
      <EnTete
        titre={entreprise.raison_sociale}
        retour={{ href: "/espace/entreprises", libelle: "Entreprises" }}
        sousTitre={entreprise.cabinets ? `Cabinet : ${champLie(entreprise.cabinets, "nom")}` : "Sans cabinet"}
      />

      <Section titre="Utilisateurs et rôles">
        {!affectations?.length ? (
          <Vide>Personne n&apos;est encore affecté à cette entreprise.</Vide>
        ) : (
          <ul className="flex flex-col gap-2">
            {affectations.map((a) => (
              <li key={`${a.profil_id}-${a.role}`}>
                <Carte>
                  <div className="flex items-start justify-between gap-3">
                    <div className={a.actif ? "" : "opacity-50"}>
                      <p className="font-medium">{champLie(a.profils, "nom_complet")}</p>
                      <p className="text-sm text-foreground/70">{champLie(a.profils, "email")}</p>
                      <p className="mt-1 text-sm">
                        {libelleRole(a.role)}
                        {!a.actif && " · accès retiré"}
                      </p>
                    </div>
                    {peutGerer && (
                      <form action={changerAcces.bind(null, id, a.profil_id, a.role, !a.actif)}>
                        <button type="submit" className="rounded-lg border border-black/20 px-3 py-1 text-sm">
                          {a.actif ? "Retirer" : "Rétablir"}
                        </button>
                      </form>
                    )}
                  </div>
                </Carte>
              </li>
            ))}
          </ul>
        )}

        {peutGerer && (
          <div className="rounded-xl border-2 border-marque/40 bg-white p-4">
            <p className="mb-1 font-semibold">Ajouter une personne à {entreprise.raison_sociale}</p>
            <p className="mb-3 text-sm text-foreground/70">
              Un compte est créé avec un mot de passe provisoire, affiché une seule fois.
            </p>
            <Formulaire action={ajouterUtilisateur.bind(null, id)} libelleBouton="Ajouter la personne">
              <Champ nom="nom_complet" libelle="Nom complet de la personne" requis />
              <Champ
                nom="email"
                libelle="Email de la personne"
                type="email"
                requis
                aide="Si la personne a déjà un compte (autre entreprise), elle est simplement ajoutée."
              />
              <ChoixListe
                nom="role"
                libelle="Rôle"
                requis
                options={ROLES_ENTREPRISE.map((r) => ({ valeur: r, libelle: libelleRole(r) }))}
              />
            </Formulaire>
          </div>
        )}
      </Section>

      <Section titre="Fiche entreprise">
        <Carte>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {[
              ["NIF", entreprise.nif],
              ["RCCM", entreprise.rccm],
              ["N° CNSS", entreprise.numero_cnss],
              ["Adresse", entreprise.adresse],
              ["Téléphone", entreprise.telephone],
              ["Email de l'entreprise", entreprise.email],
              ["Mode", entreprise.mode === "autonome" ? "Autonome" : "Cabinet"],
            ].map(([libelle, valeur]) => (
              <div key={libelle}>
                <dt className="text-foreground/60">{libelle}</dt>
                <dd className="font-medium">{valeur || "—"}</dd>
              </div>
            ))}
          </dl>
        </Carte>
        {peutGerer && (
          // Formulaire replié par défaut : il ne se confond pas avec l'ajout d'une personne.
          <details className="rounded-xl border border-black/10 bg-white p-4">
            <summary className="cursor-pointer font-medium text-marque">Modifier la fiche</summary>
            <div className="mt-4">
              <Formulaire action={modifierEntreprise.bind(null, id)} libelleBouton="Enregistrer la fiche">
                <ChampsEntreprise fiche={entreprise} />
              </Formulaire>
            </div>
          </details>
        )}
        <p className="text-xs text-foreground/60">
          Logo, cachet et signature numérisés : ajout prévu avec le dépôt des fichiers (étape 7).
        </p>
      </Section>
    </>
  );
}
