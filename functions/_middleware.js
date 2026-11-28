export async function onRequest({ next }) {
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self'; img-src 'self' data:; font-src 'self' data:; object-src 'none'; " +
    "base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
  );
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
