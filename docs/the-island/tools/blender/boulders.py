"""Original boulder kit: three fractured, weathered erratics. Separate background process.

/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/boulders.py

Why: every rock on the island was a displaced icosphere — smooth, egg-shaped, and the
same egg at every size, so the headland read as a nest of marshmallows (player-walk
review, October 2026). Real glacial erratics are blocks: a few large planar fracture
faces meeting at weathered edges, with a rounded, pitted body between them.

Recipe per stone: icosphere → 4-6 random planar cuts (the fractures) → the cut edges
bevelled (weathering) → low-frequency lump + fine grit displacement → decimated to a
game budget → sharp fracture edges marked so the exporter splits their normals, the
body stays smooth → baked vertex ambient occlusion (cavity) and a lighter tint on the
fresh fracture faces → box-projected UVs for the runtime relief normal map.

Runtime: `js/props.js` instances these three geometries for the shore rocks and the
inland erratic fields (one draw per stone type, as before). Game coordinates are
Y-up metres; the stones are authored at unit radius and scaled per instance.
No external model, texture or image is used.
"""
import bpy, bmesh, math, json, random
from pathlib import Path
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

SRC = Path(__file__).resolve().parent
ROOT = SRC.parents[1]
scene = bpy.data.scenes.new('Island - Boulders')
bpy.context.window.scene = scene

TARGET_TRIS = 180          # per stone: the old displaced icosphere was a detail-2 icosahedron = 180 faces (its comment said 320; it was not). ~300 instances × 2 (island + model): the kit must hold that budget exactly.
SPECS = [                  # name, seed, cuts, cut depth range, lump amp, grit amp, edge bevel
    ('boulderA', 1101, 5, (0.52, 0.78), 0.085, 0.014, 0.055),   # weathered granite: blocky, rounded edges
    ('boulderB', 2207, 6, (0.58, 0.82), 0.060, 0.018, 0.035),   # dark basalt: more faces, crisper edges
    ('boulderC', 3317, 5, (0.60, 0.80), 0.070, 0.012, 0.070),   # pale limestone: shallower cuts, softer edges
]
stats = {}


def fracture(bm, rng, cuts, depth):
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    for _ in range(cuts):
        n = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.6, 1))).normalized()
        co = n * rng.uniform(*depth)
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                                     plane_co=co, plane_no=n, clear_outer=True, clear_inner=False)
        cut_edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if cut_edges:
            bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)
    bm.normal_update()


def displace(bm, rng, lump, grit):
    ox = Vector((rng.uniform(0, 50), rng.uniform(0, 50), rng.uniform(0, 50)))
    for v in bm.verts:
        p = v.co + ox
        big = noise.noise(p * 1.35) * lump + noise.noise(p * 2.9 + Vector((7, 3, 1))) * lump * 0.45
        fine = noise.noise(p * 11.0) * grit
        v.co += v.normal * (big + fine)
    bm.normal_update()


def bevel_fractures(bm, width):
    sharp = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(34)]
    if sharp:
        bmesh.ops.bevel(bm, geom=sharp, offset=width, offset_type='OFFSET', segments=1,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    bm.normal_update()


def build(name, seed, cuts, depth, lump, grit, bevel):
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
    # proportions: no stone is a sphere
    sx, sy, sz = rng.uniform(0.85, 1.25), rng.uniform(0.8, 1.2), rng.uniform(0.7, 1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    fracture(bm, rng, cuts, depth)
    bevel_fractures(bm, bevel)
    displace(bm, rng, lump, grit)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    # keep the fracture planes identifiable before decimation: face normals that agree with
    # one of the cut planes within a few degrees are "fresh" rock
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    # decimate to the game budget (collapse keeps the planar faces planar)
    ratio = min(1.0, TARGET_TRIS / max(1, len(me.polygons)))
    mod = ob.modifiers.new('budget', 'DECIMATE')
    mod.ratio = ratio
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier='budget')
    # re-centre on the volume centroid and normalise to unit radius
    me = ob.data
    c = sum((v.co for v in me.vertices), Vector()) / len(me.vertices)
    r = max((v.co - c).length for v in me.vertices)
    for v in me.vertices:
        v.co = (v.co - c) / r
    me.update()
    finish(ob, rng)
    return ob


def finish(ob, rng):
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    # sharp fracture edges split their normals in the export; the weathered body stays smooth
    for e in bm.edges:
        e.smooth = not (e.is_manifold and e.calc_face_angle(0) > math.radians(30))
    for f in bm.faces:
        f.smooth = True
    # per-face: a planar fracture face (large, flat neighbourhood) reads a shade lighter
    flat = {}
    for f in bm.faces:
        agree = 0
        for e in f.edges:
            for g in e.link_faces:
                if g is not f and f.normal.dot(g.normal) > 0.985:
                    agree += 1
        flat[f.index] = agree >= 2
    # vertex ambient occlusion: hemisphere rays against the stone itself
    tree = BVHTree.FromBMesh(bm)
    dirs = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(48):
        y = 1 - (i / 47) * 2
        rr = math.sqrt(max(0, 1 - y * y))
        t = golden * i
        dirs.append(Vector((math.cos(t) * rr, y, math.sin(t) * rr)))
    ao = {}
    for v in bm.verts:
        n = v.normal
        hits = 0
        total = 0
        for d in dirs:
            if d.dot(n) < 0.15:
                continue
            total += 1
            loc = tree.ray_cast(v.co + n * 0.01, d, 2.5)[0]
            if loc is not None:
                hits += 1
        ao[v.index] = 1.0 - 0.55 * (hits / total if total else 0)
    layer = bm.loops.layers.color.new('Color')
    for f in bm.faces:
        tint = 1.06 if flat[f.index] else 0.96
        for l in f.loops:
            a = ao[l.vert.index] * tint
            l[layer] = (a, a, a, 1.0)
    # box-projected UVs by dominant normal axis: the relief map tiles in metres over each face
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = l.vert.co
            if ax == 0:
                u, w = p.y, p.z
            elif ax == 1:
                u, w = p.x, p.z
            else:
                u, w = p.x, p.y
            l[uv].uv = (u * 0.5 + 0.5, w * 0.5 + 0.5)
    bm.to_mesh(me)
    bm.free()
    me.update()
    stats[ob.name] = {'triangles': len(me.polygons), 'vertices': len(me.vertices)}


objects = [build(*spec) for spec in SPECS]
for o in bpy.data.objects:
    o.select_set(o in objects)
bpy.context.view_layer.objects.active = objects[0]
out = ROOT / 'assets/boulders.glb'
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, use_active_scene=True,
                          export_yup=True, export_apply=True, export_extras=True, export_normals=True)
summary = {'blender': bpy.app.version_string, 'targetTriangles': TARGET_TRIS, 'parts': stats, 'bytes': out.stat().st_size}
(SRC / 'boulders-geometry.json').write_text(json.dumps(summary, indent=2) + '\n')

# inspection render: the three stones side by side under a soft sky, as the game would light them
for i, o in enumerate(objects):
    o.location = ((i - 1) * 2.6, 0, 0)
world = bpy.data.worlds.new('Boulder inspection')
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (0.42, 0.50, 0.58, 1)
bg.inputs[1].default_value = 0.9
sun = bpy.data.lights.new('Sun', 'SUN')
sun.energy = 3.2
sun_ob = bpy.data.objects.new('Sun', sun)
scene.collection.objects.link(sun_ob)
sun_ob.rotation_euler = (math.radians(52), math.radians(12), math.radians(-35))
camd = bpy.data.cameras.new('Inspection')
cam = bpy.data.objects.new('Inspection', camd)
scene.collection.objects.link(cam)
cam.location = (0.4, -7.2, 3.1)
cam.rotation_euler = (Vector((0, 0, 0.1)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
camd.lens = 42
scene.camera = cam
ground = bpy.data.meshes.new('ground')
gb = bmesh.new()
bmesh.ops.create_grid(gb, x_segments=1, y_segments=1, size=12)
gb.to_mesh(ground)
gb.free()
gob = bpy.data.objects.new('ground', ground)
gob.location.z = -0.72
scene.collection.objects.link(gob)
mat = bpy.data.materials.new('stone')
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get('Principled BSDF')
attr = mat.node_tree.nodes.new('ShaderNodeVertexColor')
attr.layer_name = 'Color'
mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.95
for o in objects:
    o.data.materials.append(mat)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 1400
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(SRC / 'boulders.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SRC / 'boulders.blend'))
bpy.ops.render.render(write_still=True)
print(json.dumps(summary))
