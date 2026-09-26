"""Original landing-beach kit. Run in a SEPARATE background Blender process.

blender --background --factory-startup --python tools/blender/shore_details.py
The generated image is an albedo only; geometry supplies the net, knots, shells,
and open creel. Game coordinates are Y-up, metres. No existing .blend is opened.
"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector

SRC=Path(__file__).resolve().parent
ROOT=SRC.parents[1]
# This generator owns only its new scene, including on an interactive invocation.
scene=bpy.data.scenes.new('Island - Shore Details')
bpy.context.window.scene=scene
PARTS={}; ACTIVE='shoreTimber'; rng=random.Random(190926)
COL={'timber':(.57,.53,.45,1),'rope':(.29,.235,.15,1),'net':(.12,.17,.14,1),
     'iron':(.10,.135,.13,1),'cork':(.32,.205,.10,1),'paint':(.17,.29,.285,1),
     'chalk':(.57,.59,.51,1),'rust':(.32,.155,.07,1),'rock':(.20,.235,.23,1),
     'shell':(.51,.54,.45,1),'mussel':(.07,.115,.13,1),'weed':(.14,.185,.085,1)}

def add(v,f,color,uv=None):
    d=PARTS.setdefault(ACTIVE,{'v':[],'f':[],'c':[],'uv':[]})
    start=len(d['v']);d['v'] += [(x,-z,y) for x,y,z in v]
    d['f'] += [tuple(start+i for i in face) for face in f]
    c=COL[color] if isinstance(color,str) else color
    d['c'] += [c]*len(v)
    d['uv'] += uv if uv else [(x*.6,y*.6+z*.6) for x,y,z in v]

def beam(a,b,width,depth,color='timber'):
    a,b=Vector(a),Vector(b);d=(b-a).normalized();u=d.cross(Vector((0,0,1)))
    if u.length<.01:u=d.cross(Vector((0,1,0)))
    u.normalize();w=d.cross(u).normalized();v=[]
    for p in [a,b]:
        for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]:v.append(tuple(p+u*width*i/2+w*depth*j/2))
    # Grain follows each board's length, independently of its world orientation.
    add(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],color,
        [(j*.23,i*(b-a).length*.65) for i in [0,1] for j in range(4)])

def tube(points,radius,color='rope',sides=5):
    v=[];uv=[];f=[];dist=0
    for i,p in enumerate(points):
        p=Vector(p);d=Vector(points[min(len(points)-1,i+1)])-Vector(points[max(0,i-1)])
        d.normalize();u=d.cross(Vector((0,1,0)))
        if u.length<.01:u=d.cross(Vector((1,0,0)))
        u.normalize();w=d.cross(u).normalized()
        if i:dist+=(p-Vector(points[i-1])).length
        r=radius[i] if isinstance(radius,list) else radius
        for j in range(sides):
            angle=j*math.tau/sides;v.append(tuple(p+r*(u*math.cos(angle)+w*math.sin(angle))));uv.append((j/sides,dist*.6))
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;f.append((a,b,b+sides,a+sides))
    f.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))]);add(v,f,color,uv)

def ellipsoid(p,scale,color,segments=10,rings=5):
    v=[];f=[]
    for i in range(rings+1):
        t=math.pi*i/rings
        for j in range(segments):
            a=j*math.tau/segments
            v.append((p[0]+scale[0]*math.sin(t)*math.cos(a),p[1]+scale[1]*math.cos(t),p[2]+scale[2]*math.sin(t)*math.sin(a)))
    for i in range(rings):
        for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;f.append((a,b,b+segments,a+segments))
    add(v,f,color)

def coil(p,radius=.34,loops=3):
    pts=[]
    for i in range(loops*28+1):
        t=i/(loops*28);a=t*loops*math.tau;r=radius*(.37+.63*t)
        pts.append((p[0]+math.cos(a)*r,p[1]+.012*math.sin(a*2),p[2]+math.sin(a)*r))
    tube(pts,.018,'rope',5)
    tube([pts[-1],(p[0]+radius+.18,p[1],p[2]-.13),(p[0]+radius+.32,p[1]-.03,p[2]-.31)],.018)

# A tall, irregular drying rack. Leaned foot braces and open centre remain legible.
for x,y in [(-1.22,2.12),(1.25,2.22)]:
    beam((x,-.14,.08),(x+.065,y,.02),.13,.15)
    beam((x,-.12,-.60),(x,.9,.06),.085,.09)
    beam((x,-.12,.68),(x,.83,.05),.085,.09)
beam((-1.44,2.08,.02),(1.46,2.19,.02),.14,.16)
beam((-1.26,.48,.12),(1.30,.52,.12),.10,.10)
# Planked low sorting bench in front of the rack.
for z in [-.18,.05,.28]:beam((-1.10,.71,z),(1.12,.72,z+.025),.095,.21)
for x in [-.89,.90]:
    for z in [-.13,.23]:beam((x,-.13,z),(x,.66,z),.10,.10)
    beam((x,.42,-.30),(x,.43,.39),.09,.09)
# A wood-and-willow arched creel on the right, with genuine gaps between ribs.
cx,cz=1.93,-.24
for z in [-.61,-.39,-.17,.05,.27]:
    pts=[(cx+.52*math.cos(a),.10+.52*math.sin(a),cz+z) for a in [i*math.pi/12 for i in range(13)]]
    tube(pts,.017,'timber',5)
for k in range(10):
    a=k*math.pi/9
    tube([(cx+.52*math.cos(a),.10+.52*math.sin(a),cz-.64),(cx+.52*math.cos(a),.10+.52*math.sin(a),cz+.30)],.014,'timber',5)
for x in [-.4,-.2,0,.2,.4]:beam((cx+x,.08,cz-.66),(cx+x,.08,cz+.33),.07,.025)
# The creel's small square service hatch is slightly ajar.
for x in [-.18,.18]:beam((cx+x,.60,cz-.30),(cx+x,.66,cz+.03),.025,.03)
for z in [-.30,.03]:beam((cx-.19,.63,cz+z),(cx+.19,.63,cz+z),.025,.03)

ACTIVE='shoreGear'
# Net hangs as a catenary in two directions, with an irregular lifted corner.
def net(u,v):
    return (-1.08+u*2.11,2.03+.085*u-v*(1.13-.34*u)-.18*math.sin(u*math.pi),.09+.14*math.sin(u*math.pi)*v+.055*math.sin(v*5+u*2))
for i in range(17):tube([net(i/16,j/9) for j in range(10)],.007,'net',4)
for j in range(10):tube([net(i/16,j/9) for i in range(17)],.007,'net',4)
for v in [0,1]:tube([net(i/16,v) for i in range(17)],.016,'rope',5)
# Wooden cork floats lashed along the top rope, salt-marked and varied.
for i in [1,4,7,10,13,15]:
    p=net(i/16,0);ellipsoid((p[0],p[1]+.025,p[2]),(.075,.055,.055),'cork',8,4)
for x,y in [(-1.18,2.12),(1.26,2.20)]:
    for j in range(3):tube([(x+.09*math.cos(a),y-.05+j*.032,.04+.10*math.sin(a)) for a in [k*math.tau/10 for k in range(11)]],.016,'rope',5)
coil((-.66,.79,.06),.30,3)
coil((-.72,.055,-.88),.34,3)
# Two turned, painted fishing floats hung from the end of the rack.
for x,y,z in [(1.02,1.13,-.09),(.72,1.35,-.09)]:
    tube([(x,2.13,.02),(x+.02,y+.19,z)],.010,'rope',5)
    ellipsoid((x,y,z),(.105,.22,.105),'paint',10,5)
    tube([(x,y-.035,z),(x,y+.04,z)],.108,'chalk',10)
    tube([(x,y+.17,z),(x,y+.28,z)],.026,'cork',6)
# Iron fastenings, bent hook, and a bait tin on the bench.
for x in [-1.22,1.25]:
    for y in [.52,2.11]:tube([(x,y,-.075),(x,y,-.088)],.027,'iron',8)
tube([(-.26,.78,.1),(-.24,.84,.08),(-.19,.84,.08),(-.17,.80,.1)],.014,'iron',6)
tube([(.46,.76,.05),(.46,.91,.05)],.12,'paint',12)
tube([(.46,.91,.05),(.46,.93,.05)],.127,'iron',12)
# Cone mouth of the open creel, tied to its outer arch.
for i in range(10):
    a=i*math.tau/10
    tube([(cx+.40*math.cos(a),.29+.24*math.sin(a),cz+.31),(cx+.14*math.cos(a),.29+.11*math.sin(a),cz-.04)],.009,'net',4)
tube([(cx+.14*math.cos(a),.29+.11*math.sin(a),cz-.04) for a in [i*math.tau/16 for i in range(17)]],.015,'rope',5)

# An eroded tidal rock with a shallow bowl, split rim and attached barnacles.
ACTIVE='shoreRock';n=28
outer=[];inner=[];bottom=[]
def rock_edge(a):return 1+.19*math.sin(a*3+.4)+.10*math.sin(a*7)+.055*math.cos(a*11)
def rim_y(a):return .15+.045*math.sin(a*3)+.055*math.sin(a*7)
for i in range(n):
    a=i*math.tau/n;r=rock_edge(a)
    outer.append((math.cos(a)*r*1.20, rim_y(a), math.sin(a)*r*.72))
    inner.append((math.cos(a)*(.49+.04*math.sin(a*4)),.155+.018*math.sin(a*3),math.sin(a)*(.31+.035*math.sin(a*5))))
    bottom.append((math.cos(a)*r*1.36,-.29,math.sin(a)*r*.83))
verts=outer+inner+bottom+[(.06,-.04,-.035)]
faces=[]
for i in range(n):
    j=(i+1)%n;faces += [(i,j,n+j,n+i),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n)]
add(verts,faces,'rock')
# Irregular pale fracture planes, darker damp edges, all in the same draw.
for i,(x,y,z) in enumerate(verts):
    t=.86+.13*math.sin(x*5.3+z*7.7)+.08*math.cos(z*11)
    if i>=2*n:t*=.74
    PARTS[ACTIVE]['c'][i]=tuple(c*t for c in COL['rock'][:3])+(1,)
for p,s in [((-.99,.025,.30),(.38,.15,.22)),((.94,-.005,-.35),(.34,.16,.28)),((.38,.015,.67),(.38,.14,.19))]:ellipsoid(p,s,'rock',8,3)
ACTIVE='shoreLife'
def shell_seat(a,r):
    edge=rock_edge(a)
    x=math.cos(a)*edge*1.2*r;z=math.sin(a)*edge*.72*r
    # Sample the actual triangulated rim so no shells float above the stone.
    def height(tri):
        A,B,C=[verts[k] for k in tri];den=(B[2]-C[2])*(A[0]-C[0])+(C[0]-B[0])*(A[2]-C[2])
        if abs(den)<1e-8:return None
        u=((B[2]-C[2])*(x-C[0])+(C[0]-B[0])*(z-C[2]))/den
        v=((C[2]-A[2])*(x-C[0])+(A[0]-C[0])*(z-C[2]))/den
        if min(u,v,1-u-v)<-1e-6:return None
        return u*A[1]+v*B[1]+(1-u-v)*C[1]
    for i in range(n):
        j=(i+1)%n
        for tri in [(i,j,n+j),(i,n+j,n+i)]:
            y=height(tri)
            if y is not None:return x,y-.008,z
    return x,.08,z
for i in range(46):
    a=rng.choice([.4,2.2,4.8])+rng.gauss(0,.28);r=rng.uniform(.62,.91)
    x,y,z=shell_seat(a,r);radius=rng.uniform(.024,.044)
    v=[(x+math.cos(j*math.tau/6)*rad,yy,z+math.sin(j*math.tau/6)*rad) for rad,yy in [(radius,y),(radius*.43,y+.034),(radius*.38,y+.013)] for j in range(6)]
    f=[]
    for j in range(6):k=(j+1)%6;f.extend([(j,k,6+k,6+j),(6+j,6+k,12+k,12+j)])
    add(v,f,'shell')
for i in range(18):
    a=rng.choice([.2,2.4,4.9])+rng.gauss(0,.21);r=rng.uniform(.63,.88)
    x,y,z=shell_seat(a,r)
    ellipsoid((x,y+.012,z),(.033,.019,.071),'mussel',6,3)
ACTIVE='shorePool';v=[(.02,.085,-.01)]+[(math.cos(i*math.tau/28)*(.39+.023*math.sin(i)),.085,math.sin(i*math.tau/28)*(.25+.013*math.cos(i*2))) for i in range(28)]
add(v,[(0,i+1,(i+1)%28+1) for i in range(28)],(.13,.23,.22,1))
# Miniature keeps only the rack's defining silhouette, not thousands of subpixels.
ACTIVE='shoreMini'
for x in [-1.22,1.25]:beam((x,0,.05),(x,2.16,.05),.16,.16)
beam((-1.4,2.14,.05),(1.4,2.14,.05),.16,.16)
beam((-1.1,.7,0),(1.1,.7,0),.12,.65)
add([(-1.07,2,.10),(1.05,2.08,.10),(1.05,1.18,.10),(-1.07,.85,.10)],[(0,1,2,3)],'net')
ellipsoid((cx,.26,cz),(.53,.32,.60),'timber',8,3)

mat=bpy.data.materials.new('Shore vertex palette');mat.use_nodes=True
bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Roughness'].default_value=.88
vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color'
mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
objects=[];stats={}
for name,d in PARTS.items():
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(d['v'],[],d['f']);mesh.update()
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);mesh.materials.append(mat)
    colors=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for out,c in zip(colors.data,d['c']):out.color=c
    uv=mesh.uv_layers.new(name='Timber grain')
    for p in mesh.polygons:
        for li in p.loop_indices:uv.data[li].uv=d['uv'][mesh.loops[li].vertex_index]
    obj['authoring']='Blender shore_details.py';obj['units']='metres; game Y-up'
    mesh.calc_loop_triangles();stats[name]={'vertices':len(mesh.vertices),'triangles':len(mesh.loop_triangles)}
    objects.append(obj)
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
out=ROOT/'assets/shore-details.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
(SRC/'shore-details-geometry.json').write_text(json.dumps({'blender':bpy.app.version_string,'parts':stats,'bytes':out.stat().st_size,'totalTriangles':sum(x['triangles'] for x in stats.values())},indent=2)+'\n')
# A photographed assembly of the real exported parts. Material added after export
# so the game manifest remains the sole runtime owner of the generated image.
timber=mat.copy();timber.name='Imagegen salt timber'
t=timber.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(ROOT/'assets/shore-timber.jpg'));t.image.pack()
bs=next(n for n in timber.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
timber.node_tree.links.new(t.outputs['Color'],bs.inputs['Base Color'])
bpy.data.objects['shoreTimber'].data.materials[0]=timber
for name in ['shoreRock','shoreLife','shorePool']:
    bpy.data.objects[name].location=(.1,1.75,0)
bpy.data.objects['shoreMini'].hide_render=True
scene.world=bpy.data.worlds.new('Shore inspection world');scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.20,.25,.27,1);bg.inputs[1].default_value=.4
# Ground and camera belong only to inspection; they are not exported.
mesh=bpy.data.meshes.new('inspection ground');mesh.from_pydata([(-200,-200,-.16),(200,-200,-.16),(200,200,-.16),(-200,200,-.16)],[],[(0,1,2,3)]);mesh.update()
ground=bpy.data.objects.new('Inspection ground',mesh);scene.collection.objects.link(ground)
gm=bpy.data.materials.new('Inspection sand');gm.use_nodes=True;gbs=next(n for n in gm.node_tree.nodes if n.type=='BSDF_PRINCIPLED');gbs.inputs['Base Color'].default_value=(.32,.31,.27,1);gbs.inputs['Roughness'].default_value=1;mesh.materials.append(gm)
for i,(p,energy,size) in enumerate([((-3,-4,7),1000,5),((4,2,5),700,4)]):
    data=bpy.data.lights.new('Inspection softbox '+str(i),'AREA');o=bpy.data.objects.new(data.name,data);scene.collection.objects.link(o);o.location=p;data.energy=energy;data.shape='DISK';data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Inspection camera');cam=bpy.data.objects.new(data.name,data);scene.collection.objects.link(cam);cam.location=(5,-8,4.1);cam.rotation_euler=(Vector((.25,.35,.8))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=6.4;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1500;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(SRC/'shore-details.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'shore-details.blend'))
bpy.ops.render.render(write_still=True)
print(json.dumps(stats))
