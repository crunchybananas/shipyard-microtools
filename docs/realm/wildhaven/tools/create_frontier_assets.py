"""Wildhaven's original frontier kit: fortifications, neighbors and articulated fighters.

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
random.seed(630217)
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

# Frontier silhouettes keep the village's rounded masonry and painted timber.
PALETTE.update({'steel':'#81979c','steel_light':'#b4c7c7','navy':'#35566e','wine':'#914851','wine_dark':'#633745','moss':'#58714c'})

def pivot(name, position=(0,0,0), parent=None):
    obj=bpy.data.objects.new(ROOT.name+'_'+name,None);bpy.context.collection.objects.link(obj)
    obj.parent=parent or ROOT;obj.location=position;return obj

def masonry_wall(length=1.8,angle=0,offset=(0,0),endcaps=True):
    old=ROOT;group=pivot('wall_course',(offset[0],offset[1],0));group.rotation_euler.z=angle
    for course in range(4):
        pieces=5 if course%2 else 4
        for i in range(pieces):
            width=length/pieces
            cube('rounded limestone ashlar',(-length/2+(i+.5)*width,0,.12+course*.205),(width-.014,.35+.014*(i%2),.195),['cream','stone_light','light'][(course+i)%3],.022,group)
    cube('wall continuous coping',(0,0,.872),(length+.035,.41,.105),'light',.022,group)
    for i in range(max(2,round(length/.42))):
        count=max(2,round(length/.42));x=-length/2+(i+.5)*length/count
        cube('sheltered battlement',(x,0,1.04),(.245,.39,.265),'cream',.018,group)
        cube('battlement cap',(x,0,1.182),(.27,.415,.035),'light',.012,group)
    for side in [-1,1]:
        cube('wall stone footing',(0,side*.18,.075),(length+.045,.15,.15),'stone',.016,group)

root('wall')
masonry_wall()
root('wall_corner')
masonry_wall(.93,offset=(.435,0));masonry_wall(.93,math.pi/2,(0,.435))
cube('corner stone pier',(0,0,.57),(.44,.44,1.14),'cream',.024)
cube('corner pier cap',(0,0,1.17),(.49,.49,.08),'light',.02)
root('wall_end')
masonry_wall(.93,offset=(.435,0))
cube('wall end pier',(-.015,0,.60),(.43,.46,1.20),'cream',.025)
cube('end pier cap',(-.015,0,1.23),(.49,.50,.075),'light',.02)
root('gate')
for x in [-.735,.735]:
    for course in range(6):cube('gate pier block',(x,0,.125+course*.205),(.40,.57,.196),'cream' if course%2 else 'stone_light',.022)
    cube('gate pier weather cap',(x,0,1.38),(.46,.66,.12),'light',.025)
beam('gate carved lintel',(-.87,0,1.30),(.87,0,1.30),.065,'wood_dark')
for side in [-1,1]:
    leaf=pivot('gate_left' if side<0 else 'gate_right',(side*.535,0,.04))
    for j in range(4):cube('gate oak plank',(-side*(j+.5)*.134,0,.51),(.126,.075,1.02),'wood',.009,leaf)
    for z in [.23,.79]:cube('gate forged brace',(-side*.267,-.045,z),(.535,.027,.04),'metal',.007,leaf)
    beam('gate timber diagonal',(-side*.02,-.025,.10),(-side*.51,-.025,.95),.023,'wood_light',6,leaf)
    ball('gate brass handle',(-side*.44,-.073,.48),(.026,.025,.025),'ochre',1,leaf)
for x in [-.65,.65]:
    beam('gate torch bracket',(x,-.3,.79),(x,-.42,.98),.028,'wood_dark')
    cylinder('gate lantern',(x,-.43,1.02),.065,.12,'ochre',8,.01)
root('tower')
for course in range(7):
    for x,y,w,d in [(0,-.42,.95,.19),(0,.42,.95,.19),(-.42,0,.19,.65),(.42,0,.19,.65)]:
        cube('watchtower coursed stone',(x,y,.12+course*.18),(w,d,.173),'cream' if course%2 else 'stone_light',.018)
arch('tower arched door',0,-.529,.09,.28,.66,.035,'wood_dark')
cube('watch deck',(0,0,1.39),(1.16,1.15,.13),'wood',.02)
for x in [-.48,.48]:
    for y in [-.47,.47]:beam('tower corner post',(x,y,1.43),(x,y,2.19),.045,'wood',8)
for y in [-.51,.51]:cube('watch platform rail',(0,y,1.69),(1.12,.067,.095),'wood_light',.015)
for x in [-.52,.52]:cube('watch side rail',(x,0,1.69),(.067,1.10,.095),'wood_light',.015)
roof(eave=2.14,rise=.29,width=1.41,depth=1.38,tint='teal')
banner(.66,.18,2.12,.25,.62,'teal')
root('outpost')
cube('scout cairn base',(-.41,.27,.11),(.47,.43,.22),'stone',.04)
for i in range(3):cube('cairn marker stone',(-.42+.015*i,.27,.29+i*.12),(.33-i*.07,.29-i*.05,.17),'stone_light',.028)
beam('outpost flag mast',(-.40,.25,.30),(-.40,.25,2.04),.035,'wood',8)
mesh('outpost broad swallowtail',[(-.40,.24,1.96),(.40,.28,1.89),(.23,.24,1.66),(.41,.29,1.46),(-.40,.24,1.50)],[(0,1,2,3,4)],'teal')
for x in [-.38,.38]:beam('lean-to tripod',(x,-.39,.02),(0,-.25,1.0),.035,'wood',8)
mesh('scout canvas shelter',[(-.61,-.58,.11),(.57,-.58,.11),(0,-.27,1.01),(-.61,.50,.11),(.57,.50,.11),(0,.47,1.01)],[(0,2,5,3),(2,1,4,5)],'light')
for x in [-.61,.57]:beam('tent edge rope',(x,-.58,.1),(x*1.18,-.76,.025),.009,'wood_light',6)
crate(.56,.31,.02,.24);barrel(-.60,.0,.01,.10,.22)
root('wall_rubble')
for i in range(13):
    x=random.uniform(-.72,.72);y=random.uniform(-.30,.30)
    cube('fallen rounded masonry',(x,y,.09+random.random()*.15),(random.uniform(.16,.34),random.uniform(.17,.29),random.uniform(.13,.27)),['cream','stone','stone_light'][i%3],.025,rot=(random.uniform(-.3,.3),random.uniform(-.4,.4),random.random()*3))

def fighter(name,role,enemy=False):
    asset=root(name);tunic='wine' if enemy else ('moss' if role=='archer' else 'navy')
    cube('fighter cloth tunic',(0,0,.43),(.27,.19,.31),tunic,.040)
    ball('fighter broad shoulders',(0,0,.54),(.16,.104,.085),tunic,1)
    cube('leather marching belt',(0,-.006,.349),(.285,.208,.045),'wood_dark',.014)
    cube('belt buckle',(0,-.118,.35),(.047,.022,.043),'ochre',.006)
    cube('split cloth tabard',(0,-.106,.375),(.172,.03,.24),'wine_dark' if enemy else 'cream',.014)
    cylinder('fighter neck',(0,0,.62),.047,.085,'skin_light',10,.006)
    ball('fighter head',(0,-.003,.710),(.112,.096,.113),'skin_light',2)
    for x in [-.105,.105]:ball('fighter ear',(x,-.003,.709),(.022,.024,.031),'skin',1)
    ball('fighter nose',(0,-.103,.71),(.025,.029,.023),'skin',1)
    for x in [-.040,.040]:
        ball('fighter dark eye',(x,-.095,.738),(.013,.008,.013),'ink',1)
        cube('fighter brow',(x,-.095,.759),(.033,.010,.008),'hair',.004,rot=(0,0,-x*3))
    cube('fighter mouth',(0,-.101,.673),(.030,.009,.006),'wood_dark',.003)
    if role=='archer':
        ball('deep cloth hood',(0,.02,.764),(.135,.12,.15),tunic,1)
        cube('hood face opening',(0,-.086,.715),(.186,.035,.156),'skin_light',.04)
        for x in [-.040,.040]:ball('archer eye',(x,-.112,.74),(.014,.009,.012),'ink',1)
        mesh('arched hood peak',[(-.132,-.115,.774),(.132,-.115,.774),(0,-.13,.909),(-.12,.09,.79),(.12,.09,.79),(0,.05,.93)],[(0,1,2),(0,2,5,3),(2,1,4,5),(3,5,4)],tunic)
        cylinder('quiver leather case',(.11,.135,.56),.061,.30,'wood_dark',9,.008)
        for i in range(3):
            x=.075+i*.036;beam('quiver arrow shaft',(x,.134,.57),(x,.134,.89),.007,'wood_light',5)
            mesh('quiver feather',[(x-.022,.134,.81),(x,.134,.90),(x+.018,.134,.84)],[(0,1,2)],'light')
    else:
        ball('forged rounded helmet',(0,.012,.790),(.137,.116,.115),'metal' if enemy else 'steel',1)
        cube('helmet brow band',(0,-.090,.794),(.27,.07,.045),'steel_light',.012)
        for x in [-.114,.114]:cube('helmet cheek guard',(x,-.012,.727),(.045,.09,.119),'metal' if enemy else 'steel',.012,rot=(0,(-1 if x<0 else 1)*.08,0))
        cube('helmet raised seam',(0,.008,.883),(.027,.17,.036),'steel_light',.007)
        if not enemy:mesh('short honey helmet crest',[(-.023,.052,.874),(.023,.052,.874),(.023,.11,1.002),(-.023,.11,1.002)],[(0,1,2,3)],'ochre')
    for limb,x in [('left_arm',-.153),('right_arm',.153)]:
        arm=pivot(limb,(x,0,.565));sign=-1 if x<0 else 1
        beam('padded sleeve',(0,0,0),(sign*.021,-.006,-.081),.052,tunic,9,arm)
        beam('forearm bracer',(sign*.022,-.006,-.081),(sign*.031,-.027,-.184),.035,'wood_dark',8,arm)
        ball('fighter hand',(sign*.032,-.031,-.199),(.038,.036,.044),'skin_light',1,arm)
        if role=='archer' and limb=='left_arm':
            points=[(-.02,-.035,-.48),(-.02,-.11,-.39),(-.02,-.145,-.20),(-.02,-.11,-.01),(-.02,-.035,.08)]
            for a,b in zip(points,points[1:]):beam('recurved ash bow',a,b,.018,'wood_light',7,arm)
            beam('drawn bowstring',points[0],points[-1],.006,'light',5,arm)
        elif limb=='left_arm':
            if enemy:
                shield=cylinder('raider round buckler',(-.073,-.049,-.12),.16,.045,'wine_dark',12,.010,arm);shield.rotation_euler.x=math.pi/2
                ball('buckler bronze boss',(-.073,-.081,-.12),(.055,.033,.055),'ochre',1,arm)
            else:
                mesh('kite shield outline',[(-.18,-.062,-.01),(.02,-.062,-.01),(.05,-.065,-.19),(-.08,-.069,-.33),(-.21,-.065,-.19)],[(0,1,2,3,4)],'light',arm,bevel=.008)
                mesh('painted teal shield',[(-.16,-.075,-.035),(0,-.075,-.035),(.023,-.076,-.18),(-.08,-.08,-.291),(-.185,-.076,-.18)],[(0,1,2,3,4)],'teal',arm)
                cube('shield brass cross',(-.08,-.091,-.115),(.017,.013,.19),'ochre',.004,arm)
        elif role!='archer':
            beam('weapon ash haft',(.033,-.035,-.53),(.033,-.035,.29),.015,'wood_light',8,arm)
            if enemy:
                mesh('raider broad axe',[(-.03,-.057,.19),(.20,-.054,.15),(.24,-.054,.31),(.00,-.057,.32)],[(0,1,2,3)],'steel',arm,bevel=.006)
            else:
                mesh('leaf steel spearhead',[(.033,-.05,.49),(-.009,-.05,.34),(.033,-.069,.285),(.075,-.05,.34)],[(0,1,2),(0,2,3)],'steel_light',arm)
                torus('spear binding',(.033,-.035,.29),.023,.008,'teal',parent=arm)
    for limb,x in [('left_leg',-.071),('right_leg',.071)]:
        leg=pivot(limb,(x,0,.296))
        cube('marching trouser',(0,0,-.10),(.092,.119,.21),'wine_dark' if enemy else 'teal_dark',.025,leg)
        cube('high leather boot',(0,-.031,-.23),(.113,.17,.132),'wood_dark',.025,leg)
        cube('boot sole',(0,-.038,-.286),(.116,.175,.024),'wood',.008,leg)
    return asset

fighter('spearman','spear')
fighter('archer','archer')
fighter('raider','spear',True)
fighter('enemy_archer','archer',True)

def settlement_house(name,pos,scale=.9,angle=0,roof_color='roof'):
    global ROOT
    old=ROOT;group=pivot(name,pos);group.scale=(scale,)*3;group.rotation_euler.z=angle;ROOT=group
    house(h=.88,rise=.44,tint=roof_color);door();window(.33,-.552,.74,.22,.27);chimney(-.36,.25,1.20,.40)
    ROOT=old

root('neighbor_harbor')
settlement_house('harbor guildhouse',(-.70,.47,0),1.02,0,'teal')
settlement_house('salt cottage',(.77,.49,0),.78,-.12,'roof')
for i in range(9):cube('harbor market boardwalk',(-.65+i*.16,-.62,.05),(.15,.50,.10),'wood',.008)
awning(.60,-.61,.96,.94,.57,('light','teal_light'))
crate(.50,-.67,.06,.23,True);barrel(.94,-.40,.01,.12,.29)
beam('harbor banner pole',(-1.20,-.50,0),(-1.20,-.50,2.1),.029,'wood')
mesh('harbor long pennant',[(-1.20,-.51,2.04),(-.72,-.50,1.97),(-.85,-.51,1.78),(-1.20,-.51,1.73)],[(0,1,2,3)],'teal')
# Back-lane cottages make a real four-building harbor hamlet. All pieces stay
# inside the agreed 3x3-cell compound; cardinal approaches remain outside it.
settlement_house('net makers cottage',(-1.43,1.62,0),.73,.07,'teal')
settlement_house('salt store',(1.33,1.65,0),.71,-.10,'roof')
for x in [-2.20,2.20]:
    beam('harbor orchard rail',(x,-1.38,.28),(x,2.13,.28),.024,'wood_light')
    for y in [-1.38,.38,2.13]:beam('harbor rail post',(x,y,0),(x,y,.46),.027,'wood')
for x in [-1.8,-1.35,-.9]:cube('garden raised bed',(x,-1.28,.11),(.35,.40,.22),'wood',.014)
root('neighbor_fort')
settlement_house('hill wardens hall',(0,.36,0),1.08,0,'teal')
for x in [-1.05,1.05]:
    for k in range(5):cube('hillfort squared stone',(x,-.45,.15+k*.24),(.49,.58,.23),'stone_light' if k%2 else 'cream',.022)
    for dx in [-.16,.16]:cube('hillfort crenel',(x+dx,-.45,1.47),(.17,.55,.36),'cream',.018)
for side in [-1,1]:masonry_wall(.71,offset=(side*.63,-.48))
beam('fort banner mast',(.87,.59,1.22),(.87,.59,2.6),.026,'wood')
mesh('hill gold standard',[(.87,.58,2.58),(1.36,.56,2.49),(1.34,.56,2.01),(.87,.58,2.07)],[(0,1,2,3)],'ochre')
settlement_house('fort smith cottage',(-1.35,1.55,0),.76,.04,'roof')
settlement_house('fort watch cottage',(1.30,1.52,0),.72,-.04,'teal')
settlement_house('rear store house',(0,1.95,0),.48,0,'roof')
for x in [-2.18,2.18]:
    for k in range(3):cube('hamlet outer stone wall',(x,.55,.10+k*.15),(.17,3.36,.145),'stone_light' if k%2 else 'cream',.016)
root('neighbor_camp')
for x,y,s in [(-.58,.37,1),(.71,.21,.74)]:
    mesh('camp burgundy canvas',[(x-.63*s,y-.53*s,0),(x+.63*s,y-.53*s,0),(x,y-.53*s,1.17*s),(x-.63*s,y+.44*s,0),(x+.63*s,y+.44*s,0),(x,y+.44*s,1.17*s)],[(0,2,5,3),(2,1,4,5),(3,5,4)],'wine')
    beam('tent ridge pole',(x,y-.60*s,1.16*s),(x,y+.52*s,1.16*s),.025,'wood')
for i in range(7):
    a=i*math.tau/7;ball('camp hearth stone',(.25+math.cos(a)*.22,-.65+math.sin(a)*.22,.075),(.091,.071,.071),'stone',1)
for i in range(3):log(.25,-.65,.075+i*.045,.30,.035,i*1.2)
crate(-.95,-.41,0,.29);barrel(-.78,-.13,0,.10,.25)
beam('raider camp mast',(-1.1,.61,0),(-1.1,.61,2.04),.03,'wood_dark')
mesh('camp tattered red flag',[(-1.1,.61,2.0),(-.43,.63,1.94),(-.64,.61,1.76),(-.44,.65,1.57),(-1.1,.61,1.61)],[(0,1,2,3,4)],'wine')

# Two additional tents and a supply lean-to complete the raider encampment.
for x,y,s in [(-1.28,1.51,.87),(1.27,1.48,.82)]:
    mesh('outer burgundy tent',[(x-.63*s,y-.53*s,0),(x+.63*s,y-.53*s,0),(x,y-.53*s,1.17*s),(x-.63*s,y+.44*s,0),(x+.63*s,y+.44*s,0),(x,y+.44*s,1.17*s)],[(0,2,5,3),(2,1,4,5),(3,5,4)],'wine_dark')
    beam('outer tent ridge',(x,y-.60*s,1.16*s),(x,y+.52*s,1.16*s),.025,'wood')
for x in [-2.20,2.20]:
    for j in range(5):
        y=-.95+j*.69;beam('camp palisade stake',(x,y,0),(x,y,.62+.05*(j%2)),.05,'wood_dark')
    beam('camp rope rail',(x,-.95,.39),(x,1.81,.39),.015,'wood_light')
for x in [-.30,.02,.34]:crate(x,2.14,0,.27)

# Weapon grips are separate rigid pivots at the authored hand. A raised arm
# can keep a bow upright or level a spear, without bending or stretching limbs.
bpy.context.view_layer.update()
for asset in roots:
    if asset.name not in ['spearman','archer','raider','enemy_archer']: continue
    for side in ['left','right']:
        arm=next((o for o in asset.children_recursive if o.name==asset.name+'_'+side+'_arm'),None)
        selected=[o for o in arm.children if o.type=='MESH' and any(o.name.startswith(prefix) for prefix in ['recurved ash bow','drawn bowstring','weapon ash haft','raider broad axe','leaf steel spearhead','spear binding'])]
        if not selected:continue
        grip=bpy.data.objects.new(asset.name+'_'+side+'_weapon',None);bpy.context.collection.objects.link(grip);grip.parent=arm;grip.location=((-1 if side=='left' else 1)*.032,-.031,-.199)
        bpy.context.view_layer.update()
        for obj in selected:
            world=obj.matrix_world.copy();obj.parent=grip;obj.matrix_world=world

# Join by articulated parent: a whole building is one mesh, while gate leaves
# and fighter limbs retain their named pivots for cheap procedural animation.
bpy.context.view_layer.update()
for asset in roots:
    groups={}
    for obj in list(asset.children_recursive):
        if obj.type!='MESH':continue
        parent=obj.parent
        while parent!=asset and not any(parent.name.endswith('_'+part) for part in ['left_arm','right_arm','left_leg','right_leg','left_weapon','right_weapon','gate_left','gate_right']):parent=parent.parent
        world=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=world;groups.setdefault(parent,[]).append(obj)
    for parent,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=bpy.context.object;obj.name=parent.name+'_mesh'
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
metadata={'title':'Wildhaven original frontier kit','authoring':'Original Blender geometry, no external models or textures.','generator':'../tools/create_frontier_assets.py','generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'coordinates':'Three Y-up, +Z forward. One grid tile1.8m; wall alongX; gate passage alongZ.','motion':{'limbs':'named *_left_arm/right_arm/left_leg/right_leg pivots, localX swing','gate_left':'localY opening rotation in Three','gate_right':'opposite localY opening rotation','weapon_grips':'named *_left_weapon/right_weapon at hand; localX independent rigid rotation'},'assets':{}}
for asset in roots:
    points=[obj.matrix_world@v.co for obj in asset.children_recursive if obj.type=='MESH' for v in obj.data.vertices]
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    metadata['assets'][asset.name]={'size_three':[round(hi[0]-lo[0],4),round(hi[2]-lo[2],4),round(hi[1]-lo[1],4)],'bounds_three':{'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]},'triangles':sum(len(p.vertices)-2 for obj in asset.children_recursive if obj.type=='MESH' for p in obj.data.polygons),'mesh_nodes':sum(obj.type=='MESH' for obj in asset.children_recursive)}
for name in ['neighbor_harbor','neighbor_fort','neighbor_camp']:
    bounds=metadata['assets'][name]['bounds_three'];assert max(abs(bounds[end][axis]) for end in ['min','max'] for axis in [0,2])<=2.5, (name,bounds)
bpy.ops.object.select_all(action='DESELECT')
for asset in roots:
    asset.select_set(True)
    for obj in asset.children_recursive:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'frontier-kit.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)
metadata['total_triangles']=sum(v['triangles'] for v in metadata['assets'].values());metadata['glb_bytes']=(OUT/'frontier-kit.glb').stat().st_size
(OUT/'frontier-kit.json').write_text(json.dumps(metadata,indent=2)+'\n')
ROOT=None
for i,asset in enumerate(roots):
    asset.location=((i%4-1.5)*3.25,4.3-(i//4)*3.2,0) if i<11 else ((i-12)*5.25,-6.8,0)
    if asset.name in ['spearman','archer','raider','enemy_archer']:asset.scale=(1.55,)*3
    x,y=asset.location.x,asset.location.y
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=2.52 if i>=11 else 1.34,depth=.07,location=(x,y,-.05));plinth=finish(bpy.context.object,'frontier gallery plinth','light',None,.025);plinth.parent=None
    font=bpy.data.curves.new('frontier label','FONT');font.body=asset.name.replace('_',' ').upper();font.align_x='CENTER';font.size=.12;font.extrude=.001
    label=bpy.data.objects.new('label_'+asset.name,font);bpy.context.collection.objects.link(label);label.location=(x,y-(2.42 if i>=11 else 1.28),-.005);label.data.materials.append(paint)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.10));floor=bpy.context.object
backdrop=bpy.data.materials.new('Frontier gallery sage');backdrop.use_nodes=True;backdrop.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=rgba('#bbc3a5');floor.data.materials.append(backdrop)
scene=bpy.context.scene;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.73,.79,.88,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for name,pos,energy,size in [('Frontier softbox',(-6,-8,15),2400,9),('Frontier bounce',(7,5,9),1100,7)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=size;obj=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector((0,0,.5))-obj.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('Frontier gallery camera');obj=bpy.data.objects.new('Frontier gallery camera',cam);bpy.context.collection.objects.link(obj);obj.location=(6,-21,18);obj.rotation_euler=(Vector((0,-1.55,.4))-obj.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=21.6;scene.camera=obj
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=2400;scene.render.resolution_y=2150;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'frontier-art-contact.png')
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'frontier-kit.blend'))
if RENDER:bpy.ops.render.render(write_still=True)
print('WILDHAVEN_FRONTIER_READY '+json.dumps(metadata))
