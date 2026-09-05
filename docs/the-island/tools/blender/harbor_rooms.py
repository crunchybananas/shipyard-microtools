"""Original Island environment kit. Run with Blender --background --python this-file.
No source biography, external assets, or network dependencies are used in this file.
All geometry is authored here; game coordinates are converted to Blender Z-up.
"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets'/'harbor-rooms.glb'
SRC=Path(__file__).resolve().parent
random.seed(240)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
PARTS={}; ACTIVE='roomStructure'
COLORS={'oak':(.30,.16,.075,1),'edge':(.46,.27,.12,1),'pine':(.51,.35,.19,1),'dark':(.055,.065,.065,1),'blue':(.10,.24,.31,1),'patch':(.31,.47,.46,1),'linen':(.70,.68,.52,1),'cream':(.76,.80,.70,1),'rust':(.28,.105,.055,1),'gold':(.57,.36,.13,1),'leaf':(.16,.34,.16,1)}
mat=bpy.data.materials.new('Painted wood and cloth'); mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.82
vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color'
mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
def xyz(p):return(p[0],-p[2],p[1])
def finish(obj,color,bevel=0):
 obj.name=ACTIVE+'_'+str(len(PARTS.get(ACTIVE,[])))
 bpy.context.view_layer.objects.active=obj
 if bevel:
  mod=obj.modifiers.new('Softened by use','BEVEL');mod.width=bevel;mod.segments=2
  bpy.ops.object.modifier_apply(modifier=mod.name)
 obj.data.materials.clear();obj.data.materials.append(mat)
 attr=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 base=COLORS.get(color,color)
 for poly in obj.data.polygons:
  shade=random.uniform(.96,1.04)
  for li in poly.loop_indices:attr.data[li].color=tuple(min(1,v*shade) for v in base[:3])+(1,)
 PARTS.setdefault(ACTIVE,[]).append(obj)
 return obj

def box(pos,size,color='oak',bevel=.014,rot=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos));o=bpy.context.object
 o.scale=(size[0],size[2],size[1]);o.rotation_euler.z=-rot
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,color,bevel)
def cyl(pos,radius,height,color='oak',vertices=16,r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=radius if r2 is None else r2,depth=height,location=xyz(pos))
 return finish(bpy.context.object,color,.006)
def ball(pos,scale,color='oak'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=1,location=xyz(pos));o=bpy.context.object
 o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,color)
def rod(a,b,r,color='oak'):
 av=Vector(xyz(a));bv=Vector(xyz(b));d=bv-av
 bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=(av+bv)/2);o=bpy.context.object
 o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
 return finish(o,color)
def mesh(verts,faces,color):
 m=bpy.data.meshes.new(ACTIVE);m.from_pydata([xyz(p) for p in verts],[],faces);m.update()
 o=bpy.data.objects.new(ACTIVE,m);bpy.context.collection.objects.link(o);return finish(o,color)
def cloth(x,y,z,w,d,color,drop=.11):
 verts=[];faces=[];nx=32;nz=18
 for j in range(nz+1):
  v=j/nz
  for i in range(nx+1):
   u=i/nx;edge=abs(v-.5)*2
   yy=y+.013*math.sin(u*31+v*7)+.02*math.sin(v*22+u*4)-drop*max(0,(edge-.76)/.24)
   verts.append((x+(u-.5)*w,yy,z+(v-.5)*d))
 for j in range(nz):
  for i in range(nx):
   a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
 o=mesh(verts,faces,color)
 for p in o.data.polygons:p.use_smooth=True
 return o

def mug(x,y,z,color='cream',r=.105):
 # A turned, open vessel, including inner wall and a genuine empty mouth.
 n=20;verts=[]
 for radius,yy in [(r*.78,0),(r,.025),(r,.18),(r-.016,.18),(r-.022,.035)]:
  for i in range(n):
   a=i*math.tau/n;verts.append((x+radius*math.cos(a),y+yy,z+radius*math.sin(a)))
 faces=[]
 for j in range(4):
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 faces.append(tuple(range(4*n,5*n)));mesh(verts,faces,color)
 for i in range(9):
  a=-math.pi*.65+i*math.pi*1.3/9;b=-math.pi*.65+(i+1)*math.pi*1.3/9
  rod((x+r+.07*math.cos(a),y+.095+.08*math.sin(a),z),(x+r+.07*math.cos(b),y+.095+.08*math.sin(b),z),.014,color)

def boat(x,y,z,s=1):
 # Open clinker hull, deliberately stitched across one damaged seam.
 n=14;vs=[]
 for row in range(4):
  for i in range(n+1):
   t=i/n;xx=(t-.5)*.72*s;width=math.sin(math.pi*t)*(.11+.02*row)*s
   yy=y+(.014+row*.033+abs(t-.5)**3*.22)*s
   vs.extend([(x+xx,yy,z-width),(x+xx,yy,z+width)])
 fs=[]
 for row in range(3):
  for i in range(n):
   a=row*(n+1)*2+i*2;b=a+(n+1)*2
   fs.extend([(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
 mesh(vs,fs,'pine')
 box((x,y+.021*s,z),(.45*s,.022*s,.08*s),'oak',.004)
 for xx in [-.16,.14]:box((x+xx*s,y+.09*s,z),(.047*s,.014*s,.205*s),'edge',.004)
 for i in range(4):rod((x-.035*s+i*.018*s,y+.123*s,z-.138*s),(x-.025*s+i*.018*s,y+.089*s,z-.125*s),.0035*s,'blue')

# A circular floor with individually cut planks; the door remains unobstructed.
for j in range(-11,12):
 z=j*.215;span=math.sqrt(max(0,2.51**2-z*z))
 if span>.2:box((0,.09,z),(span*2-.035,.07,.201),'pine',.009)
# Cot, feet, headboard and thin mattress; journal remains on its original spot.
for x in [-1.75,-.16]:
 for z in [1.05,1.68]:box((x,.24,z),(.075,.48,.075),'oak')
box((-.95,.28,1.35),(1.96,.14,.83),'oak')
for z in [1.0,1.70]:box((-.95,.35,z),(2.04,.11,.08),'edge')
for x in [-1.91,.01]:
 box((x,.61,1.35),(.075,.67,.83),'oak')
 for z in [1.11,1.35,1.59]:rod((x,.40,z),(x,.91,z),.022,'edge')
box((-.95,.43,1.35),(1.85,.17,.76),'linen',.07)
ACTIVE='roomCloth'
cloth(-.84,.558,1.35,1.64,.91,'blue',.18)
# Blue cloth remains visibly creased; repair is carried by the sewn line below.
for i in range(9):
 x=-.45+i*.036;rod((x,.574,1.251),(x+.011,.574,1.265),.0027,'linen')
ball((-1.6,.568,1.35),(.25,.095,.32),'linen')
# A small woven oval rug that never covers the threshold.
for j in range(-8,9):
 z=-.34+j*.067;w=math.sqrt(max(0,1-(j/9)**2))*.92
 box((-.02,.135,z),(w*2,.012,.052),'blue' if j%3 else 'patch',.004)
ACTIVE='roomStructure'
# The stove is detailed but compact; no invisible collision is added.
cyl((1.4,.43,1.2),.36,.74,'dark',20,r2=.32)
cyl((1.4,.83,1.2),.39,.06,'dark',20)
for x in [1.18,1.62]:
 for z in [.98,1.42]:rod((x,.08,z),(x,.25,z),.037,'dark')
box((1.4,.42,.84),(.31,.31,.025),'rust',.035)
for i in [-1,0,1]:box((1.4+i*.074,.38,.817),(.043,.10,.012),'dark',.006)
rod((1.4,.87,1.3),(1.4,3.4,1.3),.078,'dark')
# Kettle, lid, curved handle and spout.
ball((1.40,1.00,1.17),(.22,.17,.20),'dark');cyl((1.4,1.155,1.17),.115,.03,'gold')
for i in range(12):
 a=i*math.pi/12;b=(i+1)*math.pi/12
 rod((1.4+.21*math.cos(a),1.04+.31*math.sin(a),1.17),(1.4+.21*math.cos(b),1.04+.31*math.sin(b),1.17),.018,'dark')
rod((1.57,1.00,1.13),(1.72,1.14,1.1),.045,'dark')
# A low table for two, close to the window; hand-rests, repaired rather than perfect.
box((.33,.67,1.83),(1.13,.08,.57),'edge')
for x in [-.13,.8]:
 for z in [1.63,2.02]:rod((x,.07,z),(x,.64,z),.027,'oak')
ACTIVE='roomCeramics'
mug(.08,.715,1.82);mug(.52,.715,1.86,'blue',.095)
# A green shoot kept in a repurposed tin.
cyl((.76,.79,1.97),.07,.15,'gold',12)
rod((.76,.83,1.97),(.77,1.16,1.97),.006,'leaf')
for j in range(5):
 y=.93+j*.046;sgn=(-1)**j
 mesh([(.765,y,1.97),(.765+sgn*.105,y+.05,1.96),(.765+sgn*.12,y+.075,1.97),(.77,y+.035,1.989)],[(0,1,2,3)],'leaf')
# Boot pair, toes turned away from the stove.
ACTIVE='roomStructure'
for x in [.83,1.02]:
 ball((x,.13,.94),(.073,.08,.16),'dark');cyl((x,.24,1.01),.066,.21,'dark',10)
# The spare chair is independent so making a place can move it visibly.
ACTIVE='spareChair'
box((.50,.46,.65),(.48,.045,.46),'pine',.035)
for x in [.30,.70]:
 for z in [.47,.83]:rod((x,.07,z),(x,.45,z),.023,'oak')
for x in [.29,.71]:rod((x,.44,.85),(x,1.11,.91),.026,'oak')
box((.5,1.08,.91),(.49,.10,.04),'edge',.04)
for x in [.38,.5,.62]:rod((x,.53,.86),(x,1.06,.90),.014,'oak')
# One mismatched replacement rung, bound with pale cord.
rod((.29,.21,.65),(.71,.21,.65),.018,'patch')
for i in range(4):rod((.31+i*.013,.225,.63),(.31+i*.013,.20,.67),.003,'linen')
# A boat left on the window table. Its return is a stateful payoff, not a collectible score.
ACTIVE='keepsakeBoat';boat(.33,.74,1.82,.88)
# Three small carved birds suspended in an irregular mobile above the room.
ACTIVE='listeningMobile'
rod((-.45,2.92,1.8),(.52,2.97,1.9),.014,'oak')
for x,y,z in [(-.43,2.54,1.8),(.05,2.38,1.84),(.5,2.66,1.9)]:
 rod((x,2.95,z),(x,y,z),.003,'linen')
 ball((x,y,z),(.075,.041,.038),'cream')
 mesh([(x,y,z),(x-.16,y+.04,z+.04),(x-.25,y+.16,z+.065),(x-.15,y+.13,z),(x+.05,y,z),(x+.16,y+.03,z-.03),(x+.25,y+.15,z-.035),(x+.15,y+.11,z)],[(0,1,2,3),(4,5,6,7)],'cream')
# A tide bench, for the listener below: occupied by objects, with room beside them.
ACTIVE='tideBench'
for z in [-.14,0,.14]:box((0,.47,z),(1.75,.055,.115),'pine')
for x in [-.65,.65]:
 for z in [-.14,.14]:rod((x,.0,z),(x,.45,z),.037,'oak')
rod((-.65,.2,0),(.65,.2,0),.029,'edge')
boat(-.42,.51,0,.62);mug(.55,.505,0,'blue',.087)
# Lower workbench. An opened chair-like cradle, without adding a new room shell.
ACTIVE='sourceCradle'
box((0,.72,0),(1.05,.075,.58),'pine')
for x in [-.42,.42]:
 for z in [-.21,.21]:rod((x,.02,z),(x,.69,z),.03,'oak')
for x in [-.25,.25]:box((x,.80,0),(.05,.09,.31),'edge')
boat(0,.85,0,1.1)
# A strip of blue cloth, ordinary and recognisable across the different rooms.
cloth(.39,.776,.0,.28,.62,'blue',.15)
# Consolidate each authored part to ONE mesh and material. This bounds runtime draws.
objects=[];stats={}
for name,parts in PARTS.items():
 bpy.ops.object.select_all(action='DESELECT')
 for obj in parts:obj.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();obj=bpy.context.object;obj.name=name
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
 tri=obj.modifiers.new('Runtime triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
 stats[name]={'triangles':len(obj.data.polygons),'vertices':len(obj.data.vertices)};objects.append(obj)
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'harbor-rooms.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False,export_yup=True,export_apply=True,export_attributes=True)
(SRC/'geometry.json').write_text(json.dumps({'generator':'Blender 5.2.1 LTS','parts':stats,'totalTriangles':sum(s['triangles'] for s in stats.values()),'glbBytes':OUT.stat().st_size},indent=2))
# Contact sheet render of the real room, after export; independent props hidden here.
for o in objects:
 if o.name in ['tideBench','sourceCradle','keepsakeBoat']:o.hide_render=True
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.20,.25,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
for name,pos,power,color,size in [('Window',(-3,4,0),500,(.68,.82,1),4),('Lamp',(0,2.9,.6),130,(1,.77,.48),2),('Door',(0,2,-3),180,(.9,.91,1),4)]:
 bpy.ops.object.light_add(type='AREA',location=xyz(pos));o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size
 direction=Vector(xyz((0,.7,1)))-o.location;o.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=xyz((4.2,4.7,-5.6)));cam=bpy.context.object;cam.rotation_euler=(Vector(xyz((0,.8,.2)))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.4
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.filepath=str(SRC/'east-room.png');scene.view_settings.view_transform='AgX'
bpy.ops.render.render(write_still=True)
print(json.dumps(stats))
