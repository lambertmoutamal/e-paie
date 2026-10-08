"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, LoaderCircle, Smartphone } from "lucide-react";
import { estTermine, type StatutPaiement } from "@/lib/paiement/regles";

const INTERVALLE_MS = 5_000;
const DUREE_MAX_MS = 5 * 60_000;

// Suit un paiement en cours : vérifie son état toutes les 5 secondes pendant
// que le client valide la demande sur son téléphone, puis rafraîchit la page.
export function SuiviPaiement({
  paiementId,
  statutInitial,
  verifier,
}: {
  paiementId: string;
  statutInitial: StatutPaiement;
  verifier: (id: string) => Promise<StatutPaiement | null>;
}) {
  const router = useRouter();
  const [statut, setStatut] = useState<StatutPaiement>(statutInitial);
  const [delaiDepasse, setDelaiDepasse] = useState(false);

  useEffect(() => {
    if (estTermine(statut)) return;
    const debut = Date.now();
    const minuterie = setInterval(async () => {
      if (Date.now() - debut > DUREE_MAX_MS) {
        clearInterval(minuterie);
        setDelaiDepasse(true);
        return;
      }
      const nouveau = await verifier(paiementId);
      if (nouveau && nouveau !== statut) {
        setStatut(nouveau);
        if (estTermine(nouveau)) {
          clearInterval(minuterie);
          router.refresh();
        }
      }
    }, INTERVALLE_MS);
    return () => clearInterval(minuterie);
  }, [paiementId, statut, verifier, router]);

  if (statut === "reussi") {
    return (
      <p role="status" className="flex items-center gap-2 rounded-lg border border-marque/20 bg-marque-claire px-4 py-3 text-sm text-marque-fonce">
        <CircleCheck size={18} aria-hidden /> Paiement reçu, merci ! Votre abonnement est actif.
      </p>
    );
  }
  if (estTermine(statut)) {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <CircleX size={18} aria-hidden /> Le paiement n&apos;a pas abouti (refusé, annulé ou expiré). Vous pouvez réessayer ci-dessous.
      </p>
    );
  }
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <Smartphone size={20} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Validez le paiement sur votre téléphone</p>
        <p>
          Une demande de paiement vient d&apos;être envoyée sur votre numéro Mobile Money. Confirmez-la avec votre code
          secret.
        </p>
        <p className="mt-1 flex items-center gap-1 text-sky-700">
          {delaiDepasse ? (
            "Toujours en attente : rechargez la page dans un instant pour vérifier."
          ) : (
            <>
              <LoaderCircle size={14} className="animate-spin" aria-hidden /> En attente de votre confirmation…
            </>
          )}
        </p>
      </div>
    </div>
  );
}
