"""Prepare the editable Founder scene from the exact sprite-bake skeleton."""
import bpy
import math
import json
from mathutils import Vector
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/sprites/founder'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.fps=30
scene.render.fps_base=4/3
bpy.ops.import_scene.gltf(filepath=str(OUT/'founder-walk.glb'))
# Normalize imported key times explicitly. Importer versions differ in their
# treatment of fps_base; the sprite cycle must always occupy frames 1..25,
# with frame 25 the duplicate endpoint excluded from playback.
for action in bpy.data.actions:
    start,end=action.frame_range
    factor=24/(end-start)
    curves=[]
    if hasattr(action,'fcurves'):
        curves=list(action.fcurves)
    else:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    curves.extend(bag.fcurves)
    for curve in curves:
        for key in curve.keyframe_points:
            key.co.x=1+(key.co.x-start)*factor
            key.handle_left.x=1+(key.handle_left.x-start)*factor
            key.handle_right.x=1+(key.handle_right.x-start)*factor
        curve.update()
for obj in scene.objects:
    if obj.animation_data:
        for track in obj.animation_data.nla_tracks:
            for strip in track.strips:
                strip.action_frame_start=1;strip.action_frame_end=25
                strip.frame_start=1;strip.scale=1;strip.frame_end=25
scene.render.fps=24
scene.render.fps_base=1.0666667222976685
scene.frame_start=1
scene.frame_end=24
scene.frame_set(1)
rig=next(o for o in scene.objects if o.type=='ARMATURE')
rig.name='Founder - editable skeleton'
rig.show_in_front=False

# Check the converted Blender skeleton against the actual sprite-bake points.
samples=json.loads((OUT/'landmarks.json').read_text())[:24]
max_error=0
for sample in samples:
    scene.frame_set(sample['frame']+1)
    bpy.context.view_layer.update()
    for name in ['foot.l','foot.r','hips','head']:
        expected=sample['landmarks'][name]['world']
        goal=Vector((expected[0],-expected[2],expected[1]))
        actual=rig.matrix_world @ rig.pose.bones[name].head
        max_error=max(max_error,(actual-goal).length)
assert max_error < .00002, f'Blender pose differs from sprites: {max_error}'
(OUT/'blender-validation.json').write_text(json.dumps({'frames':24,'jointsPerFrame':4,'maxWorldError':max_error,'cycleSeconds':24*scene.render.fps_base/scene.render.fps,'actionFrames':[list(a.frame_range) for a in bpy.data.actions]},indent=2)+'\n')
scene.frame_set(1)

def material(name,color,roughness=.8,metallic=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness
    p.inputs['Metallic'].default_value=metallic
    return m

stone=material('Slate pedestal',(.09,.17,.19))
brass=material('Warm brass',(.52,.33,.095),.4,.55)
ground=material('Backdrop',(.037,.076,.09))
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=1.6,depth=.13,location=(0,0,-.11))
pedestal=bpy.context.object;pedestal.name='Review pedestal';pedestal.data.materials.append(stone)
bevel=pedestal.modifiers.new('Soft stone edges','BEVEL');bevel.width=.055;bevel.segments=3
bpy.ops.mesh.primitive_torus_add(major_radius=1.52,minor_radius=.012,major_segments=96,minor_segments=8,location=(0,0,-.035))
bpy.context.object.name='Pedestal brass inlay';bpy.context.object.data.materials.append(brass)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.19))
bpy.context.object.name='Studio floor';bpy.context.object.data.materials.append(ground)

def area(name,location,color,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=location
    o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()

area('Key - warm window',(-3,-4,6),(1,.83,.63),550,4)
area('Fill - sky',(4,-1,4),(.5,.76,1),340,3)
area('Rim - cloak',(1,4,4),(.73,.89,1),600,3)
world=bpy.data.worlds.new('Slate studio');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.22,.26,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.world=world
camera_collection=bpy.data.collections.new('Eight direction cameras');scene.collection.children.link(camera_collection)
for i,direction in enumerate(['S','SE','E','NE','N','NW','W','SW']):
    yaw=i*math.pi/4
    data=bpy.data.cameras.new(f'{direction} - orthographic');data.type='ORTHO';data.ortho_scale=3.6
    camera=bpy.data.objects.new(f'Camera {direction}',data);camera_collection.objects.link(camera)
    target=Vector((0,0,.95))
    camera.location=target+Vector((-math.sin(yaw)*8,-math.cos(yaw)*8,8*math.tan(math.pi/6)))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    if direction=='SE':scene.camera=camera

scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=720;scene.render.resolution_y=840;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/'blender-preview.png')
scene.render.film_transparent=False
scene.tool_settings.use_keyframe_insert_auto=False
for o in bpy.context.selected_objects:o.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.region_3d.view_perspective='CAMERA'
            space.overlay.show_overlays=False
            space.shading.type='MATERIAL'
        if area.type=='DOPESHEET_EDITOR':
            area.spaces.active.mode='DOPESHEET'
readme=bpy.data.texts.new('START HERE - Founder walk')
readme.write('Realm Founder walking pilot\n\nSpace: play or pause the 24-frame loop.\nNumpad 0: return to the active camera.\nEight cameras are in the Eight direction cameras collection.\nThe Founder skeleton holds the same grounded motion used in the PNG sprite maps.\nSelect the skeleton, enter Pose Mode, select a bone and use the Dope Sheet to inspect keys.\n\nOnly walking is authored for this pilot. Later actions can be added as separate clips.\n\nOriginal mesh, texture and base motion: Kay Lousberg / KayKit (CC0).\nRealm additions: planted-foot IK, closed 24-frame loop, eight-view bake, runtime and review studio.\n')
scene['Realm walk contract']='24 frames; eight directions; exact sprite-bake joint transforms'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'founder-walk.blend'))
bpy.ops.render.render(write_still=True)
print(json.dumps({'blend':str(OUT/'founder-walk.blend'),'frames':[scene.frame_start,scene.frame_end],'actions':[a.name for a in bpy.data.actions],'cameras':8}))
