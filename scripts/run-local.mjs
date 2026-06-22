import { spawn } from "node:child_process";
import { resolve } from "node:path";

function run(script, env = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [resolve(script)], {
      stdio: "inherit",
      env: { ...process.env, ...env }
    });

    child.on("error", rejectRun);
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${script} failed with exit code ${code}.`));
    });
  });
}

await run("scripts/capture-inventory.mjs");
await run("scripts/update-feed.mjs", { ACF_SEARCH_FILE: "cache/acf-current.html" });
