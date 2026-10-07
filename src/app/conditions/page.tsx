import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

// VERSION PROVISOIRE : texte à faire relire et compléter par un juriste avant le lancement.
const ARTICLES = [
  {
    titre: "1. Objet",
    texte:
      "e-Paie est une plateforme en ligne de gestion et de distribution dématérialisée des bulletins de paie, destinée aux cabinets comptables et aux entreprises.",
  },
  {
    titre: "2. Essai gratuit et abonnement",
    texte:
      "Toute nouvelle inscription bénéficie d'un essai gratuit de 30 jours. À la fin de l'essai ou de l'abonnement, le compte passe en lecture seule pendant 30 jours (consultation et export), puis l'accès est bloqué pour tous les utilisateurs du compte, salariés compris, jusqu'à la souscription d'un abonnement.",
  },
  {
    titre: "3. Responsabilités",
    texte:
      "L'utilisateur reste seul responsable de l'exactitude des données qu'il saisit ou dépose, ainsi que de ses déclarations sociales et fiscales.",
  },
  {
    titre: "4. Données personnelles",
    texte:
      "Les bulletins de paie sont des données personnelles sensibles. Chaque entreprise dispose d'un espace isolé ; l'accès est limité aux personnes autorisées et toute action est tracée.",
  },
];

export default function PageConditions() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/">
        <Logo />
      </Link>
      <h1 className="text-2xl font-bold">Conditions d&apos;utilisation</h1>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Version provisoire, en cours de validation juridique.
      </p>
      {ARTICLES.map((a) => (
        <section key={a.titre}>
          <h2 className="font-semibold">{a.titre}</h2>
          <p className="mt-1 text-doux">{a.texte}</p>
        </section>
      ))}
    </main>
  );
}
