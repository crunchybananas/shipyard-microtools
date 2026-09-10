"""Apply the reviewed pointing arm only, preserving other saved action curves."""
import bpy,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/sprites/founder'
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
destination=next(a for a in bpy.data.actions if a.get('realm_id')=='point')
backup=OUT/'founder-actions-before-arm-repair.blend'
if not backup.exists():shutil.copy2(bpy.data.filepath,backup)
objects=set(bpy.data.objects);actions=set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'tmp/founder-sprites/point-arm-repair.glb'))
created=set(bpy.data.objects)-objects
source=next(o for o in created if o.type=='ARMATURE')
imported=next(a for a in bpy.data.actions if a not in actions and a.name.startswith('Realm_Direct_Work'))

def slot(action):
    handles={bag.slot_handle for layer in action.layers for strip in layer.strips for bag in strip.channelbags if any(f.data_path.startswith('pose.bones[') for f in bag.fcurves)}
    return next(s for s in action.slots if s.handle in handles)

source.animation_data.action=imported;source.animation_data.action_slot=slot(imported)
for track in source.animation_data.nla_tracks:track.mute=True
names=['upperarm.r','lowerarm.r','wrist.r','hand.r']
start,end=imported.frame_range
samples=[]
for f in range(49):
    t=start+(end-start)*f/48
    scene.frame_set(int(t),subframe=t-int(t));bpy.context.view_layer.update()
    samples.append({n:(source.matrix_world @ source.pose.bones[n].matrix).copy() for n in names})
rig.animation_data.action=destination;rig.animation_data.action_slot=slot(destination)
for track in rig.animation_data.nla_tracks:track.mute=True
previous={}
for f,sample in enumerate(samples):
    scene.frame_set(f+1);bpy.context.view_layer.update()
    for name in names:
        b=rig.pose.bones[name];goal=rig.matrix_world.inverted() @ sample[name]
        goal.translation=b.matrix.translation
        b.rotation_mode='QUATERNION';b.matrix=goal
        if name in previous:b.rotation_quaternion.make_compatible(previous[name])
        previous[name]=b.rotation_quaternion.copy()
        b.keyframe_insert(data_path='rotation_quaternion',frame=f+1,group=name)
        bpy.context.view_layer.update()
for layer in destination.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for curve in bag.fcurves:
                if any(curve.data_path==f'pose.bones["{n}"].rotation_quaternion' for n in names):
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
source.animation_data_clear()
for o in created:bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.actions):
    if a not in actions:bpy.data.actions.remove(a)
scene.frame_start=1;scene.frame_end=48;scene.render.fps=15;scene.render.fps_base=1;scene.frame_set(23)
rig.animation_data.action=destination;rig.animation_data.action_slot=slot(destination)
for o in bpy.context.selected_objects:o.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'founder-actions.blend'))
print('Updated the pointing arm only; previous scene preserved:',backup)
