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

function gabarit({ titre, paragraphes, bouton, note, reponseAttendue }: {
  titre: string;
  paragraphes: string[];
  bouton?: { libelle: string; lien: string };
  note?: string;
  // Email d'une personne (cabinet) : on peut y répondre directement
  reponseAttendue?: boolean;
}): string {
  const corps = paragraphes
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#33384d">${p}</p>`)
    .join("");
  const action = bouton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:#4f46e5;border-radius:8px">
         <a href="${echapper(bouton.lien)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none">${echapper(bouton.libelle)}</a>
       </td></tr></table>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#5b6478">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><span style="word-break:break-all;color:#4f46e5">${echapper(bouton.lien)}</span></p>`
    : "";
  const remarque = note
    ? `<p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #e4e7f0;font-size:13px;line-height:1.5;color:#5b6478">${note}</p>`
    : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f6f7fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e7f0;border-radius:12px">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e4e7f0">
  <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:#4f46e5;color:#fff;border-radius:7px;font-weight:700">D</span>
  <span style="margin-left:8px;font-size:17px;font-weight:700;color:#1b1e2e;vertical-align:middle">DématPaie</span>
</td></tr>
<tr><td style="padding:28px">
  <h1 style="margin:0 0 20px;font-size:21px;line-height:1.3;color:#1b1e2e">${titre}</h1>
  ${corps}${action}${remarque}
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#8a90a6">DématPaie · La paie zéro papier<br>${reponseAttendue ? "Répondez directement à cet email pour joindre le cabinet." : "Email automatique, merci de ne pas y répondre."}</p>
</td></tr></table></body></html>`;
}

export function emailInvitation(p: { nom: string; perimetre: string; lien: string }): Email {
  const nom = echapper(p.nom);
  const perimetre = echapper(p.perimetre);
  return {
    sujet: "Activez votre compte DématPaie",
    html: gabarit({
      titre: `Bienvenue ${nom}`,
      paragraphes: [
        `Un compte a été créé pour vous sur <strong>DématPaie</strong>, la plateforme de paie zéro papier, pour : <strong>${perimetre}</strong>.`,
        "Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et choisir votre mot de passe.",
      ],
      bouton: { libelle: "Activer mon compte", lien: p.lien },
      note: "Ce lien est personnel et valable 24 heures. Si vous n'attendiez pas cette invitation, ignorez simplement cet email : aucun compte ne sera activé.",
    }),
    texte: `Bienvenue ${p.nom},\n\nUn compte a été créé pour vous sur DématPaie pour : ${p.perimetre}.\nActivez-le et choisissez votre mot de passe en ouvrant ce lien (valable 24 heures) :\n${p.lien}\n\nSi vous n'attendiez pas cette invitation, ignorez cet email.`,
  };
}

export function emailAccesAjoute(p: { nom: string; perimetre: string; lienConnexion: string }): Email {
  const nom = echapper(p.nom);
  const perimetre = echapper(p.perimetre);
  return {
    sujet: "Nouvel accès sur DématPaie",
    html: gabarit({
      titre: `Bonjour ${nom}`,
      paragraphes: [`Un nouvel accès vous a été attribué sur DématPaie : <strong>${perimetre}</strong>.`],
      bouton: { libelle: "Se connecter", lien: p.lienConnexion },
      note: "Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.",
    }),
    texte: `Bonjour ${p.nom},\n\nUn nouvel accès vous a été attribué sur DématPaie : ${p.perimetre}.\nConnexion : ${p.lienConnexion}`,
  };
}

export function emailInscription(p: { nom: string; structure: string; lien: string; pro: boolean }): Email {
  const nom = echapper(p.nom);
  const structure = echapper(p.structure);
  const suite = p.pro
    ? "Vous avez choisi la formule Pro : votre essai gratuit de 30 jours démarre dès l'activation, et notre équipe vous contactera pour mettre en place votre abonnement."
    : "Votre essai gratuit de 30 jours démarre dès l'activation : toutes les fonctionnalités, sans engagement.";
  return {
    sujet: "Activez votre compte DématPaie",
    html: gabarit({
      titre: `Bienvenue ${nom}`,
      paragraphes: [
        `Merci d'avoir inscrit <strong>${structure}</strong> sur DématPaie, la plateforme de paie zéro papier.`,
        echapper(suite),
        "Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et choisir votre mot de passe.",
      ],
      bouton: { libelle: "Activer mon compte", lien: p.lien },
      note: "Ce lien est personnel et valable 24 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email : aucun compte ne sera activé.",
    }),
    texte: `Bienvenue ${p.nom},\n\nMerci d'avoir inscrit ${p.structure} sur DématPaie.\n${suite}\n\nActivez votre compte (lien valable 24 heures) :\n${p.lien}\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez cet email.`,
  };
}

export function emailCompteExistant(p: { lienConnexion: string; lienMotDePasse: string }): Email {
  return {
    sujet: "Vous avez déjà un compte DématPaie",
    html: gabarit({
      titre: "Vous avez déjà un compte",
      paragraphes: [
        "Quelqu'un (probablement vous) a tenté de créer un compte DématPaie avec cette adresse, mais un compte existe déjà.",
        `Connectez-vous simplement. En cas d'oubli, utilisez <a href="${echapper(p.lienMotDePasse)}" style="color:#4f46e5">« Mot de passe oublié »</a>.`,
      ],
      bouton: { libelle: "Se connecter", lien: p.lienConnexion },
      note: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre compte n'a pas été modifié.",
    }),
    texte: `Un compte DématPaie existe déjà avec cette adresse.\nConnexion : ${p.lienConnexion}\nMot de passe oublié : ${p.lienMotDePasse}`,
  };
}

export function emailAccuseDemo(p: { nom: string }): Email {
  const nom = echapper(p.nom);
  return {
    sujet: "Votre demande de démonstration DématPaie",
    html: gabarit({
      titre: `Merci ${nom}`,
      paragraphes: [
        "Nous avons bien reçu votre demande de démonstration d'DématPaie.",
        "Un membre de notre équipe vous contacte très prochainement pour convenir d'un rendez-vous.",
      ],
      note: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.",
    }),
    texte: `Merci ${p.nom},\n\nNous avons bien reçu votre demande de démonstration d'DématPaie. Un membre de notre équipe vous contacte très prochainement.`,
  };
}

// Alerte interne envoyée à l'équipe DématPaie
export function emailAlerte(p: { titre: string; lignes: [string, string][] }): Email {
  const tableau = p.lignes
    .map(([cle, valeur]) => `<strong>${echapper(cle)} :</strong> ${echapper(valeur)}`)
    .join("<br>");
  return {
    sujet: `[DématPaie] ${p.titre}`,
    html: gabarit({ titre: echapper(p.titre), paragraphes: [tableau] }),
    texte: `${p.titre}\n\n${p.lignes.map(([cle, valeur]) => `${cle} : ${valeur}`).join("\n")}`,
  };
}

export function emailRecuperation(p: { lien: string }): Email {
  return {
    sujet: "Réinitialisation de votre mot de passe DématPaie",
    html: gabarit({
      titre: "Choisissez un nouveau mot de passe",
      paragraphes: ["Vous avez demandé à réinitialiser votre mot de passe DématPaie."],
      bouton: { libelle: "Choisir un nouveau mot de passe", lien: p.lien },
      note: "Ce lien est valable 24 heures et ne fonctionne qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.",
    }),
    texte: `Vous avez demandé à réinitialiser votre mot de passe DématPaie.\nOuvrez ce lien (valable 24 heures) :\n${p.lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
  };
}

// Alerte de paie : une action attend la personne (valider, publier, corriger).
export function emailActionPaie(
  c: { sujet: string; titre: string; paragraphes: string[]; bouton: string },
  lien: string,
): Email {
  return {
    sujet: c.sujet,
    html: gabarit({
      titre: echapper(c.titre),
      paragraphes: c.paragraphes.map(echapper),
      bouton: { libelle: c.bouton, lien },
      note: "Vous recevez cet email car votre rôle sur DématPaie vous permet d'agir sur cette paie.",
    }),
    texte: `${c.titre},\n\n${c.paragraphes.join("\n\n")}\n\n${c.bouton} : ${lien}\n`,
  };
}

// ---------------------------------------------------------------------
// Demandes de prise en charge d'une entreprise par un cabinet
// ---------------------------------------------------------------------

// Au(x) administrateur(s) du cabinet choisi
export function emailNouvelleDemandeEntreprise(p: { cabinet: string; entreprise: string; nbSalaries: number; contact: string; lien: string }): Email {
  const e = echapper(p.entreprise);
  return {
    sujet: `Nouvelle demande : ${p.entreprise} souhaite vous confier sa paie`,
    html: gabarit({
      titre: "Une entreprise souhaite vous confier sa paie",
      paragraphes: [
        `<strong>${e}</strong> (${p.nbSalaries} salarié${p.nbSalaries > 1 ? "s" : ""}) a choisi le cabinet <strong>${echapper(p.cabinet)}</strong> sur DématPaie pour gérer sa paie.`,
        `Contact : ${echapper(p.contact)}.`,
        "Ouvrez la demande pour l'accepter ou demander des informations complémentaires à l'entreprise.",
      ],
      bouton: { libelle: "Voir la demande", lien: p.lien },
    }),
    texte: `${p.entreprise} (${p.nbSalaries} salarié(s)) souhaite confier sa paie au cabinet ${p.cabinet}.\nContact : ${p.contact}\nVoir la demande : ${p.lien}`,
  };
}

// À l'entreprise : demande bien transmise
export function emailAccuseDemandeEntreprise(p: { nom: string; entreprise: string; cabinet: string }): Email {
  return {
    sujet: `Votre demande a été transmise au cabinet ${p.cabinet}`,
    html: gabarit({
      titre: `Merci ${echapper(p.nom)}`,
      paragraphes: [
        `La demande de <strong>${echapper(p.entreprise)}</strong> a bien été transmise au cabinet <strong>${echapper(p.cabinet)}</strong> pour validation.`,
        "Dès que le cabinet l'aura acceptée, vous recevrez un email pour activer votre accès à DématPaie. Le cabinet peut aussi vous écrire pour demander des informations complémentaires.",
      ],
      note: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.",
    }),
    texte: `Merci ${p.nom},\n\nLa demande de ${p.entreprise} a été transmise au cabinet ${p.cabinet} pour validation. Vous recevrez un email dès qu'elle sera acceptée.`,
  };
}

// Du cabinet à l'entreprise : demande d'informations (réponse directe au cabinet)
export function emailDemandeInformations(p: { cabinet: string; entreprise: string; message: string; auteur: string }): Email {
  const message = echapper(p.message).replaceAll(/\r?\n/g, "<br>");
  return {
    sujet: `${p.cabinet} : informations complémentaires pour ${p.entreprise}`,
    html: gabarit({
      titre: "Le cabinet vous demande des informations",
      paragraphes: [
        `Le cabinet <strong>${echapper(p.cabinet)}</strong> étudie la demande de <strong>${echapper(p.entreprise)}</strong> et vous écrit :`,
        `<span style="display:block;padding:12px 16px;background:#f6f7fb;border-left:3px solid #4f46e5;border-radius:6px">${message}</span>`,
        `— ${echapper(p.auteur)}`,
      ],
      reponseAttendue: true,
    }),
    texte: `Le cabinet ${p.cabinet} étudie la demande de ${p.entreprise} et vous écrit :\n\n${p.message}\n\n— ${p.auteur}\n\nRépondez directement à cet email pour joindre le cabinet.`,
  };
}

// À l'entreprise : demande refusée par le cabinet
export function emailDemandeRefusee(p: { entreprise: string; cabinet: string }): Email {
  return {
    sujet: `Votre demande auprès du cabinet ${p.cabinet}`,
    html: gabarit({
      titre: "Demande non retenue",
      paragraphes: [
        `Le cabinet <strong>${echapper(p.cabinet)}</strong> n'a pas pu donner suite à la demande de <strong>${echapper(p.entreprise)}</strong>.`,
        "Vous pouvez choisir un autre cabinet, ou gérer vous-même votre paie (mode autonome), depuis « Créer une nouvelle entreprise » sur la page de connexion de DématPaie.",
      ],
    }),
    texte: `Le cabinet ${p.cabinet} n'a pas pu donner suite à la demande de ${p.entreprise}. Vous pouvez choisir un autre cabinet ou gérer vous-même votre paie depuis « Créer une nouvelle entreprise ».`,
  };
}
