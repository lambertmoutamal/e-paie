-- Nouveau rôle : administrateur d'une entreprise (notamment une entreprise
-- autonome inscrite seule). Fichier séparé : PostgreSQL n'autorise pas
-- l'utilisation d'une nouvelle valeur d'énumération dans la transaction qui la crée.
alter type public.role_entreprise add value if not exists 'admin_entreprise';
