"""Author an editable architectural family into staging, never over an edit.

Geometry belongs to a named home and has explicit installation/removal steps.
The saved scene is the asset authority. The normal exporter must not rerun this
bootstrap. All dimensions are in metres; the sprite camera supplies one shared
projection for every home, construction step and housing tier.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--out', default='tmp/house-sprites/houses-213')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
destination = ROOT / args.out
assert 'tmp' in destination.relative_to(ROOT).parts, 'Bootstrap into staging; preserve edited sources'
assert not (destination / 'homes.blend').exists(), 'Choose a new staging directory; preserve existing Blender edits'
destination.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene['realm_architecture'] = 'carpentered-homes-v1'
scene['realm_steps'] = 16
scene['realm_units'] = 'metres'

STEP_NAMES = ['Setting out', 'Footings', 'Stone plinth', 'Floor joists',
              'Uprights', 'Wall frames', 'Lower infill', 'Upper infill',
              'Gables', 'Roof trusses', 'Roof battens', 'Eaves',
              'Roof covering', 'Ridge and chimney', 'Joinery', 'Complete']
PALETTE = {
    'oak': '#65503c', 'oak_end': '#887458', 'new_oak': '#958064',
    'plaster': '#aaa493', 'ochre_plaster': '#a39473', 'rose_plaster': '#b0a18e',
    'stone': '#77776e', 'stone_light': '#929184', 'mortar': '#655f52',
    'thatch': '#8c7950', 'slate': '#59656a', 'tile': '#815841',
    'iron': '#393f3d', 'glass': '#464d44', 'soot': '#262722',
    'clay': '#75543d', 'rope': '#9d9478', 'linen': '#b7b19b',
    'soil': '#615644', 'leaf': '#57664c', 'brick': '#806857',
}
recipes = {}
pigments = {}


def texture_recipe(kind):
    """Packed pigment, micro-normal and roughness; also visible in Blender."""
    if kind in recipes:
        return recipes[kind]
    size = 256
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size
    rng = np.random.default_rng(sum(map(ord, kind)))
    fine = rng.uniform(-1, 1, (size, size))
    broad = (np.sin(x * math.tau * 3 + np.sin(y * math.tau * 2))
             + np.cos(y * math.tau * 5 + np.sin(x * math.tau))) / 2
    if kind in ('oak', 'thatch'):
        grain = np.sin(x * math.tau * 45 + 1.2 * np.sin(y * math.tau * 2))
        h = .5 + grain * .13 + broad * .06 + fine * .045
        pigment = .91 + grain * .055 + broad * .035 + fine * .018
    elif kind == 'plaster':
        h = .5 + broad * .15 + fine * .12
        pigment = .94 + broad * .018 + fine * .012
    else:
        h = .5 + broad * .13 + fine * .09
        pigment = .90 + broad * .07 + fine * .025
    dx, dy = (np.roll(h, 1, axis=1) - np.roll(h, -1, axis=1)), (np.roll(h, 1, axis=0) - np.roll(h, -1, axis=0))
    scale = .65 if kind == 'plaster' else .9
    length = np.sqrt((dx * scale) ** 2 + (dy * scale) ** 2 + 1)
    normal = np.stack([.5 + dx * scale / length / 2,
                       .5 + dy * scale / length / 2, .5 + .5 / length], axis=-1)
    rough = np.clip(.89 + broad * .045 + fine * .02, .65, 1)

    def image(name, rgb, non_color=False):
        result = bpy.data.images.new(f'House {kind} {name}', width=size, height=size, alpha=False)
        if non_color:
            result.colorspace_settings.name = 'Non-Color'
        rgba = np.concatenate([rgb, np.ones((size, size, 1))], axis=-1).astype(np.float32)
        result.pixels.foreach_set(rgba.ravel())
        result.pack()
        return result

    recipes[kind] = (pigment,
                     image('normal', normal, True),
                     image('roughness', np.repeat(rough[:, :, None], 3, axis=2), True))
    return recipes[kind]


materials = {}


def material(kind, tone=0):
    key = (kind, tone)
    if key in materials:
        return materials[key]
    mat = bpy.data.materials.new(f'House {kind} {tone:+d}')
    mat.use_nodes = True
    n, links = mat.node_tree.nodes, mat.node_tree.links
    p = n.get('Principled BSDF')
    raw = [int(PALETTE[kind][i:i+2], 16) / 255 for i in (1, 3, 5)]
    srgb = [max(0, min(1, v * (1 + tone * .022))) for v in raw]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in srgb] + [1]
    mat.diffuse_color = linear
    p.inputs['Base Color'].default_value = linear
    p.inputs['Roughness'].default_value = .27 if kind == 'glass' else .55 if kind == 'iron' else .89
    p.inputs['Metallic'].default_value = .55 if kind == 'iron' else .1 if kind == 'glass' else 0
    family = 'oak' if 'oak' in kind else 'plaster' if 'plaster' in kind else kind
    if family in ('oak', 'plaster', 'stone', 'thatch', 'slate', 'tile', 'brick'):
        pigment, normal, roughness = texture_recipe(family)
        # Tint is packed into an ordinary base-color image. No Blender-only
        # node blend is lost on export, and broad grain remains visible beside
        # the independent normal and roughness signals.
        if key not in pigments:
            pixels = np.empty((256, 256, 4), dtype=np.float32)
            pixels[:, :, :3] = pigment[:, :, None] * np.array(srgb)[None, None, :]
            pixels[:, :, 3] = 1
            image = bpy.data.images.new(f'House {kind} {tone:+d} pigment', width=256, height=256, alpha=False)
            image.pixels.foreach_set(pixels.ravel()); image.pack(); pigments[key] = image
        color = n.new('ShaderNodeTexImage'); color.image = pigments[key]
        bump = n.new('ShaderNodeTexImage'); bump.image = normal
        norm = n.new('ShaderNodeNormalMap'); norm.inputs['Strength'].default_value = .46
        rough = n.new('ShaderNodeTexImage'); rough.image = roughness
        links.new(bump.outputs['Color'], norm.inputs['Color'])
        links.new(norm.outputs['Normal'], p.inputs['Normal'])
        links.new(rough.outputs['Color'], p.inputs['Roughness'])
        links.new(color.outputs['Color'], p.inputs['Base Color'])
    materials[key] = mat
    return mat


current_root = None
current_rng = None
part_counter = 0


def mesh(name, vertices, faces, kind='oak', step=5, end=16, bevel=0, tone=None, **extras):
    global part_counter
    part_counter += 1
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces); data.update()
    uv = data.uv_layers.new(name='Surface')
    offset = (current_rng.random() * 6, current_rng.random() * 6)
    for face in data.polygons:
        normal = face.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        for loop in face.loop_indices:
            v = data.vertices[data.loops[loop].vertex_index].co
            uv.data[loop].uv = ((v.y if axis == 0 else v.x) * 1.6 + offset[0],
                               (v.y if axis == 2 else v.z) * .7 + offset[1])
    obj = bpy.data.objects.new(f'{current_root.name} / {name} / {part_counter}', data)
    scene.collection.objects.link(obj)
    obj.parent = current_root
    obj['realm_start'] = int(step); obj['realm_end'] = int(end)
    obj['realm_part'] = name
    for key, value in extras.items():
        obj[key] = value
    data.materials.append(material(kind, current_rng.randrange(-3, 4) if tone is None else tone))
    if bevel:
        mod = obj.modifiers.new('Worn edges', 'BEVEL')
        mod.width = bevel; mod.segments = 2
        normal = obj.modifiers.new('Face-weighted normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
    return obj


FACES = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
         (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]


def box(name, center, size, kind='oak', step=5, end=16, bevel=.012, **extras):
    x, y, z = [v / 2 for v in size]
    verts = [(-x,-y,-z), (x,-y,-z), (x,y,-z), (-x,y,-z),
             (-x,-y,z), (x,-y,z), (x,y,z), (-x,y,z)]
    obj = mesh(name, verts, FACES, kind, step, end, bevel, **extras)
    obj.location = center
    return obj


def beam(name, a, b, width=.10, depth=None, kind='oak', step=5, end=16, **extras):
    a, b = Vector(a), Vector(b)
    obj = box(name, (a+b)/2, (width, depth or width, (b-a).length), kind, step, end,
              bevel=min(.012, width*.12), **extras)
    obj.rotation_mode = 'QUATERNION'
    direction=(b-a).normalized()
    across=Vector((0,0,1)).cross(direction)
    if across.length<.00001:
        across=Vector((1,0,0))
    across.normalize()
    normal=direction.cross(across).normalized()
    obj.rotation_quaternion=Matrix((across,normal,direction)).transposed().to_quaternion()
    return obj


def cylinder(name, center, radius, depth, kind='iron', step=14, vertices=12, end=16):
    v = [(radius*math.cos(i*math.tau/vertices), radius*math.sin(i*math.tau/vertices), z)
         for z in [-depth/2, depth/2] for i in range(vertices)]
    f = [tuple(range(vertices-1, -1, -1)), tuple(range(vertices, vertices*2))]
    f += [(i, (i+1)%vertices, (i+1)%vertices+vertices, i+vertices) for i in range(vertices)]
    obj = mesh(name, v, f, kind, step, end, bevel=.008)
    obj.location = center
    return obj


def wall(axis, coordinate, lo, hi, z0, z1, openings, finish):
    # Panel boundaries follow actual apertures, leaving holes through the wall.
    cuts = sorted(set([lo, hi] + [v for hole in openings for v in hole[:2] if lo < v < hi]))
    levels = sorted(set([z0, z1, (z0+z1)/2] + [v for hole in openings for v in hole[2:] if z0 < v < z1]))
    for a,b in zip(cuts,cuts[1:]):
        for bottom,top in zip(levels,levels[1:]):
            u, z = (a+b)/2, (bottom+top)/2
            if any(x0 < u < x1 and y0 < z < y1 for x0,x1,y0,y1 in openings):
                continue
            center = (coordinate,u,z) if axis == 0 else (u,coordinate,z)
            size = (.10,b-a,top-bottom) if axis == 0 else (b-a,.10,top-bottom)
            box('Lime infill', center, size, finish, 6 if z < (z0+z1)/2 else 7, bevel=0, tone=0)


def window(axis, coordinate, center, z, width=.60, height=.76, shutters=False):
    pos = lambda u,h: (coordinate,u,h) if axis == 0 else (u,coordinate,h)
    dim = (.035,width,height) if axis == 0 else (width,.035,height)
    glass_position=list(pos(center,z))
    glass_position[axis]-=math.copysign(.038,coordinate)
    box('Window glass', glass_position, dim, 'glass', 14, bevel=.001, realm_light=True)
    for sign in [-1,1]:
        beam('Window jamb', pos(center+sign*width/2,z-height/2),
             pos(center+sign*width/2,z+height/2), .062, step=8)
        beam('Window rail', pos(center-width/2,z+sign*height/2),
             pos(center+width/2,z+sign*height/2), .063, step=8)
    beam('Window mullion', pos(center,z-height/2),pos(center,z+height/2),.027,step=14)
    beam('Window transom',pos(center-width/2,z+.05),pos(center+width/2,z+.05),.026,step=14)
    if shutters:
        for sign in [-1,1]:
            # Open shutters have their own thickness, boards and iron straps.
            u = center + sign*(width/2+.17)
            for board in range(3):
                p = pos(u + (board-1)*.095, z)
                box('Open shutter board',p,(.045,.092,height*.94) if axis == 0 else (.092,.045,height*.94),
                    'oak_end',14,bevel=.009)
            for h in [-.22,.22]:
                beam('Shutter strap',pos(u-.13,z+h),pos(u+.13,z+h),.024,kind='iron',step=14)


def house(variant, tier):
    global current_root, current_rng
    current_rng = random.Random(21300 + tier * 97 + variant * 389)
    current_root = bpy.data.objects.new(f'Home {variant+1} — tier {tier}', None)
    scene.collection.objects.link(current_root)
    current_root['realm_home'] = variant
    current_root['realm_tier'] = tier
    current_root['realm_profile'] = 'carpentered-homes-v1'
    a, b = 1.40 + (tier-1)*.07 + [0, -.035, .10][variant], 1.22 + (tier-1)*.045 + [0, .12, -.02][variant]
    sill = .30
    floors = 1 if tier < 3 else 2
    storey = 2.12 if tier == 1 else 2.30
    eave = sill + floors * storey
    ridge = eave + [1.32, 1.50, 1.23][variant] + (tier-1)*.06
    finish = ['plaster','ochre_plaster','rose_plaster'][variant]
    roof_kind = ['thatch','slate','tile'][variant]

    # Setting-out pegs and builder's line disappear once the house is finished.
    for x in [-a-.18,a+.18]:
        for y in [-b-.18,b+.18]:
            beam('Setting-out peg',(x,y,0),(x,y,.25),.045,kind='new_oak',step=0,end=3)
    for y in [-b-.18,b+.18]:
        beam('Builder line',(-a-.18,y,.19),(a+.18,y,.19),.009,kind='rope',step=0,end=3)
    for x in [-a-.18,a+.18]:
        beam('Builder line',(x,-b-.18,.19),(x,b+.18,.19),.009,kind='rope',step=0,end=3)

    # A plinth is made from staggered, individually weathered courses.
    for course in range(2):
        z=.055+course*.125
        for axis, coordinate, extent in [(0,-a,b),(0,a,b),(1,-b,a),(1,b,a)]:
            count=max(5,round(extent*2/.38))
            for i in range(count):
                u=-extent+(i+.5)*2*extent/count
                center=(coordinate,u,z) if axis==0 else (u,coordinate,z)
                size=(.26,2*extent/count-.018,.12) if axis==0 else (2*extent/count-.018,.26,.12)
                box('Quarried plinth stone',center,size,'stone_light' if course else 'stone',1+course,bevel=.026)
    for axis, coordinate, extent in [(0,-a,b),(0,a,b),(1,-b,a),(1,b,a)]:
        p=lambda u,z: (coordinate,u,z) if axis==0 else (u,coordinate,z)
        beam('Sill beam',p(-extent,sill),p(extent,sill),.15,step=3)

    for floor in range(floors):
        z=sill+floor*storey
        for i in range(7):
            y=-b+(i+.5)*b*2/7
            beam('Floor joist',(-a,y,z),(a,y,z),.11,step=3 if floor==0 else 5)
        for i in range(14):
            x=-a+(i+.5)*a*2/14
            beam('Floor board',(x,-b,z+.065),(x,b,z+.065),a*2/14-.007,.036,
                 kind='oak_end',step=4 if floor==0 else 6)

        door=(-.85,.00,sill,sill+1.78) if floor==0 else None
        front_windows=[(.57-.3,.57+.3,z+.86,z+1.64)] if floor==0 else [(-.90,-.30,z+.86,z+1.64),(.3,.9,z+.86,z+1.64)]
        openings=([door] if door else [])+front_windows
        wall(1,-b,-a,a,z+.075,z+storey,openings,finish)
        wall(1,b,-a,a,z+.075,z+storey,[],finish)
        for side in [-1,1]:
            holes=[(-.70,-.10,z+.88,z+1.64),(.35,.95,z+.88,z+1.64)]
            wall(0,side*a,-b,b,z+.075,z+storey,holes,finish)
            for x0,x1,z0,z1 in holes:
                window(0,side*(a+.063),(x0+x1)/2,(z0+z1)/2,shutters=tier>=2 and side==1)
        for x0,x1,z0,z1 in front_windows:
            window(1,-b-.063,(x0+x1)/2,(z0+z1)/2,width=x1-x0,height=z1-z0,shutters=tier>=2)

        # Continuous corner posts, rails and diagonal braces form an actual
        # load-bearing frame rather than lines floating over an opaque sprite.
        for x in [-a,0,a]:
            for y in [-b,b]:
                beam('Wall post',(x,y,z),(x,y,z+storey),.13,step=4 if x<0 else 5)
        for x in [-a,a]:
            # Corner posts already belong to the front/back frames.
            beam('Side post',(x,0,z),(x,0,z+storey),.13,step=5)
            beam('Wall plate',(x,-b,z+storey),(x,b,z+storey),.14,step=5)
            for sign in [-1,1]:
                beam('Side knee brace',(x,sign*.12,z+storey-.40),(x,sign*.61,z+storey-.06),.08,step=5)
        for y in [-b,b]:
            beam('Tie beam',(-a,y,z+storey),(a,y,z+storey),.16,step=5)
            # Bracing is above the apertures; the doorway remains walkable.
            for sign in [-1,1]:
                beam('Corner brace',(sign*a,y,z+storey-.57),(sign*(a-.52),y,z+storey-.05),.075,step=5)
        if floor:
            for y in [-b-.09,b+.09]:
                beam('Storey string course',(-a-.08,y,z+.12),(a+.08,y,z+.12),.13,step=6)

    # The entrance has real depth; a recessed boarded leaf closes the aperture.
    for side in [-.85,0]:
        beam('Door jamb',(side,-b-.07,sill),(side,-b-.07,sill+1.78),.085,step=8)
    beam('Door lintel',(-.90,-b-.07,sill+1.8),(.055,-b-.07,sill+1.8),.105,step=8)
    for i in range(7):
        box('Oak door board',(-.85+(i+.5)*.85/7,-b+.018,sill+.875),(.85/7-.006,.07,1.72),
            'oak_end',14,bevel=.007)
    for z in [.48,1.39]:
        beam('Door strap',(-.78,-b-.041,sill+z),(-.10,-b-.041,sill+z),.036,kind='iron',step=14)
    knocker=cylinder('Door ring',(-.19,-b-.088,sill+1.00),.047,.022,'iron',14)
    knocker.rotation_euler.x=math.pi/2
    for i in range(2):
        box('Doorstep',(-.43,-b-.23-i*.13,.07-i*.045),(1.04,.32,.10),'stone_light',14,bevel=.022)

    # Gables and roof structure share exact ridge/eave coordinates with the
    # final covering. Every timber stays straight and planted at every stage.
    for y in [-b,b]:
        verts=[(-a,y,eave),(a,y,eave),(0,y,ridge-.08)]
        mesh('Lime gable',verts,[(0,1,2)],finish,8)
        beam('Gable tie',(-a,y,eave),(a,y,eave),.13,step=8)
        beam('Gable king post',(0,y,eave),(0,y,ridge),.11,step=8)
        for side in [-1,1]:
            beam('Gable rafter',(side*(a+.18),y,eave-.10),(0,y,ridge),.13,step=8)
    for index in range(7):
        y=-b-.17+(b*2+.34)*index/6
        for side in [-1,1]:
            beam('Roof rafter',(side*(a+.20),y,eave-.12),(0,y,ridge),.095,
                 step=8 if index in (0,6) else 9)
    beam('Ridge beam',(0,-b-.22,ridge),(0,b+.22,ridge),.15,step=9)
    for side in [-1,1]:
        for row in range(8):
            t=(row+.5)/8
            x=side*(a+.20)*(1-t); z=eave-.10+(ridge-eave+.10)*t
            beam('Roof batten',(x,-b-.20,z),(x,b+.20,z),.043,kind='new_oak',step=10)

    # Covering is installed from the eaves toward the ridge in overlapping
    # courses. Broad pigment variations belong to individual pieces.
    for side in [-1,1]:
        courses=10 if roof_kind!='thatch' else 5
        columns=12 if roof_kind!='thatch' else 38
        for row in range(courses):
            t0=max(0,(row-.22)/courses); t1=min(1.035,(row+1.12)/courses)
            stage=11 if row<courses*.30 else 12 if row<courses*.78 else 13
            for col in range(columns+1):
                offset=.5*(row%2) if roof_kind!='thatch' else .15*(row%2)
                y0=-b-.25+(col-offset)*(b*2+.50)/columns
                y1=min(b+.25,y0+(b*2+.50)/columns*1.02)
                y0=max(-b-.25,y0)
                if y1<=y0: continue
                p0=Vector((side*(a+.24)*(1-t0),(y0+y1)/2,eave-.10+(ridge-eave+.16)*t0))
                p1=Vector((side*(a+.24)*(1-t1),(y0+y1)/2,eave-.10+(ridge-eave+.16)*t1))
                # Each covering unit has a slightly weathered crown and a
                # distinct overhanging lower lip, not a flat painted diamond.
                normal=Vector((side*.65,0,.76))
                p0+=normal*(.055+row*.002);p1+=normal*(.055+row*.002)
                if roof_kind=='thatch':
                    p0.x+=side*current_rng.uniform(-.026,.026)
                    p0.z+=current_rng.uniform(-.015,.015)
                obj=beam('Reed bundle' if roof_kind=='thatch' else 'Roof tile',p0,p1,
                         y1-y0,.14 if roof_kind=='thatch' else .031,kind=roof_kind,step=stage)
                # A beam's local X runs across the slope, giving the long
                # packed grain the same direction as the reed/tile itself.
                if roof_kind=='thatch' and col%5==0:
                    for strand in [-.035,.035]:
                        beam('Thatch stitch',p0+Vector((0,strand,.022)),p1+Vector((0,strand,.022)),
                             .009,kind='thatch',step=stage)
        beam('Eaves fascia',(side*(a+.23),-b-.26,eave-.13),
             (side*(a+.23),b+.26,eave-.13),.09,kind='oak',step=11)
    for i in range(12):
        y=-b-.26+(i+.5)*(b*2+.52)/12
        if roof_kind=='thatch':
            cap=cylinder('Reed ridge roll',(0,y,ridge+.095),.145,(b*2+.52)/12+.026,roof_kind,13,vertices=12)
            cap.rotation_euler.x=math.pi/2
        else:
            box('Ridge cap',(0,y,ridge+.10),(.22,(b*2+.52)/12+.016,.075),roof_kind,13,bevel=.026)

    # The chimney belongs to the completed architecture rather than a smoke
    # billboard. The pot has a dark recessed opening and a separate rim.
    chimney_x=-a*.53; chimney_y=b*.40
    chimney_base=eave+(ridge-eave)*.47
    for course in range(8):
        box('Chimney course',(chimney_x,chimney_y,chimney_base+course*.13),(.37,.39,.121),
            'stone' if variant==0 else 'brick',13,bevel=.015)
    box('Chimney cap',(chimney_x,chimney_y,chimney_base+1.02),(.46,.48,.10),'stone_light',13,bevel=.018)
    box('Chimney flue',(chimney_x,chimney_y,chimney_base+1.075),(.24,.26,.016),'soot',13,bevel=0)

    # Narrow working staging sits alongside the wall and leaves the doorway
    # clear. Boards, brackets and diagonals meet their supporting posts.
    sx=a+.39
    for y in [-b*.8,b*.8]:
        for x in [sx-.18,sx+.18]:
            beam('Scaffold upright',(x,y,.02),(x,y,eave+.22),.061,kind='new_oak',step=5,end=15)
        beam('Scaffold ledger',(sx-.22,y,eave*.63),(sx+.22,y,eave*.63),.065,kind='new_oak',step=5,end=15)
    for i in range(3):
        x=sx-.15+i*.15
        beam('Scaffold board',(x,-b*.9,eave*.63+.035),(x,b*.9,eave*.63+.035),.14,.035,
             kind='oak_end',step=6,end=15)
    beam('Scaffold cross brace',(sx+.18,-b*.8,.05),(sx+.18,b*.8,eave*.63),.05,
         kind='new_oak',step=5,end=15)
    for x in [sx-.12,sx+.12]:
        beam('Ladder rail',(x,-b-.17,.04),(x,-b*.80,eave*.68),.04,kind='oak_end',step=6,end=15)
    for i in range(8):
        t=(i+1)/9
        y=-b-.17+(.17+b*.2)*t
        beam('Ladder rung',(sx-.12,y,eave*.68*t),(sx+.12,y,eave*.68*t),.027,
             kind='oak_end',step=6,end=15)

    # Delivered material decreases as it becomes part of the building.
    for i in range(6):
        x=-a-.28-(i%2)*.11; z=.07+(i//2)*.105
        beam('Timber delivery',(x,-.68,z),(x,.66,z),.095,kind='new_oak',step=0,end=5+i)
    for i in range(5):
        box('Stone delivery',(-a-.35+(i%2)*.19,b*.50+(i//2)*.22,.10),(.20,.21,.18),
            'stone',0,end=2+i//3,bevel=.025)
    if tier>=2:
        # Small domestic details give the families a lived-in silhouette.
        barrel=cylinder('Rain barrel',(a+.20,b*.67,.31),.20,.55,'oak_end',15,vertices=16)
        for z in [.12,.47]:
            cylinder('Barrel iron hoop',(a+.20,b*.67,z),.211,.034,'iron',15,vertices=16)
        box('Window herb box',(.57,-b-.19,1.02),(.71,.25,.23),'oak_end',15,bevel=.014)
        for i in range(7):
            u=.31+i*.082
            beam('Herb stem',(u,-b-.20,1.10),(u+current_rng.uniform(-.035,.035),-b-.20,1.30),.012,kind='leaf',step=15)
    # Source layout is a readable library in Blender; the bake centers one
    # root at a time without altering the saved scene's placement.
    current_root.location=(variant*8,(tier-1)*9,0)
    current_root['realm_dimensions']=json.dumps({'halfWidth':a,'halfDepth':b,'eave':eave,'ridge':ridge})
    return current_root


roots=[house(variant,tier) for tier in range(1,5) for variant in range(3)]
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=512;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.world.color=(.25,.25,.25)
scene.frame_start=0;scene.frame_end=15;scene.frame_set(15)

# Make the saved scene pleasant to open: a completed library with the first
# house stopped at its visible timber skeleton. Hidden parts still export;
# explicit installation metadata is the runtime/bake authority.
for root in roots:
    shown=9 if root==roots[0] else 15
    for obj in root.children:
        obj.hide_set(not (obj['realm_start']<=shown<obj['realm_end']))
        obj.hide_render=not (obj['realm_start']<=shown<obj['realm_end'])
readme=bpy.data.texts.new('READ ME — Realm homes')
readme.write('Editable Realm home library. All parts are named and parented to one home.\n'
             'realm_start / realm_end are installation/removal steps, 0 through 15.\n'
             'The exporter preserves geometry edits and these explicit stage properties.\n'
             'Saved library positions are ignored by the sprite camera. Units: metres.\n\n'
             + '\n'.join(f'{i}: {name}' for i,name in enumerate(STEP_NAMES)))
scene['realm_step_names']=json.dumps(STEP_NAMES)
bpy.ops.wm.save_as_mainfile(filepath=str(destination/'homes.blend'))
print(json.dumps({'saved':str(destination/'homes.blend'),'homes':len(roots),'parts':part_counter,
                  'materials':len(materials),'steps':STEP_NAMES}))
