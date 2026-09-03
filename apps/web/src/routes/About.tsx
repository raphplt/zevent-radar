import { Link } from "react-router";
import { Card, SectionTitle } from "@/components/ui";

export function AboutPage() {
  return (
    <div className="space-y-4 lg:max-w-2xl">
      <SectionTitle>À propos</SectionTitle>
      <Card className="space-y-3 p-4 text-sm">
        <p>ZEvent Radar est un second écran communautaire, indépendant et non officiel, pour suivre le ZEvent : les donation goals sur le point d'être atteints, les lives à ne pas manquer et des alertes personnalisées.</p>
        <p>Les cagnottes viennent des API publiques de zevent.fr. Les donation goals proviennent de l'InGDoc (zevent.gdoc.fr), enrichis et corrigés par la communauté. Les estimations de temps restant sont calculées à partir de la vitesse médiane des cinq dernières minutes : elles restent indicatives.</p>
        <p>Aucune donnée personnelle n'est collectée. Les favoris et réglages restent dans ton navigateur. Les abonnements aux notifications sont supprimés après l'événement.</p>
        <p className="text-muted">Pour faire un don, passe toujours par <a href="https://zevent.fr/don" className="underline" target="_blank" rel="noreferrer">zevent.fr/don</a>.</p>
        <p><Link to="/legal" className="underline">Mentions légales et confidentialité</Link></p>
      </Card>
    </div>
  );
}
