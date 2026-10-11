-- =====================================================================
-- Rédaction des contrats dans e-Paie : modèles et document de chaque contrat
-- =====================================================================
-- Deux façons de gérer un contrat :
--   1. importer le contrat signé (PDF ou photo), comme depuis l'étape 6 ;
--   2. le rédiger ici, à partir d'un modèle dont les champs ({{nom}}, {{poste}}…)
--      sont remplis automatiquement, puis le modifier et générer le PDF.
-- Modèles « standard » (entreprise_id vide) : fournis par e-Paie, en lecture seule.
-- Modèles d'entreprise : créés, importés depuis Word ou personnalisés par l'entreprise.

create table public.modeles_contrat (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.entreprises (id) on delete cascade,  -- vide = modèle standard
  nom text not null check (char_length(btrim(nom)) between 2 and 120),
  categorie text not null check (categorie in ('contrat', 'avenant')),
  type_contrat public.type_contrat,                 -- type conseillé (facultatif)
  contenu text not null check (char_length(contenu) <= 200000),   -- HTML simple (titres, paragraphes, listes)
  actif boolean not null default true,
  cree_par uuid references public.profils (id) on delete set null,
  modifie_le timestamptz not null default now()
);
create index modeles_contrat_entreprise_idx on public.modeles_contrat (entreprise_id);

alter table public.modeles_contrat enable row level security;
revoke all on public.modeles_contrat from anon, authenticated;
grant select, insert, delete on public.modeles_contrat to authenticated;
grant update (nom, categorie, type_contrat, contenu, actif, modifie_le) on public.modeles_contrat to authenticated;

create policy modeles_lecture on public.modeles_contrat for select to authenticated
using (entreprise_id is null or prive.a_acces_entreprise(entreprise_id));
create policy modeles_creation on public.modeles_contrat for insert to authenticated
with check (entreprise_id is not null and prive.peut_ecrire_salaries(entreprise_id));
create policy modeles_modification on public.modeles_contrat for update to authenticated
using (entreprise_id is not null and prive.peut_ecrire_salaries(entreprise_id))
with check (entreprise_id is not null and prive.peut_ecrire_salaries(entreprise_id));
create policy modeles_suppression on public.modeles_contrat for delete to authenticated
using (entreprise_id is not null and prive.peut_ecrire_salaries(entreprise_id));

create trigger journaliser after insert or update or delete on public.modeles_contrat
  for each row execute function prive.journaliser('entreprise_id', '');

-- ---------------------------------------------------------------------
-- Document rédigé de chaque contrat ou avenant
-- ---------------------------------------------------------------------
alter table public.contrats
  add column contenu text check (contenu is null or char_length(contenu) <= 200000),
  add column modele_id uuid references public.modeles_contrat (id) on delete set null,
  add column document_fige boolean not null default false;   -- version signée : plus modifiable

-- Un document figé (signé) ne change plus ; un contrat clos non plus.
create function prive.proteger_document_contrat()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.document_fige and not new.document_fige then
    raise exception 'Un document signé ne peut pas être rouvert.' using errcode = 'insufficient_privilege';
  end if;
  if new.contenu is distinct from old.contenu
     and (old.document_fige or old.statut in ('termine', 'rompu')) then
    raise exception 'Ce document est signé ou le contrat est clos : il ne peut plus être modifié. Rédigez un avenant.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger contrats_document before update on public.contrats
  for each row execute function prive.proteger_document_contrat();

-- ---------------------------------------------------------------------
-- Modèles standard (génériques, à faire valider par un juriste)
-- ---------------------------------------------------------------------
insert into public.modeles_contrat (entreprise_id, nom, categorie, type_contrat, contenu) values
(null, 'Contrat de travail à durée indéterminée (CDI) — modèle standard', 'contrat', 'cdi',
'<h1 style="text-align: center">CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE</h1>
<p><strong>Entre les soussignés :</strong></p>
<p><strong>{{raison_sociale}}</strong>, dont le siège est situé {{adresse_entreprise}}, immatriculée sous le numéro {{rccm}}, ci-après dénommée « l''employeur », d''une part,</p>
<p><strong>Et</strong></p>
<p>{{civilite}} <strong>{{prenoms}} {{nom}}</strong>, né(e) le {{date_naissance}}, de nationalité {{nationalite}}, demeurant {{adresse_salarie}}, ci-après dénommé(e) « le salarié », d''autre part.</p>
<p>Il a été convenu ce qui suit :</p>
<h2>Article 1 — Engagement</h2>
<p>Le salarié est engagé à compter du <strong>{{date_debut}}</strong> pour une durée indéterminée, sous réserve des résultats de la visite médicale d''embauche.</p>
<h2>Article 2 — Fonctions</h2>
<p>Le salarié exercera les fonctions de <strong>{{poste}}</strong>, catégorie {{categorie}}. Il s''engage à exécuter les tâches qui lui seront confiées dans le cadre de ces fonctions.</p>
<h2>Article 3 — Période d''essai</h2>
<p>Le présent contrat ne deviendra définitif qu''à l''issue d''une période d''essai prenant fin le {{fin_periode_essai}}. Pendant cette période, chacune des parties peut rompre le contrat dans les conditions prévues par la législation du travail en vigueur.</p>
<h2>Article 4 — Lieu et durée du travail</h2>
<p>Le salarié exercera ses fonctions à {{lieu_travail}}. La durée du travail est fixée à {{heures_hebdo}} heures par semaine.</p>
<h2>Article 5 — Rémunération</h2>
<p>Le salarié percevra un salaire de base mensuel brut de <strong>{{salaire_base}}</strong>, auquel s''ajoutent, le cas échéant, les primes et indemnités prévues par la convention collective applicable.</p>
<h2>Article 6 — Congés payés</h2>
<p>Le salarié bénéficiera des congés payés prévus par la législation et la convention collective en vigueur.</p>
<h2>Article 7 — Obligations du salarié</h2>
<p>Le salarié s''engage à respecter le règlement intérieur de l''entreprise, les instructions qui lui sont données et à observer la plus grande discrétion sur les informations dont il aura connaissance dans l''exercice de ses fonctions.</p>
<h2>Article 8 — Rupture du contrat</h2>
<p>Le présent contrat pourra être rompu par l''une ou l''autre des parties dans les conditions prévues par la législation du travail en vigueur, sous réserve du respect du préavis applicable.</p>
<p>Fait en deux exemplaires originaux, le {{date_du_jour}}.</p>
<p><strong>L''employeur</strong> (signature et cachet)                                        <strong>Le salarié</strong> (« lu et approuvé », signature)</p>'),

(null, 'Contrat de travail à durée déterminée (CDD) — modèle standard', 'contrat', 'cdd',
'<h1 style="text-align: center">CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE</h1>
<p><strong>Entre les soussignés :</strong></p>
<p><strong>{{raison_sociale}}</strong>, dont le siège est situé {{adresse_entreprise}}, immatriculée sous le numéro {{rccm}}, ci-après dénommée « l''employeur », d''une part,</p>
<p><strong>Et</strong></p>
<p>{{civilite}} <strong>{{prenoms}} {{nom}}</strong>, né(e) le {{date_naissance}}, de nationalité {{nationalite}}, demeurant {{adresse_salarie}}, ci-après dénommé(e) « le salarié », d''autre part.</p>
<p>Il a été convenu ce qui suit :</p>
<h2>Article 1 — Objet et durée</h2>
<p>Le salarié est engagé pour une durée déterminée, du <strong>{{date_debut}}</strong> au <strong>{{date_fin}}</strong> inclus, pour le motif suivant : <em>(préciser le motif du recours au contrat à durée déterminée)</em>.</p>
<h2>Article 2 — Fonctions</h2>
<p>Le salarié exercera les fonctions de <strong>{{poste}}</strong>, catégorie {{categorie}}.</p>
<h2>Article 3 — Période d''essai</h2>
<p>Le contrat comporte une période d''essai prenant fin le {{fin_periode_essai}}, pendant laquelle chacune des parties peut y mettre fin dans les conditions légales.</p>
<h2>Article 4 — Lieu et durée du travail</h2>
<p>Le salarié exercera ses fonctions à {{lieu_travail}}. La durée du travail est fixée à {{heures_hebdo}} heures par semaine.</p>
<h2>Article 5 — Rémunération</h2>
<p>Le salarié percevra un salaire de base mensuel brut de <strong>{{salaire_base}}</strong>, ainsi que les primes et indemnités prévues par la convention collective applicable.</p>
<h2>Article 6 — Fin du contrat</h2>
<p>Le contrat prendra fin de plein droit à son terme. Il ne pourra être renouvelé que dans les conditions prévues par la législation en vigueur, par avenant écrit.</p>
<h2>Article 7 — Obligations du salarié</h2>
<p>Le salarié s''engage à respecter le règlement intérieur de l''entreprise et à observer la plus grande discrétion sur les informations dont il aura connaissance.</p>
<p>Fait en deux exemplaires originaux, le {{date_du_jour}}.</p>
<p><strong>L''employeur</strong> (signature et cachet)                                        <strong>Le salarié</strong> (« lu et approuvé », signature)</p>'),

(null, 'Avenant au contrat de travail — modèle standard', 'avenant', null,
'<h1 style="text-align: center">AVENANT AU CONTRAT DE TRAVAIL</h1>
<p><strong>Entre</strong> <strong>{{raison_sociale}}</strong>, dont le siège est situé {{adresse_entreprise}}, ci-après « l''employeur »,</p>
<p><strong>Et</strong> {{civilite}} <strong>{{prenoms}} {{nom}}</strong>, matricule {{matricule}}, ci-après « le salarié ».</p>
<h2>Article 1 — Objet</h2>
<p>Le présent avenant a pour objet : <strong>{{objet_avenant}}</strong>.</p>
<h2>Article 2 — Modifications</h2>
<p>À compter du <strong>{{date_debut}}</strong>, les dispositions suivantes du contrat de travail sont modifiées :</p>
<ul><li><p>Poste : {{poste}}</p></li><li><p>Catégorie : {{categorie}}</p></li><li><p>Salaire de base mensuel brut : {{salaire_base}}</p></li><li><p>Durée du travail : {{heures_hebdo}} heures par semaine</p></li><li><p>Lieu de travail : {{lieu_travail}}</p></li></ul>
<h2>Article 3 — Autres dispositions</h2>
<p>Toutes les autres clauses du contrat de travail demeurent inchangées.</p>
<p>Fait en deux exemplaires originaux, le {{date_du_jour}}.</p>
<p><strong>L''employeur</strong> (signature et cachet)                                        <strong>Le salarié</strong> (« lu et approuvé », signature)</p>');
