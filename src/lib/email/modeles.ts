// Modèles d'emails de la plateforme (HTML simple, compatible avec toutes les
// messageries, + version texte). Toute donnée saisie par un utilisateur est
// échappée pour qu'elle ne puisse pas injecter de code dans l'email.

export type Email = { sujet: string; html: string; texte: string };

export function echapper(valeur: string): string {
  return valeur
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function gabarit({ titre, paragraphes, bouton, note }: {
  titre: string;
  paragraphes: string[];
  bouton?: { libelle: string; lien: string };
  note?: string;
}): string {
  const corps = paragraphes
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334139">${p}</p>`)
    .join("");
  const action = bouton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:#0b5d3b;border-radius:8px">
         <a href="${echapper(bouton.lien)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none">${echapper(bouton.libelle)}</a>
       </td></tr></table>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#5b6b62">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><span style="word-break:break-all;color:#0b5d3b">${echapper(bouton.lien)}</span></p>`
    : "";
  const remarque = note
    ? `<p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #e3e8e5;font-size:13px;line-height:1.5;color:#5b6b62">${note}</p>`
    : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f5f7f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e8e5;border-radius:12px">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e3e8e5">
  <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:#0b5d3b;color:#fff;border-radius:7px;font-weight:700">e</span>
  <span style="margin-left:8px;font-size:17px;font-weight:700;color:#17201b;vertical-align:middle">e-Paie</span>
</td></tr>
<tr><td style="padding:28px">
  <h1 style="margin:0 0 20px;font-size:21px;line-height:1.3;color:#17201b">${titre}</h1>
  ${corps}${action}${remarque}
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#8a978f">e-Paie · La paie zéro papier<br>Email automatique, merci de ne pas y répondre.</p>
</td></tr></table></body></html>`;
}

export function emailInvitation(p: { nom: string; perimetre: string; lien: string }): Email {
  const nom = echapper(p.nom);
  const perimetre = echapper(p.perimetre);
  return {
    sujet: "Activez votre compte e-Paie",
    html: gabarit({
      titre: `Bienvenue ${nom}`,
      paragraphes: [
        `Un compte a été créé pour vous sur <strong>e-Paie</strong>, la plateforme de paie zéro papier, pour : <strong>${perimetre}</strong>.`,
        "Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et choisir votre mot de passe.",
      ],
      bouton: { libelle: "Activer mon compte", lien: p.lien },
      note: "Ce lien est personnel et valable 24 heures. Si vous n'attendiez pas cette invitation, ignorez simplement cet email : aucun compte ne sera activé.",
    }),
    texte: `Bienvenue ${p.nom},\n\nUn compte a été créé pour vous sur e-Paie pour : ${p.perimetre}.\nActivez-le et choisissez votre mot de passe en ouvrant ce lien (valable 24 heures) :\n${p.lien}\n\nSi vous n'attendiez pas cette invitation, ignorez cet email.`,
  };
}

export function emailAccesAjoute(p: { nom: string; perimetre: string; lienConnexion: string }): Email {
  const nom = echapper(p.nom);
  const perimetre = echapper(p.perimetre);
  return {
    sujet: "Nouvel accès sur e-Paie",
    html: gabarit({
      titre: `Bonjour ${nom}`,
      paragraphes: [`Un nouvel accès vous a été attribué sur e-Paie : <strong>${perimetre}</strong>.`],
      bouton: { libelle: "Se connecter", lien: p.lienConnexion },
      note: "Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.",
    }),
    texte: `Bonjour ${p.nom},\n\nUn nouvel accès vous a été attribué sur e-Paie : ${p.perimetre}.\nConnexion : ${p.lienConnexion}`,
  };
}

export function emailRecuperation(p: { lien: string }): Email {
  return {
    sujet: "Réinitialisation de votre mot de passe e-Paie",
    html: gabarit({
      titre: "Choisissez un nouveau mot de passe",
      paragraphes: ["Vous avez demandé à réinitialiser votre mot de passe e-Paie."],
      bouton: { libelle: "Choisir un nouveau mot de passe", lien: p.lien },
      note: "Ce lien est valable 24 heures et ne fonctionne qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.",
    }),
    texte: `Vous avez demandé à réinitialiser votre mot de passe e-Paie.\nOuvrez ce lien (valable 24 heures) :\n${p.lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
  };
}
