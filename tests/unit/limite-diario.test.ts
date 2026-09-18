import { describe, it, expect } from "vitest";
import { FakeSupabase, rowResult, errResult } from "./supabase-fake";
import { obtenerLimiteDiarioEfectivo } from "@/lib/server/limite-diario";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("obtenerLimiteDiarioEfectivo", () => {
  it("mapea la fila de la rpc cuando hay override", async () => {
    const client = new FakeSupabase();
    client.rpcHandler = async (fn, args) => {
      expect(fn).toBe("obtener_limite_diario_efectivo");
      expect(args).toEqual({ p_user_id: "user-1" });
      return rowResult([{ limite: 5, rol: "admin", override: true }]);
    };

    const res = await obtenerLimiteDiarioEfectivo({
      supabase: client as unknown as SupabaseClient,
      userId: "user-1",
    });

    expect(res).toEqual({ limite: 5, rol: "admin", override: true });
  });

  it("mapea el default del rol sin override (user)", async () => {
    const client = new FakeSupabase();
    client.rpcHandler = async () => rowResult([{ limite: 2, rol: "user", override: false }]);

    const res = await obtenerLimiteDiarioEfectivo({
      supabase: client as unknown as SupabaseClient,
      userId: "user-1",
    });

    expect(res).toEqual({ limite: 2, rol: "user", override: false });
  });

  it("normaliza un rol inesperado a 'user'", async () => {
    const client = new FakeSupabase();
    client.rpcHandler = async () => rowResult([{ limite: 4, rol: "editor", override: false }]);

    const res = await obtenerLimiteDiarioEfectivo({
      supabase: client as unknown as SupabaseClient,
      userId: "user-1",
    });

    expect(res).toEqual({ limite: 4, rol: "user", override: false });
  });

  it("lanza si la rpc devuelve error", async () => {
    const client = new FakeSupabase();
    client.rpcHandler = async () => errResult("boom");

    await expect(
      obtenerLimiteDiarioEfectivo({
        supabase: client as unknown as SupabaseClient,
        userId: "user-1",
      }),
    ).rejects.toThrow("boom");
  });

  it("lanza si la rpc no devuelve fila usable", async () => {
    const vacio = new FakeSupabase();
    vacio.rpcHandler = async () => rowResult([]);
    await expect(
      obtenerLimiteDiarioEfectivo({
        supabase: vacio as unknown as SupabaseClient,
        userId: "user-1",
      }),
    ).rejects.toThrow("No se pudo determinar el límite diario");

    const malTipo = new FakeSupabase();
    malTipo.rpcHandler = async () => rowResult([{ limite: "x", rol: "user", override: false }]);
    await expect(
      obtenerLimiteDiarioEfectivo({
        supabase: malTipo as unknown as SupabaseClient,
        userId: "user-1",
      }),
    ).rejects.toThrow("No se pudo determinar el límite diario");
  });
});
