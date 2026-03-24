export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/api/poketrace', '/v1');
  const targetUrl = `https://api.poketrace.com${path}${url.search}`;

  const response = await fetch(targetUrl, {
    headers: {
      'X-API-Key': 'pc_fb0e8b76efbaf35454be5d403556bed5207cf71ab24312c5',
      'Content-Type': 'application/json',
    },
  });

  const data = await response.text();

  return new Response(data, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}