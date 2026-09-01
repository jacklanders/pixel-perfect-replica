import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import {
  getAdminDashboard,
  actualizarAppSetting,
  type DiaUsoIA,
  type DatosAdminDashboard,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel de administración — Jack" },
      {
        name: "description",
        content: "Métricas de uso, usuarios y configuración de la app.",
      },
      { property: "og:title", content: "Panel de administración — Jack" },
    ],
  }),
  component: AdminPage,
});

const adminQueryKey = ["admin", "dashboard"];

function AdminPage() {
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getAdminDashboard);

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: adminQueryKey,
    queryFn: () => fetchDashboard(),
  });

  return (
    <AppShell title="Panel de administración" subtitle="Métricas de uso y configuración de Jack.">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={isFetching}
            onClick={() => queryClient.invalidateQueries({ queryKey: adminQueryKey })}
          >
            {isFetching ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-3.5" />
            )}
            Actualizar
          </Button>
        </div>

        {isPending ? (
          <AdminSkeleton />
        ) : isError || !data ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
            <p className="text-sm text-destructive">
              {error?.message ?? "No se pudieron cargar las métricas"}
            </p>
            <Button
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: adminQueryKey })}
            >
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <Kpis data={data} />
            <div className="grid gap-6 lg:grid-cols-2">
              <UsoIaChart uso={data.usoIAUltimos14Dias} />
              <UsuariosRecientes usuarios={data.usuariosRecientes} />
            </div>
            <AppSettings settings={data.appSettings} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpis({ data }: { data: DatosAdminDashboard }) {
  const kpis = [
    { label: "Usuarios", valor: data.totalUsuarios, hint: "perfiles registrados" },
    { label: "CVs", valor: data.totalCvs, hint: "resúmenes creados" },
    { label: "Postulaciones", valor: data.totalPostulaciones, hint: "generadas" },
    { label: "Enviadas", valor: data.postulacionesEnviadas, hint: "con Gmail/servidor" },
    { label: "Vacantes", valor: data.totalVacantes, hint: "cargadas" },
    { label: "Gmail conectado", valor: data.gmailConectados, hint: "usuarios" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((k) => (
        <Card key={k.label} className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">{k.valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsoIaChart({ uso }: { uso: DiaUsoIA[] }) {
  const totalCosto = uso.reduce((acc, d) => acc + d.costoUSD, 0);
  const totalLlamadas = uso.reduce((acc, d) => acc + d.llamadasIA, 0);
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Uso de IA · últimos 14 días</CardTitle>
        <p className="text-xs text-muted-foreground">
          {totalLlamadas} llamadas · USD {totalCosto.toFixed(4)}
        </p>
      </CardHeader>
      <CardContent>
        {uso.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sin actividad en el período.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={uso}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={(f: string) => f.slice(5)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis allowDecimals={false} width={30} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => [
                    String(value),
                    name === "llamadasIA"
                      ? "Llamadas IA"
                      : name === "aplicacionesGeneradas"
                        ? "Postulaciones"
                        : "Costo USD",
                  ]}
                  labelFormatter={(label) => `Fecha: ${String(label)}`}
                />
                <Bar dataKey="llamadasIA" fill="#2a6e6e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="aplicacionesGeneradas" fill="#8fbdbd" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UsuariosRecientes({ usuarios }: { usuarios: DatosAdminDashboard["usuariosRecientes"] }) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Usuarios recientes</CardTitle>
      </CardHeader>
      <CardContent>
        {usuarios.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sin usuarios todavía.</p>
        ) : (
          <ul className="divide-y divide-border">
            {usuarios.map((u) => (
              <li key={u.userId} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.nombre || u.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{u.cantidadCvs} CVs</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("es-AR")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AppSettings({ settings }: { settings: DatosAdminDashboard["appSettings"] }) {
  const queryClient = useQueryClient();
  const saveSetting = useServerFn(actualizarAppSetting);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(settings.map((s) => [s.key, JSON.stringify(s.value)])),
  );

  const mutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      saveSetting({ data: { key, value } }),
    onSuccess: (fila) => {
      queryClient.setQueryData<DatosAdminDashboard>(adminQueryKey, (prev) =>
        prev
          ? {
              ...prev,
              appSettings: prev.appSettings.map((s) => (s.key === fila.key ? fila : s)),
            }
          : prev,
      );
      toast.success("Configuración actualizada");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la configuración"),
  });

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" /> Configuración de la app
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {settings.map((s) => (
            <div key={s.key} className="space-y-2">
              <Label htmlFor={`setting-${s.key}`} className="font-mono text-xs">
                {s.key}
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`setting-${s.key}`}
                  value={valores[s.key] ?? ""}
                  onChange={(e) => setValores((prev) => ({ ...prev, [s.key]: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Guardar"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ key: s.key, value: valores[s.key] ?? "" })}
                >
                  {mutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
