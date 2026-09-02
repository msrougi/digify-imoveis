import crypto from "node:crypto";

const base64url = value => Buffer.from(value).toString("base64url");
const password = `${base64url(crypto.randomBytes(18))}!Aa9`;
// Cloudflare Workers WebCrypto rejects PBKDF2 iteration counts above 100000.
const iterations = 100000;
const salt = crypto.randomBytes(18);
const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");

console.log("\nGuarde esta senha no gerenciador de senhas. Ela aparece uma única vez:\n");
console.log(`NOVA_SENHA_MONTASITE=${password}`);
console.log("\nCopie os três valores abaixo para Secrets do Cloudflare Pages:\n");
console.log(`MONTASITE_PASSWORD_HASH=${`pbkdf2$${iterations}$${base64url(salt)}$${base64url(hash)}`}`);
console.log(`MONTASITE_SESSION_SECRET=${base64url(crypto.randomBytes(48))}`);
console.log(`MONTASITE_OTP_SECRET=${base64url(crypto.randomBytes(48))}`);
console.log("\nNão crie um secret chamado NOVA_SENHA_MONTASITE; esse primeiro valor é somente a senha para você entrar.");
