import { Info } from "lucide-react";

interface PageIntroProps {
  title: string;
  purpose: string;
  howTo: string[];
}

export function PageIntro({ title, purpose, howTo }: PageIntroProps) {
  return (
    <section
      className="rounded-xl border p-4 sm:p-5 shadow-sm space-y-2.5"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        borderLeftWidth: "4px",
        borderLeftColor: "var(--brand)"
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 p-1.5 rounded-lg shrink-0"
          style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
          aria-hidden="true"
        >
          <Info className="w-4 h-4" />
        </span>
        <div className="space-y-1 min-w-0">
          <h1 className="text-base font-semibold leading-tight">{title}</h1>
          <p className="text-sm leading-snug" style={{ color: "var(--text-muted)" }}>
            {purpose}
          </p>
        </div>
      </div>

      {howTo.length > 0 && (
        <ul
          className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {howTo.map((step, index) => (
            <li
              key={step}
              className="rounded-lg border px-3 py-2 flex items-start gap-2"
              style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
            >
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold shrink-0"
                style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
              >
                {index + 1}
              </span>
              <span className="leading-snug">{step}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
