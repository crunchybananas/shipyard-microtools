"""Original Wildhaven fieldbook landmarks and carried goods. Background Blender only.
Reuses our frontier kit's geometry vocabulary; no external models or textures.
"""
from pathlib import Path
source=Path(__file__).with_name('create_frontier_assets.py').read_text()
exec(compile(source[:source.index("root('wall')")],str(Path(__file__).with_name('create_frontier_assets.py')),'exec'))

def base():
    cylinder('hand laid stone footing',(0,0,.07),.77,.14,'stone_dark',12,.025)
    cylinder('warm stone floor',(0,0,.15),.69,.08,'stone_light',12,.014)

def leaves():
    for x,y in [(-.57,.34),(.54,.41),(-.48,-.43)]:
        for i in range(3):
            ball('mint leaves',(x+.09*math.cos(i*2),y+.09*math.sin(i*2),.24+i*.024),(.12,.065,.04),'leaf_light',1)

def waystone(restored):
    base()
    cube('carved mason stone',(0,.02,.71 if restored else .53),(.55,.28,1.08 if restored else .71),'stone',.09,rot=(0,.04 if restored else .29,-.03))
    cube('cap stone',(0,.02,1.29 if restored else .95),(.64,.35,.13),'stone_light',.025,rot=(0,0,-.03))
    for i in range(4):cube('incised measurement',(-.09,-.134,.48+i*.16),(.22 if i%2 else .30,.012,.023),'wood_dark',.002)
    beam('measuring plumb line',(.19,-.15,.42),(.19,-.15,1.13 if restored else .88),.009,'ochre')
    if restored:
        cube('craftsman bench',(-.47,.31,.42),(.31,.56,.09),'wood_light',.013)
        for y in [.12,.50]:cube('bench foot',(-.47,y,.29),(.10,.08,.25),'wood',.014)
        cube('open notebook',(-.46,.27,.48),(.25,.28,.025),'cream',.005)
        flower_pot(.48,-.34,.21,.12,'pink')
    else:ball('fallen fragment',(.39,-.28,.25),(.24,.18,.12),'stone',1)

def spring(restored):
    base();cylinder('spring basin',(0,0,.30),.44,.22,'stone',12,.025)
    cylinder('clear spring water',(0,0,.418),.355,.015,'#559e9b',24,0)
    torus('basin rim',(0,0,.42),.40,.045,'stone_light')
    for x in [-.49,.49]:cube('springhouse post',(x,.20,.74 if restored else .48),(.09,.09,1.02 if restored else .50),'wood',.015)
    if restored:
        mesh('springhouse roof',[(-.67,-.24,1.26),(.67,-.24,1.26),(0,-.24,1.67),(-.67,.64,1.26),(.67,.64,1.26),(0,.64,1.67)],[(0,2,5,3),(2,1,4,5)],'teal')
        beam('roof ridge',(0,-.29,1.68),(0,.69,1.68),.045,'wood_light')
        cylinder('traveler cup',(.49,-.30,.31),.07,.13,'cream',10,.008)
        torus('cup handle',(.57,-.30,.34),.044,.012,'cream',(math.pi/2,0,0))
    else:beam('fallen roof beam',(-.58,.36,.32),(.41,.55,.36),.06,'wood_dark')
    leaves()

def kiln(restored):
    base()
    cylinder('kiln dome',(0,.08,.66 if restored else .54),.53,.94 if restored else .70,'roof',16,.055,radius2=.38)
    cylinder('kiln chimney',(0,.08,1.31 if restored else 1.04),.18,.45 if restored else .26,'roof_dark',10,.024)
    cylinder('dark flue',(0,.08,1.55 if restored else 1.18),.126,.012,'ink',10,0)
    arch('kiln mouth',0,-.44,.20,.39,.43,.02,'ink')
    if restored:
        arch('warm coals',0,-.458,.22,.27,.15,.023,'flame')
        for x in [-.26,.18]:cylinder('fired pot',(x,-.55,.27),.08,.16,'ochre',10,.01,radius2=.10)
        cube('potter shelf',(.53,.12,.62),(.26,.61,.07),'wood_light',.008)
        for y in [-.11,.30]:cube('shelf foot',(.53,y,.40),(.06,.06,.39),'wood',.008)
    else:
        for i in range(4):cube('fallen kiln brick',(-.42+i*.20,-.51,.24),(.15,.09,.09),'roof_light',.012,rot=(0,0,i*.4))
    for z in [.48,.73,.98] if restored else [.46,.72]:torus('brick course',(0,.08,z),.49-(z-.48)*.15,.013,'roof_dark')

def stars(restored):
    base();cylinder('sky ring pillar',(0,.09,.53),.18,.69,'cream',8,.03)
    torus('brass sky ring',(0,.09,1.22 if restored else .94),.48,.037,'ochre',(math.pi/2,.25,0))
    torus('crossed sky ring',(0,.09,1.22 if restored else .94),.47,.024,'metal',(.3,math.pi/2,.2))
    if restored:
        beam('celestial axis',(-.19,-.03,.81),(.20,.20,1.68),.02,'wood_dark')
        ball('little sun',(0,.09,1.22),(.095,)*3,'ochre',2)
        for i in range(4):
            a=i*math.tau/4;cube('season stone',(.57*math.cos(a),.57*math.sin(a),.29),(.17,.17,.20),'stone',.02)
        leaves()
    else:beam('fallen axis',(-.49,-.40,.23),(.43,-.28,.23),.023,'metal')

for name,build in [('waystone',waystone),('spring',spring),('kiln',kiln),('stars',stars)]:
    for restored in [False,True]:root('discovery_'+name+('_restored' if restored else ''));build(restored)
# Small payloads fit between the villagers' hands. Origin is bottom center.
root('cargo_logs')
for x,y,z in [(-.065,0,.05),(.065,0,.05),(0,0,.15)]:log(x,y,z,.34,.059,math.pi/2)
root('cargo_stone')
for x,y,z in [(-.06,0,.06),(.065,.03,.06),(0,0,.15)]:ball('cut stones',(x,y,z),(.105,.10,.075),'stone_light',1)
root('cargo_planks')
for i in range(3):cube('carried planks',(0,0,.03+i*.048),(.40,.18,.043),'wood_light' if i%2 else 'wood',.006)
for x in [-.10,.10]:cube('plank bindings',(x,0,.09),(.015,.187,.17),'cream',.002)
root('cargo_bread');basket(0,0,0,.17,'bread')
root('cargo_grain')
ball('grain sack',(0,0,.13),(.15,.12,.17),'cream',2);torus('tied sack neck',(0,0,.24),.066,.012,'wood');ball('sack ears',(0,0,.29),(.08,.065,.06),'ochre',1)
root('cargo_cloth')
for i in range(3):cube('folded cloth',(0,0,.035+i*.045),(.28-i*.012,.21,.04),'teal_light' if i%2 else 'cream',.014)
root('cargo_iron')
for i in range(3):cube('iron billet',(-.085+i*.085,0,.05),(.07,.27,.08),'metal',.012)
root('cargo_ale');barrel(0,0,0,.12,.27)

root('cargo_fruit');basket(0,0,0,.17,'red')
root('cargo_vegetables');basket(0,0,0,.17,'sage')
root('cargo_ore')
for x,y,z in [(-.06,0,.06),(.065,.03,.06),(0,0,.15)]:
    ball('iron ore lumps',(x,y,z),(.105,.10,.075),'wood_dark',1)
    ball('metal ore face',(x+.045,y-.03,z+.025),(.037,.036,.041),'metal',1)
root('cargo_flour')
ball('flour sack',(0,0,.13),(.15,.12,.17),'light',2);torus('flour sack tie',(0,0,.25),.065,.011,'teal');cube('mill stamp',(0,-.112,.13),(.083,.011,.083),'ochre',.006)
root('cargo_flax')
for i in range(9):
    x=(i%3-1)*.048;y=(i//3-1)*.047
    beam('flax stalk',(x,y,0),(x*.6,y*.6,.27),.011,'sage')
    ball('flax blossom',(x*.6,y*.6,.29),(.026,.026,.018),'purple',1)
torus('flax twine',(0,0,.13),.060,.012,'cream')
root('cargo_tools')
crate(0,0,0,.24)
for x in [-.065,.055]:
    beam('carried tool handle',(x,-.02,.10),(x,.02,.31),.014,'wood_light')
    cube('carried hammer head',(x,.02,.31),(.10,.045,.044),'metal',.008)

# Consolidate each authored root into one draw call, keeping shared paint.
bpy.context.view_layer.update()
metadata={'title':'Wildhaven living island kit','generator':'tools/create_living_assets.py','generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'helper_sha256':hashlib.sha256(Path(__file__).with_name('create_frontier_assets.py').read_bytes()).hexdigest(),'original_art':True,'assets':{}}
for asset in roots:
    objects=[o for o in asset.children_recursive if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=asset.name+'_mesh';bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    points=[o.matrix_world@v.co for v in o.data.vertices];lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    metadata['assets'][asset.name]={'bounds_three':{'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]},'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)}
    if asset.name.startswith('discovery_'):assert max(abs(lo[0]),abs(hi[0]),abs(lo[1]),abs(hi[1]))<.83
bpy.ops.object.select_all(action='DESELECT')
for asset in roots:
    asset.select_set(True)
    for o in asset.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'living-kit.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)
metadata['total_triangles']=sum(a['triangles'] for a in metadata['assets'].values());metadata['glb_bytes']=(OUT/'living-kit.glb').stat().st_size
(OUT/'living-kit.json').write_text(json.dumps(metadata,indent=2)+'\n')
for i,asset in enumerate(roots):
    asset.location=((i%4-1.5)*2.6,((math.ceil(len(roots)/4)-1)/2-i//4)*2.5,0)
    if i>=8:asset.scale=(2,)*3
ROOT=None
bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.025));floor=bpy.context.object
mat=bpy.data.materials.new('Warm gallery paper');mat.diffuse_color=rgba('#c6ccb5');floor.data.materials.append(mat)
scene=bpy.context.scene;scene.world.color=(.5,.5,.5)
for pos,energy,size in [((-5,-6,12),1900,8),((5,3,8),1200,6)]:
    light=bpy.data.lights.new('Softbox','AREA');light.energy=energy;light.shape='DISK';light.size=size;o=bpy.data.objects.new('Softbox',light);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('Living gallery');o=bpy.data.objects.new('Living gallery',cam);bpy.context.collection.objects.link(o);o.location=(7,-15,17);o.rotation_euler=(Vector((0,0,.4))-o.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=17.3;scene.camera=o
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1850;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'living-art-contact.png')
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'living-kit.blend'))
if RENDER:bpy.ops.render.render(write_still=True)
print('WILDHAVEN_LIVING_READY',metadata['total_triangles'],metadata['glb_bytes'])
