import { pool } from "./db-pool";
import { isHashedPin, hashPin, validatePinFormat } from "./security-pins";

export type MaintenanceTask =
  | "sync_negocio"
  | "seed_demo"
  | "ensure_waiters"
  | "migrate_pins";

export const VALID_MAINTENANCE_TASKS: ReadonlySet<MaintenanceTask> = new Set([
  "sync_negocio",
  "seed_demo",
  "ensure_waiters",
  "migrate_pins",
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface QueryRunner {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

export interface MaintenanceOptions {
  businessId: string;
  task: MaintenanceTask;
  apply?: boolean;
  queryRunner?: QueryRunner;
}

export interface MaintenanceActionItem {
  action:
    | "sync_negocio_insert"
    | "sync_negocio_noop"
    | "sync_negocio_missing_source"
    | "seed_demo_insert_negocio"
    | "seed_demo_insert_waiters"
    | "seed_demo_noop"
    | "ensure_waiters_insert"
    | "ensure_waiters_noop"
    | "ensure_waiters_missing_negocio"
    | "preserve_existing_hash"
    | "hash_valid_plain_pin"
    | "revoke_invalid_pin";
  targetId?: string;
  detail: string;
}

export interface MaintenanceReport {
  businessId: string;
  task: MaintenanceTask;
  mode: "dry-run" | "applied";
  writesExecuted: number;
  actions: MaintenanceActionItem[];
}

/**
 * Validates that businessId is a strict UUID and task is one of the allowed maintenance tasks.
 */
export function assertValidMaintenanceOptions(businessId: unknown, task: unknown): {
  businessId: string;
  task: MaintenanceTask;
} {
  if (typeof businessId !== "string" || !UUID_REGEX.test(businessId.trim())) {
    throw new Error("Se requiere un UUID válido de negocio (--business-id=<uuid>). No se permite selección global.");
  }
  if (typeof task !== "string" || !VALID_MAINTENANCE_TASKS.has(task as MaintenanceTask)) {
    throw new Error(
      `Se requiere una tarea válida (${Array.from(VALID_MAINTENANCE_TASKS).join(", ")}).`
    );
  }
  return {
    businessId: businessId.trim(),
    task: task as MaintenanceTask,
  };
}

/**
 * Parses CLI arguments for explicit maintenance execution.
 * Rejects --all or missing businessId/task. Defaults to dry-run (apply=false).
 */
export function parseMaintenanceCliArgs(argv: string[]): {
  businessId: string;
  task: MaintenanceTask;
  apply: boolean;
} {
  let businessId = "";
  let task = "";
  let apply = false;

  for (const arg of argv) {
    if (arg === "--all" || arg.startsWith("--all=")) {
      throw new Error("La opción --all está prohibida. Debe especificar exactamente un UUID de negocio.");
    }
    if (arg === "--apply") {
      apply = true;
    } else if (arg.startsWith("--business-id=")) {
      businessId = arg.slice("--business-id=".length);
    } else if (arg.startsWith("--task=")) {
      task = arg.slice("--task=".length);
    }
  }

  const validated = assertValidMaintenanceOptions(businessId, task);
  return { ...validated, apply };
}

/**
 * Runs ONE explicit, business-scoped maintenance task.
 * Never runs automatically on import or HTTP requests. Defaults to dry-run simulation (apply=false).
 * Never logs or returns plaintext PINs or bcrypt hashes.
 */
export async function runStaffMaintenance(options: MaintenanceOptions): Promise<MaintenanceReport> {
  const { businessId, task } = assertValidMaintenanceOptions(options.businessId, options.task);
  const apply = options.apply === true;
  const runner: QueryRunner = options.queryRunner ?? pool;
  const actions: MaintenanceActionItem[] = [];
  let writesExecuted = 0;

  if (task === "sync_negocio") {
    const { rows: restRows } = await runner.query(
      `SELECT id, name, slug FROM "Restaurant" WHERE id = $1 LIMIT 1`,
      [businessId]
    );
    if (restRows.length === 0) {
      actions.push({
        action: "sync_negocio_missing_source",
        targetId: businessId,
        detail: "No existe registro fuente en Restaurant para el UUID indicado.",
      });
    } else {
      const { rows: negRows } = await runner.query(
        `SELECT id FROM negocios WHERE id = $1::uuid LIMIT 1`,
        [businessId]
      );
      if (negRows.length > 0) {
        actions.push({
          action: "sync_negocio_noop",
          targetId: businessId,
          detail: "El negocio ya existe en negocios.",
        });
      } else {
        actions.push({
          action: "sync_negocio_insert",
          targetId: businessId,
          detail: apply ? "Negocio sincronizado desde Restaurant." : "[DRY-RUN] Planificada inserción en negocios desde Restaurant.",
        });
        if (apply) {
          await runner.query(
            `INSERT INTO negocios (id, nombre, slug, numero_mesas)
             VALUES ($1::uuid, $2, $3, 10)
             ON CONFLICT (id) DO NOTHING`,
            [businessId, restRows[0].name, restRows[0].slug]
          );
          writesExecuted++;
        }
      }
    }
  } else if (task === "seed_demo") {
    const { rows: negRows } = await runner.query(
      `SELECT id FROM negocios WHERE id = $1::uuid LIMIT 1`,
      [businessId]
    );
    if (negRows.length === 0) {
      actions.push({
        action: "seed_demo_insert_negocio",
        targetId: businessId,
        detail: apply ? "Negocio demo creado para el UUID explícito." : "[DRY-RUN] Planificada creación de negocio demo para el UUID explícito.",
      });
      if (apply) {
        await runner.query(
          `INSERT INTO negocios (id, nombre, slug, numero_mesas)
           VALUES ($1::uuid, 'Restaurante Demo', $2, 12)
           ON CONFLICT (id) DO NOTHING`,
          [businessId, `demo-${businessId.slice(0, 8)}`]
        );
        writesExecuted++;
      }
    } else {
      actions.push({
        action: "seed_demo_noop",
        targetId: businessId,
        detail: "El negocio ya existe en negocios.",
      });
    }

    const { rows: camCountRows } = await runner.query(
      `SELECT COUNT(*)::int AS c FROM camareros WHERE negocio_id = $1::uuid`,
      [businessId]
    );
    if ((camCountRows[0]?.c ?? 0) === 0) {
      actions.push({
        action: "seed_demo_insert_waiters",
        targetId: businessId,
        detail: apply ? "Insertados 3 meseros demo con PIN nulo." : "[DRY-RUN] Planificada inserción de 3 meseros demo con PIN nulo.",
      });
      if (apply) {
        await runner.query(
          `INSERT INTO camareros (negocio_id, nombre, pin)
           VALUES
             ($1::uuid, 'Carlos Gómez', NULL),
             ($1::uuid, 'María López', NULL),
             ($1::uuid, 'Andrés Torres', NULL)`,
          [businessId]
        );
        writesExecuted++;
      }
    }
  } else if (task === "ensure_waiters") {
    const { rows: negRows } = await runner.query(
      `SELECT id FROM negocios WHERE id = $1::uuid LIMIT 1`,
      [businessId]
    );
    if (negRows.length === 0) {
      actions.push({
        action: "ensure_waiters_missing_negocio",
        targetId: businessId,
        detail: "El negocio no existe en negocios; no se insertan meseros.",
      });
    } else {
      const { rows: camCountRows } = await runner.query(
        `SELECT COUNT(*)::int AS c FROM camareros WHERE negocio_id = $1::uuid`,
        [businessId]
      );
      if ((camCountRows[0]?.c ?? 0) === 0) {
        actions.push({
          action: "ensure_waiters_insert",
          targetId: businessId,
          detail: apply ? "Insertados Mesero 1 y Mesero 2 con PIN nulo." : "[DRY-RUN] Planificada inserción de Mesero 1 y Mesero 2 con PIN nulo.",
        });
        if (apply) {
          await runner.query(
            `INSERT INTO camareros (negocio_id, nombre, pin)
             VALUES
               ($1::uuid, 'Mesero 1', NULL),
               ($1::uuid, 'Mesero 2', NULL)`,
            [businessId]
          );
          writesExecuted++;
        }
      } else {
        actions.push({
          action: "ensure_waiters_noop",
          targetId: businessId,
          detail: "El negocio ya tiene camareros registrados.",
        });
      }
    }
  } else if (task === "migrate_pins") {
    const { rows: staffRows } = await runner.query(
      `SELECT id, pin FROM camareros WHERE negocio_id = $1::uuid AND pin IS NOT NULL`,
      [businessId]
    );

    for (const member of staffRows) {
      const rawPin = String(member.pin || "").trim();

      // 1. Reconocer y conservar primero cualquier hash bcrypt existente sin escritura
      if (isHashedPin(rawPin)) {
        actions.push({
          action: "preserve_existing_hash",
          targetId: member.id,
          detail: "Hash bcrypt existente reconocido y conservado sin UPDATE.",
        });
        continue;
      }

      // 2. Solo después validar PIN plano con las reglas actuales (4-8 dígitos, sin lista negra)
      const validation = validatePinFormat(rawPin);
      if (!validation.valid || !validation.cleanPin) {
        actions.push({
          action: "revoke_invalid_pin",
          targetId: member.id,
          detail: apply ? "PIN plano inválido o en lista negra revocado a NULL." : "[DRY-RUN] Planificada revocación a NULL por PIN plano inválido o en lista negra.",
        });
        if (apply) {
          await runner.query(
            `UPDATE camareros SET pin = NULL WHERE id = $1 AND negocio_id = $2::uuid`,
            [member.id, businessId]
          );
          writesExecuted++;
        }
      } else {
        actions.push({
          action: "hash_valid_plain_pin",
          targetId: member.id,
          detail: apply ? "PIN plano válido migrado a hash bcrypt." : "[DRY-RUN] Planificada migración de PIN plano válido a hash bcrypt.",
        });
        if (apply) {
          const secureHash = hashPin(validation.cleanPin);
          await runner.query(
            `UPDATE camareros SET pin = $1 WHERE id = $2 AND negocio_id = $3::uuid`,
            [secureHash, member.id, businessId]
          );
          writesExecuted++;
        }
      }
    }
  }

  return {
    businessId,
    task,
    mode: apply ? "applied" : "dry-run",
    writesExecuted,
    actions,
  };
}
