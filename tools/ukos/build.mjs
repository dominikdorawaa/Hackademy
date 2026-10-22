import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createBootSnapshot } from "./snapshot.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.join(root, "client/prototypes/runtime");
const biosRevision = "cc37f35c43bf14865d74ad76879ecf9410f69eb1";
const assets = {
  "seabios.bin":
    "73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98",
  "vgabios.bin":
    "a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880",
};
await mkdir(output, { recursive: true });
if (process.env.UKOS_IMAGE_READY !== "1") {
  execFileSync(
    "docker",
    [
      "build",
      "--platform",
      "linux/386",
      "-t",
      "hackademy-ukos-prototype",
      path.join(root, "tools/ukos"),
    ],
    { stdio: "inherit" },
  );
  const container = execFileSync("docker", [
    "create",
    "hackademy-ukos-prototype",
  ])
    .toString()
    .trim();
  try {
    execFileSync("docker", ["cp", `${container}:/out/.`, output], {
      stdio: "inherit",
    });
  } finally {
    execFileSync("docker", ["rm", container], { stdio: "ignore" });
  }
}
for (const [name, hash] of Object.entries(assets)) {
  const response = await fetch(
    `https://raw.githubusercontent.com/copy/v86/${biosRevision}/bios/${name}`,
  );
  if (!response.ok)
    throw new Error(`Cannot download ${name}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== hash)
    throw new Error(`Invalid checksum for ${name}`);
  await writeFile(path.join(output, name), bytes);
}
await writeFile(
  path.join(output, "v86.wasm"),
  await readFile(path.join(root, "client/node_modules/v86/build/v86.wasm")),
);
await createBootSnapshot(output);
const files = {};
for (const name of (await readdir(output)).sort()) {
  if (name === "manifest.json") continue;
  const bytes = await readFile(path.join(output, name));
  if (bytes.length > 25 * 1024 * 1024)
    throw new Error(`${name} exceeds the Cloudflare Pages 25 MiB limit`);
  files[name] = {
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
const version = createHash("sha256")
  .update(
    JSON.stringify(files),
  )
  .digest("hex")
  .slice(0, 16);
await writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify({ version, biosRevision, files }, null, 2) + "\n",
);
process.stdout.write(JSON.stringify({ version, files }, null, 2) + "\n");
