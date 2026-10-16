import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, CircleCheck, FileCheck2, FileSignature, FileText, Lock, MessageCircle, Send, Trash2, Undo2, Users } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/utilisateur";
import { formaterDate } from "@/lib/abonnements/phases";
import { libellePeriode, libelleRole, salariesAttendus, STATUTS_PERIODE, type EtapeCircuit, type StatutPeriode } from "@/lib/bulletins/regles";
import { ActionEnLigne } from "@/components/formulaire";
import { Badge, Carte, classesBouton, EnTetePage, EtatVide, Page, Statistique } from "@/components/ui";
import { annulerDepot, apposerSignature, deciderEtape, publierPeriode, renvoyerAvis, retirerBulletin, soumettrePeriode, supprimerPeriode } from "../actions";
import { LIBELLES_AVIS, type StatutAvis } from "@/lib/notifications/regles-avis";
import { DecisionEtape } from "./decision-etape";
import { DepotUnique } from "./depot-bulletins";
import { ModesDepot } from "./modes-depot";

export const metadata: Metadata = { title: "Période de paie" };

const TAILLE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const taille = (octets: number) => (octets > 1024 * 1024 ? `${TAILLE.format(octets / 1024 / 1024)} Mo` : `${Math.ceil(octets / 1024)} Ko`);
const lienBulletin = (chemin: string) => `/espace/fichiers?espace=bulletins&chemin=${encodeURIComponent(chemin)}`;

export default async function PagePeriode({ params }: PageProps<"/espace/entreprises/[id]/paie/[periodeId]">) {
  const { id, periodeId } = await params;
  const { supabase } = await exigerUtilisateur();

  const [
    { data: entreprise },
    { data: periode },
    { data: salaries },
    { data: bulletins },
    { data: peutDeposer },
    { data: historique },
    { data: circuitActuel },
    { data: motifBlocage },
    { data: peutPublier },
    { data: nbValidateurs },
    { count: nbResultats },
    { data: avis },
    { data: emargements },
  ] = await Promise.all([
    supabase.from("entreprises").select("raison_sociale").eq("id", id).maybeSingle(),
    supabase
      .from("periodes_paie")
      .select("id, annee, mois, statut, circuit, etape_courante, approuvee_le, publiee_le")
      .eq("id", periodeId)
      .eq("entreprise_id", id)
      .maybeSingle(),
    supabase
      .from("salaries")
      .select("id, matricule, nom, prenoms, statut, date_embauche, date_sortie, telephone, accord_whatsapp_le")
      .eq("entreprise_id", id)
      .order("nom")
      .order("prenoms"),
    supabase
      .from("bulletins")
      .select("id, salarie_id, fichier_chemin, fichier_signe_chemin, signe_le, fichier_nom, taille, empreinte_sha256, depose_le")
      .eq("periode_id", periodeId)
      .eq("type", "normal"),
    supabase.rpc("peut_deposer_bulletins", { p_entreprise_id: id }),
    supabase
      .from("validations_periode")
      .select("id, cycle, etape, libelle_etape, action, commentaire, cree_le, auteur:profils(nom_complet)")
      .eq("periode_id", periodeId)
      .order("cree_le", { ascending: false })
      .order("etape", { ascending: false }),
    supabase.rpc("circuit_entreprise", { p_entreprise_id: id }),
    supabase.rpc("motif_blocage_validation", { p_periode_id: periodeId }),
    supabase.rpc("peut_publier", { p_entreprise_id: id }),
    supabase.rpc("nb_validateurs_possibles", { p_periode_id: periodeId }),
    supabase.from("resultats_paie").select("id", { count: "exact", head: true }).eq("periode_id", periodeId),
    supabase.from("avis_bulletins").select("bulletin_id, statut, erreur, envoye_le").eq("periode_id", periodeId).order("envoye_le"),
    supabase.from("emargements_bulletins").select("bulletin_id, emarge_le, bulletins!inner(periode_id)").eq("bulletins.periode_id", periodeId),
  ]);
  if (!entreprise || !periode) notFound();
  // Dernier avis par bulletin, et date d'émargement (premier téléchargement par le salarié)
  const avisParBulletin = new Map((avis ?? []).map((a) => [a.bulletin_id, a]));
  const emargeLe = new Map((emargements ?? []).map((e) => [e.bulletin_id, e.emarge_le as string]));

  const titre = libellePeriode(periode.annee, periode.mois);
  const statut = STATUTS_PERIODE[periode.statut as StatutPeriode];
  const modifiable = peutDeposer === true && periode.statut === "brouillon";
  // Circuit figé à l'envoi ; avant l'envoi, on montre le circuit actuel de l'entreprise.
  const circuit = ((periode.circuit ?? circuitActuel) as EtapeCircuit[] | null) ?? [];
  const etapeCourante = periode.etape_courante as number | null;
  const etapeEnCours = etapeCourante ? circuit[etapeCourante - 1] : undefined;
  const peutDecider = periode.statut === "en_validation" && motifBlocage === null;

  const parSalarie = new Map((bulletins ?? []).map((b) => [b.salarie_id, b]));
  const attendus = salariesAttendus(salaries ?? [], periode.annee, periode.mois);
  const idsAttendus = new Set(attendus.map((s) => s.id));
  // Un bulletin déposé pour un salarié hors période (ex. sorti plus tôt) reste affiché.
  const horsListe = (salaries ?? []).filter((s) => !idsAttendus.has(s.id) && parSalarie.has(s.id));
  const lignes = [...attendus, ...horsListe].sort((a, b) => Number(parSalarie.has(a.id)) - Number(parSalarie.has(b.id)));
  const manquants = attendus.filter((s) => !parSalarie.has(s.id)).length;
  const sansTelephone = (salaries ?? []).filter((s) => parSalarie.has(s.id) && !s.telephone).length;
  const sansAccord = (salaries ?? []).filter((s) => parSalarie.has(s.id) && s.telephone && !s.accord_whatsapp_le).length;
  const nbEmarges = (bulletins ?? []).filter((b) => emargeLe.has(b.id)).length;
  const nbSignes = (bulletins ?? []).filter((b) => b.fichier_signe_chemin).length;
  const compteAvis = (statuts: StatutAvis[]) => [...avisParBulletin.values()].filter((a) => statuts.includes(a.statut as StatutAvis)).length;
  // Paie refusée par un validateur : elle revient en brouillon chez qui l'a préparée
  const dernierEvenement = historique?.[0];
  const refusee = periode.statut === "brouillon" && dernierEvenement?.action === "refus";
  const auteurRefus = (dernierEvenement?.auteur as unknown as { nom_complet: string | null } | null)?.nom_complet ?? "un validateur";

  return (
    <Page>
      <EnTetePage
        titre={`Paie de ${titre}`}
        description={entreprise.raison_sociale}
        fil={[
          { href: `/espace/entreprises/${id}`, libelle: entreprise.raison_sociale },
          { href: `/espace/entreprises/${id}/paie`, libelle: "Paie et bulletins" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge teinte={statut.teinte}>{statut.libelle}</Badge>
            {modifiable && !bulletins?.length && (
              <ActionEnLigne action={supprimerPeriode.bind(null, id, periodeId)} libelle="Supprimer la période" variante="danger" />
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Statistique icone={Users} libelle="Salariés attendus" valeur={attendus.length} />
        <Statistique icone={FileCheck2} libelle="Bulletins déposés" valeur={bulletins?.length ?? 0} />
        <Statistique icone={CircleAlert} libelle="Bulletins manquants" valeur={manquants} />
      </div>

      <Link
        href={`/espace/entreprises/${id}/paie/${periodeId}/resultats`}
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bordure bg-surface px-4 py-3 text-sm shadow-[0_1px_3px_rgba(27,30,46,.05)] hover:border-marque/40"
      >
        <span>
          <strong>Résultats de paie (Excel)</strong> :{" "}
          {nbResultats ? `${nbResultats} salarié(s) importé(s)` : "aucun import pour ce mois"} — ils alimentent le livre de paie, la DTS et la DAS.
        </span>
        <span className="font-semibold text-marque">{nbResultats ? "Voir / réimporter" : "Importer"} →</span>
      </Link>

      <Carte
        titre="Circuit de validation"
        description={
          periode.statut === "brouillon"
            ? "Déposez les bulletins, puis envoyez la période en validation."
            : etapeEnCours
              ? `En attente : ${etapeEnCours.libelle} (${libelleRole(etapeEnCours.role)})`
              : periode.approuvee_le
                ? `Approuvée le ${formaterDate(periode.approuvee_le)}`
                : undefined
        }
        action={
          peutDeposer === true && periode.statut === "brouillon" ? (
            <Link href={`/espace/entreprises/${id}/paie/circuit`} className="text-sm font-medium text-marque hover:underline">
              Régler le circuit
            </Link>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-5">
          <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {circuit.map((e, i) => {
              const n = i + 1;
              const faite = periode.statut === "approuvee" || periode.statut === "publiee" || (etapeCourante !== null && n < etapeCourante);
              const enCours = etapeCourante === n;
              return (
                <li key={n} className="flex items-center gap-2">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      faite ? "bg-marque text-white" : enCours ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300" : "bg-black/[.05] text-doux"
                    }`}
                  >
                    {faite ? <CircleCheck size={16} aria-label="Validée" /> : n}
                  </span>
                  <span className="text-sm">
                    <span className="font-medium">{e.libelle}</span>
                    <span className="block text-xs text-doux">{libelleRole(e.role)}</span>
                  </span>
                  {n < circuit.length && <span className="mx-2 hidden h-px w-8 bg-bordure sm:block" aria-hidden />}
                </li>
              );
            })}
          </ol>

          {peutDeposer === true && periode.statut === "brouillon" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-black/[.03] px-3 py-2">
              <p className="text-sm text-doux">
                {bulletins?.length
                  ? `${manquants > 0 ? `Attention : ${manquants} bulletin(s) manquant(s). ` : "Tous les bulletins attendus sont déposés. "}Après l'envoi, les bulletins ne pourront plus être modifiés, sauf en cas de refus.`
                  : "Déposez au moins un bulletin avant d'envoyer la période."}
              </p>
              {!!bulletins?.length && (
                <div className="flex flex-wrap items-start gap-2">
                  <details className="group relative">
                    <summary className={`${classesBouton("danger", "petit")} cursor-pointer list-none`}>
                      <Undo2 size={14} aria-hidden />
                      Annuler le dépôt
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-bordure bg-surface p-3 text-sm shadow-xl">
                      <p className="mb-3">
                        Les <strong>{bulletins.length} bulletin(s)</strong> déposé(s) pour {titre} seront retirés. Vous pourrez les déposer à nouveau.
                      </p>
                      <ActionEnLigne action={annulerDepot.bind(null, id, periodeId)} libelle="Confirmer l'annulation" variante="danger" />
                    </div>
                  </details>
                  <ActionEnLigne action={soumettrePeriode.bind(null, periodeId)} libelle="Envoyer en validation" />
                </div>
              )}
            </div>
          )}

          {peutDecider && etapeEnCours && (
            <DecisionEtape action={deciderEtape.bind(null, periodeId)} libelleEtape={etapeEnCours.libelle} derniere={etapeCourante === circuit.length} />
          )}
          {periode.statut === "en_validation" && nbValidateurs === 0 && etapeEnCours && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                Période bloquée : personne ne peut valider l&apos;étape « {etapeEnCours.libelle} ». Attribuez le rôle «{" "}
                {libelleRole(etapeEnCours.role)} » à une personne qui n&apos;a ni préparé ni déjà validé cette paie, dans les{" "}
                <Link href={`/espace/entreprises/${id}`} className="font-semibold underline">
                  utilisateurs de l&apos;entreprise
                </Link>
                .
              </span>
            </p>
          )}
          {periode.statut === "en_validation" && !peutDecider && motifBlocage && nbValidateurs !== 0 && <p className="text-sm text-doux">{motifBlocage}</p>}

          {periode.statut === "approuvee" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-marque-claire/60 px-3 py-2">
              <p className="text-sm">
                Période approuvée. La publication rend chaque bulletin visible par son salarié dans son espace.
                {sansTelephone > 0 && (
                  <span className="mt-1 block text-amber-800">
                    {sansTelephone} salarié(s) concerné(s) n&apos;ont pas de numéro de téléphone : ajoutez-le sur leur fiche pour qu&apos;ils puissent se
                    connecter.
                  </span>
                )}
              </p>
              {peutPublier === true && <ActionEnLigne action={publierPeriode.bind(null, periodeId)} libelle="Publier aux salariés" variante="secondaire" />}
            </div>
          )}
          {periode.statut === "publiee" && periode.publiee_le && (
            <p className="flex items-center gap-2 text-sm text-marque">
              <CircleCheck size={16} aria-hidden />
              Publiée aux salariés le {formaterDate(periode.publiee_le)}.
            </p>
          )}
          {(periode.statut === "approuvee" || periode.statut === "publiee") && !!bulletins?.length && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bordure p-3 text-sm">
              <p className="flex items-center gap-2">
                <FileSignature size={16} className="text-marque" aria-hidden />
                <span>
                  <strong>Signature et cachet de l&apos;employeur</strong> : {nbSignes} bulletin(s) sur {bulletins.length} signé(s)
                  {nbSignes < bulletins.length && (
                    <>
                      {" "}
                      · réglage dans la{" "}
                      <Link href={`/espace/entreprises/${id}`} className="font-medium text-marque hover:underline">
                        fiche de l&apos;entreprise
                      </Link>
                    </>
                  )}
                </span>
              </p>
              {peutPublier === true && (
                <ActionEnLigne
                  action={apposerSignature.bind(null, id, periodeId, nbSignes === bulletins.length)}
                  libelle={nbSignes === bulletins.length ? "Signer de nouveau" : "Apposer signature et cachet"}
                  variante={nbSignes === bulletins.length ? "discret" : "secondaire"}
                />
              )}
            </div>
          )}
          {periode.statut === "publiee" && (
            <div className="flex flex-col gap-3 rounded-xl border border-bordure p-3">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p className="flex items-center gap-2">
                  <MessageCircle size={16} className="text-emerald-600" aria-hidden />
                  <span>
                    <strong>Avis WhatsApp</strong> : {compteAvis(["envoye", "recu", "lu", "simule"])} envoyé(s), dont {compteAvis(["recu", "lu"])} reçu(s) et{" "}
                    {compteAvis(["lu"])} lu(s){compteAvis(["echec"]) ? ` · ${compteAvis(["echec"])} échec(s)` : ""}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <FileSignature size={16} className="text-marque" aria-hidden />
                  <span>
                    <strong>Émargement</strong> : {nbEmarges} bulletin(s) sur {bulletins?.length ?? 0} téléchargé(s) par le salarié
                  </span>
                </p>
              </div>
              {(sansTelephone > 0 || sansAccord > 0) && (
                <p className="text-xs text-doux">
                  Non prévenus par WhatsApp : {sansTelephone} sans numéro de téléphone, {sansAccord} sans accord (à recueillir sur la fiche du salarié, ou par le
                  salarié depuis son espace).
                </p>
              )}
              {peutPublier === true && (
                <div className="flex justify-end">
                  <ActionEnLigne action={renvoyerAvis.bind(null, id, periodeId)} libelle="Envoyer l'avis aux salariés pas encore prévenus" />
                </div>
              )}
            </div>
          )}
        </div>
      </Carte>

      {refusee && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <Undo2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              Paie refusée par {auteurRefus}
              {dernierEvenement?.libelle_etape ? ` (étape « ${dernierEvenement.libelle_etape} »)` : ""}
            </p>
            {dernierEvenement?.commentaire && <p>Motif : « {dernierEvenement.commentaire} »</p>}
            <p>
              {modifiable
                ? "Elle vous revient : modifiez (« Remplacer ») ou supprimez des bulletins dans la liste ci-dessous, ou annulez tout le dépôt, puis renvoyez-la en validation."
                : "Elle est revenue à la personne qui l'a préparée, pour correction."}
            </p>
          </div>
        </div>
      )}

      {periode.statut !== "brouillon" && (
        <p className="flex items-start gap-2 rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-doux">
          <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
          {periode.statut === "en_validation"
            ? "Paie envoyée en validation : le dépôt ne peut plus être annulé ni modifié. Si un validateur la refuse, elle reviendra à la personne qui l'a préparée, qui pourra alors modifier ou supprimer les bulletins."
            : "Cette période est verrouillée : les bulletins ne peuvent plus être déposés, remplacés ni retirés."}
        </p>
      )}

      {modifiable && (
        <Carte titre="Déposer les bulletins en masse" description="Tous les bulletins du mois en une seule fois.">
          <ModesDepot
            entrepriseId={id}
            periodeId={periodeId}
            annee={periode.annee}
            mois={periode.mois}
            salaries={attendus.map((s) => ({ id: s.id, matricule: s.matricule, nom: s.nom, prenoms: s.prenoms, aBulletin: parSalarie.has(s.id) }))}
          />
        </Carte>
      )}

      <Carte titre="Bulletins par salarié" description="Les salariés sans bulletin apparaissent en premier." sansMarge>
        {lignes.length === 0 ? (
          <EtatVide icone={Users} titre="Aucun salarié attendu" texte={`Aucun salarié n'est en poste en ${titre}.`} />
        ) : (
          <ul className="divide-y divide-bordure">
            {lignes.map((s) => {
              const b = parSalarie.get(s.id);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <FileText size={20} className={`shrink-0 ${b ? "text-marque" : "text-doux"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {s.nom} {s.prenoms} <span className="font-normal text-doux">· {s.matricule}</span>
                    </p>
                    {b ? (
                      <p className="truncate text-sm text-doux">
                        <a href={lienBulletin(b.fichier_signe_chemin ?? b.fichier_chemin)} target="_blank" rel="noopener" className="text-marque hover:underline">
                          {b.fichier_nom}
                        </a>{" "}
                        · {taille(b.taille)} · déposé le {formaterDate(b.depose_le)} ·{" "}
                        <span title={`Empreinte SHA-256 : ${b.empreinte_sha256}`}>empreinte {b.empreinte_sha256.slice(0, 8)}…</span>
                      </p>
                    ) : (
                      <p className="text-sm text-doux">Aucun bulletin</p>
                    )}
                  </div>
                  {!b && <Badge teinte="ambre">Manquant</Badge>}
                  {b && !idsAttendus.has(s.id) && <Badge>Hors période</Badge>}
                  {b?.fichier_signe_chemin && <Badge teinte="bleu">Signé par l&apos;employeur</Badge>}
                  {b && periode.statut === "publiee" && (
                    <div className="flex flex-wrap items-center gap-2">
                      {avisParBulletin.has(b.id) && (
                        <Badge teinte={avisParBulletin.get(b.id)!.statut === "echec" ? "rouge" : "bleu"}>
                          WhatsApp : {LIBELLES_AVIS[avisParBulletin.get(b.id)!.statut as StatutAvis]}
                        </Badge>
                      )}
                      {emargeLe.has(b.id) ? <Badge teinte="vert">Émargé le {formaterDate(emargeLe.get(b.id)!)}</Badge> : <Badge>Non émargé</Badge>}
                      <a
                        href={`/espace/entreprises/${id}/paie/${periodeId}/emarge/${b.id}`}
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-medium text-marque hover:underline"
                        title="Exemplaire employeur avec la mention d'émargement"
                      >
                        Exemplaire émargé
                      </a>
                    </div>
                  )}
                  {modifiable && (
                    <div className="flex items-start gap-2">
                      <DepotUnique entrepriseId={id} periodeId={periodeId} salarieId={s.id} libelle={b ? "Remplacer" : "Déposer"} />
                      {b && (
                        <form action={retirerBulletin.bind(null, id, b.id)}>
                          <button type="submit" className={classesBouton("danger", "petit")} aria-label={`Retirer le bulletin de ${s.nom} ${s.prenoms}`} title="Retirer">
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {!!historique?.length && (
        <Carte titre="Historique de validation" sansMarge>
          <ul className="divide-y divide-bordure">
            {historique.map((h) => {
              const Icone = h.action === "refus" ? Undo2 : h.action === "soumission" ? Send : CircleCheck;
              const auteur = (h.auteur as unknown as { nom_complet: string | null } | null)?.nom_complet ?? "Utilisateur";
              const heure = new Date(h.cree_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Libreville" });
              return (
                <li key={h.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <Icone size={18} className={`mt-0.5 shrink-0 ${h.action === "refus" ? "text-red-600" : "text-marque"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">
                        {h.action === "soumission" ? "Envoi en validation" : `${h.action === "refus" ? "Refus" : "Validation"} : ${h.libelle_etape}`}
                      </span>{" "}
                      <span className="text-doux">
                        par {auteur}, le {formaterDate(h.cree_le)} à {heure}
                      </span>
                    </p>
                    {h.commentaire && <p className="mt-1 rounded-lg bg-black/[.03] px-3 py-2 text-sm">{h.commentaire}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Carte>
      )}
    </Page>
  );
}
