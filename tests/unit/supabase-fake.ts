/**
 * Helpers para tests unitarios de funciones server-only (BLOQUE 7).
 *
 * FakeSupabase simula la cadena de query-builder de @supabase/supabase-js
 * (from().select().eq().single() / update / insert / upsert / rpc / storage)
 * sin tocar red ni DB. Cada test configura el handler de la tabla que le
 * interesa y en `calls` queda el historial de operaciones resueltas.
 */

export interface FakeOp {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  filters: Array<[string, unknown]>;
  joinedSelect?: string;
  payload?: unknown;
}

export type FakeResult<T = unknown> =
  { data: T; error: null } | { data: null; error: { message: string } };

export type TableHandler = (op: FakeOp) => FakeResult;
export type RpcHandler = (fn: string, args: Record<string, unknown>) => Promise<FakeResult>;
export type StorageDownloadHandler = (path: string) => Promise<FakeResult<Blob>>;
export type StorageRemoveHandler = (
  paths: string[],
) => Promise<{ error: null } | { error: { message: string } }>;

const row = <T>(data: T): FakeResult<T> => ({ data, error: null });
const fail = (message: string): FakeResult<never> => ({ data: null, error: { message } });

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private selectArg?: string;
  private payload?: unknown;
  private op: FakeOp["op"] = "select";

  constructor(
    private readonly client: FakeSupabase,
    private readonly table: string,
  ) {}

  select(joined?: string): this {
    this.selectArg = joined;
    return this;
  }

  eq(key: string, value: unknown): this {
    this.filters.push([key, value]);
    return this;
  }

  order(): this {
    return this;
  }

  maybeSingle(): FakeResult {
    return this.finish();
  }

  single(): FakeResult {
    return this.finish();
  }

  insert(payload: Record<string, unknown>): this {
    this.op = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>): this {
    this.op = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload: Record<string, unknown>): this {
    this.op = "upsert";
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  // Hace que la consulta sea awaitable también sin terminal (ej: update/upsert
  // que en supabase-js resuelven al awaitar la cadena directamente).
  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.finish()).then(onfulfilled, onrejected);
  }

  private finish(): FakeResult {
    const op: FakeOp = {
      table: this.table,
      op: this.op,
      filters: this.filters,
      ...(this.selectArg !== undefined ? { joinedSelect: this.selectArg } : {}),
      ...(this.payload !== undefined ? { payload: this.payload } : {}),
    };
    this.client.calls.push(op);

    const handler = this.client.handlers[this.table];
    if (!handler) {
      throw new Error(`[FakeSupabase] No hay handler para la tabla '${this.table}' (${this.op})`);
    }
    return handler(op);
  }
}

export class FakeSupabase {
  readonly calls: FakeOp[] = [];
  handlers: Record<string, TableHandler> = {};
  rpcHandler?: RpcHandler;
  downloadHandler: StorageDownloadHandler = async () => fail("download no configurado");
  removeHandler: StorageRemoveHandler = async () => ({ error: null });
  authUser: { id: string; email: string } | null = null;

  from(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<FakeResult> {
    if (!this.rpcHandler) throw new Error(`[FakeSupabase] No hay rpcHandler para '${fn}'`);
    return this.rpcHandler(fn, args);
  }

  readonly storage = {
    from: (_bucket: string) => ({
      download: async (path: string) => this.downloadHandler(path),
      remove: async (paths: string[]) => this.removeHandler(paths),
      upload: async () => row({ path: `${_bucket}/mock-upload-${Date.now()}` }),
    }),
  };

  readonly auth = {
    getUser: async () =>
      this.authUser
        ? { data: { user: this.authUser }, error: null }
        : { data: { user: null }, error: { message: "FakeSupabase: sin usuario" } },
  };
}

export function rowResult<T>(data: T): FakeResult<T> {
  return row(data);
}

export function errResult(message: string): FakeResult<never> {
  return fail(message);
}

export function blobFrom(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

/** Body del form-urlencoded de una request fetch (para assert del payload OAuth). */
export function formBodyOf(req: { body?: string }): URLSearchParams {
  return new URLSearchParams(req.body ?? "");
}

/** Respuesta fetch mínima (sin depender del global Response del runtime). */
export function fakeResponse(
  status: number,
  body: unknown,
): { ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> } {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => body,
  };
}
