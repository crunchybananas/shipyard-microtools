"""The Island: an authored lighthouse stair, vaulted rooms, headland and wind pines.
Blender is the source DCC. Runtime meshes and editable scene are exported together.
"""
import bpy, math, random, json, re
from pathlib import Path
from mathutils import Vector
SRC=Path(__file__).resolve().parent; ROOT=SRC.parents[1]
T=json.loads(re.search(r'// layout:start\s*([\s\S]*?)\s*// layout:end',(ROOT/'js/tower-course.js').read_text()).group(1))
random.seed(8306); bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
PARTS={}; ACTIVE='towerShaft'
COL={'chalk':(.62,.64,.58,1),'stone':(.30,.33,.31,1),'wet':(.105,.145,.155,1),'iron':(.075,.105,.10,1),'copper':(.25,.39,.33,1),'oak':(.28,.21,.12,1),'cut':(.40,.32,.20,1),'pine':(.045,.115,.084,1),'tip':(.115,.23,.135,1),'moss':(.19,.235,.12,1),'paper':(.65,.66,.53,1),'blue':(.075,.24,.29,1)}
def add(v,f,c):
 d=PARTS.setdefault(ACTIVE,{'v':[],'f':[],'c':[]}); off=len(d['v']); d['v'] += [(x,-z,y) for x,y,z in v]
 d['f'] += [tuple(off+i for i in p) for p in f]
 base=COL.get(c,c) if isinstance(c,str) else c
 d['c'] += [base for _ in f]
def box(p,s,c='stone',angle=0):
 x,y,z=p;w,h,d=[a/2 for a in s]; v=[]
 for a,b,k in [(-w,-h,-d),(w,-h,-d),(w,h,-d),(-w,h,-d),(-w,-h,d),(w,-h,d),(w,h,d),(-w,h,d)]:
  v.append((x+a*math.cos(angle)+k*math.sin(angle),y+b,z-a*math.sin(angle)+k*math.cos(angle)))
 add(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],c)
def tube(points,radii,c='iron',n=8):
 v=[]; f=[]
 for i,p in enumerate(points):
  d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
  d.normalize();u=d.cross(Vector((0,1,0)))
  if u.length<.01:u=d.cross(Vector((1,0,0)))
  u.normalize();w=d.cross(u).normalized();r=radii[i] if isinstance(radii,list) else radii
  for j in range(n):v.append(tuple(Vector(p)+r*(math.cos(j*math.tau/n)*u+math.sin(j*math.tau/n)*w)))
 for i in range(len(points)-1):
  for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
 f.extend([tuple(range(n-1,-1,-1)),tuple((len(points)-1)*n+j for j in range(n))]);add(v,f,c)
def course(t):
 a=math.radians(T['startDegrees'])+t*T['turns']*math.tau;r=T['radiusBottom']+(T['radiusTop']-T['radiusBottom'])*t
 return a,r,t*T['rise']
# Double-sided masonry shell, with genuinely open windows aligned to the stair.
windows=[]
for height in [6.4,11.2,16.0]:
 a,r,y=course(height/T['rise']);windows.append((a%math.tau,height+1.25))
N=64;Y=44
for i in range(Y):
 y0=4.7+i*(15.9/Y);y1=4.7+(i+1)*(15.9/Y);ym=(y0+y1)/2
 for j in range(N):
  a0=j*math.tau/N;a1=(j+1)*math.tau/N;am=(a0+a1)/2
  if any(abs((am-wa+math.pi)%math.tau-math.pi)<.165 and abs(ym-wy)<.82 for wa,wy in windows):continue
  r0=4.05-(y0-4.7)/15.9*1.60;r1=4.05-(y1-4.7)/15.9*1.60
  v=[(math.sin(a)*r,y,math.cos(a)*r) for r,y,a in [(r0,y0,a0),(r0,y0,a1),(r1,y1,a1),(r1,y1,a0),(r0-.22,y0,a0),(r0-.22,y0,a1),(r1-.22,y1,a1),(r1-.22,y1,a0)]]
  shade=.91+random.random()*.10
  col=COL['chalk'] if ym>11.4+.17*math.sin(am*5) else COL['stone']
  if ym>18.8:col=COL['iron']
  add(v,[(0,1,2,3)],tuple(q*shade for q in col[:3])+(1,))
  add(v,[(4,7,6,5)],COL['stone'])
# The miniature uses the same profile at a lower mesh density.
ACTIVE='towerShaftFar'
for i in range(12):
 y0=4.7+i*15.9/12;y1=4.7+(i+1)*15.9/12
 for j in range(28):
  a=j*math.tau/28;b=(j+1)*math.tau/28;r0=4.05-i*1.6/12;r1=4.05-(i+1)*1.6/12
  add([(math.sin(q)*r,y,math.cos(q)*r) for q,r,y in [(a,r0,y0),(b,r0,y0),(b,r1,y1),(a,r1,y1)]],[(0,1,2,3)],'iron' if i>10 else 'chalk' if i>4 else 'stone')
ACTIVE='towerShaft'
# Window reveals, copper sills, and stone heads; their openings admit the actual sky.
for a,y in windows:
 r=4.05-(y-4.7)/15.9*1.6
 for yy in [y-.94,y+.94]:box((math.sin(a)*r,yy,math.cos(a)*r),(.96,.14,.44),'chalk',a)
 for side in [-1,1]:
  aa=a+side*.186;box((math.sin(aa)*r,y,math.cos(aa)*r),(.13,1.87,.44),'chalk',aa)
# All 83 treads have real thickness and a radial wedge. Same course as collision.
ACTIVE='towerStair'
for i in range(T['steps']):
 t0=i/T['steps'];t1=(i+1)/T['steps'];a0,r0,_=course(t0);a1,r1,y=course(t1)
 v=[]
 for yy in [y-.12,y]:
  for a,r in [(a0,r0-.58),(a0,r0+.58),(a1,r1+.58),(a1,r1-.58)]:v.append((math.sin(a)*r,yy,math.cos(a)*r))
 add(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'cut' if i%9==0 else 'oak')
 # A pale worn leading edge catches each tread in the window spill.
 a,r,y=course(t0);tube([(math.sin(a)*(r-.56),y+.251,math.cos(a)*(r-.56)),(math.sin(a)*(r+.56),y+.251,math.cos(a)*(r+.56))],.012,'cut',4)
ACTIVE='towerRails'
for side in [-1,1]:
 points=[]
 for i in range(T['steps']+1):
  a,r,y=course(i/T['steps']);r+=side*.56
  points.append((math.sin(a)*r,y+.93,math.cos(a)*r))
  if i%2==0:tube([(math.sin(a)*r,y+.12,math.cos(a)*r),(math.sin(a)*r,y+.93,math.cos(a)*r)],.024,'iron',6)
 tube(points,.033,'copper',6)
# Vault ribs: individual voussoirs with a small mortar gap, flat interior walking clearance.
ACTIVE='vaultRib'
for i in range(15):
 a=i*math.pi/15+.0025;b=(i+1)*math.pi/15-.0025;v=[]
 for z in [-.23,.23]:
  for r,ang in [(3.7,a),(4.06,a),(4.06,b),(3.7,b)]:v.append((r*math.cos(ang),.35+r*math.sin(ang),z))
 add(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],'stone')
for x in [-3.88,3.88]:box((x,.18,0),(.36,.36,.6),'stone')
# Work of many hands in the western room: a long drying rack and tins, no exposition wall.
ACTIVE='archiveFurniture'
for x in [-2.65,2.65]:
 for z in [-.6,.6]:box((x,.44,z),(.12,.88,.12),'oak')
box((0,.92,0),(5.7,.14,1.45),'cut')
for x in [-2.1,-1.1,.1,1.2,2.1]:
 box((x,1.025,0),(.68,.07,.72),'paper',random.uniform(-.15,.15))
 box((x,1.06,.25),(.08,.035,.15),'stone')
for i in range(5):
 x=-2.2+i*1.08;box((x,1.21,-.42),(.65,.30,.34),'iron')
 if i<4:box((x,1.37,-.42),(.60,.035,.30),'copper')
# Hand-cut basalt with broad bedding planes, missing corners, and moss only on upward faces.
def rock(name,seed):
 global ACTIVE;ACTIVE=name;rng=random.Random(seed);v=[];f=[];N=13;R=6
 for j in range(R):
  y=j/(R-1);radius=math.sin(.45+y*2.4)**.35*(1-.25*y)
  for i in range(N):
   a=i*math.tau/N;rr=radius*(.87+rng.random()*.22)+.05*math.sin(j*3+i)
   v.append((math.cos(a)*rr+.18*y,y*2,math.sin(a)*rr*.85))
 for j in range(R-1):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
 f += [tuple(range(N-1,-1,-1)),tuple((R-1)*N+i for i in range(N))]
 for face in f:
  col='moss' if min(v[i][1] for i in face)>1.55 else 'wet' if max(v[i][1] for i in face)<.55 else 'stone'
  add(v,[face],col)
rock('basaltA',43);rock('basaltB',117)
# A genuine walk-through sea arch, not a solid decorative collider.
ACTIVE='headlandArch';v=[];f=[];N=25
for i in range(N+1):
 a=i*math.pi/N
 for rr,z in [(5.6,-2.2),(7.4,-2.2),(7.4,2.2),(5.6,2.2)]:
  noise=.18*math.sin(i*2.74+z);v.append((math.cos(a)*(rr+noise),math.sin(a)*(rr+noise)*1.15,z+.22*math.sin(i*1.2)))
for i in range(N):
 for j in range(4):a=i*4+j;b=i*4+(j+1)%4;f.append((a,b,b+4,a+4))
f += [(3,2,1,0),tuple(N*4+j for j in range(4))];add(v,f,'stone')
# One wind pine, with bent trunk, distinct branch tiers and needle sprays.
ACTIVE='windPineWood'
trunk=[(0,0,0),(.12,1.7,.05),(.45,3.5,0),(1.1,5.1,-.08),(2.0,6.5,-.18),(3.0,7.2,-.1)]
tube(trunk,[.29,.23,.19,.14,.095,.025],'oak',10)
for a in [0,1.4,3.1,4.8]:tube([(0,.35,0),(math.sin(a)*.8,.10,math.cos(a)*.8),(math.sin(a)*1.35,-.2,math.cos(a)*1.35)],[.16,.09,.02],'oak',7)
branches=[]
for j in range(18):
 t=.26+j/25;y=1.4+t*5.1;a=j*2.399;length=(1-t)*3+.9;x=.3+max(0,y-3)*.62
 end=(x+math.cos(a)*length+1.05,y+.34,math.sin(a)*length*.62)
 start=(x,y,0);mid=((start[0]+end[0])*.5,y-.2,end[2]*.4)
 tube([start,mid,end],[.085*(1-t)+.025,.045,.006],'oak',7);branches.append((mid,end))
ACTIVE='windPineNeedles'
for mid,end in branches:
 for k in range(7):
  t=k/6;p=tuple(mid[j]+(end[j]-mid[j])*t for j in range(3))
  for j in range(14):
   a=j*2.4;ln=.20+random.random()*.31;dx=math.cos(a)*ln;dz=math.sin(a)*ln*.65;up=.09+random.random()*.17
   tip=(p[0]+dx+.13,p[1]+up,p[2]+dz)
   add([(p[0]-.045,p[1],p[2]),(p[0]+.045,p[1],p[2]),tip,(p[0],p[1]-.035,p[2]-.04),(p[0],p[1]+.035,p[2]+.04)],[(0,1,2),(3,4,2)],'tip' if j%6==0 else 'pine')
ACTIVE='windPineFar'
for mid,end in branches:
 p=tuple((mid[j]+end[j])*.5 for j in range(3));box(p,(1.1,.20,.8),'pine',math.atan2(end[0]-mid[0],end[2]-mid[2]))
tube(trunk,[.29,.23,.19,.14,.095,.025],'oak',6)
# One material per part; vertex color holds the authored material and cavity palette.
material=bpy.data.materials.new('Landfall mineral and timber');material.use_nodes=True
nodes=material.node_tree.nodes;bs=nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.86
vc=nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';material.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
objs=[];stats={}
for name,d in PARTS.items():
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(d['v'],[],d['f']);mesh.update()
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(material)
 colors=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 for face,col in zip(mesh.polygons,d['c']):
  shade=.95+random.random()*.09
  for li in face.loop_indices:colors.data[li].color=tuple(min(1,c*shade) for c in col[:3])+(1,)
 bpy.context.view_layer.objects.active=obj;mod=obj.modifiers.new('Runtime triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
 stats[name]={'triangles':len(mesh.polygons),'vertices':len(mesh.vertices)};objs.append(obj)
# Save a usable overview camera with the source, and organized collections for editing.
scene=bpy.context.scene;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.16,.21,1)
for o in objs:
 c=bpy.data.collections.new(o.name);scene.collection.children.link(c)
 for old in list(o.users_collection):old.objects.unlink(o)
 c.objects.link(o)
bpy.ops.object.camera_add(location=(34,-36,25));cam=bpy.context.object;cam.name='Overview camera';cam.rotation_euler=(Vector((0,0,9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=31;scene.camera=cam
for pos,power,size in [((6,-10,22),2200,10),((-8,5,14),1700,12)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,9))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1200;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.render.filepath=str(SRC/'landfall.png');scene.view_settings.view_transform='AgX'
# Export all authored parts, then make the overview show the tower only.
bpy.ops.object.select_all(action='DESELECT')
for o in objs:o.select_set(True)
OUT=ROOT/'assets/landfall.glb'
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False,export_yup=True,export_apply=True,export_attributes=True)
for o in objs:
 if not o.name.startswith('tower'):o.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'landfall.blend'))
(SRC/'landfall-geometry.json').write_text(json.dumps({'parts':stats,'totalTriangles':sum(s['triangles'] for s in stats.values()),'bytes':OUT.stat().st_size},indent=2)+'\n')
bpy.ops.render.render(write_still=True)
print(json.dumps(stats))
