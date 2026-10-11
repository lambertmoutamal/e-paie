import type { Metadata } from "next";
import { MODULES } from "@/lib/modules";
import { CarteModule } from "@/components/carte-module";
import { EnTetePage, Page } from "@/components/ui";

export const metadata: Metadata = { title: "Modules" };

export default function PageModules() {
  return (
    <Page>
      <EnTetePage
        titre="Modules"
        description="Les briques d'DématPaie. Les modules « Bientôt » arrivent au fil des prochaines mises à jour."
        fil={[{ href: "/espace", libelle: "Tableau de bord" }]}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <CarteModule key={m.id} module={m} href={`/espace/modules/${m.id}`} />
        ))}
      </div>
    </Page>
  );
}
