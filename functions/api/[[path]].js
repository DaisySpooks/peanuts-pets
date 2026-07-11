// Cloudflare Pages Function: transparent proxy for /api/* to the Railway
// backend. Pages' _redirects only supports 200-status rewrites to relative,
// same-site paths — it cannot proxy to an external origin like Railway.
// Functions can, by fetching the backend directly and returning its
// response as-is (method, headers, cookies, body, status all preserved).
//
// The frontend's existing fetch('/api/...') calls are untouched: this
// still resolves to the Pages origin from the browser's point of view.
const BACKEND_ORIGIN = 'https://peanuts-pets-production.up.railway.app'

export async function onRequest(context) {
  const { request } = context
  const incomingUrl = new URL(request.url)
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, BACKEND_ORIGIN)

  // Cloning via `new Request(url, request)` carries over method, headers
  // (including Cookie), and body untouched. `redirect: 'manual'` stops this
  // fetch from following a 3xx itself, passing it through to the browser
  // unchanged instead.
  const proxyRequest = new Request(targetUrl, request)
  return fetch(proxyRequest, { redirect: 'manual' })
}
