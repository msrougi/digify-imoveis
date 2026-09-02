import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectName = "digify-imoveis";
const encode = value => Buffer.from(value).toString("base64url");
const password = `${encode(crypto.randomBytes(18))}!Aa9`;
const iterations = 210000;
const salt = crypto.randomBytes(18);
const passwordHash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");

const secrets = {
  MONTASITE_ADMIN_EMAIL: "marcelo@digify.live",
  MONTASITE_PASSWORD_HASH: `pbkdf2$${iterations}$${encode(salt)}$${encode(passwordHash)}`,
  MONTASITE_SESSION_SECRET: encode(crypto.randomBytes(48)),
  MONTASITE_OTP_SECRET: encode(crypto.randomBytes(48)),
  MONTASITE_EMAIL_FROM: "Digify MontaSite <montasite@notify.digify.live>"
};

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "digify-montasite-"));
const secretFile = path.join(temporaryDirectory, "secrets.json");

try {
  fs.writeFileSync(secretFile, JSON.stringify(secrets), { mode: 0o600 });

  const result = spawnSync(
    "npx",
    [
      "--yes",
      "wrangler@latest",
      "pages",
      "secret",
      "bulk",
      secretFile,
      "--project-name",
      projectName
    ],
    { stdio: "inherit" }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler terminou com o código ${result.status}.`);

  console.log("\n============================================================");
  console.log("CONFIGURAÇÃO BASE CONCLUÍDA");
  console.log("\nSENHA NOVA DO DIGIFY MONTASITE:\n");
  console.log(password);
  console.log("\nGuarde-a agora. Não envie esta senha por chat ou e-mail.");
  console.log("============================================================\n");
} catch (error) {
  console.error("\nNão foi possível cadastrar os secrets:", error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
