import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { CadreAuth } from "@/components/cadre-auth";
import { Squelette } from "@/components/ui";
import { clientSupabaseAdmin } from "@/lib/supabase/admin";
import { FormulaireCreation } from "./formulaire-creation";

export const metadata: Metadata = { title: "Créer une nouvelle entreprise" };

// Page publique (depuis la connexion) : une entreprise se crée, en paie autonome ou
// en confiant sa paie à un cabinet inscrit sur DématPaie.
export default function PageNouvelleEntreprise() {
  return (
    <CadreAuth
      titre="Créer une nouvelle entreprise"
      description="Renseignez votre entreprise, puis indiquez qui fait votre paie."
      pied={
        <div className="flex flex-col gap-3">
          <p>
            Cabinet déjà inscrit ?{" "}
            <Link href="/nouvelle-entreprise/cabinet" className="font-medium text-marque hover:underline">
              Ajouter une entreprise cliente
            </Link>
          </p>
          <p>
            Déjà un compte ?{" "}
            <Link href="/connexion" className="font-medium text-marque hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      }
    >
      <Suspense fallback={<Squelette />}>
        <Formulaire />
      </Suspense>
    </CadreAuth>
  );
}

// Liste des cabinets (nom seulement), lue par le serveur : aucune fonction de la base
// n'est ouverte aux visiteurs non connectés.
async function Formulaire() {
  await connection(); // liste lue à chaque visite (jamais figée à la construction)
  const { data: cabinets } = await clientSupabaseAdmin().from("cabinets").select("id, nom").order("nom").limit(1000);
  return <FormulaireCreation cabinets={cabinets ?? []} />;
}
