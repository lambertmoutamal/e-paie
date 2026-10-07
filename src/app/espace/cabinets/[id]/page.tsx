import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { champLie } from "@/lib/supabase/relations";
import { Champ, Formulaire } from "@/components/formulaire";
import { Carte, Chargement, EnTete, PageEspace, Section, Vide } from "@/components/mise-en-page";
import { ajouterAdministrateur } from "../actions";

export const metadata: Metadata = { title: "Cabinet" };

export default function PageCabinet({ params }: PageProps<"/espace/cabinets/[id]">) {
  return (
    <PageEspace>
      <Suspense fallback={<Chargement />}>
        <DetailCabinet params={params} />
      </Suspense>
    </PageEspace>
  );
}

async function DetailCabinet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigerUtilisateur();

  // La RLS ne renvoie le cabinet qu'à l'admin plateforme et aux admins de ce cabinet.
  const { data: cabinet } = await supabase
    .from("cabinets")
    .select("id, nom, nif, telephone, email, adresse")
    .eq("id", id)
    .maybeSingle();
  if (!cabinet) notFound();

  const [{ data: admins }, { data: entreprises }] = await Promise.all([
    supabase.from("membres_cabinet").select("profil_id, profils(nom_complet, email)").eq("cabinet_id", id),
    supabase.from("entreprises").select("id, raison_sociale, statut").eq("cabinet_id", id).order("raison_sociale"),
  ]);

  return (
    <>
      <EnTete
        titre={cabinet.nom}
        retour={{ href: "/espace", libelle: "Mon espace" }}
        sousTitre={[cabinet.nif && `NIF ${cabinet.nif}`, cabinet.telephone, cabinet.email].filter(Boolean).join(" · ")}
      />

      <Section titre="Entreprises clientes">
        {!entreprises?.length ? (
          <Vide>Aucune entreprise rattachée à ce cabinet.</Vide>
        ) : (
          <ul className="flex flex-col gap-2">
            {entreprises.map((e) => (
              <li key={e.id}>
                <Link href={`/espace/entreprises/${e.id}`} className="block rounded-xl border border-black/10 bg-white p-4">
                  <p className="font-semibold">{e.raison_sociale}</p>
                  {e.statut === "archivee" && <p className="text-sm text-foreground/60">Archivée</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/espace/entreprises/nouvelle?cabinet=${cabinet.id}`}
          className="self-start rounded-lg bg-marque px-4 py-2 text-sm font-semibold text-white"
        >
          + Nouvelle entreprise
        </Link>
      </Section>

      <Section titre="Administrateurs du cabinet">
        {!admins?.length ? (
          <Vide>Aucun administrateur.</Vide>
        ) : (
          <ul className="flex flex-col gap-2">
            {admins.map((a) => (
              <li key={a.profil_id}>
                <Carte>
                  <p className="font-medium">{champLie(a.profils, "nom_complet")}</p>
                  <p className="text-sm text-foreground/70">{champLie(a.profils, "email")}</p>
                </Carte>
              </li>
            ))}
          </ul>
        )}
        <Carte>
          <Formulaire action={ajouterAdministrateur.bind(null, cabinet.id)} libelleBouton="Ajouter l'administrateur">
            <Champ nom="nom_complet" libelle="Nom complet" requis />
            <Champ nom="email" libelle="Email" type="email" requis />
          </Formulaire>
        </Carte>
      </Section>
    </>
  );
}
