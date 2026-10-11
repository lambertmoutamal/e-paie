import type { Metadata } from "next";
import { Briefcase, Building2, Plus, ShieldCheck, Users } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libelleRole } from "@/lib/auth/roles";
import { champLie } from "@/lib/supabase/relations";
import { MODULES } from "@/lib/modules";
import { CarteModule } from "@/components/carte-module";
import { CarteEcheances, type Echeance } from "@/components/echeances";
import { CarteActionsPaie } from "@/components/actions-paie";
import { mesActionsPaie } from "@/lib/bulletins/actions-a-faire";
import { Badge, Carte, EnTetePage, EtatVide, LienBouton, Ligne, ListeLignes, Page, Statistique } from "@/components/ui";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function TableauDeBord() {
  const { supabase } = await exigerUtilisateur();
  const { profil, adminPlateforme, cabinets, affectations } = await droitsUtilisateur();
  const administrateur = adminPlateforme || cabinets.length > 0;

  // Compteurs : la RLS limite automatiquement au périmètre de la personne.
  const [nbCabinets, nbEntreprises, nbUtilisateurs] = administrateur
    ? await Promise.all([
        supabase.from("cabinets").select("id", { count: "exact", head: true }),
        supabase.from("entreprises").select("id", { count: "exact", head: true }),
        supabase.from("profils").select("id", { count: "exact", head: true }),
      ]).then((r) => r.map((x) => x.count ?? 0))
    : [0, 0, 0];
  // Fins de contrat et de période d'essai à venir (la base limite aux entreprises accessibles)
  const { data: echeancesBrutes } = await supabase.rpc("echeances_contrats", { p_jours: 30 });
  const echeances = (echeancesBrutes ?? []) as Echeance[];
  const actionsPaie = await mesActionsPaie();

  const prenom = (profil?.nom_complet || "").split(" ")[0];
  const acces = [
    ...(adminPlateforme
      ? [{ cle: "plateforme", role: "admin_plateforme", perimetre: "Toute la plateforme", href: undefined, icone: ShieldCheck }]
      : []),
    ...cabinets.map((m) => ({
      cle: `cabinet-${m.cabinet_id}`,
      role: m.role,
      perimetre: champLie(m.cabinets, "nom"),
      href: `/espace/cabinets/${m.cabinet_id}`,
      icone: Building2,
    })),
    ...affectations.map((a) => ({
      cle: `entreprise-${a.entreprise_id}-${a.role}`,
      role: a.role,
      perimetre: champLie(a.entreprises, "raison_sociale"),
      href: `/espace/entreprises/${a.entreprise_id}`,
      icone: Briefcase,
    })),
  ];

  return (
    <Page>
      <EnTetePage
        titre={prenom ? `Bonjour ${prenom}` : "Bonjour"}
        description="Bienvenue sur votre espace e-Paie."
        actions={
          administrateur && (
            <>
              {adminPlateforme && (
                <LienBouton href="/espace/cabinets#nouveau" variante="secondaire" icone={Plus}>
                  Nouveau cabinet
                </LienBouton>
              )}
              <LienBouton href="/espace/entreprises/nouvelle" icone={Plus}>
                Nouvelle entreprise
              </LienBouton>
            </>
          )
        }
      />

      {actionsPaie.length > 0 && <CarteActionsPaie actions={actionsPaie} />}

      {administrateur && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {adminPlateforme && <Statistique icone={Building2} libelle="Cabinets" valeur={nbCabinets} href="/espace/cabinets" />}
          <Statistique icone={Briefcase} libelle="Entreprises" valeur={nbEntreprises} href="/espace/entreprises" />
          <Statistique icone={Users} libelle="Utilisateurs" valeur={nbUtilisateurs} />
        </div>
      )}

      {acces.length > 0 && (
        <section aria-labelledby="titre-modules" className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-2">
            <h2 id="titre-modules" className="text-lg font-semibold">
              Modules
            </h2>
            <LienBouton href="/espace/modules" variante="discret" taille="petit">
              Tous les modules
            </LienBouton>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.slice(0, 3).map((m) => (
              <CarteModule key={m.id} module={m} href={`/espace/modules/${m.id}`} />
            ))}
          </div>
        </section>
      )}

      {echeances.length > 0 && <CarteEcheances echeances={echeances.slice(0, 8)} avecEntreprise />}

      <Carte titre="Mes accès" description="Les espaces sur lesquels vous pouvez intervenir." sansMarge>
        {acces.length === 0 ? (
          <EtatVide
            icone={Briefcase}
            titre="Aucun accès pour le moment"
            texte="Votre administrateur doit vous affecter à une entreprise."
          />
        ) : (
          <ListeLignes>
            {acces.map((a) => (
              <Ligne
                key={a.cle}
                href={a.href}
                icone={a.icone}
                titre={a.perimetre}
                fin={<Badge teinte={a.role.startsWith("admin") ? "vert" : "bleu"}>{libelleRole(a.role)}</Badge>}
              />
            ))}
          </ListeLignes>
        )}
      </Carte>
    </Page>
  );
}
