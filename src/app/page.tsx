import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CircleCheck,
  FileLock2,
  Fingerprint,
  Lock,
  Send,
  Upload,
  UserCheck,
  History,
  KeyRound,
  Layers,
  LogIn,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
} from "lucide-react";
import { MODULES } from "@/lib/modules";
import { ICONES_MODULES } from "@/components/icone-module";
import { Badge, classesBouton } from "@/components/ui";
import { PagePublique, TitreSection } from "@/components/vitrine";
import { TARIFS, formaterPrix } from "@/lib/abonnements/tarifs";

// Garanties réelles de la plateforme (aucun chiffre ni témoignage inventé).
const GARANTIES = [
  { icone: Layers, titre: "Un espace isolé par entreprise", texte: "Aucune donnée n'est visible d'une entreprise à l'autre." },
  { icone: History, titre: "Journal d'audit infalsifiable", texte: "Qui a fait quoi, et quand, pour chaque action." },
  { icone: ShieldCheck, titre: "Hébergement sécurisé en Europe", texte: "Connexions chiffrées, accès strictement contrôlés." },
  { icone: Smartphone, titre: "Pensé pour le téléphone", texte: "Léger, utilisable même avec une connexion faible." },
];

const ETAPES_BULLETIN = [
  { icone: Upload, titre: "Bulletin déposé", texte: "Le gestionnaire dépose les bulletins de la période." },
  { icone: UserCheck, titre: "Validé", texte: "Contrôle puis approbation, par des personnes différentes." },
  { icone: Fingerprint, titre: "Verrouillé, avec empreinte", texte: "La version publiée ne peut plus être modifiée sans que cela se voie." },
  { icone: Send, titre: "Publié", texte: "Le salarié le consulte sur son téléphone." },
];

const PUBLICS = [
  {
    icone: Building2,
    titre: "Cabinets comptables",
    points: ["Toutes vos entreprises clientes dans un seul espace", "Rôles par client : gestionnaire, contrôleur, signataire", "Circuit de validation avant publication"],
    lien: { href: "/experts-comptables", libelle: "L'offre cabinets" },
  },
  {
    icone: Briefcase,
    titre: "Entreprises",
    points: ["Dossiers salariés à jour, import depuis Excel", "Paie en autonomie ou confiée à votre cabinet", "Fini l'impression et la distribution des bulletins"],
    lien: { href: "/inscription?type=entreprise", libelle: "Essayer gratuitement" },
  },
  {
    icone: UserRound,
    titre: "Salariés",
    points: ["Bulletins consultables à tout moment", "Demandes de congé et réclamations en ligne", "Connexion simple par numéro de téléphone"],
    lien: null,
  },
];

const SECURITE = [
  { icone: Layers, titre: "Isolation contrôlée par la base de données", texte: "Les règles d'accès sont appliquées par la base elle-même : même une erreur dans l'application ne peut pas exposer les données d'une autre entreprise. Des tests automatiques le vérifient à chaque évolution." },
  { icone: History, titre: "Traçabilité complète", texte: "Chaque création, modification ou suppression est enregistrée avec son auteur. Le journal ne peut être modifié par personne, et toute falsification est détectable." },
  { icone: KeyRound, titre: "Accès maîtrisés", texte: "Comptes créés par invitation email, rôles distincts, séparation des tâches : personne ne valide sa propre saisie." },
  { icone: FileLock2, titre: "Documents protégés", texte: "Les bulletins sont stockés dans un espace privé et ne sont accessibles qu'au salarié concerné et aux personnes habilitées." },
];

const QUESTIONS = [
  { q: "Faut-il installer un logiciel ?", r: "Non. DématPaie fonctionne dans le navigateur, sur ordinateur comme sur téléphone. Rien à installer, rien à mettre à jour." },
  { q: "Comment se passe l'essai gratuit ?", r: "Vous créez votre compte en quelques minutes : un mois (30 jours) d'accès complet, sans engagement et sans moyen de paiement. Vous choisissez ensuite de souscrire ou non." },
  { q: "Puis-je importer mes salariés existants ?", r: "Oui, depuis un fichier Excel. Un modèle est fourni et chaque ligne est vérifiée avant l'import." },
  { q: "Mes salariés doivent-ils avoir un smartphone ?", r: "Le portail salarié est conçu pour le téléphone, mais il fonctionne aussi sur ordinateur. La connexion se fait par numéro de téléphone." },
  { q: "Comment payer l'abonnement ?", r: "Par Mobile Money, au mois ou à l'année (2 mois offerts sur l'annuel). Cabinets : 20 000 FCFA par mois. Entreprises : 2 000 FCFA par salarié et par mois." },
];

export default function Accueil() {
  return (
    <PagePublique>
      {/* Promesse */}
      <section className="bg-gradient-to-b from-marque-claire/60 to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-marque">Logiciel de paie et RH en ligne</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              La paie zéro papier, jusqu&apos;au téléphone du salarié.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-doux">
              DématPaie réunit cabinets comptables, entreprises et salariés : dossiers du personnel, validation et publication
              des bulletins, congés et échanges, dans un espace sécurisé.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/inscription" className={`${classesBouton("principal")} h-12 px-5`}>
                Essai gratuit d&apos;un mois <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/demo" className={`${classesBouton("secondaire")} h-12 px-5`}>
                Demander une démo
              </Link>
            </div>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-doux">
              {["Sans engagement", "Sans moyen de paiement", "Données isolées par entreprise"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1">
                  <CircleCheck size={14} className="text-marque" aria-hidden /> {t}
                </span>
              ))}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-bordure bg-surface px-4 py-3">
              <p className="text-sm text-doux">Cabinet ou entreprise déjà inscrit ?</p>
              <Link href="/connexion" className={`${classesBouton("discret")} -mx-2`}>
                <LogIn size={16} aria-hidden /> Se connecter à mon espace
              </Link>
            </div>
          </div>

          {/* Maquette de l'application (HTML et CSS seulement). Illustration : les noms sont fictifs. */}
          <figure aria-hidden className="relative mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-2xl border border-bordure bg-surface shadow-flottant">
              <div className="flex items-center gap-1.5 border-b border-bordure bg-background px-3 py-2">
                <span className="size-2.5 rounded-full bg-black/10" />
                <span className="size-2.5 rounded-full bg-black/10" />
                <span className="size-2.5 rounded-full bg-black/10" />
                <span className="ml-2 rounded bg-black/[.04] px-2 py-0.5 text-[11px] text-doux">dematpaie · Paie</span>
              </div>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Bulletins · Octobre</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-marque-claire px-2 py-0.5 text-xs font-semibold text-marque-fonce">
                    <Lock size={11} /> Verrouillé
                  </span>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  {[["Déposés", "4"], ["Validés", "4"], ["Publiés", "4"]].map(([l, v]) => (
                    <div key={l} className="rounded-lg bg-background px-2 py-2">
                      <p className="text-lg font-bold leading-none">{v}</p>
                      <p className="mt-1 text-[11px] text-doux">{l}</p>
                    </div>
                  ))}
                </div>
                {[
                  ["NDONG Awa", "Comptable"],
                  ["MBA Paul", "Technicien"],
                  ["OBAME Clarisse", "Assistante RH"],
                ].map(([nom, poste]) => (
                  <div key={nom} className="flex items-center gap-3 border-t border-bordure py-2.5">
                    <span className="grid size-8 place-items-center rounded-full bg-marque text-xs font-semibold text-white">
                      {nom.split(" ").map((m) => m[0]).join("")}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{nom}</p>
                      <p className="text-xs text-doux">{poste}</p>
                    </div>
                    <CircleCheck size={16} className="text-marque" />
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-5 -left-3 hidden rounded-xl border border-bordure bg-surface p-3 shadow-survol sm:block">
              <p className="text-xs text-doux">Validation</p>
              <p className="text-sm font-semibold">Contrôlé → Approuvé → Publié</p>
            </div>
            <figcaption className="mt-7 text-center text-xs text-doux sm:mt-8">Illustration : les noms sont fictifs.</figcaption>
          </figure>
        </div>
      </section>

      {/* Garanties */}
      <section className="border-y border-bordure bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {GARANTIES.map(({ icone: Icone, titre, texte }) => (
            <div key={titre} className="flex gap-3">
              <Icone size={22} className="mt-0.5 shrink-0 text-marque" aria-hidden />
              <div>
                <p className="font-semibold">{titre}</p>
                <p className="text-sm text-doux">{texte}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Parcours d'un bulletin */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <TitreSection surtitre="Le parcours d'un bulletin" titre="Du dépôt à la publication, chaque étape est tracée" texte="Une fois publié, le bulletin est verrouillé : sa copie reçoit une empreinte, et toute modification serait détectée." />
        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ETAPES_BULLETIN.map(({ icone: Icone, titre, texte }, i) => (
            <li key={titre} className="relative flex gap-4 rounded-2xl border border-bordure bg-surface p-5 shadow-carte lg:flex-col">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marque text-white">
                <Icone size={22} aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-marque">Étape {i + 1}</p>
                <p className="mt-0.5 font-semibold">{titre}</p>
                <p className="mt-1 text-sm text-doux">{texte}</p>
              </div>
              {i < ETAPES_BULLETIN.length - 1 && (
                <ArrowRight size={18} aria-hidden className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-surface text-marque lg:block" />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <TitreSection
          surtitre="Fonctionnalités"
          titre="Une solution complète, organisée en modules"
          texte="Commencez par l'essentiel ; les nouveaux modules s'ajoutent au fil des mises à jour, sans rien installer."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            const Icone = ICONES_MODULES[m.id];
            return (
              <article key={m.id} className="flex flex-col gap-3 rounded-xl border border-bordure bg-surface p-5">
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-lg bg-marque-claire text-marque">
                    <Icone size={22} aria-hidden />
                  </span>
                  {m.statut === "disponible" ? <Badge teinte="vert">Disponible</Badge> : <Badge>Bientôt</Badge>}
                </div>
                <h3 className="text-lg font-semibold">{m.nom}</h3>
                <p className="text-sm text-doux">{m.accroche}</p>
                <ul className="mt-auto flex flex-col gap-1.5 text-sm">
                  {m.fonctions.slice(0, 3).map((f) => (
                    <li key={f.libelle} className="flex items-start gap-2">
                      <CircleCheck size={15} className="mt-0.5 shrink-0 text-marque" aria-hidden />
                      {f.libelle}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      {/* Pour qui */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <TitreSection surtitre="Pour qui" titre="Chacun son espace, une seule plateforme" centre />
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {PUBLICS.map(({ icone: Icone, titre, points, lien }) => (
              <article key={titre} className="flex flex-col gap-4 rounded-xl border border-bordure p-6">
                <span className="grid size-11 place-items-center rounded-lg bg-marque text-white">
                  <Icone size={22} aria-hidden />
                </span>
                <h3 className="text-lg font-semibold">{titre}</h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <CircleCheck size={15} className="mt-0.5 shrink-0 text-marque" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
                {lien && (
                  <Link href={lien.href} className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-marque">
                    {lien.libelle} <ArrowRight size={14} aria-hidden />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Deux façons de travailler */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <TitreSection surtitre="Votre organisation" titre="Faites la paie vous-même, ou confiez-la à votre cabinet" />
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-bordure bg-surface p-6">
            <Badge teinte="bleu">Mode autonome</Badge>
            <h3 className="mt-3 text-lg font-semibold">L&apos;entreprise gère sa paie</h3>
            <p className="mt-2 text-sm text-doux">
              Vos équipes RH et paie travaillent directement dans DématPaie, avec leurs propres rôles et le circuit de validation
              de votre choix.
            </p>
          </article>
          <article className="rounded-xl border border-bordure bg-surface p-6">
            <Badge teinte="vert">Mode cabinet</Badge>
            <h3 className="mt-3 text-lg font-semibold">Votre cabinet s&apos;en occupe</h3>
            <p className="mt-2 text-sm text-doux">
              Votre expert-comptable prépare et publie les bulletins ; vous gardez la main sur les congés, les réclamations et la
              validation finale.
            </p>
          </article>
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="scroll-mt-20 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <TitreSection
            surtitre="Tarifs"
            titre="Des prix simples, un mois d'essai offert"
            texte="Essayez gratuitement pendant un mois, sans engagement et sans moyen de paiement. Vous choisissez ensuite de souscrire ou non."
            centre
          />
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            {TARIFS.map((t) => (
              <article key={t.cible} className="flex flex-col gap-4 rounded-xl border border-bordure bg-background p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{t.titre}</h3>
                  <Badge teinte="vert">1 mois d&apos;essai gratuit</Badge>
                </div>
                <p>
                  <span className="text-3xl font-bold tracking-tight">{formaterPrix(t.prixMensuel)}</span>{" "}
                  <span className="text-sm text-doux">{t.unite}</span>
                </p>
                <p className="text-sm text-doux">{t.accroche}</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {t.points.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <CircleCheck size={15} className="mt-0.5 shrink-0 text-marque" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link href={t.inscription} className={`${classesBouton("principal")} mt-auto h-12 w-full`}>
                  Commencer l&apos;essai gratuit <ArrowRight size={16} aria-hidden />
                </Link>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-doux">
            Paiement par Mobile Money, au mois ou à l&apos;année (2 mois offerts sur l&apos;annuel). Déjà inscrit ?{" "}
            <Link href="/connexion" className="font-semibold text-marque hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </section>

      {/* Sécurité */}
      <section id="securite" className="scroll-mt-20 bg-marque text-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-white/70">Sécurité & confiance</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Les bulletins de paie sont des données sensibles. Nous les traitons comme telles.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {SECURITE.map(({ icone: Icone, titre, texte }) => (
              <div key={titre} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icone size={22} aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{titre}</h3>
                  <p className="mt-1 text-sm text-white/80">{texte}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Questions fréquentes */}
      <section id="questions" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
        <TitreSection surtitre="Questions fréquentes" titre="Vous vous demandez peut-être…" centre />
        <div className="mt-8 flex flex-col gap-3">
          {QUESTIONS.map(({ q, r }) => (
            <details key={q} className="group rounded-xl border border-bordure bg-surface p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                {q}
                <span className="text-marque transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-doux">{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Appel à l'action */}
      <section className="px-4 pb-16">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-2xl bg-foreground px-6 py-10 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <h2 className="text-2xl font-bold">Prêt à passer au zéro papier ?</h2>
            <p className="mt-2 text-white/75">Une démonstration de 30 minutes, adaptée à votre organisation.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/demo" className={`${classesBouton("principal")} h-12 px-5`}>
              <Users size={16} aria-hidden /> Demander une démo
            </Link>
            <Link href="/inscription" className="inline-flex h-12 items-center rounded-lg border border-white/30 px-5 text-sm font-semibold hover:bg-white/10">
              Essai gratuit
            </Link>
          </div>
        </div>
      </section>
    </PagePublique>
  );
}
