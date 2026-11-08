const base64url = (bytes) =>
  Buffer.from(bytes).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")

const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
])
const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey))
const privateKey = await crypto.subtle.exportKey("jwk", keys.privateKey)

console.log(`VAPID_PUBLIC_KEY=${base64url(publicKey)}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey.d}`)
console.log("VAPID_SUBJECT=mailto:you@example.com")
