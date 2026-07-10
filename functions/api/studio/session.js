import { isAuthenticated, json } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  return json({ authenticated: await isAuthenticated(request, env) });
}
