"""Wildhaven's original, editable miniature village kit.

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
random.seed(9124)
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
        mod.segments = 2
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
        for slope in range(4):
            f=(slope+.44)/4
            for row in range(7):
                yy=cy-depth/2+(row+.45)*depth/7
                xx=cx+side*f*width/2
                zz=eave+(1-f)*rise+.045+random.uniform(-.009,.009)
                # Soft tile lips and uneven courses catch individual highlights.
                obj=cube('overlapping fired tile',(xx,yy,zz),(length/4+.038,depth/7+.035,.07),
                         random.choices(colors,[6,2,1])[0],.022,rot=(0,side*angle,0))
        for yy in [cy-depth/2-.005,cy+depth/2+.005]:
            beam('gable carved fascia',(cx+side*width/2,yy,eave-.045),(cx,yy,eave+rise-.015),.049,'wood_light')
        beam('eave carved fascia',(cx+side*width/2,cy-depth/2,eave-.02),(cx+side*width/2,cy+depth/2,eave-.02),.045,'wood')
    for row in range(7):
        cap=cylinder('rounded ridge cap',(cx,cy-depth/2+(row+.5)*depth/7,eave+rise+.063),.075,depth/7+.03,colors[1],10,.007)
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

# ---- Cottage: the founding home. ------------------------------------------------
root('cottage')
cube('rounded foundation',(0,0,.10),(1.38,1.24,.20),'stone_light',.06)
cube('butter plaster house',(0,0,.64),(1.23,1.07,.99),'cream',.045)
mesh('plaster gables',[(-.61,-.534,1.12),(.61,-.534,1.12),(0,-.534,1.62),(-.61,.534,1.12),(.61,.534,1.12),(0,.534,1.62)],[(0,1,2),(5,4,3),(0,3,5,2),(2,5,4,1)],'cream')
timber_frame()
roof(tint='teal')
door(-.20,-.576,.17,.37,.67)
window(.37,-.577,.74,.23,.29)
arch('attic opening',0,-.56,1.20,.23,.28,.027,'wood_dark')
arch('attic inner shutter',0,-.583,1.215,.17,.23,.03,'ochre')
cube('brick chimney',(.40,.22,1.65),(.25,.24,.68),'roof_light',.022)
cube('chimney collar',(.40,.22,1.95),(.32,.31,.105),'cream',.023)
cube('chimney dark throat',(.40,.22,2.013),(.18,.17,.015),'ink',.007)
for zz in [1.54,1.73,1.87]:
    cube('chimney mortar',(.402,.095,zz),(.23,.008,.018),'roof_dark',.004)
flower_pot(-.55,-.67,.15,.17,'pink')
flower_pot(.61,-.61,.13,.13,'light')
for i in range(4): log(.51,.37,.23+i*.073,.44,.053)
beam('washing line post',(-.56,.47,.15),(-.56,.47,.84),.026,'wood')
cube('striped hanging towel',(-.52,.59,.63),(.23,.028,.29),'light',.016,rot=(.07,0,-.05))
for x in [-.59,-.53,-.47]: cube('woven towel stripe',(x,.574,.63),(.018,.014,.27),'red',.003)

# ---- Lumber shed: chunky sawmill with real stacks and workbench. ----------------
root('lumber')
cube('wooden platform',(0,0,.09),(1.41,1.20,.18),'wood',.027)
for xx in [-.56,.56]:
    for yy in [-.43,.43]:
        cube('stout shed post',(xx,yy,.65),(.14,.14,1.1),'wood_light',.015)
        beam('diagonal shed brace',(xx,yy,.98),(xx*.50,yy,1.25),.045,'wood')
cube('weatherboard back',(0,.48,.66),(1.2,.08,1.06),'wood',.017)
for xx in [-.45,-.23,0,.23,.45]: cube('back vertical board seam',(xx,.43,.66),(.022,.014,1.02),'wood_dark',.005)
roof(eave=1.24,rise=.36,width=1.57,depth=1.37,tint='roof')
cube('workbench top',(-.04,-.18,.57),(1.12,.46,.12),'wood_light',.027)
for xx in [-.45,.37]: cube('workbench leg',(xx,-.19,.32),(.11,.28,.46),'wood',.012)
log(-.10,-.15,.70,.76,.085,math.pi/2)
for i in range(7): log(-.38+(i%3)*.20,.39,.24+(i//3)*.14,.45,.083)
for i in range(3): cube('stacked cut boards',(.72,-.08,.14+i*.055),(.19,.89,.045),'wood_light',.009,rot=(0,0,.03*i))
beam('axe handle',(.44,-.46,.20),(.30,-.48,.70),.026,'wood_light')
mesh('axe iron head',[(.22,-.51,.65),(.36,-.51,.71),(.40,-.51,.63),(.24,-.51,.59),(.22,-.43,.65),(.36,-.43,.71),(.40,-.43,.63),(.24,-.43,.59)],[(0,1,2,3),(7,6,5,4),(0,4,5,1),(3,2,6,7),(1,5,6,2),(0,3,7,4)],'metal',bevel=.008)
cylinder('wood chopping block',(-.58,-.64,.22),.19,.30,'wood',11,.014)
cylinder('chopping block top',(-.58,-.64,.377),.176,.024,'wood_light',11,.007)

# ---- Quarry: carved stone and a hand-powered lifting frame. ----------------------
root('quarry')
for i,(x,y,s) in enumerate([(-.42,.24,.42),(.01,.40,.43),(.37,.21,.34),(-.44,-.14,.24)]):
    ball('quarry limestone outcrop',(x,y,s*.58),(s,s*.85,s*.77),'stone_light' if i%2 else 'stone',1)
for row in range(2):
    for i in range(3-row):
        cube('cut ashlar',(-.30+i*.30,-.36,.13+row*.22),(.28,.28,.23),'stone_light',.025,rot=(0,0,.02*(i-1)))
cube('crane foot',(.45,.25,.10),(.37,.40,.20),'wood_dark',.029)
cube('crane upright',(.45,.25,.91),(.16,.16,1.60),'wood_light',.018)
beam('crane diagonal brace',(.46,.25,.74),(-.39,.25,1.70),.058,'wood')
cube('crane jib',(.06,.25,1.69),(1.17,.15,.13),'wood_light',.018)
torus('crane pulley',(-.45,.25,1.57),.097,.026,'wood_dark',rot=(math.pi/2,0,0))
beam('hemp lifting rope',(-.45,.25,1.56),(-.45,.25,.68),.011,'cream',6)
cube('suspended quarried block',(-.45,.25,.60),(.29,.28,.27),'stone_light',.028)
for y in [.12,.38]: cube('stone lifting sling',(-.45,y,.61),(.023,.019,.29),'wood_dark',.004)
beam('pick handle',(.58,-.47,.15),(.68,-.44,.62),.022,'wood_light')
beam('pick iron',(.48,-.44,.62),(.87,-.44,.63),.026,'metal')
for i in range(5): ball('stone chippings',(-.55+i*.24,-.62+random.random()*.1,.055),(.064,.053,.045),'stone',1)

# ---- Orchard and raised garden. ------------------------------------------------
root('orchard')
tree(-.30,.17,0,.95,True)
tree(.39,.22,0,.65,True)
crate(.22,-.47,.015,.35,True)
flower_pot(-.54,-.35,0,.13,'light')
for i in range(3):
    beam('orchard fence post',(-.65+i*.63,.60,0),(-.65+i*.63,.60,.45),.039,'wood_light')
for zz in [.16,.34]: beam('orchard fence rail',(-.68,.60,zz),(.66,.60,zz),.033,'wood')

root('garden')
for xx in [-.36,.36]:
    cube('raised garden soil',(xx,0,.12),(.57,1.19,.21),'soil',.03)
    for sx in [-1,1]: cube('garden bed board',(xx+sx*.30,0,.15),(.075,1.32,.28),'wood_light',.013)
    for sy in [-1,1]: cube('garden bed end',(xx,sy*.63,.15),(.61,.07,.28),'wood',.013)
    for i in range(5):
        yy=-.47+i*.24
        if xx<0:
            for j,(dx,dy) in enumerate([(-.1,0),(.07,.03),(0,-.05)]):
                leaf=ball('cabbage leaf',(xx+dx,yy+dy,.32),(.13,.13,.105),['sage','leaf_light','leaf'][j],1)
        else:
            for dx in [-.12,.10]:
                cylinder('carrot crown',(xx+dx,yy,.24),.038,.08,'roof_light',8,0,radius2=.054)
                for side in [-1,0,1]: beam('carrot feather',(xx+dx,yy,.27),(xx+dx+side*.065,yy+.025,.43-abs(side)*.035),.015,'sage',5)
crate(-.08,-.73,0,.24,True)
cylinder('watering can',(.49,.69,.14),.13,.27,'teal_light',12,.015)
torus('watering can handle',(.49,.69,.34),.09,.018,'teal',rot=(math.pi/2,0,0))
beam('watering spout',(.58,.69,.15),(.77,.69,.31),.032,'teal_light')
cylinder('watering sprinkler',(.77,.69,.32),.058,.032,'cream',10,.004)

# ---- Windmill: broad linen sails and flour sacks. -------------------------------
root('windmill')
cylinder('windmill stone plinth',(0,0,.12),.60,.24,'stone_light',16,.025)
cylinder('tapered plaster mill',(0,0,1.10),.50,1.85,'cream',12,.025,radius2=.34)
for z,r in [(.30,.492),(1.38,.38),(1.86,.342)]: torus('mill stone belt',(0,0,z),r,.028,'light')
door(0,-.49,.14,.31,.57)
arch('mill upper window',-.07,-.369,1.29,.20,.30,.05,'wood_dark')
arch('mill lit upper window',-.07,-.399,1.31,.145,.25,.025,'ochre')
bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.53,radius2=.045,depth=.53,location=(0,0,2.22))
finish(bpy.context.object,'copper mill cap','roof',bevel=.018)
torus('cap eave bead',(0,0,1.96),.51,.038,'roof_light')
cylinder('cap finial',(0,0,2.53),.040,.12,'ochre',10,.007)
rotor=bpy.data.objects.new('rotor',None)
bpy.context.collection.objects.link(rotor)
rotor.parent=ROOT
rotor.location=(0,-.48,1.88)
rotor['axis_three']='z'
for i in range(4):
    angle=i*math.pi/2+.25
    def rp(x,z,y=-.018): return (math.cos(angle)*x-math.sin(angle)*z,y,math.sin(angle)*x+math.cos(angle)*z)
    beam('mill sail spar',rp(0,-.04),rp(0,1.00),.025,'wood_light',8,rotor)
    # Four thick linen quadrilaterals make readable pinwheel sails.
    pts=[rp(.035,.28),rp(.28,.34),rp(.35,.94),rp(.035,1.01)]
    pts2=[(x,y+.035,z) for x,y,z in pts]
    mesh('linen mill sail',pts+pts2,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'light',rotor,.01)
    for z in [.38,.59,.81,.96]: beam('sail batten',rp(.022,z,-.046),rp(.29 if z<.9 else .33,z,-.046),.014,'wood_light',6,rotor)
hub=cylinder('sail hub',(0,-.061,0),.11,.13,'wood',12,.02,rotor)
hub.rotation_euler.x=math.pi/2
ball('hub pin',(0,-.14,0),(.035,.018,.035),'ochre',2,rotor)
for i,(x,y) in enumerate([(.44,-.26),(.59,.01),(-.52,.19)]):
    ball('flour sack',(x,y,.25),(.14,.13,.23),'cream',2)
    cylinder('sack gathered neck',(x,y,.45),.052,.075,'light',8,.01)
    torus('sack neck tie',(x,y,.454),.050,.009,'wood')
    cube('sack stitched label',(x,y-.122,.26),(.092,.012,.089),'roof',.007)

# ---- Bell tower: the village landmark and end-state celebration. ----------------
root('bell')
cube('tower limestone foot',(0,0,.12),(1.10,1.02,.24),'stone_light',.05)
cube('tower lower body',(0,0,.92),(.84,.79,1.58),'cream',.045)
for z in [.32,1.32,1.68]: cube('tower stone belt',(0,0,z),(.93,.88,.10),'light',.017)
door(0,-.44,.19,.35,.77)
arch('tower tall dark slit',0,-.403,1.14,.16,.33,.025,'wood_dark')
for x in [-.35,.35]:
    for y in [-.32,.32]: cube('belfry column',(x,y,2.07),(.17,.17,.79),'cream',.025)
for y in [-.34,.34]:
    cube('belfry lintel',(0,y,2.48),(.89,.19,.17),'light',.024)
    # Stepped chamfered corbels suggest a masonry arch without a flat cutout.
    for s in [-1,1]:
        cube('bell arch corbel',(s*.23,y,2.34),(.16,.17,.16),'cream',.025,rot=(0,s*.35,0))
cube('belfry upper deck',(0,0,2.56),(1.00,.95,.15),'cream',.025)
roof(eave=2.64,rise=.34,width=1.22,depth=1.15,tint='teal')
bellbody=bpy.data.objects.new('bell_body',None)
bpy.context.collection.objects.link(bellbody)
bellbody.parent=ROOT
bellbody.location=(0,0,2.36)
bellbody['axis_three']='x'
beam('bell yoke',(-.23,0,0),(.23,0,0),.037,'wood_dark',8,bellbody)
cylinder('bronze bell shoulder',(0,0,-.14),.115,.23,'ochre',14,.015,bellbody,radius2=.08)
cylinder('bronze flared bell',(0,0,-.285),.213,.15,'ochre',14,.014,bellbody,radius2=.115)
torus('bell heavy rim',(0,0,-.365),.202,.03,'roof_light',parent=bellbody)
ball('bell clapper',(0,0,-.395),(.043,.043,.061),'wood_dark',2,bellbody)
flower_pot(-.60,-.18,0,.20,'pink')
flower_pot(.55,.17,0,.16,'light')
cube('tower doorstep',(0,-.66,.09),(.76,.29,.18),'stone',.035)
cube('tower welcome mat',(0,-.71,.193),(.45,.22,.012),'sage',.008)

# ---- Hearth: communal cooking, no alpha sprites or screen-space effects. --------
root('hearth')
cylinder('hearth circular paving',(0,0,.045),.61,.09,'stone_dark',16,.02)
for i in range(11):
    a=i*math.tau/11
    obj=cube('individual hearth stone',(math.cos(a)*.39,math.sin(a)*.39,.14),(.22,.19,.18),'stone_light' if i%3 else 'stone',.035,rot=(0,0,a))
for i in range(3): log(-.18+i*.15,0,.17,.49,.055,.20+i*.82)
for i,(x,y,h) in enumerate([(-.13,.03,.23),(.06,.02,.34),(.17,-.08,.19)]):
    flame=ball('sculpted amber flame',(x,y,.25+h*.25),(.083,.073,h*.60),'flame',1)
    flame.data.materials.clear(); flame.data.materials.append(glow)
for s in [-1,1]: beam('cooking tripod leg',(s*.49,.19,.09),(0,.12,.93),.032,'wood_dark')
beam('cooking tripod third leg',(0,-.46,.09),(0,.12,.93),.032,'wood_dark')
beam('kettle hook',(0,.12,.87),(0,.12,.63),.012,'metal',6)
cylinder('copper cooking pot',(0,.11,.47),.195,.23,'roof_dark',14,.022,radius2=.22)
torus('copper pot rim',(0,.11,.59),.21,.025,'roof_light')
torus('pot handle',(0,.11,.64),.135,.013,'metal',rot=(math.pi/2,0,0))
for x in [-.63,.63]:
    for y in [-.2,.27]: cube('bench foot',(x,y,.12),(.11,.12,.24),'wood_dark',.016)
    cube('split log hearth bench',(x,.025,.25),(.26,.80,.11),'wood_light',.036)

# ---- Villager: pivoted miniature with expressive readable features. -------------
root('villager')
cube('soft coral tunic',(0,0,.40),(.235,.155,.27),'red',.050)
ball('shirt shoulders',(0,0,.48),(.135,.087,.081),'red',2)
cube('linen apron',(0,-.089,.365),(.16,.027,.19),'light',.022)
cube('apron embroidered stripe',(0,-.106,.303),(.13,.01,.020),'ochre',.005)
cube('apron waist band',(0,-.085,.445),(.23,.027,.028),'cream',.005)
cylinder('neck',(0,0,.553),.047,.086,'skin_light',10,.009)
ball('round sculpted head',(0,-.002,.63),(.111,.093,.116),'skin_light',2)
ball('hair back',(0,.033,.66),(.113,.079,.088),'hair',2)
for x in [-.104,.104]: ball('ear',(x,-.002,.63),(.023,.024,.034),'skin',2)
ball('little nose',(0,-.098,.626),(.028,.030,.026),'skin',2)
for x in [-.041,.041]:
    ball('bright ink eye',(x,-.088,.656),(.012,.009,.015),'ink',2)
    ball('eye glint',(x-.003,-.096,.661),(.003,.003,.004),'light',1)
    cube('brow',(x,-.087,.681),(.027,.012,.008),'hair',.004)
    ball('warm cheek',(x*1.5,-.081,.615),(.023,.009,.014),'pink',2)
cube('gentle smile',(0,-.096,.597),(.031,.009,.006),'roof_dark',.003)
cylinder('straw hat brim',(0,.008,.727),.168,.033,'ochre',16,.012)
cylinder('straw hat crown',(0,.01,.763),.114,.07,'cream',14,.017,radius2=.087)
torus('hat teal ribbon',(0,.01,.743),.111,.014,'teal')
ball('hat crown top',(0,.01,.796),(.087,.074,.024),'cream',2)
for name,x in [('left_arm',-.133),('right_arm',.133)]:
    pivot=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(pivot)
    pivot.parent=ROOT; pivot.location=(x,0,.494); pivot['axis_three']='x'
    sign=-1 if x<0 else 1
    beam('tunic sleeve',(0,0,0),(sign*.035,-.006,-.081),.047,'red',10,pivot)
    beam('bare forearm',(sign*.034,-.006,-.075),(sign*.046,-.025,-.161),.030,'skin_light',10,pivot)
    ball('hand',(sign*.046,-.028,-.175),(.036,.034,.044),'skin_light',2,pivot)
for name,x in [('left_leg',-.062),('right_leg',.062)]:
    pivot=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(pivot)
    pivot.parent=ROOT; pivot.location=(x,0,.285); pivot['axis_three']='x'
    cube('navy trouser leg',(0,0,-.084),(.082,.106,.19),'teal',.025,pivot)
    cube('soft leather boot',(0,-.024,-.235),(.10,.157,.093),'wood_dark',.026,pivot)
    cube('boot sole',(0,-.025,-.273),(.104,.16,.023),'wood',.009,pivot)

# ---- River boat: curved clinker hull, benches, oars and bow lamp. ----------------
root('boat')
sections=[(-1.00,.02,.22),(-.78,.245,.05),(-.40,.36,.0),(.32,.36,.0),(.76,.24,.06),(1.00,.025,.24)]
verts=[]
for y,w,b in sections:
    verts += [(-w*.72,y,b+.075),(-w,y,b+.26),(w,y,b+.26),(w*.72,y,b+.075)]
faces=[]
for i in range(len(sections)-1):
    for j in range(3): faces.append((i*4+j,(i+1)*4+j,(i+1)*4+j+1,i*4+j+1))
mesh('curved wooden boat hull',verts,faces,'wood',bevel=.012)
for side in [-1,1]:
    for i in range(len(sections)-1):
        ya,wa,ba=sections[i]; yb,wb,bb=sections[i+1]
        beam('rounded teal gunwale',(side*wa,ya,ba+.27),(side*wb,yb,bb+.27),.035,'teal_light')
        beam('clinker plank seam',(side*wa*.87,ya,ba+.16),(side*wb*.87,yb,bb+.16),.012,'wood_light',6)
cube('boat inner floor',(0,-.02,.088),(.48,1.22,.055),'wood_dark',.014)
for y in [-.52,.02,.51]: cube('cross boat bench',(0,y,.27),(.61,.15,.058),'wood_light',.015)
for x in [-.11,0,.11]: cube('floor plank',(x,-.01,.123),(.092,1.25,.026),'wood_light',.007)
beam('oar handle',(-.52,-.61,.32),(.43,.68,.35),.019,'cream')
cube('shaped oar blade',(.46,.72,.35),(.13,.39,.036),'cream',.027,rot=(0,0,-.64))
torus('bow rope coil',(0,-.71,.33),.082,.013,'cream')
cube('bow cargo box',(0,.47,.37),(.29,.26,.20),'roof',.016)
cube('cargo lid',(0,.47,.483),(.31,.28,.04),'roof_light',.012)

# ---- Environmental trees: asymmetric, branch-led silhouettes for instancing. ----
root('broadleaf')
tapered_bough('bent broadleaf trunk',[(0,0,0),(-.025,.01,.18),(.045,.012,.72),(.105,.018,1.24),(.06,.04,1.80)],[.16,.115,.09,.073,.025],'wood',9)
for i,a in enumerate([.25,2.1,3.7,5.15]):
    tapered_bough('visible buttress root',[(math.cos(a)*.30,math.sin(a)*.29,0),(math.cos(a)*.16,math.sin(a)*.13,.08),(0,0,.27)],[.022,.048,.065],'wood',6)
for points,radii in [
    ([(.07,.01,.86),(-.18,-.08,1.26),(-.49,-.05,1.85)],[.070,.046,.016]),
    ([(.08,.02,1.11),(.37,-.06,1.57),(.63,-.08,1.97)],[.064,.037,.011]),
    ([(.08,.025,1.37),(.02,.25,1.82),(-.12,.36,2.25)],[.055,.032,.011]),
    ([(.09,.02,1.32),(-.09,-.25,1.68),(-.25,-.34,1.98)],[.045,.026,.009]),
]: tapered_bough('branching broadleaf limb',points,radii,'wood',7)
for i,(center,scale,tint) in enumerate([
    ((-.43,-.02,1.88),(.58,.44,.69),'leaf'),
    ((.40,-.10,1.99),(.52,.48,.72),'leaf_light'),
    ((.10,.31,2.23),(.54,.43,.70),'leaf'),
    ((-.12,-.25,2.22),(.51,.42,.72),'leaf_light'),
    ((-.13,.02,2.56),(.43,.39,.64),'sage'),
    ((-.24,-.34,1.64),(.48,.30,.42),'leaf'),
]): sculpted_canopy('sculpted broadleaf crown',center,scale,tint,803+i)

root('cypress')
tapered_bough('cypress rising trunk',[(0,0,0),(.01,.02,.43),(-.035,.015,1.02),(.03,-.025,1.87),(-.025,.01,2.63)],[.12,.075,.058,.032,.009],'wood',8)
for i,a in enumerate([0,2.1,4.2]):
    tapered_bough('cypress surface root',[(math.cos(a)*.22,math.sin(a)*.20,0),(math.cos(a)*.11,math.sin(a)*.10,.065),(0,0,.20)],[.018,.033,.053],'wood',6)
# A continuous wind-shaped spire. The profile has subtle leaf shelves, but never
# pinches into a stack of disconnected baubles.
cypress_profile=[(.57,.025),(.72,.27),(.93,.43),(1.13,.37),(1.31,.40),(1.53,.32),(1.74,.34),(1.96,.25),(2.17,.25),(2.39,.18),(2.62,.13),(2.84,.067),(3.075,.005)]
verts=[]
rng=random.Random(1901)
for ring,(z,radius) in enumerate(cypress_profile):
    cx=.066*math.sin(z*2.4)-.015*z
    cy=.025*math.sin(z*3.1)
    for j in range(10):
        angle=j*math.tau/10+.06*(ring%2)
        r=radius*(1+rng.uniform(-.10,.10))
        verts.append((cx+math.cos(angle)*r,cy+math.sin(angle)*r*.88,z+rng.uniform(-.025,.025)))
faces=[tuple(range(9,-1,-1))]
for ring in range(len(cypress_profile)-1):
    for j in range(10):
        a=ring*10+j; b=ring*10+(j+1)%10; c=(ring+1)*10+(j+1)%10; d=(ring+1)*10+j
        faces.extend([(a,b,c),(a,c,d)])
faces.append(tuple(range((len(cypress_profile)-1)*10,len(cypress_profile)*10)))
spire=mesh('continuous sculpted cypress spire',verts,faces,'leaf')
for polygon in spire.data.polygons:
    tint='leaf_dark' if polygon.normal.z<-.25 else ('leaf_light' if polygon.normal.z>.2 and rng.random()<.55 else 'leaf')
    for loop_index in polygon.loop_indices: spire.data.color_attributes['Color'].data[loop_index].color=rgba(tint)
for i,a in enumerate([.4,2.5,4.7]):
    tapered_bough('cypress upward branch',[(0,0,.48),(math.cos(a)*.20,math.sin(a)*.17,.75),(math.cos(a)*.23,math.sin(a)*.21,.99)],[.025,.017,.005],'wood',6)

# Join the static clay pieces per root/pivot: one material primitive per assembly.
for asset in roots:
    parents=[asset]+[o for o in asset.children_recursive if o.type=='EMPTY']
    for parent in parents:
        meshes=[o for o in parent.children if o.type=='MESH']
        if not meshes: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes: o.select_set(True)
        bpy.context.view_layer.objects.active=meshes[0]
        bpy.ops.object.join()
        joined=bpy.context.object
        joined.name=parent.name+'_mesh'
        # Weld only exact coincident points. Preserve hard silhouettes and painted seams.
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

def descendants(obj): return [obj]+list(obj.children_recursive)

# Foundation contact is exact: flatten the tiny underground rock bases and
# lower the curved boat's keel to its local zero. Animation pivots stay intact.
for asset in roots:
    bpy.context.view_layer.update()
    meshes=[o for o in descendants(asset) if o.type=='MESH']
    for obj in meshes:
        world=obj.matrix_world.copy(); inv=world.inverted()
        for vertex in obj.data.vertices:
            p=world@vertex.co
            if p.z<0:
                p.z=0
                vertex.co=inv@p
    bottom=min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
    if bottom>.015:
        for child in asset.children: child.location.z-=bottom

metadata={
  'title':'Wildhaven original village kit',
  'authoring':'Original geometry generated in Blender; editable generator and .blend included.',
  'license':'Original project art. No third-party model, texture, or font sources.',
  'blender_version':bpy.app.version_string,
  'generator':'../tools/create_assets.py',
  'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
  'units':'meters; 1.8 meter game tiles',
  'coordinates':'GLB uses Y up and +Z front; Blender source uses Z up and -Y front.',
  'motion':{'rotor':'local Z rotation in Three.js','bell_body':'local X rocking in Three.js','left_arm':'local X rotation','right_arm':'local X rotation','left_leg':'local X rotation','right_leg':'local X rotation'},
  'assets':{}
}
for asset in roots:
    bpy.context.view_layer.update()
    meshes=[o for o in descendants(asset) if o.type=='MESH']
    # A joined mesh may retain a rotated local frame. Transform actual vertices,
    # not its oriented box corners, so collision/placement metadata is exact.
    pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    mins=[min(p[i] for p in pts) for i in range(3)]
    maxs=[max(p[i] for p in pts) for i in range(3)]
    metadata['assets'][asset.name]={
      'size_three':[round(maxs[0]-mins[0],3),round(maxs[2]-mins[2],3),round(maxs[1]-mins[1],3)],
      'mesh_nodes':len(meshes),
      'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
      'bottom':round(mins[2],4),
      'bounds_three':{'min':[round(mins[0],4),round(mins[2],4),round(-maxs[1],4)],'max':[round(maxs[0],4),round(maxs[2],4),round(-mins[1],4)]},
    }

bpy.ops.object.select_all(action='DESELECT')
for asset in roots:
    for obj in descendants(asset): obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'village-kit.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)

# An arranged, editable source scene and softly lit contact sheet.
positions={
    'cottage':(-4.4,-1.55,0),'lumber':(-2.2,-1.55,0),'quarry':(0,-1.55,0),'orchard':(2.2,-1.55,0),'garden':(4.4,-1.55,0),
    'windmill':(-4.4,1.15,0),'bell':(-2.2,1.15,0),'hearth':(0,1.15,0),'villager':(2.2,1.15,0),'boat':(4.4,1.15,0),
    'broadleaf':(-1.25,4.00,0),'cypress':(1.25,4.00,0),
}
ROOT=None
for asset in roots: asset.location=positions[asset.name]
for asset in roots:
    x,y,z=asset.location
    # Gallery plinths are excluded from the exported asset kit.
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1.05,depth=.09,location=(x,y,-.07))
    p=finish(bpy.context.object,'gallery plinth','light',None,.035)
    p.parent=None
    p['gallery_only']=True
    font=bpy.data.curves.new('label','FONT'); font.body=asset.name.upper(); font.align_x='CENTER'; font.size=.115; font.extrude=.001
    label=bpy.data.objects.new('label_'+asset.name,font); bpy.context.collection.objects.link(label)
    label.location=(x,y-1.03,-.012); label.rotation_euler=(0,0,0)
    label.data.materials.append(paint)

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.13))
floor=bpy.context.object
floor.name='Gallery backdrop'
mat=bpy.data.materials.new('Gallery sage paper'); mat.diffuse_color=rgba('#bbc3a5'); mat.use_nodes=True
mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=rgba('#bbc3a5')
mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.9
floor.data.materials.append(mat)
world=bpy.context.scene.world or bpy.data.worlds.new('World')
bpy.context.scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.79,.88,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.45
for name,pos,energy,size in [('Big softbox',(-4,-6,11),1700,7),('Cream bounce',(6,1,8),900,6)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    ob=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(ob); ob.location=pos
    ob.rotation_euler=(Vector((0,0,.6))-ob.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Asset gallery camera')
camera=bpy.data.objects.new('Asset gallery camera',camera_data); bpy.context.collection.objects.link(camera)
camera.location=(7,-15,13)
camera.rotation_euler=(Vector((0,.70,.7))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'; camera_data.ortho_scale=13.8
scene=bpy.context.scene; scene.camera=camera
scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1800; scene.render.resolution_y=1150; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'village-kit-contact.png')
metadata['total_triangles']=sum(a['triangles'] for a in metadata['assets'].values())
metadata['glb_bytes']=(OUT/'village-kit.glb').stat().st_size
(OUT/'village-kit.json').write_text(json.dumps(metadata,indent=2)+'\n')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'village-kit.blend'))
if RENDER: bpy.ops.render.render(write_still=True)

# Inspect the character where face, silhouette, and the actual moving pivots are
# readable. This review scene is deliberately not saved over the editable kit.
for obj in list(bpy.context.scene.objects):
    if obj.type not in {'LIGHT','CAMERA'} and obj != floor:
        obj.hide_render=True
floor.location.z=-.004

def copy_tree(source, parent=None):
    obj=source.copy()
    bpy.context.collection.objects.link(obj)
    obj.parent=parent
    obj.hide_render=False
    for child in source.children: copy_tree(child,obj)
    return obj

villager=next(a for a in roots if a.name=='villager')
poses=[('FRONT',0,0),('SIDE',-math.pi/2,0),('BACK',math.pi,0),('THREE QUARTER',-.60,0),('STRIDE A',0,.52),('STRIDE B',0,-.52)]
for i,(label,angle,stride) in enumerate(poses):
    duplicate=copy_tree(villager)
    x=(i%3-1)*1.15; y=(i//3)*1.55
    duplicate.location=(x,y,.025 if stride else 0)
    duplicate.rotation_euler.z=angle
    for part in duplicate.children:
        if part.name.startswith('left_arm'): part.rotation_euler.x=-stride*.8
        if part.name.startswith('right_arm'): part.rotation_euler.x=stride*.8
        if part.name.startswith('left_leg'): part.rotation_euler.x=stride
        if part.name.startswith('right_leg'): part.rotation_euler.x=-stride
    font=bpy.data.curves.new('pose label','FONT'); font.body=label; font.align_x='CENTER'; font.size=.085; font.extrude=.001
    title=bpy.data.objects.new(label,font); bpy.context.collection.objects.link(title)
    title.location=(x,y-.42,.001)
    title.data.materials.append(paint)
camera.location=(2.8,-7,6)
camera.rotation_euler=(Vector((0,.65,.32))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.ortho_scale=4.5
scene.render.resolution_x=1400; scene.render.resolution_y=1100
scene.render.filepath=str(OUT/'villager-pose-review.png')
if RENDER: bpy.ops.render.render(write_still=True)

# Foliage silhouettes receive their own close review at useful environmental scale.
for obj in list(bpy.context.scene.objects):
    if obj.type not in {'LIGHT','CAMERA'} and obj != floor:
        obj.hide_render=True
for i,name in enumerate(['broadleaf','cypress']):
    source=next(a for a in roots if a.name==name)
    duplicate=copy_tree(source)
    duplicate.location=(-1.12+i*2.24,0,0)
    font=bpy.data.curves.new('tree label','FONT'); font.body=name.upper(); font.align_x='CENTER'; font.size=.11; font.extrude=.001
    title=bpy.data.objects.new(name+' review label',font); bpy.context.collection.objects.link(title)
    title.location=(-1.12+i*2.24,-.79,.001); title.data.materials.append(paint)
camera.location=(4.0,-8.5,5.0)
camera.rotation_euler=(Vector((0,0,1.30))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.ortho_scale=5.5
scene.render.resolution_x=1400; scene.render.resolution_y=1100
scene.render.filepath=str(OUT/'nature-review.png')
if RENDER: bpy.ops.render.render(write_still=True)
backup=OUT/'village-kit.blend1'
if backup.exists(): backup.unlink()
print('WILDHAVEN_ASSETS_READY '+json.dumps(metadata))
