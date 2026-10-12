"""Offline checks for the deployment's refusal and configuration-preservation guards."""
from pathlib import Path
import json,re,subprocess,sys,tempfile,copy
script=Path(__file__).parents[1]/'releases/deploy-shift-outcomes.sh'
blocks=re.findall(r"<<'PY'\n([\s\S]*?)\nPY",script.read_text())
app='/opt/apps/fets-live'
container={'Config':{'Image':'fets-live-app','Cmd':['nginx','-g','daemon off;'],'Entrypoint':['/docker-entrypoint.sh'],'Env':['TZ=Asia/Kolkata'],'Labels':{'com.docker.compose.project':'fets-live','com.docker.compose.service':'app','com.docker.compose.project.working_dir':app}},'Mounts':[{'Type':'bind','Source':'/example/nginx','Destination':'/etc/nginx','RW':False,'Propagation':'rprivate'}],'HostConfig':{'PortBindings':{'80/tcp':[{'HostIp':'127.0.0.1','HostPort':'8080'}]},'NetworkMode':'fets-live_default','RestartPolicy':{'Name':'unless-stopped'}}}
checks=0
with tempfile.TemporaryDirectory() as tmp:
 r=Path(tmp)
 def write(name,data): (r/name).write_text(json.dumps(data))
 def run(block): return subprocess.run([sys.executable,'-c',block,str(r),app],text=True,capture_output=True)
 write('container.before.json',[container]);write('image.before.json',[{'Config':container['Config']}]);write('compose.before.json',{'services':{'app':{'build':{'context':app}}}})
 assert run(blocks[0]).returncode==0;checks+=1
 changed=copy.deepcopy(container);changed['Config']['Labels']['com.docker.compose.project']='fets-online';write('container.before.json',[changed]);assert run(blocks[0]).returncode!=0;checks+=1
 changed=copy.deepcopy(container);changed['Mounts'].append({'Destination':'/usr/share/nginx/html'});write('container.before.json',[changed]);assert run(blocks[0]).returncode!=0;checks+=1
 write('container.before.json',[container]);write('container.after.json',[container])
 for name in ['nginx.before','nginx.after']:
  (r/name).mkdir();(r/name/'default.conf').write_text('server { listen 80; }')
 assert run(blocks[-1]).returncode==0;checks+=1
 changed=copy.deepcopy(container);changed['Config']['Env']=['TZ=UTC'];write('container.after.json',[changed]);assert run(blocks[-1]).returncode!=0;checks+=1
 write('container.after.json',[container]);(r/'nginx.after/default.conf').write_text('server { listen 81; }');assert run(blocks[-1]).returncode!=0;checks+=1
print(f'{checks} deployment guard checks passed; no server was contacted.')
