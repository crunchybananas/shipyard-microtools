"""Mark repeated review frames without deleting source captures or action records."""
from pathlib import Path
import json, sys
from PIL import Image, ImageChops, ImageStat
root=Path(sys.argv[1]);path=root/'stages.json';data=json.loads(path.read_text());stages=data['stages']
previous=[];seen_text={};groups={};first_scene=set()
protected=('boughs above','working ledge','water in the glass','float has fallen','first window','bay from halfway','high window','above the whole island','light shaft below','drain chamber','inverted lighthouse','western doorway','drying table','lid loose','cellar stair','drowned hall','water in the room','across the bay','changed shore','afterward')
for s in stages:
 s['presentation']='moment';s.pop('repeatOf',None);s.pop('additionalPages',None)
 im=Image.open(root/s['image']).convert('RGB').resize((32,20))
 grey=im.convert('L').resize((10,9));v=list(grey.getdata());bits=sum((v[y*10+x]>v[y*10+x+1])<<(y*9+x) for y in range(9) for x in range(9))
 read=s.get('reading')
 if read:
  lore=read['lore'];seen=seen_text.setdefault(lore,{})
  if read['text'] in seen:
   s['presentation']='repeat';s['repeatOf']=seen[read['text']]
  else:
   seen[read['text']]=s['number'];key=(s['chapter'],lore,s['level'])
   if key in groups:
    first=groups[key];s['presentation']='page';s['repeatOf']=first['number'];first.setdefault('additionalPages',[]).append({'text':read['text'],'image':s['image'],'number':s['number'],'hand':read.get('hand','')})
   else:groups[key]=s
 elif any(p in s['title'].lower() for p in protected) or (s['chapter'],s['level']) not in first_scene:
  first_scene.add((s['chapter'],s['level']))
 else:
  for old,oldim,oldbits in previous:
   if old.get('reading') or old['level']!=s['level']:continue
   distance=bin(bits^oldbits).count('1');mean=sum(ImageStat.Stat(ImageChops.difference(im,oldim)).mean)/3
   if distance<=9 and mean<7:
    s['presentation']='repeat';s['repeatOf']=old['number'];s['visualDifference']={'hashBits':distance,'meanChannelDelta':round(mean,2)};break
 if s['presentation']=='moment':previous.append((s,im,bits))
data['review']={'moments':sum(s['presentation']=='moment' for s in stages),'sourceCaptures':len(stages),'groupedPages':sum(s['presentation']=='page' for s in stages),'repeatedFrames':sum(s['presentation']=='repeat' for s in stages),'method':'Consecutive artifact pages are grouped. Revisited text and perceptually similar frames at the same depth are folded into the action record. All original captures remain available.'}
path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(data['review']))
