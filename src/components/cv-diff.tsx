import { Check, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface CambioSugerido {
  campo: string;
  antes: string;
  despues: string;
  razon: string;
}

interface CvDiffProps {
  cambios: CambioSugerido[];
  preguntas: string[];
  onAplicar: () => void;
  onCancelar: () => void;
  isApplying: boolean;
}

export function CvDiff({ cambios, preguntas, onAplicar, onCancelar, isApplying }: CvDiffProps) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <h4 className="font-display text-base font-bold">Jack sugiere estos cambios</h4>
      </div>

      {preguntas.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Preguntas de Jack:</p>
          {preguntas.map((p, i) => (
            <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
              • {p}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {cambios.map((c, idx) => (
          <div key={idx} className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                {c.campo}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-destructive/5 p-2">
                <p className="text-[10px] font-medium text-destructive mb-1 flex items-center gap-1">
                  <X className="size-3" /> Antes
                </p>
                <p className="text-xs text-muted-foreground line-clamp-4">{c.antes || "(vacío)"}</p>
              </div>
              <div className="rounded-lg bg-primary/5 p-2">
                <p className="text-[10px] font-medium text-primary mb-1 flex items-center gap-1">
                  <Check className="size-3" /> Después
                </p>
                <p className="text-xs line-clamp-4">{c.despues || "(vacío)"}</p>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground italic">{c.razon}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-3">
        <Button onClick={onAplicar} disabled={isApplying} className="gap-2">
          {isApplying ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Aplicar cambios
        </Button>
        <Button variant="ghost" onClick={onCancelar} disabled={isApplying}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
