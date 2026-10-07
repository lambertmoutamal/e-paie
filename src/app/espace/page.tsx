import type { Metadata } from "next";
import { Briefcase, Building2, Plus, ShieldCheck, Users } from "lucide-react";
import { droitsUtilisateur, exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libelleRole } from "@/lib/auth/roles";
import { champLie } from "@/lib/supabase/relations";
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

      {administrateur && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {adminPlateforme && <Statistique icone={Building2} libelle="Cabinets" valeur={nbCabinets} href="/espace/cabinets" />}
          <Statistique icone={Briefcase} libelle="Entreprises" valeur={nbEntreprises} href="/espace/entreprises" />
          <Statistique icone={Users} libelle="Utilisateurs" valeur={nbUtilisateurs} />
        </div>
      )}

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
