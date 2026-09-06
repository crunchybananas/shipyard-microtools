"""Editable Blender source for the working study and four coastal conifers.

Closed needle cushions replace the old crossed cards. Near and far crowns use the
same bough centres, wind habit and height; UV.x transports each tip's wind weight.
Coordinates below are game Y-up and convert once on entry to Blender Z-up.
"""
import bpy, json, math, random, re
from mathutils import Vector
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROOT = SRC.parents[1]
profiles = json.loads(re.search(r'const profiles = (\[[\s\S]*?\]);', (ROOT/'js/forest-profile.js').read_text()).group(1))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
PARTS = {}
ACTIVE = ''
PALETTE = {'wood':(.235,.153,.080,1), 'end':(.29,.207,.121,1),
           'paint':(.065,.128,.133,1), 'iron':(.045,.066,.059,1),
           'copper':(.265,.32,.205,1), 'paper':(.49,.46,.34,1),
           'plaster':(.43,.43,.365,1), 'cloth':(.09,.185,.20,1)}

def add(vertices, faces, color, rim=0):
    d = PARTS.setdefault(ACTIVE, {'v':[], 'f':[], 'c':[], 'rim':[]})
    start = len(d['v'])
    d['v'] += [(x,-z,y) for x,y,z in vertices]
    d['f'] += [tuple(start+i for i in f) for f in faces]
    col = PALETTE[color] if isinstance(color,str) else color
    d['c'] += [col for _ in vertices]
    d['rim'] += [rim for _ in vertices]

def box(p, size, color='wood', angle=0):
    x,y,z=p; w,h,d=[a/2 for a in size]
    v=[]
    for a,b,c in [(-w,-h,-d),(w,-h,-d),(w,h,-d),(-w,h,-d),(-w,-h,d),(w,-h,d),(w,h,d),(-w,h,d)]:
        v.append((x+a*math.cos(angle)+c*math.sin(angle), y+b, z-a*math.sin(angle)+c*math.cos(angle)))
    add(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],color)

def tube(points, radius, color='iron', sides=6, rim=0):
    v=[]; f=[]
    for i,p in enumerate(points):
        direction=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
        u=direction.cross(Vector((0,1,0)))
        if u.length<.01: u=direction.cross(Vector((1,0,0)))
        u.normalize(); w=direction.cross(u).normalized()
        r=radius[i] if isinstance(radius,list) else radius
        for j in range(sides):
            v.append(tuple(Vector(p)+r*(math.cos(j*math.tau/sides)*u+math.sin(j*math.tau/sides)*w)))
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides
            f.append((a,b,b+sides,a+sides))
    f += [tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))]
    add(v,f,color,rim)

def cushion(p, direction, length, width, depth, near, tone, rim):
    """A tapered, asymmetric closed volume. No crossed or camera-facing cards."""
    d=Vector(direction).normalized(); u=d.cross(Vector((0,1,0)))
    if u.length<.01: u=d.cross(Vector((1,0,0)))
    u.normalize(); w=d.cross(u).normalized(); p=Vector(p)
    n=10 if near else 4
    rings=[(0,1)]
    v=[tuple(p-d*length*.64)]
    for along,rad in rings:
        for j in range(n):
            a=j*math.tau/n
            lobed=(.72 if near and j%2 else 1.12)*(1+.09*math.sin(j*4.3+rim*12))
            v.append(tuple(p+d*((along+(.11 if j%2 else -.11))*length)+u*(math.cos(a)*width*rad*lobed)+w*(math.sin(a)*depth*rad)))
    v.append(tuple(p+d*length*.61+w*depth*.12)); tip=len(v)-1
    f=[]
    for j in range(n):
        a=1+j;b=1+(j+1)%n
        f.append((0,b,a))
        if len(rings)>1:f.append((a,b,b+n,a+n))
        f.append((tip,a+(n if len(rings)>1 else 0),b+(n if len(rings)>1 else 0)))
    base=(.09*tone,.185*tone,.12*tone,1)
    add(v,f,base,rim)
    # Subtle light on the upper surface, cool cavities. The geometry carries AO.
    part=PARTS[ACTIVE]
    for k,vertex in enumerate(v):
        gain=.78+.24*max(-.5,min(1,(vertex[1]-p.y)/max(.08,depth)))+.14*rim
        part['c'][-len(v)+k]=tuple(c*gain for c in base[:3])+(1,)
        if k==len(v)-1:part['rim'][-len(v)+k]=min(1,rim+.25)

for variant,profile in enumerate(profiles):
    p=profile['p']
    # Generate the branch skeleton once. LOD cannot reroll missing boughs.
    rng=random.Random(p['seedXor']); branches=[]
    for i in range(p['n']):
        t=i/(p['n']-1); phase=i*2.399+rng.random()*.55
        count=7 if p['fullness']>1.1 else 6
        for j in range(count):
            a=phase+j*math.tau/count+rng.uniform(-.17,.17)
            if rng.random()<p.get('broken',0)*(1-t*.45):continue
            reach=p['baseR']*(.13+.87*(1-t*p['taperK']))*(.98+rng.random()*.28)
            reach*=.92+.19*(.5+.5*math.cos(a))
            y=p['baseY']+i*p['spacing']+rng.uniform(-.14,.14)
            root=Vector((p['lean']*i,y,0))
            # Upward twigs at the ends support a thick, overlapping outer crown.
            end=root+Vector((math.cos(a)*reach,-p['droop']*(.6+rng.random()*.4)+.09,math.sin(a)*reach))
            middle=root.lerp(end,.52);middle.y-=.13
            branches.append((root,middle,end,reach,a,.84+rng.random()*.27,t))
    # At 1:240 these crowns are only a few pixels high. Keep their silhouette,
    # branch levels and bend, with four closed lobes per level.
    ACTIVE=f'forest{variant}Model'
    for i in range(p['n']):
        t=i/(p['n']-1);radius=p['baseR']*(.13+.87*(1-t*p['taperK']))*1.13
        for j in range(4):
            a=i*2.399+j*math.tau/4
            root=Vector((p['lean']*i,p['baseY']+i*p['spacing'],0))
            direction=Vector((math.cos(a),-.13,math.sin(a)))
            cushion(root+direction*radius*.49,direction,radius*1.25,radius*.34,p['tierH']*.23,False,1,.82)
    top=p['baseY']+(p['n']-1)*p['spacing']
    cushion((p['lean']*(p['n']-1),top+p['tierH']*.20,0),(0,1,0),p['tierH']*1.12,p['baseR']*.17,p['baseR']*.17,False,1.05,.92)
    for near in [True,False]:
        ACTIVE=f'forest{variant}{"Near" if near else "Far"}'
        for root,middle,end,reach,a,tone,t in branches:
            if near:tube([root,middle,end],[.048,.022,.005],(.16,.09,.037,1),5,.24)
            direction=end-middle
            # Broad cushions overlap along each branch. Forks break their silhouette.
            for k,u0 in enumerate([.26,.56,.84]):
                centre=root.lerp(end,u0);centre.y+=.03+math.sin(u0*math.pi)*.08
                cushion(centre,direction,reach*.72,reach*(.245-u0*.045),p['tierH']*(.15-u0*.025),near,tone,u0)
            if near:
                for side in [-1,1]:
                    centre=root.lerp(end,.61)+Vector((-math.sin(a),.10,math.cos(a)))*reach*.20*side
                    branch=direction.normalized()+Vector((-math.sin(a),.24,math.cos(a)))*side*.72
                    cushion(centre,branch,reach*.51,reach*.17,p['tierH']*.18,False,tone*1.04,.77)
        top=p['baseY']+(p['n']-1)*p['spacing']
        for k in range(4):
            t=k/3
            cushion((p['lean']*(p['n']-1)+.05*t,top+t*p['tierH']*.55,0),(.06,1,.02),p['tierH']*.63,p['baseR']*(.18-.105*t),p['baseR']*(.15-.09*t),near,1.13,.78+t*.15)

# The room's masonry shell stays structural. These are its inner finish and timber.
# Real openings preserve the beach door, study window, annex and tower course.
ACTIVE='studyPlaster'
for i in range(144):
    a=i*math.tau/144;b=(i+1)*math.tau/144;m=(a+b)/2;deg=math.degrees(m)
    for y0,y1 in [(1.10,1.15),(1.15,2.62),(2.62,2.825),(2.825,3.30),(3.30,4.53)]:
        if (y0<3.30 and 6.5<deg<23.5) or (y0<2.62 and 159.5<deg<170.5):continue
        if y0>=1.15 and y1<=2.825 and 102<deg<118:continue
        shade=.96+.016*math.sin(a*13)+.008*math.sin(a*31+y0)
        col=tuple(c*shade for c in PALETTE['plaster'][:3])+(1,)
        add([(math.sin(q)*4.665,y,math.cos(q)*4.665) for q,y in [(a,y0),(a,y1),(b,y1),(b,y0)]],[(0,1,2,3)],col)

ACTIVE='studyTimber'; rng=random.Random(2319)
# Individually fitted floorboards, staggered butt joints, occasional repaired ends.
R=4.66; board=.32
for i in range(-14,15):
    x=i*board;half=math.sqrt(max(0,R*R-(abs(x)+board/2)**2))
    z=-half
    while z<half-.04:
        end=min(half,z+1.50+rng.random()*.72)
        col=tuple(c*(.86+rng.random()*.25) for c in PALETTE['wood'][:3])+(1,)
        box((x,.10,(z+end)/2),(board-.011,.04,end-z-.012),col)
        z=end
# Wainscot boards, a rubbed cap and skirting. Doors interrupt the full height.
for i in range(96):
    a=(i+.5)*math.tau/96; deg=math.degrees(a)
    if 5<deg<25 or 158<deg<172:continue
    col=tuple(c*(.86+rng.random()*.26) for c in PALETTE['paint'][:3])+(1,)
    box((math.sin(a)*4.635,.57,math.cos(a)*4.635),(.297,1.075,.055),col,a)
    for y,h,r in [(.09,.15,4.585),(1.11,.072,4.578),(1.065,.035,4.58)]:
        box((math.sin(a)*r,y,math.cos(a)*r),(.307,h,.10),'end' if y==1.11 else 'paint',a)
# Timber ring and radial joists around the stair's real ceiling opening.
for i in range(32):
    a=(i+.5)*math.tau/32
    box((math.sin(a)*4.57,4.40,math.cos(a)*4.57),(.91,.20,.21),'wood',a)
    if i%4==0:
        box((math.sin(a)*3.90,4.40,math.cos(a)*3.90),(.16,.23,1.34),'wood',a)

ACTIVE='studyFittings'
# The working library is fitted into actual bays, with side uprights and backs.
for degrees in [285,323]:
    a=math.radians(degrees)
    for side in [-1,1]:
        x=math.sin(a)*4.43+math.cos(a)*side*1.07
        z=math.cos(a)*4.43-math.sin(a)*side*1.07
        box((x,1.34,z),(.10,1.68,.48),'paint',a)
    box((math.sin(a)*4.43,2.20,math.cos(a)*4.43),(2.25,.11,.52),'end',a)
    box((math.sin(a)*4.63,1.37,math.cos(a)*4.63),(2.20,1.56,.035),'wood',a)
# The valve now belongs to a pipe run and a visible stilling tube by the window.
tube([(2.3,.83,1.1),(2.3,.19,1.1),(3.76,.19,.22),(3.99,.24,-.72),(4.15,.35,-1.40),(4.36,.35,-1.61)],.066,'copper',10)
tube([(3.99,.24,-.72),(3.99,2.33,-.72)],.035,'copper',8)
box((3.99,1.29,-.76),(.43,2.16,.10),'paint')
for y in [.31,2.28]:
    tube([(3.94,y,-.65),(4.09,y,-.65)],.077,'copper',10)
for y in [.445,.765,1.085,1.405,1.725,2.045]:
    box((3.83,y,-.69),(.10,.017,.02),'paper')
# A shallow working ledge on the blank southern wall: rolled charts, dividers, twine.
a=math.radians(221)
def desk(p):
    x,y,z=p
    return (math.sin(a)*4.20+x*math.cos(a)+z*math.sin(a), y, math.cos(a)*4.20-x*math.sin(a)+z*math.cos(a))
box(desk((0,.95,0)),(1.45,.11,.57),'end',a)
for x in [-.61,.61]:box(desk((x,.47,0)),(.085,.94,.35),'paint',a)
for k in range(3):
    p=desk((-.35+k*.17,1.08,.06));q=desk((-.35+k*.17,1.08,-.26))
    tube([p,q],.057,'paper',10)
tube([desk((.19,1.025,.16)),desk((.46,1.035,-.13)),desk((.60,1.025,.18))],.012,'copper',6)
# Copper clips on the working table, bolts on the valve plinth, floor-board nails.
for x in [-1,1]:
    for z in [-1,1]:
        box((x,.50,z),(.24,.12,.24),'paint')
        box((x,.20,z),(.23,.05,.23),'end')
for x in [2.17,2.43]:
    for z in [.97,1.23]:box((x,.052,z),(.035,.025,.035),'iron')
for i in range(-13,14):
    x=i*board; half=math.sqrt(max(0,R*R-x*x))
    for z in [-half+.18,half-.18]:box((x,.124,z),(.018,.004,.018),'iron')

# Export once, with a named editable object for every batch and every LOD.
material=bpy.data.materials.new('Working coast vertex palette');material.use_nodes=True
bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.88
vc=material.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color'
material.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
objects=[];stats={}
for name,d in PARTS.items():
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(d['v'],[],d['f']);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(material)
    color=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for v,c in zip(color.data,d['c']):v.color=c
    uv=mesh.uv_layers.new(name='Wind weight')
    for face in mesh.polygons:
        face.use_smooth=name.startswith('forest')
        for li in face.loop_indices:uv.data[li].uv=(d['rim'][mesh.loops[li].vertex_index],0)
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Runtime triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
    obj['authoring']='Blender working_coast.py';obj['closedNeedleVolumes']=name.startswith('forest')
    stats[name]={'triangles':len(mesh.polygons),'vertices':len(mesh.vertices)}
    objects.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
out=ROOT/'assets/working-coast.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True)
(SRC/'working-coast-geometry.json').write_text(json.dumps({'parts':stats,'bytes':out.stat().st_size,'totalTriangles':sum(v['triangles'] for v in stats.values())},indent=2)+'\n')
# A source scene arranged as an asset inspection, without changing exported transforms.
for o in objects:
    if o.name.startswith('forest'):
        i=int(o.name[6]);o.location.x=-8+i*5.2;o.location.y=8
        if not o.name.endswith('Near'):o.hide_render=True
scene=bpy.context.scene;scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.24,.26,1)
for pos,power,size in [((2,-7,15),1800,10),((-10,3,12),2400,8)]:
    bpy.ops.object.light_add(type='AREA',location=pos);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.size=size
    lamp.rotation_euler=(Vector((0,2,2))-lamp.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(17,-22,17));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=28
cam.rotation_euler=(Vector((0,4,2.2))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.filepath=str(SRC/'working-coast.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'working-coast.blend'))
bpy.ops.render.render(write_still=True)
print(json.dumps(stats))
