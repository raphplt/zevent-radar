import { ChevronDown, ExternalLink, HeartHandshake } from "lucide-react";
import { useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import data from "@/data/associations.json";

interface Association {
  slug: string;
  name: string;
  link: string;
  logo: string;
  since: number | null;
  collector: boolean;
  description: string;
  usage: string[];
}

const associations = data.associations as Association[];
const collector = associations.find((a) => a.collector);
const beneficiaries = associations.filter((a) => !a.collector).sort((a, b) => a.name.localeCompare(b.name, "fr"));

export function AssociationsPage() {
  return (
    <div className="space-y-5">
      <SectionTitle action={<span className="text-xs text-muted">{beneficiaries.length} associations</span>}>Pour qui on donne</SectionTitle>
      <p className="text-sm text-muted">Les associations bénéficiaires du ZEVENT {data.edition}, telles que présentées sur <a href={data.source} target="_blank" rel="noreferrer" className="underline">zevent.fr</a>. Chaque fiche renvoie vers le site officiel de l'association.</p>
      {collector && (
        <Card className="flex items-center gap-4 p-4">
          <Logo association={collector} size={56} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{collector.name}</p>
            <p className="text-xs text-muted">Collecte et redistribue les dons aux associations bénéficiaires.</p>
          </div>
          <a href={collector.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-strong"><ExternalLink size={12} />Site</a>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {beneficiaries.map((association) => (
          <AssociationCard key={association.slug} association={association} />
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted"><HeartHandshake size={14} />Pour donner, passe par <a href="https://zevent.fr/don" target="_blank" rel="noreferrer" className="underline">zevent.fr/don</a> ou par la page d'un streamer.</p>
    </div>
  );
}

function Logo({ association, size }: { association: Association; size: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1.5" style={{ width: size, height: size }}>
      <img src={association.logo} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
    </span>
  );
}

function AssociationCard({ association }: { association: Association }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Logo association={association} size={52} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{association.name}</p>
          {association.since && <p className="text-xs text-muted">Soutenue depuis {association.since}</p>}
        </div>
        <a href={association.link} target="_blank" rel="noreferrer" aria-label={`Site de ${association.name}`} className="rounded-lg bg-surface-2 p-2 text-accent-strong hover:bg-border"><ExternalLink size={16} /></a>
      </div>
      <p className="text-sm text-muted">{association.description}</p>
      {association.usage.length > 0 && (
        <div>
          <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong" aria-expanded={open}>
            <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />À quoi serviront les dons
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5 border-l-2 border-accent-border pl-3 text-sm">
              {association.usage.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
