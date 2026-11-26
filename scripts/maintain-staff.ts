import { parseMaintenanceCliArgs, runStaffMaintenance } from "../src/lib/staff-maintenance";
import { pool } from "../src/lib/db-pool";

async function main() {
  const opts = parseMaintenanceCliArgs(process.argv.slice(2));
  const report = await runStaffMaintenance(opts);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error("[maintain-staff] Error:", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
