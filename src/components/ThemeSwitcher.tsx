import { useEffect, useRef, useState } from "react";
import { Lightbulb, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  { id: "classic", label: "Jack Classic", dot: "bg-teal-600" },
  { id: "dark", label: "Jack Dark", dot: "bg-ink" },
  { id: "ayu", label: "Jack Ayu", dot: "bg-[#FFB454]" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.dataset["theme"] = theme;
  root.classList.toggle("dark", theme !== "classic");
  localStorage.setItem("jack-theme", theme);
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<ThemeId>("classic");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("jack-theme");
    const fallback: ThemeId = THEMES.some((t) => t.id === saved) ? (saved as ThemeId) : "classic";
    const current = (document.documentElement.dataset["theme"] as ThemeId | undefined) ?? fallback;
    setActive(current);
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={open ? "Cerrar cambio de tema" : "Cambiar el tema de la página"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-secondary"
      >
        <Lightbulb className="size-5" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-[calc(100%+0.5rem)] z-50 w-48 rounded-xl border border-border bg-card p-1.5 text-sm shadow-lift">
          <p className="px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Tema
          </p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                applyTheme(t.id);
                setActive(t.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary"
            >
              <span className={cn("size-3 shrink-0 rounded-full border border-border", t.dot)} />
              <span className="flex-1">{t.label}</span>
              {active === t.id && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
