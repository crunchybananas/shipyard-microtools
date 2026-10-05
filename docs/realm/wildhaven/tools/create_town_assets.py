"""Wildhaven's original town expansion kit: workplaces, construction and carried tools.

Run with Blender 4.5+ in background mode. No downloaded art, textures, fonts,
add-ons, or external Python packages. Coordinates are Blender Z-up, front -Y;
the GLB exporter converts these to Three Y-up, front +Z.
"""
import bpy
import math
import json
import random
import hashlib
import sys
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / 'assets'
RENDER = '--skip-render' not in sys.argv
OUT.mkdir(parents=True, exist_ok=True)
random.seed(34729)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablock in list(bpy.data.materials):
    bpy.data.materials.remove(datablock)

PALETTE = {
    'cream': '#f2d4a0', 'light': '#fff0cc', 'ochre': '#dfaa42',
    'roof': '#bf634a', 'roof_light': '#d67d56', 'roof_dark': '#a64d3b',
    'teal': '#40666e', 'teal_light': '#527f82', 'teal_dark': '#31515b',
    'wood': '#94633e', 'wood_light': '#bd8a53', 'wood_dark': '#634830',
    'stone': '#a2a79c', 'stone_light': '#c6c9b3', 'stone_dark': '#798579',
    'leaf': '#26766b', 'leaf_light': '#458e6a', 'leaf_dark': '#1d6155',
    'sage': '#78944e', 'red': '#de6548', 'pink': '#ebae9e',
    'skin': '#c58d65', 'skin_light': '#e4b689', 'hair': '#664332',
    'ink': '#303e3f', 'glass': '#31595e', 'metal': '#747d6e',
    'soil': '#705541', 'purple': '#9184a4', 'flame': '#ffbc48',
}

def rgba(value):
    h = PALETTE.get(value, value).lstrip('#')
    rgb = [int(h[i:i+2], 16)/255 for i in (0,2,4)]
    return tuple((x/12.92 if x <= .04045 else ((x+.055)/1.055)**2.4) for x in rgb)+(1,)

paint = bpy.data.materials.new('Wildhaven • hand-painted clay')
paint.use_nodes = True
bsdf = paint.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .86
color = paint.node_tree.nodes.new('ShaderNodeVertexColor')
color.layer_name = 'Color'
paint.node_tree.links.new(color.outputs['Color'], bsdf.inputs['Base Color'])

glow = bpy.data.materials.new('Wildhaven • amber embers')
glow.use_nodes = True
g = glow.node_tree.nodes.get('Principled BSDF')
g.inputs['Base Color'].default_value = rgba('flame')
g.inputs['Emission Color'].default_value = rgba('flame')
g.inputs['Emission Strength'].default_value = .6
g.inputs['Roughness'].default_value = .9

roots = []
ROOT = None
serial = 0

def root(name):
    global ROOT
    ROOT = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ROOT)
    ROOT.empty_display_type = 'PLAIN_AXES'
    ROOT['asset'] = name
    ROOT['original_art'] = 'Wildhaven procedural sculpt, 2026'
    roots.append(ROOT)
    return ROOT

def finish(obj, name, tint, parent=None, bevel=0, smooth=False, material=None):
    global serial
    serial += 1
    obj.name = name + '_' + str(serial)
    bpy.context.view_layer.objects.active = obj
    if bevel:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = obj.modifiers.new('Soft hand-cut edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(material or paint)
    attr = obj.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    col = rgba(tint)
    for datum in attr.data:
        datum.color = col
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    obj.parent = parent or ROOT
    return obj

def cube(name, pos, size, tint, bevel=.02, parent=None, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.dimensions = size
    if rot: obj.rotation_euler = rot
    return finish(obj, name, tint, parent, bevel)

def ball(name, pos, size, tint, sub=1, parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=pos)
    obj = bpy.context.object
    obj.scale = size
    return finish(obj, name, tint, parent)

def cylinder(name, pos, radius, depth, tint, vertices=12, bevel=.012, parent=None, radius2=None):
    if radius2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius2, depth=depth, location=pos)
    return finish(bpy.context.object, name, tint, parent, bevel)

def beam(name, a, b, radius, tint, vertices=8, parent=None):
    a,b=Vector(a),Vector(b)
    obj=cylinder(name, (a+b)/2, radius, (b-a).length, tint, vertices, .008, parent)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj

def mesh(name, verts, faces, tint, parent=None, bevel=0):
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj=bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, tint, parent, bevel)

def arch(name, x,y,z,width,height,depth,tint, parent=None, bevel=.008):
    r=width/2
    points=[(-r,0),(r,0),(r,height-r)]
    points += [(math.cos(t)*r,height-r+math.sin(t)*r) for t in [math.pi*i/12 for i in range(1,13)]]
    n=len(points)
    verts=[(x+px,y+dy,z+pz) for dy in (-depth/2,depth/2) for px,pz in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,tint,parent,bevel)

def torus(name,pos,major,minor,tint,rot=None,parent=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=6,location=pos,major_radius=major,minor_radius=minor)
    obj=finish(bpy.context.object,name,tint,parent)
    if rot: obj.rotation_euler=rot
    return obj

def timber_frame(x=0,y=0,z=.17,w=1.23,d=1.05,h=.98):
    for xx in [-w/2,w/2]:
        for yy in [-d/2,d/2]:
            cube('corner beam',(x+xx,y+yy,z+h/2),(.075,.075,h),'wood',.012)
    for zz in [z+.08,z+h-.08]:
        cube('front timber',(x,y-d/2-.025,zz),(w+.08,.075,.065),'wood_light',.009)

def roof(cx=0,cy=0,eave=1.17,rise=.56,width=1.58,depth=1.46,tint='roof'):
    # The tiles overlap across a thick bent roof, rather than a texture on a prism.
    verts=[(cx-width/2,cy-depth/2,eave),(cx-width/2,cy+depth/2,eave),
           (cx,cy-depth/2,eave+rise),(cx,cy+depth/2,eave+rise),
           (cx+width/2,cy-depth/2,eave),(cx+width/2,cy+depth/2,eave)]
    mesh('thick roof shadow',verts,[(0,1,3,2),(2,3,5,4)],'wood_dark')
    length=math.sqrt((width/2)**2+rise**2)
    angle=math.atan2(rise,width/2)
    colors= ['roof','roof_light','roof_dark'] if tint=='roof' else ['teal','teal_light','teal_dark']
    for side in [-1,1]:
        for slope in range(3):
            f=(slope+.44)/3
            for row in range(5):
                yy=cy-depth/2+(row+.45)*depth/5
                xx=cx+side*f*width/2
                zz=eave+(1-f)*rise+.045+random.uniform(-.009,.009)
                # Soft tile lips and uneven courses catch individual highlights.
                obj=cube('overlapping fired tile',(xx,yy,zz),(length/3+.038,depth/5+.035,.07),
                         random.choices(colors,[6,2,1])[0],.022,rot=(0,side*angle,0))
        for yy in [cy-depth/2-.005,cy+depth/2+.005]:
            beam('gable carved fascia',(cx+side*width/2,yy,eave-.045),(cx,yy,eave+rise-.015),.049,'wood_light')
        beam('eave carved fascia',(cx+side*width/2,cy-depth/2,eave-.02),(cx+side*width/2,cy+depth/2,eave-.02),.045,'wood')
    for row in range(5):
        cap=cylinder('rounded ridge cap',(cx,cy-depth/2+(row+.5)*depth/5,eave+rise+.063),.075,depth/5+.03,colors[1],10,.007)
        cap.rotation_euler.x=math.pi/2

def flower_pot(x,y,z,scale=.16,color='pink'):
    cylinder('terracotta flowerpot',(x,y,z+scale*.43),scale*.61,scale*.85,'roof',10,.009,radius2=scale*.77)
    torus('rolled pot lip',(x,y,z+scale*.87),scale*.70,scale*.08,'roof_light')
    cylinder('pot soil',(x,y,z+scale*.87),scale*.63,.016,'soil',10,0)
    for i in range(5):
        a=i*2.4
        xx=x+math.cos(a)*scale*.40; yy=y+math.sin(a)*scale*.38
        zz=z+scale*(1.25+random.random()*.45)
        beam('flower stem',(xx,yy,z+scale*.90),(xx,yy,zz),.009,'leaf')
        ball('flower',(xx,yy,zz),(scale*.19,scale*.19,scale*.16),color,1)
        ball('gold flower heart',(xx,yy-.008,zz+scale*.10),(scale*.07,)*3,'ochre',1)

def door(x=0,y=-.58,z=.18,w=.39,h=.68):
    arch('cream door surround',x,y,z,w+.13,h+.07,.08,'light')
    arch('arched teal door',x,y-.046,z+.005,w,h,.04,'teal')
    for off in [-.11,0,.11]:
        cube('door inset plank',(x+off,y-.072,z+.23),(.014,.009,.40),'teal_dark',.004)
    ball('warm brass doorknob',(x+w*.29,y-.096,z+.30),(.032,.025,.032),'ochre',2)
    cube('door sill',(x,y-.09,z+.017),(w+.22,.25,.09),'stone_light',.035)

def window(x,y,z,w=.28,h=.32):
    cube('window cream recess',(x,y,z),(w+.10,.07,h+.10),'light',.016)
    cube('window deep blue',(x,y-.046,z),(w,.025,h),'glass',.008)
    cube('window vertical mullion',(x,y-.066,z),(.026,.035,h),'wood_light',.008)
    cube('window horizontal mullion',(x,y-.065,z),(w,.035,.028),'wood_light',.006)
    cube('stone window ledge',(x,y-.080,z-h/2-.035),(w+.14,.18,.07),'cream',.018)
    for side in [-1,1]:
        cube('open sage shutter',(x+side*(w*.73),y-.045,z),(w*.32,.045,h+.02),'sage',.012,rot=(0,0,side*.18))
        for dz in [-.09,.01,.11]:
            cube('shutter slat',(x+side*(w*.73),y-.072,z+dz),(w*.28,.02,.017),'leaf_dark',.005)

def crate(x,y,z,w=.3,fruit=False):
    cube('crate dark inside',(x,y,z+.10),(w,.28,.20),'wood_dark',.01)
    for sy in [-1,1]:
        for zz in [.035,.115,.195]:
            cube('crate slat',(x,y+sy*.145,z+zz),(w+.035,.035,.06),'wood_light',.006)
    for sx in [-1,1]:
        cube('crate end',(x+sx*w/2,y,z+.11),(.035,.31,.22),'wood',.006)
    if fruit:
        for i in range(6):
            ball('ripe harvest',(x+(i%3-1)*w*.27,y+(i//3-.5)*.13,z+.225),(.062,.055,.065),'red' if i%2 else 'ochre',1)

def log(x,y,z,length=.48,r=.07,rot=0):
    axis=Vector((math.sin(rot),math.cos(rot),0))
    center=Vector((x,y,z))
    beam('cut log',center-axis*length/2,center+axis*length/2,r,'wood',10)
    for s in [-1,1]:
        end=center+axis*(length/2+.005)*s
        obj=cylinder('log cut end',end,r*.83,.01,'wood_light',10,0)
        obj.rotation_euler=axis.to_track_quat('Z','Y').to_euler()

def tree(x,y,z=0,scale=1,fruit=False):
    beam('tapered fruit tree trunk',(x,y,z),(x+.04*scale,y,z+.84*scale),.073*scale,'wood',9)
    for i in range(3):
        a=i*2.1+.2
        beam('branch',(x,y,z+.45*scale),(x+math.cos(a)*.31*scale,y+math.sin(a)*.28*scale,z+.92*scale),.035*scale,'wood')
    for i,(dx,dy,dz,s) in enumerate([(-.22,-.02,.93,.32),(.22,.07,1.00,.35),(0,-.16,1.20,.37),(.02,.19,1.22,.30),(-.14,.12,1.32,.29)]):
        ball('sculpted leaf crown',(x+dx*scale,y+dy*scale,z+dz*scale),(s*scale,s*.85*scale,s*.80*scale),['leaf','leaf_light','leaf','sage','leaf_light'][i],2)
    if fruit:
        for dx,dy,dz in [(-.32,-.2,1.04),(.25,-.2,1.12),(.04,-.38,1.24),(-.15,-.14,1.47),(.25,.1,1.27)]:
            ball('golden quince',(x+dx*scale,y+dy*scale,z+dz*scale),(.065*scale,)*3,'ochre',2)
            cube('quince stem',(x+dx*scale,y+dy*scale,z+(dz+.065)*scale),(.018,.018,.04),'wood_dark',.003)

def tapered_bough(name, centers, radii, tint='wood', sides=8):
    """A bent solid tapered trunk/branch with a flared, planted lower end."""
    verts=[]
    for i,((x,y,z),radius) in enumerate(zip(centers,radii)):
        for j in range(sides):
            a=j*math.tau/sides+.13*(i%2)
            verts.append((x+math.cos(a)*radius,y+math.sin(a)*radius,z))
    faces=[tuple(range(sides-1,-1,-1))]
    for ring in range(len(centers)-1):
        for j in range(sides):
            faces.append((ring*sides+j,ring*sides+(j+1)%sides,(ring+1)*sides+(j+1)%sides,(ring+1)*sides+j))
    faces.append(tuple(range((len(centers)-1)*sides,len(centers)*sides)))
    return mesh(name,verts,faces,tint)

def sculpted_canopy(name, center, scale, tint, seed=0, pointed=False):
    """Irregular convex leaf planes, with angular overhangs and a biased crown.

    This is a hand-shaped ring profile, not an icosphere or a sphere primitive.
    Facet colors move from cool undersides into sunlit upward-facing leaf fans.
    """
    rng=random.Random(seed)
    segments=9
    profile=[(-.61,.14),(-.40,.66),(-.06,1.0),(.29,.82),(.57,.40),(.72,.015)] if not pointed else [(-.62,.13),(-.34,.76),(-.03,1),(.30,.60),(.64,.24),(.87,.015)]
    verts=[]
    for ring,(z,radius) in enumerate(profile):
        for j in range(segments):
            angle=j*math.tau/segments+(ring%2)*.13
            ripple=1+rng.uniform(-.13,.12)
            dx=(math.cos(angle)*radius*ripple+.16*z)*scale[0]
            dy=(math.sin(angle)*radius*ripple-.10*z)*scale[1]
            zz=(z+rng.uniform(-.055,.055))*scale[2]
            verts.append((center[0]+dx,center[1]+dy,center[2]+zz))
    faces=[tuple(range(segments-1,-1,-1))]
    for ring in range(len(profile)-1):
        for j in range(segments):
            a=ring*segments+j; b=ring*segments+(j+1)%segments
            c=(ring+1)*segments+(j+1)%segments; d=(ring+1)*segments+j
            # Alternating triangular planes avoid the smooth ring-banded look.
            faces.extend([(a,b,c),(a,c,d)])
    faces.append(tuple(range((len(profile)-1)*segments,len(profile)*segments)))
    obj=mesh(name,verts,faces,tint)
    variants={'leaf':['leaf_dark','leaf','leaf','leaf_light'], 'leaf_light':['leaf','leaf_light','leaf_light','sage'], 'sage':['leaf_light','sage','sage','leaf_light']}.get(tint,['leaf_dark','leaf','leaf','leaf_light'])
    attr=obj.data.color_attributes['Color']
    for polygon in obj.data.polygons:
        shade=variants[0] if polygon.normal.z<-.35 else (variants[3] if polygon.normal.z>.45 and rng.random()<.45 else rng.choice(variants[1:3]))
        for loop_index in polygon.loop_indices: attr.data[loop_index].color=rgba(shade)
    return obj


def house(w=1.12,d=1.02,h=.98,rise=.43,tint='roof',wall='cream'):
    cube('dressed stone foundation',(0,0,.095),(w+.12,d+.12,.19),'stone_light',.035)
    cube('hand plastered wall',(0,0,.17+h/2),(w,d,h),wall,.03)
    eave=.17+h
    mesh('plaster gables',[(-w/2,-d/2,eave),(w/2,-d/2,eave),(0,-d/2,eave+rise),(-w/2,d/2,eave),(w/2,d/2,eave),(0,d/2,eave+rise)],[(0,1,2),(5,4,3),(0,3,5,2),(2,5,4,1)],wall)
    roof(eave=eave,rise=rise,width=w+.25,depth=d+.24,tint=tint)
    for x in [-w/2,w/2]:
        cube('plaster corner quoin',(x,-d/2-.012,.64),(.08,.07,.91),'light',.012)
    return eave

def side_window(x,y,z,w=.30,h=.35):
    cube('side window frame',(x,y,z),(.075,w+.08,h+.08),'light',.01)
    cube('side window glass',(x+.045,y,z),(.025,w,h),'glass',.006)
    cube('side mullion',(x+.062,y,z),(.035,.025,h),'wood_light',.005)
    cube('side sill',(x+.045,y,z-h/2-.025),(.13,w+.13,.06),'cream',.012)

def chimney(x,y,z,h=.55):
    cube('brick chimney shaft',(x,y,z+h/2),(.23,.23,h),'roof_light',.016)
    cube('chimney cap',(x,y,z+h),(.31,.30,.08),'cream',.015)
    cube('chimney black throat',(x,y,z+h+.046),(.17,.16,.015),'ink',.004)
    for zz in [z+h*.25,z+h*.58,z+h*.82]: cube('mortar stripe',(x,y-.119,zz),(.22,.012,.018),'roof_dark',.002)

def basket(x,y,z,r=.14,produce='bread'):
    cylinder('woven basket body',(x,y,z+.075),r*.72,.15,'wood_light',10,.007,radius2=r)
    cylinder('basket dark interior',(x,y,z+.153),r*.90,.014,'wood_dark',10,0)
    torus('rolled wicker lip',(x,y,z+.16),r,.014,'ochre')
    for i in range(3):
        a=i*2.1
        xx=x+math.cos(a)*r*.42; yy=y+math.sin(a)*r*.4
        if produce=='bread':
            ball('fresh bread loaf',(xx,yy,z+.18),(.065,.047,.039),'ochre',1)
            cube('scored loaf crust',(xx,yy,z+.216),(.045,.012,.009),'cream',.003,rot=(0,0,.4))
        else: ball('market produce',(xx,yy,z+.18),(.047,.047,.046),produce,1)

def barrel(x,y,z,r=.14,h=.32):
    cylinder('barrel staves',(x,y,z+h/2),r,h,'wood',12,.012)
    cylinder('barrel lid',(x,y,z+h+.009),r*.90,.02,'wood_light',12,.005)
    for zz in [z+.07,z+h-.07]: torus('barrel hoop',(x,y,zz),r,.012,'metal')
    for dx in [-.045,.04]: cube('lid plank seam',(x+dx,y,z+h+.022),(.01,r*1.6,.008),'wood_dark',.001)

def banner(x,y,z,width=.20,length=.43,tint='red'):
    beam('pennant pole',(x,y,.07),(x,y,z+.10),.021,'wood_dark',6)
    beam('pennant crosspiece',(x-width*.62,y,z),(x+width*.62,y,z),.019,'wood_light',6)
    mesh('swallowtail linen pennant',[(x-width/2,y-.009,z),(x+width/2,y-.009,z),(x+width/2,y-.01,z-length),(x,y-.015,z-length+.07),(x-width/2,y-.01,z-length)],[(0,1,2,3,4)],tint)
    cube('pennant woven stripe',(x,y-.022,z-length*.32),(.029,.013,length*.55),'light',.003)

def blade_disk(x,y,z,r=.16):
    verts=[]
    count=32
    for yy in [y-.012,y+.012]:
        for i in range(count):
            a=i*math.tau/count; rr=r if i%2 else r*.88
            verts.append((x+math.cos(a)*rr,yy,z+math.sin(a)*rr))
    faces=[tuple(range(count-1,-1,-1)),tuple(range(count,2*count))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh('cast iron circular saw teeth',verts,faces,'metal')
    axis=cylinder('saw central spindle',(x,y-.024,z),.027,.025,'wood_dark',8,0)
    axis.rotation_euler.x=math.pi/2

def awning(x,y,z,w=1.32,d=.72,colors=('light','red')):
    for xx in [-w/2,w/2]:
        beam('awning support post',(x+xx,y-d/2,.1),(x+xx,y-d/2,z-.10),.035,'wood_light',8)
    for i in range(8):
        xl=x-w/2+i*w/8; xr=xl+w/8
        section=[(xl,y-d/2,z-.12),(xr,y-d/2,z-.12),(xl,y,z+.08),(xr,y,z+.08),(xl,y+d/2,z),(xr,y+d/2,z)]
        mesh('striped linen awning',section,[(0,1,3,2),(2,3,5,4)],colors[i%2])
        cube('scalloped awning valance',((xl+xr)/2,y-d/2-.01,z-.155),(w/8-.004,.027,.105),colors[i%2],.018)
    beam('awning front rail',(x-w/2-.03,y-d/2,z-.105),(x+w/2+.03,y-d/2,z-.105),.025,'wood')

# Wheat farm: planted rows, golden ears, a stook, and low split-rail fencing.
root('farm')
cube('cultivated dark loam',(0,0,.065),(1.45,1.40,.13),'soil',.04)
for x in [-.54,-.18,.18,.54]:
    cube('raised wheat furrow',(x,-.04,.145),(.17,1.22,.08),'wood_dark',.025)
    for j in range(5):
        y=-.49+j*.245
        for k in range(2):
            xx=x+(k-.5)*.06; h=.39+random.random()*.12
            stalk=cylinder('wheat stalk',(xx+.0125,y,(.15+h)/2),.008,h-.15,'ochre',5,0)
            stalk.rotation_euler.y=.025/(h-.15)
            for dz,side in [(0,-1),(.045,1),(.08,-1)]:
                kernel=ball('heavy grain ear',(xx+side*.02+.025,y,h+dz),(.025,.018,.050),'ochre' if k else 'light',1)
                kernel.rotation_euler.y=side*.34
            mesh('wheat leaf',[(xx,y,.27),(xx-.07,y+.018,.35),(xx-.04,y+.016,.28)],[(0,1,2)],'sage')
for x in [-.70,0,.70]:
    cube('farm fence post',(x,.70,.25),(.065,.065,.50),'wood_light',.008)
for z in [.15,.36]: cube('farm low fence rail',(0,.70,z),(1.50,.044,.047),'wood',.007)
for i in range(5):
    beam('gathered wheat stook',(.51,-.63,.12),(.41+i*.039,-.63,.55-abs(i-2)*.045),.023,'ochre',5)
torus('stook binding',(.51,-.63,.31),.061,.012,'wood_dark')

root('bakery')
house(w=1.14,d=1.05,h=.99,rise=.39,tint='roof')
door(-.28,-.565,.18,.32,.66)
window(.34,-.563,.91,.25,.28)
side_window(.58,.05,.72,.28,.34)
chimney(.37,.27,1.47,.59)
ball('domed terracotta bread oven',(.39,-.57,.42),(.29,.25,.27),'roof',2)
arch('oven cream surround',.39,-.752,.22,.33,.30,.048,'cream')
arch('oven glowing mouth',.39,-.781,.245,.24,.22,.025,'roof_dark')
arch('oven warm inner fire',.39,-.798,.252,.16,.15,.014,'ochre')
cube('oven hearth ledge',(.39,-.76,.21),(.48,.13,.07),'stone_light',.015)
basket(-.59,-.65,.15,.12)
beam('bread peel handle',(-.63,-.35,.22),(-.67,-.34,1.04),.018,'wood_light',6)
cube('bread peel paddle',(-.68,-.34,1.09),(.14,.042,.17),'wood_light',.026,rot=(0,-.08,0))
cube('hanging bread sign',(-.10,-.602,1.18),(.39,.045,.16),'wood_dark',.018)
ball('bread sign relief',(-.10,-.635,1.18),(.13,.025,.044),'ochre',1)

root('sawmill')
cube('sawmill timber deck',(0,0,.075),(1.46,1.37,.15),'wood',.02)
for x in [-.57,.57]:
    for y in [-.44,.44]:
        cube('sawmill stout post',(x,y,.67),(.115,.115,1.20),'wood_light',.011)
        beam('sawmill diagonal brace',(x,y,.94),(x*.56,y,1.25),.034,'wood',6)
roof(eave=1.28,rise=.30,width=1.60,depth=1.51,tint='teal')
cube('saw bench',(0,-.25,.57),(1.10,.52,.10),'wood_light',.016)
for x in [-.44,.44]: cube('saw bench leg',(x,-.25,.33),(.11,.40,.43),'wood',.012)
blade_disk(.08,-.27,.67,.18)
cube('sawmill plank being cut',(-.28,-.28,.645),(.68,.16,.04),'cream',.006)
for j in range(5): log(-.40+j*.20,.41,.22+(j%2)*.10,.47,.065)
for i in range(4): cube('vertical sawn planks',(.66,-.10,.40),(.07,.27,.58+i*.06),'wood_light' if i%2 else 'wood',.009,rot=(0,.035*i,0))
crate(-.48,-.56,.16,.20,False)

root('mine')
for i,(x,y,z,s) in enumerate([(-.42,.24,.54,.46),(.07,.39,.75,.56),(.44,.29,.58,.40),(-.12,.14,1.12,.35)]):
    rock=ball('rough quarry ridge',(x,y,z),(s,s*.68,s*.98),'stone' if i%2 else 'stone_dark',1)
arch('dark mine opening',0,-.075,.08,.68,.92,.12,'ink')
for x in [-.42,.42]:
    cube('mine portal timber upright',(x,-.18,.57),(.17,.20,1.07),'wood_light',.015)
    cube('portal foot stone',(x,-.18,.10),(.23,.24,.20),'stone_light',.015)
cube('mine portal lintel',(0,-.18,1.12),(1.04,.23,.17),'wood',.018)
for s in [-1,1]: beam('portal diagonal corbel',(s*.40,-.20,.80),(s*.24,-.20,1.08),.045,'wood_light',6)
for x in [-.20,.20]: cube('mine narrow gauge rail',(x,-.39,.056),(.042,.82,.035),'metal',.003)
for y in [-.73,-.56,-.39,-.22,.02]: cube('mine rail sleeper',(0,y,.029),(.55,.07,.044),'wood_dark',.004)
cube('ore cart lower chassis',(0,-.53,.17),(.47,.38,.08),'wood_dark',.01)
cube('iron ore cart tub',(0,-.53,.31),(.43,.36,.23),'teal_dark',.017)
cube('ore cart dark interior',(0,-.53,.438),(.35,.28,.015),'ink',.008)
for x in [-.24,.24]:
    for y in [-.65,-.40]:
        wheel=cylinder('iron mine cart wheel',(x,y,.13),.079,.039,'metal',10,.004)
        wheel.rotation_euler.y=math.pi/2
for i in range(5): ball('blue iron ore',(random.uniform(-.14,.14),-.53+random.uniform(-.09,.09),.465),(.075,.057,.07),'teal_light' if i%2 else 'stone_dark',1)
cube('mine safety lantern',(.55,-.25,.73),(.11,.11,.17),'ochre',.018)

root('smith')
cube('forge flagstone floor',(0,0,.055),(1.48,1.40,.11),'stone_dark',.028)
for x in [-.57,.57]:
    for y in [-.46,.44]: cube('forge canopy oak post',(x,y,.69),(.095,.095,1.30),'wood',.012)
roof(eave=1.32,rise=.23,width=1.60,depth=1.47,tint='teal')
cube('forge brick furnace',(-.30,.28,.43),(.50,.45,.74),'roof',.018)
arch('forge firebox trim',-.30,.027,.36,.33,.40,.045,'stone_light')
arch('forge dark firebox',-.30,-.003,.38,.26,.33,.025,'ink')
arch('forge glowing embers',-.30,-.019,.385,.21,.14,.020,'flame')
chimney(-.30,.29,1.10,.78)
# The anvil is at the toy villagers' waist, leaving room for a real upswing.
cube('anvil oak block',(.27,-.28,.165),(.35,.36,.23),'wood_dark',.03)
cube('anvil base',(.27,-.28,.29),(.41,.28,.09),'metal',.014)
cube('anvil narrow waist',(.27,-.28,.39),(.18,.18,.15),'metal',.018)
cube('anvil face',(.27,-.28,.49),(.44,.24,.11),'teal_dark',.01)
mesh('anvil tapered horn',[(.04,-.39,.435),(.04,-.17,.435),(.04,-.17,.54),(.04,-.39,.54),(-.15,-.28,.505)],[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'metal')
for i in range(4): cube('bellows leather folds',(.31,.31,.30+i*.033),(.40-i*.012,.28,.024),'roof_dark' if i%2 else 'wood_dark',.02)
cube('bellows wooden top',(.31,.31,.446),(.40,.28,.04),'wood_light',.018)
beam('bellows air spout',(.13,.30,.37),(-.04,.28,.35),.045,'metal',8)
crate(.56,-.51,.11,.22,False)
for i in range(4): ball('charcoal lumps',(.56+random.uniform(-.07,.07),-.51+random.uniform(-.07,.07),.35),(.046,.042,.042),'ink',1)

root('market')
cube('market timber platform',(0,0,.06),(1.49,1.35,.12),'wood',.024)
for x in [-.65,.65]: beam('market rear post',(x,.45,.1),(x,.45,1.40),.04,'wood_light',8)
awning(0,-.02,1.40,1.40,1.12,('light','red'))
cube('stall slatted counter',(0,-.39,.58),(1.30,.40,.14),'wood_light',.02)
for x in [-.56,-.28,0,.28,.56]: cube('counter front upright',(x,-.57,.37),(.22,.037,.37),'wood',.008)
for x,tint in [(-.44,'red'),(0,'ochre'),(.44,'sage')]: basket(x,-.39,.66,.15,tint)
crate(-.41,.33,.12,.31,True)
crate(.27,.34,.12,.31,True)
barrel(.60,.32,.12,.13,.31)
cube('market weighing balance foot',(.49,-.38,.72),(.11,.13,.09),'teal_dark',.01)
beam('market scale upright',(.49,-.38,.74),(.49,-.38,1.05),.012,'metal',6)
beam('market scale beam',(.35,-.38,1.03),(.63,-.38,1.03),.012,'ochre',6)

root('school')
house(w=1.13,d=1.06,h=1.28,rise=.46,tint='teal')
door(-.32,-.574,.18,.30,.72)
window(.27,-.573,.98,.34,.61)
side_window(.57,.09,.95,.31,.60)
arch('school attic round recess',0,-.548,1.58,.24,.25,.037,'wood_dark')
arch('school attic golden shutter',0,-.575,1.60,.18,.20,.025,'ochre')
cube('chalkboard oak frame',(-.55,-.73,.60),(.32,.055,.38),'wood_light',.012)
cube('chalkboard slate',(-.55,-.765,.60),(.26,.023,.30),'teal_dark',.004)
for x in [-.67,-.43]: cube('chalkboard legs',(x,-.72,.24),(.035,.045,.43),'wood',.004)
beam('chalk A left',(-.61,-.783,.52),(-.55,-.783,.69),.008,'light',5)
beam('chalk A right',(-.55,-.783,.69),(-.49,-.783,.52),.008,'light',5)
beam('chalk A bar',(-.59,-.783,.585),(-.515,-.783,.585),.007,'light',5)
cube('school book ledge',(.48,-.67,.30),(.30,.18,.07),'wood_light',.013)
for i,tint in enumerate(['red','teal','ochre']): cube('stacked lesson book',(.48,-.67,.36+i*.044),(.22-.02*i,.13,.035),tint,.005,rot=(0,0,.035*i))
banner(.64,.37,1.57,.18,.35,'ochre')

root('well')
cylinder('well dark water',(0,0,.21),.32,.025,'glass',16,0)
for row in range(3):
    for i in range(12):
        a=(i+.5*(row%2))*math.tau/12
        cube('well dressed masonry',(math.cos(a)*.36,math.sin(a)*.36,.095+row*.14),(.20,.14,.13),'stone_light' if i%3 else 'stone',.013,rot=(0,0,a+math.pi/2))
for x in [-.48,.48]: cube('well oak upright',(x,0,.65),(.11,.12,1.30),'wood',.012)
roof(eave=1.28,rise=.26,width=1.24,depth=.97,tint='roof')
beam('well winch axle',(-.56,0,.91),(.63,0,.91),.042,'wood_light',10)
beam('well crank handle',(.65,0,.92),(.65,0,.70),.02,'metal',6)
beam('well crank grip',(.65,0,.70),(.74,0,.70),.026,'wood',8)
for x in [-.09,-.03,.03,.09]: torus('winch wound rope',(x,0,.91),.052,.014,'cream',rot=(0,math.pi/2,0))
beam('well bucket rope',(0,0,.86),(0,0,.32),.012,'cream',6)
cylinder('well wooden bucket',(0,0,.29),.12,.23,'wood_light',10,.008,radius2=.14)
torus('well bucket rim',(0,0,.41),.137,.015,'metal')
cylinder('spare well bucket',(.49,-.47,.14),.12,.25,'wood_light',10,.01,radius2=.14)
torus('spare bucket handle',(.49,-.47,.35),.092,.014,'metal',rot=(math.pi/2,0,0))

root('barracks')
house(w=1.17,d=1.10,h=.95,rise=.45,tint='teal',wall='stone_light')
door(0,-.591,.18,.39,.70)
for x in [-.40,.40]: arch('guardhouse arrow slit',x,-.567,.77,.105,.34,.022,'teal_dark')
cube('guardhouse oak lintel',(0,-.598,1.00),(.56,.08,.11),'wood',.01)
for x,tint in [(-.64,'red'),(.64,'ochre')]: banner(x,-.42,1.42,.16,.48,tint)
cube('shield rack rail',(.43,-.68,.55),(.47,.045,.045),'wood_light',.006)
for x in [.25,.43,.61]:
    mesh('guard training shield',[(x-.071,-.72,.60),(x+.071,-.72,.60),(x+.071,-.73,.45),(x,-.75,.39),(x-.071,-.73,.45)],[(0,1,2,3,4)],'teal')
    cube('shield painted stripe',(x,-.756,.514),(.016,.010,.16),'light',.002)
barrel(-.57,.35,.10,.13,.30)

root('warehouse')
house(w=1.36,d=1.19,h=1.16,rise=.52,tint='roof',wall='wood')
for x in [-.57,-.38,-.19,0,.19,.38,.57]: cube('warehouse exterior plank',(x,-.608,.82),(.018,.014,1.02),'wood_dark',.002)
cube('wide storage door surround',(0,-.643,.61),(.87,.09,.99),'wood_light',.012)
cube('double storage doors',(0,-.698,.60),(.73,.045,.88),'teal',.01)
for s in [-1,1]:
    cube('barn door vertical seam',(s*.18,-.728,.60),(.014,.012,.84),'teal_dark',.002)
    beam('barn door diagonal brace',(s*.33,-.744,.22),(s*.02,-.744,.99),.024,'wood_light',6)
    ball('barn door iron ring',(s*.075,-.758,.63),(.025,.012,.025),'metal',1)
arch('warehouse loft opening',0,-.615,1.47,.31,.35,.025,'wood_dark')
cube('warehouse loading sill',(0,-.735,.15),(.95,.18,.11),'stone_light',.021)
crate(-.62,-.45,.12,.22,False)
crate(.62,-.44,.12,.22,False)
barrel(.61,.47,.10,.13,.34)
beam('loft hoist bracket',(0,-.66,1.89),(0,-.78,1.89),.036,'wood_dark')

root('clinic')
house(w=1.15,d=1.04,h=.98,rise=.38,tint='teal')
door(-.25,-.565,.18,.33,.68)
window(.34,-.560,.83,.28,.35)
side_window(.585,.06,.72,.28,.38)
cube('herbalist sign backing',(-.24,-.610,1.035),(.30,.041,.17),'light',.021)
for s in [-1,1]:
    leaf=ball('herbalist leaf emblem',(-.24+s*.045,-.64,1.035),(.036,.013,.060),'leaf',1)
    leaf.rotation_euler.y=s*.45
beam('herbalist leaf stem',(-.24,-.659,.99),(-.24,-.659,1.08),.007,'sage',5)
for x,y,s in [(-.61,-.50,.15),(.58,-.51,.17),(.60,.32,.14)]: flower_pot(x,y,.09,s,'purple')
cube('herb drying crossbar',(-.10,.60,1.15),(.77,.05,.05),'wood_light',.008)
for i in range(4):
    x=-.38+i*.18
    beam('hanging herb twine',(x,.6,1.16),(x,.6,.98),.008,'cream',5)
    for j in range(3): ball('hanging dried herb',(x+(j-1)*.021,.60,.90),(.026,.024,.10),'sage' if j%2 else 'leaf_light',1)

# The upgrade is a full replacement home, sharing cottage's ground anchor.
root('upgrade_cottage')
house(w=1.20,d=1.09,h=1.64,rise=.48,tint='teal')
door(-.25,-.590,.18,.34,.70)
window(.35,-.585,.74,.25,.33)
window(-.29,-.585,1.39,.26,.37)
window(.29,-.585,1.39,.26,.37)
side_window(.615,.11,1.29,.34,.40)
for z in [.97,1.72]: cube('upper storey half timber',(0,-.570,z),(1.24,.071,.07),'wood_light',.008)
cube('upgraded balcony deck',(0,-.655,1.085),(1.05,.26,.085),'wood',.015)
for x in [-.48,-.24,0,.24,.48]: cube('balcony turned spindle',(x,-.782,1.22),(.037,.037,.23),'wood_light',.006)
cube('balcony top handrail',(0,-.781,1.35),(1.08,.055,.052),'wood_light',.008)
chimney(.41,.24,1.98,.60)
arch('dormer round window',0,-.560,1.92,.26,.30,.045,'light')
arch('dormer golden window',0,-.587,1.95,.19,.22,.02,'ochre')
banner(-.63,.31,1.86,.19,.48,'red')
flower_pot(-.62,-.62,.08,.14,'pink')
flower_pot(.62,-.62,.08,.14,'light')

# Scaffold is a shell around a developing house, never an opaque placeholder.
root('construction')
for x in [-.65,.65]:
    for y in [-.64,.64]:
        cube('scaffold timber upright',(x,y,.75),(.075,.075,1.50),'wood_light',.009)
        cube('scaffold square foot pad',(x,y,.035),(.20,.17,.07),'wood_dark',.008)
for z in [.61,1.29]:
    for y in [-.64,.64]: cube('scaffold horizontal rail',(0,y,z),(1.41,.048,.06),'wood',.008)
    for x in [-.65,.65]: cube('scaffold side rail',(x,0,z),(.048,1.37,.06),'wood',.008)
for x in [-.65,.65]: beam('scaffold diagonal brace',(x,-.62,.25),(x,.61,1.27),.025,'wood_light',6)
for x in [-.38,-.13,.12,.37]: cube('scaffold working plank',(x,.47,.87),(.22,.29,.035),'wood_light',.005)
for i in range(5): cube('pallet lumber',(-.23,-.28,.07+i*.041),(.65,.17,.03),'wood_light' if i%2 else 'wood',.004,rot=(0,0,.03*(i%2)))
for i in range(5): cube('waiting dressed stone',(.35+(i%2)*.16,-.13+(i//2)*.14,.10+(i%2)*.08),(.18,.16,.16),'stone_light',.017)
for x in [-.18,.18]: beam('short scaffold ladder side',(x,.53,.09),(x,.53,1.42),.022,'wood',6)
for z in [.25,.48,.71,.94,1.17]: beam('scaffold ladder rung',(-.18,.53,z),(.18,.53,z),.018,'wood_light',6)

# Carried tools are authored around the actual hand grip. Local Three +Y is up.
root('tool_hammer')
beam('hammer ash handle',(0,0,-.16),(0,0,.18),.019,'wood_light',8)
cube('forged hammer head',(0,0,.18),(.17,.072,.082),'metal',.008)
cube('hammer poll',(-.080,0,.18),(.03,.079,.088),'teal_dark',.004)

root('tool_axe')
beam('axe curved handle',(.015,0,-.17),(-.009,0,.19),.018,'wood_light',8)
mesh('axe wedge blade',[(-.03,-.025,.135),(.05,-.025,.135),(.14,-.022,.12),(.15,-.022,.245),(.05,-.025,.23),(-.03,-.025,.23),(-.03,.025,.135),(.05,.025,.135),(.14,.022,.12),(.15,.022,.245),(.05,.025,.23),(-.03,.025,.23)],[(0,1,2,3,4,5),(11,10,9,8,7,6),(0,6,7,1),(1,7,8,2),(2,8,9,3),(3,9,10,4),(4,10,11,5),(5,11,6,0)],'metal',bevel=.004)

root('tool_pick')
beam('pick hickory shaft',(0,0,-.18),(0,0,.18),.018,'wood',8)
mesh('curved double ended pick',[(-.18,0,.095),(-.13,-.022,.185),(0,-.032,.225),(.13,-.022,.18),(.18,0,.115),(.12,.022,.204),(0,.032,.25),(-.12,.022,.21)],[(0,1,2,6,7),(2,3,4,5,6),(0,7,6,5,4,3,2,1)],'metal')
cube('pick central socket',(0,0,.204),(.052,.069,.075),'teal_dark',.005)

root('tool_hoe')
beam('hoe long handle',(0,0,-.19),(0,0,.19),.016,'wood_light',8)
beam('hoe bent iron neck',(0,0,.185),(0,-.065,.17),.015,'metal',6)
cube('hoe broad blade',(0,-.090,.158),(.13,.069,.034),'metal',.008,rot=(.22,0,0))

root('tool_spear')
beam('spear ash shaft',(0,0,-.20),(0,0,.19),.013,'wood_light',8)
mesh('leaf shaped spear point',[(0,0,.302),(-.036,-.008,.222),(0,-.013,.185),(.036,-.008,.222),(0,.012,.24)],[(0,1,2),(0,2,3),(0,4,1),(1,4,2),(2,4,3),(3,4,0)],'metal')
torus('spear binding',(0,0,.181),.016,.006,'red')

root('tool_book')
cube('book cream pages',(0,-.028,.035),(.16,.049,.21),'light',.004)
cube('book leather front',(0,-.059,.035),(.18,.013,.232),'red',.005)
cube('book leather back',(0,.004,.035),(.18,.013,.232),'red',.005)
cube('book bound spine',(-.086,-.028,.035),(.019,.076,.232),'roof_dark',.005)
for z in [-.035,.095]: cube('book gilded spine band',(-.096,-.028,z),(.007,.071,.012),'ochre',.002)
cube('book cover gold inset',(0,-.068,.035),(.096,.006,.131),'ochre',.004)
cube('book cover leather inset',(0,-.072,.035),(.080,.006,.115),'red',.003)

root('tool_basket')
cylinder('carried wicker basket',(0,0,-.102),.095,.145,'wood_light',10,.006,radius2=.117)
cylinder('basket interior',(0,0,-.026),.101,.014,'wood_dark',10,0)
torus('basket thick rim',(0,0,-.019),.112,.012,'ochre')
torus('basket arched handle',(0,0,.045),.079,.012,'wood',rot=(math.pi/2,0,0))
for i in range(3): ball('basket harvest',(math.cos(i*2.1)*.046,math.sin(i*2.1)*.043,-.011),(.039,.037,.041),'red' if i%2 else 'ochre',1)

# One shared vertex-color material and one identity-transform mesh per root.
for asset in roots:
    meshes=[o for o in asset.children_recursive if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes: obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.join()
    obj=bpy.context.object; obj.name=asset.name+'_mesh'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if asset.name=='tool_basket':
        # Fingers grasp the top of the arched handle, leaving the basket below.
        for vertex in obj.data.vertices: vertex.co.z-=.124
    if not asset.name.startswith('tool_'):
        for vertex in obj.data.vertices:
            if vertex.co.z<0: vertex.co.z=0
        bottom=min(v.co.z for v in obj.data.vertices)
        if bottom>.001:
            for vertex in obj.data.vertices: vertex.co.z-=bottom
    obj.data.update()

metadata={
    'title':'Wildhaven original town expansion kit',
    'authoring':'Original Blender geometry; no downloaded models, textures, fonts or add-ons.',
    'blender_version':bpy.app.version_string,
    'generator':'../tools/create_town_assets.py',
    'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'coordinates':'GLB: Three Y-up, +Z front. Buildings: ground origin. Tools: hand grip origin, handle along +Y.',
    'upgrade_cottage':'Complete replacement for cottage, not an attachment. Same ground origin and facing.',
    'construction':'Open scaffold shell, no house; hide after construction completes.',
    'assets':{}
}
work_targets={
    'farm':[0,.37,.40],'bakery':[.39,.43,.76],'sawmill':[0,.67,.25],
    'mine':[0,.38,.53],'smith':[.27,.545,.28],'market':[0,.72,.39],
    'school':[-.55,.60,.75],'well':[0,.91,0],'barracks':[.43,.53,.72],
    'warehouse':[0,.60,.74],'clinic':[-.25,.65,.60],
}
for asset in roots:
    obj=next(o for o in asset.children if o.type=='MESH')
    mins=[min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    maxs=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    metadata['assets'][asset.name]={
        'size_three':[round(maxs[0]-mins[0],4),round(maxs[2]-mins[2],4),round(maxs[1]-mins[1],4)],
        'bounds_three':{'min':[round(mins[0],4),round(mins[2],4),round(-maxs[1],4)],'max':[round(maxs[0],4),round(maxs[2],4),round(-mins[1],4)]},
        'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),
        'mesh_nodes':1,
        'anchor':'hand_grip' if asset.name.startswith('tool_') else 'ground',
    }
    if asset.name in work_targets:
        metadata['assets'][asset.name]['work_target_three']=work_targets[asset.name]

bpy.ops.object.select_all(action='DESELECT')
for asset in roots:
    asset.select_set(True)
    for obj in asset.children_recursive: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'town-kit.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)
metadata['total_triangles']=sum(v['triangles'] for v in metadata['assets'].values())
metadata['glb_bytes']=(OUT/'town-kit.glb').stat().st_size
(OUT/'town-kit.json').write_text(json.dumps(metadata,indent=2)+'\n')

# Source scene is a labeled gallery; GLB roots above were all exported at origin.
ROOT=None
layout=[['school','upgrade_cottage','warehouse','bakery','clinic'],['sawmill','mine','smith','market','barracks'],['farm','well','construction','tool_hammer','tool_axe'],['tool_pick','tool_hoe','tool_spear','tool_book','tool_basket']]
for row,names in enumerate(layout):
    for col,name in enumerate(names):
        asset=next(r for r in roots if r.name==name)
        x=(col-2)*2.35; y=3.8-row*2.55
        scale=2.8 if name.startswith('tool_') else 1.0
        asset.scale=(scale,)*3
        asset.location=(x,y,-metadata['assets'][name]['bounds_three']['min'][1]*scale)
        bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.99,depth=.065,location=(x,y,-.0525))
        plinth=finish(bpy.context.object,'gallery plinth','light',None,.025)
        plinth.parent=None
        font=bpy.data.curves.new('asset label','FONT'); font.body=name.replace('tool_','').replace('_',' ').upper(); font.align_x='CENTER'; font.size=.105; font.extrude=.001
        label=bpy.data.objects.new('label_'+name,font); bpy.context.collection.objects.link(label)
        label.location=(x,y-.93,-.011)
        label.data.materials.append(paint)

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.11))
floor=bpy.context.object; floor.name='Town art gallery backdrop'
mat=bpy.data.materials.new('Town gallery sage paper'); mat.use_nodes=True
mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=rgba('#bbc3a5')
mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.9
floor.data.materials.append(mat)
world=bpy.context.scene.world or bpy.data.worlds.new('World'); bpy.context.scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.79,.88,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.45
for name,pos,energy,size in [('Town softbox',(-5,-7,13),2100,8),('Town warm bounce',(7,4,9),1000,7)]:
    light=bpy.data.lights.new(name,'AREA'); light.energy=energy; light.shape='DISK'; light.size=size
    obj=bpy.data.objects.new(name,light); bpy.context.collection.objects.link(obj); obj.location=pos
    obj.rotation_euler=(Vector((0,0,.5))-obj.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Town asset gallery camera')
camera=bpy.data.objects.new('Town asset gallery camera',camera_data); bpy.context.collection.objects.link(camera)
camera.location=(6,-19,16); camera.rotation_euler=(Vector((0,0,.55))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'; camera_data.ortho_scale=15.7
scene=bpy.context.scene; scene.camera=camera
scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.use_denoising=True
scene.render.resolution_x=2400; scene.render.resolution_y=1850; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'town-art-contact.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'town-kit.blend'))
if RENDER: bpy.ops.render.render(write_still=True)
print('WILDHAVEN_TOWN_READY '+json.dumps(metadata))
