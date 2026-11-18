"""Build the static quay and a moored lugger in Blender, using meters and Y-up plans."""
import math
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / "assets"
bpy.ops.wm.read_factory_settings(use_empty=True)
clay = bpy.data.materials.new("Harbor paint")
clay.use_nodes = True
shader = clay.node_tree.nodes.get("Principled BSDF")
shader.inputs["Roughness"].default_value = .87
colors = clay.node_tree.nodes.new("ShaderNodeVertexColor")
colors.layer_name = "Paint"
clay.node_tree.links.new(colors.outputs["Color"], shader.inputs["Base Color"])

class Model:
    def __init__(self):
        self.verts, self.faces, self.colors = [], [], []

    def face(self, points, tint):
        start = len(self.verts)
        self.verts.extend((x, -z, y) for x, y, z in points)
        self.faces.append(tuple(range(start, len(self.verts))))
        self.colors.append(tuple(int(tint[i:i+2],16)/255 for i in (0,2,4))+(1,))

    def box(self, x, y, z, w, h, d, tint):
        pts = [(x+a*w/2,y+b*h/2,z+c*d/2) for a,b,c in
               [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
        for face in [(0,1,2,3),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)]:
            self.face([pts[i] for i in face],tint)

    def spar(self, a, b, radius, tint, sides=8):
        a,b=Vector(a),Vector(b)
        axis=(b-a).normalized()
        u=axis.cross(Vector((1,0,0)) if abs(axis.x)<.9 else Vector((0,1,0))).normalized()*radius
        v=axis.cross(u)
        ring=[u*math.cos(math.tau*i/sides)+v*math.sin(math.tau*i/sides) for i in range(sides)]
        self.face([a+r for r in reversed(ring)],tint)
        self.face([b+r for r in ring],tint)
        for i,r in enumerate(ring):
            s=ring[(i+1)%sides]
            self.face([a+r,a+s,b+s,b+r],tint)

    def finish(self, name):
        geo=bpy.data.meshes.new(name)
        geo.from_pydata(self.verts,[],self.faces)
        geo.materials.append(clay)
        paint=geo.color_attributes.new(name="Paint",type="BYTE_COLOR",domain="CORNER")
        for poly,color in zip(geo.polygons,self.colors):
            for loop in poly.loop_indices:
                paint.data[loop].color_srgb=color
        obj=bpy.data.objects.new(name,geo)
        bpy.context.collection.objects.link(obj)

def barrel(m,x,y,z,r):
    for lo,hi,radius,tint in [(0,.08,.91,'564636'),(.08,1.48,1,'a37447'),(.22,.32,1.03,'384b4a'),(1.14,1.25,1.03,'384b4a'),(1.48,1.55,.92,'c49462')]:
        m.spar((x,y+lo*r,z),(x,y+hi*r,z),r*radius,tint,12)

# Deck starts at the existing ramp. The outer platform opens to the cargo side.
# The first planks climb the bank to meet the stone footpath.
def ramp(z):
    return max(0, -.19*(z+.27))

quay=Model()
for i in range(18):
    z=-2+i*.25
    width=2.44 if i>=11 else 1.85
    quay.box((width-1.85)/2,.13+ramp(z),z,width,.16,.238,['996c46','ac8056','b38861','a47751'][i%4])
for z in [-1.8,-.35,1.0,2.12]:
    for x in [-.88,.88 if z<.8 else 1.36]:
        quay.spar((x,-.8,z),(x,.51+ramp(z),z),.11,'785438')
        quay.spar((x,.39+ramp(z),z),(x,.49+ramp(z),z),.12,'c8a572')
# A small hand derrick, block and suspended hook above the loading end.
quay.spar((.99,.2,1.76),(.99,2.16,1.76),.1,'795434')
quay.spar((.99,1.84,1.76),(.99,2.20,.23),.083,'ae7d4d')
quay.spar((.99,.8,1.76),(.99,2.12,.55),.063,'755037')
quay.spar((.99,2.17,.26),(.99,1.02,.26),.017,'5c5547')
quay.spar((.9,1.03,.26),(1.08,1.03,.26),.09,'384844')
barrel(quay,-.57,.21,.77,.23)
barrel(quay,-.49,.21,1.30,.19)
for x,z in [(.54,-.98),(.51,-.43)]:
    quay.box(x,.43+ramp(z),z,.61,.44,.48,'af7951')
    for xx in [-.23,.23]:
        quay.box(x+xx,.43+ramp(z),z,.045,.48,.51,'63503e')
quay.finish("Fish quay")

boat=Model()
# A hollow double-ended clinker hull with a dark sheer stripe and honey gunwale.
stations=[(-2.00,.025,.28),(-1.65,.46,.12),(-.87,.71,.02),(.25,.77,0),(1.16,.60,.06),(1.69,.35,.19),(1.96,.025,.33)]
rings=[(.09,-.17),(.54,-.04),(.80,.15),(.95,.31),(1,.40),(.997,.46),(.91,.46),(.83,.21)]
planks=['433e36','834f38','a36644','26615b','d8a25f','e0b97f','795636']
for side in [-1,1]:
    for (z,w,lift),(zz,ww,lift2) in zip(stations,stations[1:]):
        for i,((a,b),(c,d)) in enumerate(zip(rings,rings[1:])):
            # Use the same height at each shared strake edge.
            pts=[(side*width*f,h+rise,along) for width,f,h,rise,along in [(w,a,b,lift,z),(ww,a,b,lift2,zz),(ww,c,d,lift2,zz),(w,c,d,lift,z)]]
            boat.face(pts if side<0 else pts[::-1],planks[i])
boat.box(0,.11,0,1.04,.10,2.5,'70503a')
for z in [-1.05,-.29,.66,1.16]:
    boat.box(0,.38,z,1.0 if abs(z)>1 else 1.32,.08,.18,'c19b69')
boat.spar((0,.15,-.46),(0,3.32,-.53),.055,'704b2f')
boat.spar((-.05,2.16,-1.59),(.10,3.10,.94),.05,'694d36')
# Cut panels follow a bowed four-sided lug sail. The broad cream reef stripe
# and dark foot remain legible in the whole-village view.
def sail(u,v):
    z=(-1.28+2.34*u)*(1-v)+(-1.59+2.53*u)*v
    y=(.98-.09*u)*(1-v)+(2.16+.94*u)*v
    return (.02+.18*u+.36*math.sin(math.pi*u)*math.sin(math.pi*v),y,z)
for row,(low,high) in enumerate([(0,.09),(.09,.53),(.53,.68),(.68,1)]):
    for col in range(6):
        a,b=col/6,(col+1)/6
        paint=[['a4452f','ab4b34'],['c36240','c96946'],['f3d9aa','ead1a4'],['cb714e','c16a48']][row][col%2]
        boat.face([sail(a,low),sail(b,low),sail(b,high),sail(a,high)],paint)
for end in [-1.88,1.82]:
    boat.spar((0,3.25,-.53),(0,.71,end),.015,'665944',5)
boat.face([(0,3.05,-.53),(0,3.36,-.53),(.09,3.22,-1.14)],'dfaa47')
boat.finish("Ochre lugger")
bpy.ops.export_scene.gltf(filepath=str(OUT/"saltwick-harbor.glb"),export_format="GLB",export_yup=True,export_texcoords=False)
