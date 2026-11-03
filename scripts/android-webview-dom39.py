"""Read visible DOM bounds from the debug APK; all interactions remain real ADB touches.

DOM-derived nodes are explicitly marked. This does not claim a TalkBack test.
"""
import json, re, subprocess, urllib.request, websocket
import xml.etree.ElementTree as ET

EXPRESSION="""JSON.stringify({width:innerWidth,visibility:document.visibilityState,url:location.href,ready:document.readyState,slides:document.querySelectorAll('.slide').length,model:typeof HomeModel,registry:typeof VeldioImages39,rows:Array.from(document.querySelectorAll('button,input,h1,h2,h3,p,label,[role=status],strong')).map(e=>{let r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:(e.innerText||e.textContent||e.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim(),tag:e.tagName,clickable:e.matches('button,input'),x:r.x,y:r.y,w:r.width,h:r.height,shown:s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&r.bottom>0&&r.y<innerHeight};}).filter(r=>r.shown)})"""

def augment(root, package, output):
    web=next((n for n in root.iter('node') if n.get('class')=='android.webkit.WebView'),None)
    if web is None:return
    bounds=list(map(int,re.findall(r'\d+',web.get('bounds',''))))
    if len(bounds)!=4 or bounds[2]<=bounds[0]:return
    pid=subprocess.check_output(['adb','shell','pidof',package],text=True).strip().split()[0]
    subprocess.run(['adb','forward','tcp:9222','localabstract:webview_devtools_remote_'+pid],check=True,stdout=subprocess.DEVNULL)
    with urllib.request.urlopen('http://127.0.0.1:9222/json/list',timeout=5) as response:targets=json.load(response)
    def visible(target):
        try:
            description=json.loads(target.get('description')or'{}')
            return description.get('attached',True) and description.get('visible',True)
        except ValueError:return True
    for target in targets:
        if not visible(target) or not target.get('url','').startswith('file:///android_asset/'):continue
        connection=websocket.create_connection(target['webSocketDebuggerUrl'],timeout=6,suppress_origin=True)
        try:
            connection.send(json.dumps({'id':1,'method':'Runtime.evaluate','params':{'expression':EXPRESSION,'returnByValue':True}}))
            while True:
                result=json.loads(connection.recv())
                if result.get('id')==1:break
            data=json.loads(result['result']['result']['value'])
        finally:connection.close()
        if data.get('visibility')!='visible':continue
        output.write_text(json.dumps(data,ensure_ascii=False,indent=2))
        scale=(bounds[2]-bounds[0])/data['width']
        for item in data['rows']:
            x1=max(bounds[0],round(bounds[0]+item['x']*scale));y1=max(bounds[1],round(bounds[1]+item['y']*scale))
            x2=min(bounds[2],round(bounds[0]+(item['x']+item['w'])*scale));y2=min(bounds[3],round(bounds[1]+(item['y']+item['h'])*scale))
            if x2<=x1 or y2<=y1:continue
            ET.SubElement(web,'node',{'text':item['text'],'content-desc':'','class':'webview.dom.'+item['tag'],'source':'debug-webview-cdp','clickable':str(item['clickable']).lower(),'bounds':f'[{x1},{y1}][{x2},{y2}]'})
        return
