"""Original Heartwood Frog Alchemist sculpt, modeled against approved monochrome tile.
Blender 5.x: blender --background --python tools/heartwood/build_frog.py
No external model/texture assets. Colors are an interpretation of the monochrome art.
"""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'docs/heartwood-island/assets')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def mat(name,color,rough=.65,metal=0,emission=None):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emission: p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
sage=mat('Sage ceramic skin',(.31,.49,.32)); belly=mat('Warm pale throat',(.70,.76,.43));dark=mat('Ink expression',(.023,.048,.037));eye=mat('Ivory eye rims',(.92,.90,.66),.38);pupil=mat('Glossy forest pupils',(.018,.035,.025),.19);white=mat('Eye glints',(1,.98,.85),.2)
hatmat=mat('Deep teal felt hat',(.055,.16,.16));capemat=mat('Blackberry wine cape',(.28,.075,.13));lining=mat('Cape inner plum',(.40,.15,.22));gold=mat('Old gold piping',(.70,.46,.17),.42,.35);heartmat=mat('Heart clasp enamel',(.85,.31,.25),.32);glass=mat('Glazed sea-glass potion bottle',(.33,.69,.63),.24,.12);potion=mat('Lantern remedy glow',(.88,.73,.26),.28,0,.35);cork=mat('Warm cork',(.38,.24,.12))
root=bpy.data.objects.new('FrogAlchemist',None);bpy.context.collection.objects.link(root)
groups={}
for name in ['Body','Head','Hat','Cape','Flask']:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=root;groups[name]=o

def finish(o,name,material,group='Body'):
 o.name=name;o.data.materials.append(material);o.parent=groups[group]
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
 return o

def ell(name,pos,scale,material,group='Body',seg=20,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=pos);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,material,group)
def curve(name,points,radius,material,group='Body'):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=5;c.bevel_depth=radius;c.bevel_resolution=2
 s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for b,p in zip(s.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(material);o.parent=groups[group];bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o

def mesh(name,verts,faces,material,group='Body'):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);return finish(o,name,material,group)
# Squat rounded frog proportions and splayed webbed feet.
ell('Pear shaped body',(0,.03,.44),(.31,.245,.36),sage)
ell('Cream throat and belly',(0,-.194,.44),(.235,.095,.29),belly)
for side in [-1,1]:
 ell('Folded haunch '+str(side),(side*.31,.01,.28),(.17,.205,.235),sage)
 ell('Heel '+str(side),(side*.32,-.16,.105),(.14,.18,.085),sage)
 footx=side*.35
 # A single broad web with three bulbous toe tips, not separate mammalian fingers.
 verts=[(footx,-.12,.10),(footx-side*.14,-.37,.035),(footx-side*.08,-.47,.045),(footx+side*.02,-.39,.06),(footx+side*.11,-.46,.04),(footx+side*.15,-.33,.07),(footx+side*.24,-.35,.045),(footx+side*.20,-.20,.08)]
 o=mesh('Webbed foot '+str(side),verts,[tuple(range(8))],sage);solid=o.modifiers.new('Soft web thickness','SOLIDIFY');solid.thickness=.035;bev=o.modifiers.new('Rounded web','BEVEL');bev.width=.025;bev.segments=3
 for j,(dx,y) in enumerate([(-.08,-.47),(.11,-.46),(.24,-.35)]):ell('Toe pad '+str(side)+' '+str(j),(footx+side*dx,y,.047),(.048,.055,.035),sage,seg=16,rings=10)
# Broad head, high protruding eyes, a quiet thoughtful expression.
ell('Broad frog face',(0,-.015,.86),(.405,.30,.295),sage,'Head')
ell('Soft lower jaw',(.025,-.19,.765),(.30,.15,.15),sage,'Head')
for side in [-1,1]:
 ell('Eye mound '+str(side),(side*.225,-.10,1.063),(.152,.174,.18),sage,'Head')
 ell('Ivory eye '+str(side),(side*.225,-.244,1.074),(.119,.065,.137),eye,'Head')
 ell('Pupil '+str(side),(side*.225+.025,-.298,1.087),(.080,.037,.103),pupil,'Head')
 ell('Catchlight '+str(side),(side*.225+.008,-.329,1.137),(.026,.012,.029),white,'Head',16,10)
 ell('Nostril '+str(side),(side*.045,-.300,.978),(.012,.009,.014),dark,'Head',12,8)
curve('Thoughtful curved mouth',[(-.23,-.264,.80),(-.13,-.296,.82),(.02,-.307,.875),(.16,-.285,.90),(.28,-.247,.89)],.008,dark,'Head')
curve('Cheek crease',[(-.315,-.218,.87),(-.335,-.232,.835),(-.319,-.239,.808)],.007,dark,'Head')
# Draped open-front cape, visible broad scalloped hem and warm lining.
verts=[];faces=[];N=32;R=8
for j in range(R):
 t=j/(R-1);radius=.24+.31*t;z=.81-.67*t
 for i in range(N+1):
  a=math.radians(-117+234*i/N);r=radius*(1+.035*math.cos(a*7)*t)
  verts.append((math.sin(a)*r,.045+math.cos(a)*r*.72,z+(.025*math.cos(a*6) if j==R-1 else 0)))
for j in range(R-1):
 for i in range(N):k=j*(N+1)+i;faces.append((k,k+1,k+N+2,k+N+1))
cape=mesh('Draped scalloped cape',verts,faces,capemat,'Cape');sol=cape.modifiers.new('Fabric thickness','SOLIDIFY');sol.thickness=.018
for edge in [0,N]:curve('Cape front gold binding '+str(edge),[verts[j*(N+1)+edge] for j in range(R)],.009,gold,'Cape')
curve('Cape hem piping',[verts[(R-1)*(N+1)+i] for i in range(N+1)],.008,gold,'Cape')
# Collar sweeps toward the central heart, preserving the artwork's main edit.
for side in [-1,1]:curve('Soft cape collar '+str(side),[(side*.34,-.05,.79),(side*.25,-.20,.76),(side*.11,-.265,.73),(side*.04,-.28,.72)],.032,capemat,'Cape')
def heart(name,center,size,material):
 pts=[]
 for i in range(48):
  t=i*2*math.pi/48;x=16*math.sin(t)**3;z=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
  pts.append((center[0]+x/32*size,center[1],center[2]+z/32*size))
 o=mesh(name,pts,[tuple(range(48))],material,'Cape');s=o.modifiers.new('Enamel thickness','SOLIDIFY');s.thickness=.025;b=o.modifiers.new('Polished heart edge','BEVEL');b.width=.009;b.segments=3
heart('Gold heart clasp bezel',(0,-.385,.685),.18,gold);heart('Coral heart clasp',(0,-.409,.689),.143,heartmat)
# One hand touches the chin. Opposite hand presents a round flask.
curve('Thinking left arm',[(-.25,-.04,.65),(-.36,-.20,.53),(-.32,-.32,.64),(-.22,-.37,.80)],.058,sage)
ell('Thinking hand',(-.21,-.38,.815),(.07,.045,.067),sage)
curve('Finger at chin',[(-.24,-.415,.83),(-.20,-.427,.875),(-.13,-.411,.91),(-.09,-.39,.90)],.023,sage)
curve('Supporting right arm',[(.27,-.01,.64),(.40,-.14,.62),(.54,-.22,.75),(.60,-.26,.96)],.055,sage)
ell('Open right palm',(.61,-.26,.975),(.11,.068,.04),sage)
for j in range(3):curve('Flask supporting finger '+str(j),[(.54+j*.054,-.30,.975),(.56+j*.054,-.335,1.00),(.58+j*.054,-.32,1.045)],.018,sage)
ell('Round potion flask',(.61,-.245,1.118),(.115,.108,.123),glass,'Flask')
ell('Golden remedy visible glaze',(.61,-.309,1.087),(.092,.055,.065),potion,'Flask')
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.045,depth=.09,location=(.61,-.245,1.25));finish(bpy.context.object,'Bottle neck',glass,'Flask')
bpy.ops.mesh.primitive_torus_add(major_radius=.047,minor_radius=.012,major_segments=24,minor_segments=8,location=(.61,-.245,1.292));finish(bpy.context.object,'Bottle lip',gold,'Flask')
bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.038,depth=.038,location=(.61,-.245,1.307));finish(bpy.context.object,'Cork stopper',cork,'Flask')
ell('Bottle highlight',(.566,-.336,1.155),(.012,.009,.035),white,'Flask',16,10)
# Broad soft asymmetric brim, then a genuinely bent, drooping cone silhouette.
verts=[];faces=[];N=48
for j in range(3):
 t=j/2
 for i in range(N):
  a=2*math.pi*i/N;r=.22+(.56-.22)*t
  verts.append((math.cos(a)*r,math.sin(a)*r*.68+.015,1.14+.025*math.cos(a)+.035*t*math.sin(a*2)))
for j in range(2):
 for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
o=mesh('Wide floppy hat brim',verts,faces,hatmat,'Hat');sol=o.modifiers.new('Felt brim thickness','SOLIDIFY');sol.thickness=.025
rings=[(0,.025,1.15,.29),(0,.04,1.26,.24),(-.045,.055,1.39,.18),(-.13,.06,1.51,.12),(-.26,.05,1.55,.075),(-.36,.025,1.49,.042),(-.405,0,1.40,.013)]
verts=[];faces=[];N=32
for cx,cy,z,r in rings:
 for i in range(N):a=2*math.pi*i/N;verts.append((cx+math.cos(a)*r,cy+math.sin(a)*r*.8,z))
for j in range(len(rings)-1):
 for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
faces.append(tuple(range((len(rings)-1)*N,len(rings)*N)))
mesh('Bent pointed wizard hat',verts,faces,hatmat,'Hat')
# Narrow burgundy hatband and gold seam.
curve('Hatband',[((.28)*math.cos(a),.025+.224*math.sin(a),1.205) for a in [i*2*math.pi/48 for i in range(49)]],.025,capemat,'Hat')
curve('Hatband edge',[((.28)*math.cos(a),.025+.224*math.sin(a),1.225) for a in [i*2*math.pi/48 for i in range(49)]],.006,gold,'Hat')
# Hat rests above the eye mounds rather than intersecting them.
for o in list(bpy.context.scene.objects):
 if o.parent==groups['Hat']: o.location.z+=.10
# Collection cleanup and exact size. Mesh modifiers are applied before export.
for o in list(bpy.context.scene.objects):
 if o.type=='MESH':
  bpy.context.view_layer.objects.active=o;o.select_set(True)
  for modifier in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
  o.select_set(False)
# Character is stationary in reference pose. Parent animates root hops/breathing; no fake rig.
# Blender forward -Y exports as glTF +Z. Model currently height1.57; scale to1.5.
allmesh=[o for o in bpy.context.scene.objects if o.type=='MESH']
minz=min((o.matrix_world@Vector(c)).z for o in allmesh for c in o.bound_box);maxz=max((o.matrix_world@Vector(c)).z for o in allmesh for c in o.bound_box)
scale=1.5/(maxz-minz)
for o in allmesh:
 for v in o.data.vertices:v.co*=scale
 o.location*=scale;o.location.z-=minz*scale
# Gather geometry stats and export selection only.
triangles=sum(len(p.vertices)-2 for o in allmesh for p in o.data.polygons)
bpy.ops.object.select_all(action='DESELECT')
for o in [root,*groups.values(),*allmesh]:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'frog-alchemist.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
# Preview stage is deliberately excluded from exported asset.
stage=mat('Preview sandstone',(.19,.25,.21))
bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1.0,depth=.08,location=(.05,0,-.05));bpy.context.object.data.materials.append(stage)
bpy.ops.object.camera_add(location=(2.65,-5.8,2.8));camera=bpy.context.object;direction=Vector((.08,-.03,.76))-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.25;bpy.context.scene.camera=camera
for pos,power,size in [((-3,-4,6),650,4),((4,-2,3),350,3),((0,3,4),900,3)]:
 bpy.ops.object.light_add(type='AREA',location=pos);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size;lamp.rotation_euler=(Vector((0,0,.7))-lamp.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.world.color=(.2,.2,.2);scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(OUT,'frog-model-preview.png');scene.view_settings.view_transform='AgX';scene.render.film_transparent=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'frog-alchemist.blend'))
bpy.ops.render.render(write_still=True)
info={'triangles':triangles,'mesh_count':len(allmesh),'height':1.5,'forward':'+Z (glTF)','ground':'Y=0 (glTF)','palette':'Sage ceramic frog, midnight teal felt hat, blackberry wine cape, coral-and-gold heart clasp. Colors interpret monochrome approved art.','pose':'Reference: thinking finger at chin, flask presented in opposite hand.','animations':'No skeletal clips. Named nodes Body, Head, Hat, Cape, Flask allow parent procedural motion; root hop recommended.','source':'../creature-field-notes/assets/frog-alchemist.svg unchanged'}
bounds=[o.matrix_world@Vector(c) for o in allmesh for c in o.bound_box]
lo=[min(p[i] for p in bounds) for i in range(3)];hi=[max(p[i] for p in bounds) for i in range(3)]
info.update(dimensions_gltf_xyz=[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]],minimum_y=lo[2],bytes=os.path.getsize(os.path.join(OUT,'frog-alchemist.glb')))
with open(os.path.join(OUT,'frog-model-provenance.json'),'w') as f:json.dump(info,f,indent=2)
print('FROG_MODEL_STATS',json.dumps(info))
