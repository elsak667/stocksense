import os
from aiohttp import web, ClientSession

DIST = '/app/dist'

async def serve_file(request):
    path = request.path
    if path == '/' or path == '':
        path = '/index.html'
    fp = os.path.join(DIST, path.lstrip('/'))
    if os.path.isfile(fp):
        ct = {'js':'application/javascript','css':'text/css','html':'text/html','svg':'image/svg+xml'}.get(fp.rsplit('.',1)[-1],'application/octet-stream')
        return web.FileResponse(fp, headers={'Content-Type': ct})
    return web.FileResponse(os.path.join(DIST, 'index.html'), headers={'Content-Type': 'text/html'})

async def api_proxy(request):
    path = request.path
    qs = request.query_string
    url = f'http://backend:8000{path}'
    if qs:
        url += f'?{qs}'
    body = await request.read()
    headers = dict(request.headers)
    headers.pop('Host', None)
    headers.pop('host', None)
    async with ClientSession() as s:
        async with s.request(request.method, url, headers=headers, data=body) as r:
            rbody = await r.read()
            resp = web.Response(body=rbody, status=r.status)
            for k, v in r.headers.items():
                if k.lower() not in ('transfer-encoding',):
                    resp.headers[k] = v
            return resp

app = web.Application()
app.router.add_route('*', '/api/{path:.*}', api_proxy)
app.router.add_route('*', '/{path:.*}', serve_file)

if __name__ == '__main__':
    web.run_app(app, host='0.0.0.0', port=80)
