import { json, sessionCookie } from "./_shared.js";

export async function onRequestPost({ request }) {
  return json({ authenticated: false }, 200, { "set-cookie": sessionCookie("", request, 0) });
}
