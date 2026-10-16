import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { libellePeriode } from "@/lib/bulletins/regles";
import { enLettres } from "@/lib/paie/lettres";
import { exigerEntrepriseCourante } from "@/lib/entreprise-courante";
import { Page } from "@/components/ui";
import { BoutonImprimer } from "../../boutons-export";

export const metadata: Metadata = { title: "Reçu pour solde de tout compte" };

const MONTANT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (d: string | null) => (d ? d.split("-").reverse().join("/") : "……………");

// Reçu pour solde de tout compte, prêt à imprimer et à faire signer. Les montants
// viennent des résultats de paie importés pour le mois de sortie.
export default async function PageRecu({ params, searchParams }: PageProps<"/espace/etats/[etat]/recu">) {
  const { etat } = await params;
  const { entreprise: entrepriseId, salarie: salarieId, mois } = await searchParams;
  if (etat !== "solde-tout-compte") notFound();
  if (typeof entrepriseId !== "string" || !UUID.test(entrepriseId) || typeof salarieId !== "string" || !UUID.test(salarieId)) notFound();
  if (typeof mois !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) notFound();
  const annee = Number(mois.slice(0, 4));
  const numeroMois = Number(mois.slice(5, 7));

  const { supabase } = await exigerUtilisateur();
  // Une seule entreprise à la fois : le reçu doit concerner l'entreprise de travail
  if ((await exigerEntrepriseCourante()).id !== entrepriseId) notFound();
  const [{ data: entreprise }, { data: salarie }, { data: periode }] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale, adresse, nif, numero_cnss").eq("id", entrepriseId).maybeSingle(),
    supabase.from("salaries").select("matricule, nom, prenoms, poste, date_embauche, date_sortie, motif_sortie").eq("id", salarieId).eq("entreprise_id", entrepriseId).maybeSingle(),
    supabase.from("periodes_paie").select("id").eq("entreprise_id", entrepriseId).eq("annee", annee).eq("mois", numeroMois).maybeSingle(),
  ]);
  if (!entreprise || !salarie || !periode) notFound();
  const { data: r } = await supabase
    .from("resultats_paie")
    .select("brut, cnss_salarie, cnamgs_salarie, impot_revenu, autres_retenues, net_a_payer, rubriques")
    .eq("periode_id", periode.id)
    .eq("salarie_id", salarieId)
    .maybeSingle();
  if (!r || r.net_a_payer === null) notFound();

  const net = Number(r.net_a_payer);
  const nomComplet = `${salarie.nom} ${salarie.prenoms}`;
  const detail: [string, number | null][] = [
    ...Object.entries((r.rubriques ?? {}) as Record<string, number>).map(([k, v]) => [k, Number(v)] as [string, number]),
    ["Salaire brut", r.brut === null ? null : Number(r.brut)],
    ["Retenue CNSS", r.cnss_salarie === null ? null : -Number(r.cnss_salarie)],
    ["Retenue CNAMGS", r.cnamgs_salarie === null ? null : -Number(r.cnamgs_salarie)],
    ["IRPP / ITS", r.impot_revenu === null ? null : -Number(r.impot_revenu)],
    ["Autres retenues", r.autres_retenues === null ? null : -Number(r.autres_retenues)],
  ];

  return (
    <Page>
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/espace/etats/solde-tout-compte?entreprise=${entrepriseId}&mois=${mois}`} className="inline-flex items-center gap-1 text-sm font-medium text-marque hover:underline">
          <ChevronLeft size={16} aria-hidden />
          Soldes de tout compte
        </Link>
        <BoutonImprimer libelle="Imprimer le reçu" />
      </div>

      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-bordure bg-white p-8 text-[15px] leading-relaxed text-black print:max-w-none print:border-0 print:p-0">
        <header className="text-sm">
          <p className="text-base font-bold">{entreprise.raison_sociale}</p>
          {entreprise.adresse && <p>{entreprise.adresse}</p>}
          <p>
            {entreprise.nif && `NIF : ${entreprise.nif}`}
            {entreprise.nif && entreprise.numero_cnss && " · "}
            {entreprise.numero_cnss && `N° CNSS employeur : ${entreprise.numero_cnss}`}
          </p>
        </header>

        <h1 className="text-center text-xl font-bold uppercase tracking-wide">Reçu pour solde de tout compte</h1>

        <p>
          Je soussigné(e) <strong>{nomComplet}</strong>, matricule <strong>{salarie.matricule}</strong>
          {salarie.poste ? `, ${salarie.poste}` : ""}, employé(e) du {date(salarie.date_embauche)} au {date(salarie.date_sortie)}
          {salarie.motif_sortie ? ` (motif : ${salarie.motif_sortie})` : ""}, reconnais avoir reçu de <strong>{entreprise.raison_sociale}</strong> la somme de{" "}
          <strong>{MONTANT.format(net)} FCFA</strong> ({enLettres(net)} francs CFA), en paiement des salaires, accessoires du salaire et indemnités de toute nature dus au titre de
          l&apos;exécution et de la cessation de mon contrat de travail.
        </p>

        <table className="w-full border-collapse text-sm">
          <caption className="mb-2 text-left font-semibold">Détail des sommes versées — paie de {libellePeriode(annee, numeroMois).toLowerCase()}</caption>
          <tbody>
            {detail
              .filter(([, v]) => v !== null && v !== 0)
              .map(([libelle, v]) => (
                <tr key={libelle} className="border-b border-gray-200">
                  <td className="py-1.5">{libelle}</td>
                  <td className="py-1.5 text-right tabular-nums">{MONTANT.format(v as number)}</td>
                </tr>
              ))}
            <tr className="border-t-2 border-black font-bold">
              <td className="py-2">Net versé</td>
              <td className="py-2 text-right tabular-nums">{MONTANT.format(net)} FCFA</td>
            </tr>
          </tbody>
        </table>

        <p className="text-sm">Le présent reçu est établi en deux exemplaires, dont un est remis au salarié.</p>
        <p>Fait à ……………………………, le ……………………………</p>

        <div className="grid grid-cols-2 gap-8 pt-2 text-sm">
          <div>
            <p className="font-semibold">Le salarié</p>
            <p className="italic text-gray-600">« Lu et approuvé, pour solde de tout compte »</p>
            <div className="mt-2 h-24 border-b border-dashed border-gray-400" />
          </div>
          <div>
            <p className="font-semibold">L&apos;employeur</p>
            <p className="italic text-gray-600">Nom, qualité, signature et cachet</p>
            <div className="mt-2 h-24 border-b border-dashed border-gray-400" />
          </div>
        </div>
      </article>
    </Page>
  );
}
