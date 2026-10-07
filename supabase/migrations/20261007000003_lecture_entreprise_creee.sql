-- Correctif : un admin cabinet qui crée une entreprise doit pouvoir la relire
-- immédiatement (insert ... returning). La règle de lecture cherchait l'entreprise
-- dans la table, où la ligne en cours de création n'est pas encore visible.
-- On vérifie donc aussi directement le cabinet porté par la ligne elle-même.
-- Le périmètre ne change pas : l'admin d'un cabinet voit les entreprises de ce cabinet.

drop policy entreprises_lecture on public.entreprises;

create policy entreprises_lecture on public.entreprises for select to authenticated
using (
  prive.a_acces_entreprise(id)
  or (cabinet_id is not null and prive.est_admin_cabinet(cabinet_id))
);
