import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const apiUrl = (process.env.API_URL ?? "http://localhost:8787").replace(/\/$/, "");
const token = process.env.ADMIN_TOKEN;
const file = resolve(process.argv[2] ?? "data/initial-goals.json");

if (!token) {
  console.error("ADMIN_TOKEN is required");
  process.exit(1);
}

async function main() {
  const body = await readFile(file, "utf8");
  const res = await fetch(`${apiUrl}/api/admin/goals/import`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body
  });
  console.log(res.status, await res.text());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
