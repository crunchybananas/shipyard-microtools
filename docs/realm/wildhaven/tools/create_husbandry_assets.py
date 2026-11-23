"""Original smallholding and surveying kit. Run in background Blender.
Shares the town kit's clay palette and mesh helpers; exports no external assets.
Animal head/leg pivots are retained for the browser's gentle feeding animation.
"""
from pathlib import Path
source = Path(__file__).with_name('create_town_assets.py').read_text()
exec(compile(source.split('# Wheat farm:')[0], __file__, 'exec'), globals())

def fence(height=.38):
    for x,y in [(-.73,-.7),(.73,-.7),(-.73,0),(.73,0),(-.73,.7),(.73,.7)]:
        cube('split oak post',(x,y,height/2),(.065,.065,height),'wood_light',.014)
    for x in [-.73,.73]:
        for z in [.14,.30]: cube('side fence rail',(x,0,z),(.045,1.45,.043),'wood',.008)
    for y in [-.7,.7]:
        for z in [.14,.30]: cube('end fence rail',(0,y,z),(1.48,.045,.043),'wood',.008)
    for x in [-.24,.24]: cube('hinged gate post',(x,-.71,.21),(.035,.04,.39),'wood_light',.008)
    beam('diagonal gate brace',(-.23,-.735,.14),(.23,-.735,.30),.018,'wood_light')

def pasture(up=False):
    root('pasture_upgrade' if up else 'pasture')
    cube('grazing meadow',(0,0,.025),(1.50,1.48,.05),'sage',.04);fence()
    # Rear shelter leaves most of the paddock open; wide doorway faces the herd.
    cube('shelter back',(0,.62,.40),(1.28,.07,.72),'wood',.018)
    for x in [-.60,.60]:cube('shelter side',(x,.44,.39),(.065,.42,.70),'wood_light',.015)
    roof(cy=.46,eave=.78,rise=.25,width=1.43,depth=.57,tint='teal' if up else 'roof')
    cube('fresh hay',(0,.48,.095),(1.05,.28,.10),'ochre',.02)
    cube('feeding trough',(.80,-.30,.20),(.17,.30,.22),'wood_dark',.02)
    cube('grain in trough',(.80,-.30,.317),(.13,.26,.025),'ochre',.006)
    cylinder('water tub',(-.80,-.30,.12),.085,.21,'wood',12)
    cylinder('water',(-.80,-.30,.231),.075,.008,'teal',12,0)
    if up:
        cube('raised winter store',(-.46,.46,.38),(.23,.28,.49),'cream',.02)
        for x in [-.6,.6]:cube('stone shelter footing',(x,.42,.09),(.16,.53,.17),'stone',.025)
        beam('shelter brace',(-.58,.24,.40),(-.28,.24,.74),.033,'wood_dark')
        beam('shelter brace',(.58,.24,.40),(.28,.24,.74),.033,'wood_dark')
        for x in [-.38,-.08,.22]:ball('stored winter fodder',(x,.47,.20),(.13,.12,.15),'ochre',1)

def henhouse(up=False):
    root('henhouse_upgrade' if up else 'henhouse')
    cube('scratching yard',(0,0,.025),(1.50,1.48,.05),'soil',.04);fence(.34)
    for x in [-.51,.51]:
        for y in [.13,.62]:cube('coop stilts',(x,y,.25),(.08,.08,.5),'wood_dark',.014)
    cube('raised coop',(0,.37,.65),(1.12,.64,.70),'cream' if up else 'wood_light',.035)
    for x in [-.52,0,.52]:cube('coop batten',(x,.025,.65),(.035,.045,.67),'wood',.008)
    roof(cy=.37,eave=1.01,rise=.29,width=1.30,depth=.84,tint='teal')
    cube('little hen door',(0,.016,.54),(.23,.035,.34),'wood_dark',.012)
    ramp=cube('hen ladder',(0,-.23,.20),(.26,.51,.044),'wood',.006,rot=(.55,0,0))
    for i in range(5):cube('ladder rung',(0,-.43+i*.084,.075+i*.05),(.28,.035,.028),'wood_light',.004)
    cylinder('grain crock',(.50,-.45,.10),.10,.16,'roof',12)
    cylinder('crock feed',(.50,-.45,.186),.085,.014,'ochre',12,0)
    if up:
        cube('nesting boxes',(.58,.32,.54),(.30,.50,.32),'wood',.02)
        cube('nest box lid',(.60,.32,.72),(.34,.56,.055),'teal',.014,rot=(0,.15,0))
        cube('weather vane stem',(0,.37,1.43),(.025,.025,.25),'metal',.003)
        ball('weather vane bird',(.04,.37,1.56),(.13,.025,.065),'ochre',1)

def surveybench(restored=True):
    for x in [-.52,.52]:
        for y in [-.18,.38]:cube('bench leg',(x,y,.27),(.065,.065,.53),'wood',.009)
    cube('sampling bench',(0,.08,.55),(1.23,.70,.09),'wood_light',.022)
    for i in range(4):
        cube('sample compartment',(-.45+i*.30,.04,.62),(.25,.45,.065),'wood_dark',.008)
        ball('labelled ore sample',(-.45+i*.30,.08,.72),(.09,.13,.12),'purple' if i%2 else 'stone',1)
    if restored:
        cube('survey notebook',(-.37,-.18,.65),(.27,.18,.025),'light',.006)
        beam('measuring stick',(-.22,-.22,.69),(.49,-.22,.69),.013,'ochre',6)

def assay(up=False):
    root('assay_upgrade' if up else 'assay')
    cube('flagstone platform',(0,0,.045),(1.52,1.46,.09),'stone',.03)
    surveybench();awning(0,.19,1.25,1.40,1.01,('light','teal'))
    for x in [-.58,.58]:cube('canopy back post',(x,.63,.66),(.06,.06,1.25),'wood',.009)
    for x,y in [(0,-.56),(-.25,-.35),(.25,-.35)]:beam('survey tripod',(x,y,.07),(0,-.44,.75),.022,'wood_light')
    scope=cylinder('brass sight',(0,-.44,.80),.04,.35,'ochre',12);scope.rotation_euler.x=math.pi/2
    if up:
        cube('specimen drawers',(0,.53,.37),(.86,.24,.55),'wood_dark',.02)
        for z in [.22,.4,.56]:
            cube('drawer face',(0,.395,z),(.78,.03,.14),'wood_light',.01)
            ball('drawer pull',(0,.365,z),(.024,.015,.02),'ochre')
        cube('chart board',(.59,.14,.85),(.06,.48,.51),'wood',.008)
        cube('chart paper',(.553,.14,.85),(.016,.41,.43),'light',.002)

def pivot(name,pos,parent):
    ob=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(ob);ob.parent=parent;ob.location=pos;return ob

def goat():
    r=root('goat');ball('goat wool',(0,0,.23),(.105,.20,.115),'light',2)
    for x in [-.065,.065]:
        for y in [-.125,.125]:
            p=pivot('goat_leg', (x,y,.21),r)
            cube('goat shin',(0,0,-.087),(.035,.037,.175),'cream',.006,parent=p)
            cube('goat hoof',(0,-.009,-.171),(.044,.054,.033),'wood_dark',.005,parent=p)
    p=pivot('goat_head',(0,-.18,.30),r)
    ball('goat muzzle',(0,-.054,.012),(.069,.105,.081),'cream',2,parent=p)
    for x in [-.073,.073]:
        ball('goat ear',(x,-.02,.056),(.062,.026,.024),'wood_light',1,parent=p)
        ball('goat eye',(x*.73,-.079,.051),(.009,.009,.011),'ink',2,parent=p)
        beam('goat horn',(x*.52,.007,.073),(x*.67,.031,.141),.017,'stone_light',6,parent=p)
    ball('goat beard',(0,-.114,-.066),(.023,.024,.055),'light',1,parent=p)
    ball('goat tail',(0,.199,.289),(.029,.058,.032),'light',1)

def hen():
    r=root('hen');ball('hen feathers',(0,0,.123),(.075,.103,.079),'cream',2)
    for x in [-.033,.033]:
        p=pivot('hen_leg',(x,0,.073),r)
        beam('hen shank',(0,0,0),(0,0,-.049),.008,'ochre',5,parent=p)
        beam('hen foot',(0,0,-.047),(0,-.027,-.052),.010,'ochre',5,parent=p)
    p=pivot('hen_head',(0,-.071,.173),r)
    ball('hen head',(0,-.011,.029),(.043,.040,.050),'light',2,parent=p)
    ball('red comb',(0,-.009,.080),(.013,.031,.022),'red',1,parent=p)
    ball('beak',(0,-.058,.025),(.019,.032,.018),'ochre',1,parent=p)
    for x in [-.036,.036]:ball('hen eye',(x,-.025,.04),(.006,.007,.007),'ink',2,parent=p)
    for x in [-.055,.055]:ball('folded wing',(x,.012,.127),(.035,.065,.06),'wood_light',1)
    ball('tail feathers',(0,.090,.190),(.035,.048,.072),'wood',1)

for up in [False,True]:pasture(up);henhouse(up);assay(up)
goat();hen()
for restored in [False,True]:
    root('discovery_croft'+('_restored' if restored else ''))
    for x,y in [(-.6,0),(.6,0),(-.6,.55),(.6,.55)]:cube('old croft pier',(x,y,.3),(.20,.20,.58),'stone',.045)
    if restored:roof(cy=.27,eave=.66,rise=.31,width=1.50,depth=.97)
    else:
        for i in range(5):cube('fallen roof timber',(-.45+i*.21,.25,.12),(.09,.8,.08),'wood_dark',.012,rot=(0,0,(i-2)*.14))
    cube('old trough',(0,-.39,.17),(.83,.36,.32),'stone',.04)
    cube('trough lining',(0,-.39,.341),(.66,.23,.025),'teal' if restored else 'soil',.01)
    if restored:ball('bundle of hay',(.33,.3,.20),(.22,.21,.19),'ochre',1)
    root('discovery_survey'+('_restored' if restored else ''))
    surveybench(restored)
    for x in [-.5,.5]:beam('measuring frame',(x,.45,.03),(x,.45,1.2),.042,'wood')
    beam('measuring crosspiece',(-.6,.45,1.2),(.6,.45,1.2),.038,'wood_light')
    if restored:
        beam('plumb cord',(0,.45,1.17),(0,.45,.75),.008,'ink',5)
        ball('plumb bob',(0,.45,.72),(.045,.04,.07),'ochre',1)
    else:ball('lichen over sample',(.25,.08,.77),(.17,.13,.06),'sage',1)

root('cargo_milk')
cylinder('milk pail',(0,0,.085),.085,.17,'wood_light',12,bevel=.008)
cylinder('fresh milk',(0,0,.173),.073,.008,'light',12,0)
for z in [.025,.13]:torus('iron pail band',(0,0,z),.087,.008,'metal')
torus('pail handle',(0,0,.19),.083,.009,'metal',rot=(math.pi/2,0,0))
root('cargo_eggs')
cylinder('egg basket',(0,0,.035),.12,.07,'wood_light',12,bevel=.008)
for x in [-.06,0,.06]:
    for y in [-.037,.037]:ball('egg',(x,y,.085),(.026,.026,.036),'light',2)

# Join painted static parts by parent. Keep articulated head/leg pivots, but
# avoid one draw call per fence post, roof tile or animal facial feature.
for r in roots:
    groups=[o for o in r.children_recursive if o.type=='EMPTY']+[r]
    for parent in groups:
        pieces=[o for o in parent.children if o.type=='MESH']
        if len(pieces)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in pieces:o.select_set(True)
        bpy.context.view_layer.objects.active=pieces[0]
        bpy.ops.object.join();pieces[0].name=parent.name+'_painted_mesh'
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

bpy.ops.object.select_all(action='DESELECT')
for r in roots:
    r.select_set(True)
    for child in r.children_recursive:child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'husbandry-kit.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)
metadata={'source':'tools/create_husbandry_assets.py','assets':{}}
for r in roots:
    verts=[v for o in r.children_recursive if o.type=='MESH' for v in o.data.vertices]
    metadata['assets'][r.name]={'vertices':len(verts),'meshes':sum(o.type=='MESH' for o in r.children_recursive)}
(OUT/'husbandry-kit.json').write_text(json.dumps(metadata,indent=2)+'\n')
# Keep editable source in an arranged contact sheet, independently of GLB origins.
for i,r in enumerate(roots):r.location=((i%4-1.5)*2.4,(i//4-1)*2.7,0)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.08))
floor=bpy.context.object;mat=bpy.data.materials.new('sage backdrop');mat.diffuse_color=rgba('#b4bf9e');floor.data.materials.append(mat)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.79,.88,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7
light=bpy.data.lights.new('large softbox','AREA');light.energy=1800;light.size=8
ob=bpy.data.objects.new('large softbox',light);bpy.context.collection.objects.link(ob);ob.location=(-4,-5,10)
ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('gallery camera');cam=bpy.data.objects.new('gallery camera',camdata);bpy.context.collection.objects.link(cam)
cam.location=(7,-14,13);cam.rotation_euler=(Vector((0,0,.1))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=12
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.resolution_x=1700;scene.render.resolution_y=1300;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'husbandry-contact.png')
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'husbandry-kit.blend'))
if RENDER:bpy.ops.render.render(write_still=True)
print('HUSBANDRY_KIT_READY',json.dumps(metadata))
