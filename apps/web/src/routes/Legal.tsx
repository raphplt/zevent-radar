import { Card, SectionTitle } from "@/components/ui";

const EDITOR_NAME = import.meta.env.VITE_LEGAL_EDITOR ?? "Raph";
const EDITOR_CONTACT =
  import.meta.env.VITE_LEGAL_CONTACT ?? "raphael.plassart@gmail.com";

export function LegalPage() {
  return (
    <div className="space-y-4 lg:max-w-2xl">
      <SectionTitle>Mentions légales</SectionTitle>
      <Card className="space-y-3 p-4 text-sm">
        <p>
          <span className="font-semibold">Éditeur :</span> {EDITOR_NAME}, à
          titre non professionnel. Contact : {EDITOR_CONTACT}.
        </p>
        <p>
          <span className="font-semibold">Hébergeur :</span> Cloudflare, Inc.,
          101 Townsend Street, San Francisco, CA 94107, États-Unis. Site :
          cloudflare.com.
        </p>
        <p>
          ZEvent Radar est un projet communautaire indépendant. Il n'est ni
          édité, ni approuvé, ni affilié à ZEvent, à ses organisateurs ou à
          Twitch. « ZEvent » est une marque de ses titulaires. Les dons se font
          exclusivement sur zevent.fr.
        </p>
        <p>
          Les données de cagnottes proviennent des API publiques de zevent.fr,
          les donation goals de l'InGDoc (zevent.gdoc.fr) et de contributions
          communautaires. Elles sont fournies à titre indicatif, sans garantie
          d'exactitude ni de disponibilité.
        </p>
      </Card>
      <SectionTitle>Confidentialité</SectionTitle>
      <Card className="space-y-3 p-4 text-sm">
        <p>
          <span className="font-semibold">
            Aucun compte, aucun traceur publicitaire, aucun outil d'analyse
            d'audience.
          </span>{" "}
          Le stockage local du navigateur conserve uniquement tes favoris, tes
          réglages et un identifiant d'installation aléatoire, strictement
          nécessaires au fonctionnement.
        </p>
        <p>
          <span className="font-semibold">Notifications push :</span> si tu les
          actives, l'adresse d'abonnement fournie par ton navigateur et tes
          préférences par streamer sont enregistrées pour t'envoyer les alertes
          demandées. Tu peux les supprimer à tout moment depuis les réglages.
          Elles sont effacées après l'événement.
        </p>
        <p>
          <span className="font-semibold">Signalements :</span> un identifiant
          d'installation et une empreinte hachée de l'adresse IP sont conservés
          avec chaque signalement pour limiter les abus, pendant la durée de
          l'événement.
        </p>
        <p>
          <span className="font-semibold">Sous-traitants :</span> Cloudflare
          (hébergement, protection anti-spam Turnstile), services de
          notification des navigateurs (Google, Mozilla, Apple), Twitch pour les
          avatars.
        </p>
        <p>
          Base légale : intérêt légitime et exécution du service demandé. Pour
          exercer tes droits d'accès, de rectification ou d'effacement, écris à{" "}
          {EDITOR_CONTACT}. Tu peux également saisir la CNIL.
        </p>
      </Card>
    </div>
  );
}
