import * as THREE from './vendor/three.module.js';

const canvas = document.querySelector('#scene');
const fallback = document.querySelector('#fallback');
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
if (!gl) {
  fallback.hidden = false;
  canvas.hidden = true;
  throw new Error('WebGL unavailable');
}
const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x96b7c8);
scene.fog = new THREE.Fog(0x96b7c8, 16, 38);
const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const pickables = [], leaves = [], curtains = [];
const v = (x,y,z) => new THREE.Vector3(x,y,z);
const home = { pos: v(9.7, 7.4, 13.8), look: v(0, 2.15, 0) };
let focus = null, desired = { pos: home.pos.clone(), look: home.look.clone() };

scene.add(new THREE.HemisphereLight(0xd7eaff, 0x56331c, 2.1));
const sun = new THREE.DirectionalLight(0xffd69b, 4.2); sun.position.set(-7, 12, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
const warm = new THREE.PointLight(0xffa94e, 18, 16, 2); warm.position.set(-3,5,2); scene.add(warm);

function mat(color, rough=.65, metal=0) { return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal}); }
const oak = mat(0x6d3516), oakLight = mat(0xa95b27), darkOak=mat(0x361609), paper=mat(0xfff0cf), brass=mat(0xbc7729,.35,.75), ink=mat(0x243247), cloth=mat(0xd3a564,.85);
function box(parent, size, pos, material) { const g = new THREE.BoxGeometry(...size); const m = new THREE.Mesh(g,material); m.position.copy(pos); m.castShadow=m.receiveShadow=true; parent.add(m); return m; }
function cyl(parent,r1,r2,h,pos,material,rot) { const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,16),material);m.position.copy(pos);if(rot)m.rotation.set(...rot);m.castShadow=m.receiveShadow=true;parent.add(m);return m; }
function textTexture(lines, opts={}) { const c=document.createElement('canvas'); c.width=opts.width||1024;c.height=opts.height||640;const x=c.getContext('2d'); x.fillStyle=opts.bg||'#f6e8c5';x.fillRect(0,0,c.width,c.height);if(opts.gradient){const g=x.createLinearGradient(0,0,c.width,c.height);g.addColorStop(0,'#184a7c');g.addColorStop(1,'#69a5d1');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);for(let i=0;i<7;i++){x.fillStyle='rgba(255,255,255,.18)';x.beginPath();x.arc(160+i*155,170+(i%2)*120,100,0,7);x.fill();}} x.fillStyle=opts.color||'#26384a'; x.textAlign='center';x.font=`${opts.big||64}px Arial`; lines.forEach((line,i)=>x.fillText(line,c.width/2,(opts.top||120)+i*(opts.gap||88)));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t; }
function plane(parent,w,h,pos,rotation,material) {const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);m.position.copy(pos);m.rotation.set(...rotation);parent.add(m);return m;}

const room = new THREE.Group(); scene.add(room);
box(room,[24,.3,18],v(0,-.35,0),mat(0x3e2b24));
box(room,[24,11,.25],v(0,5,-7),mat(0xe6c79d));
box(room,[.25,11,18],v(-10,5,0),mat(0xe6c79d));
const windowGroup=new THREE.Group(); room.add(windowGroup); windowGroup.position.set(-2.8,4.5,-6.82);
const sky=plane(windowGroup,8,5.3,v(0,0,0),[0,0,0],new THREE.MeshBasicMaterial({map:textTexture([], {width:900,height:600,gradient:true})}));
box(windowGroup,[8.5,.25,.28],v(0,2.8,.15),oakLight);box(windowGroup,[8.5,.25,.28],v(0,-2.8,.15),oakLight);box(windowGroup,[.25,5.8,.28],v(-4.1,0,.15),oakLight);box(windowGroup,[.25,5.8,.28],v(4.1,0,.15),oakLight);box(windowGroup,[.15,5.3,.2],v(0,0,.22),oakLight);box(windowGroup,[8,.15,.2],v(0,0,.22),oakLight);
const openPane=new THREE.Group();windowGroup.add(openPane);openPane.position.set(0,0,.3);openPane.rotation.y=-.42;box(openPane,[3.8,.15,.13],v(2,2.5,0),oakLight);box(openPane,[3.8,.15,.13],v(2,-2.5,0),oakLight);box(openPane,[.15,5,.13],v(.15,0,0),oakLight);box(openPane,[.15,5,.13],v(3.85,0,0),oakLight);
for(let i=0;i<7;i++){const bird=new THREE.Group();windowGroup.add(bird);bird.position.set(-3+i,1.3+(i%3)*.65,-.2);const wing=new THREE.Mesh(new THREE.ConeGeometry(.2,.75,3),mat(0x26313a));wing.rotation.z=Math.PI/2;bird.add(wing);const wing2=wing.clone();wing2.rotation.z=-Math.PI/2;bird.add(wing2);bird.userData.phase=i;}
for(const side of [-1,1]){const c=new THREE.Mesh(new THREE.PlaneGeometry(2.2,5.8,12,12),cloth);c.position.set(side*4.7,4.5,-6.48);c.rotation.y=side*.15;scene.add(c);curtains.push(c);}
const table=new THREE.Group();scene.add(table);table.position.y=1.75;box(table,[13.5,.55,7.6],v(0,0,0),oakLight,.14);box(table,[12.7,.12,6.8],v(0,.33,0),mat(0xc77a35));
for(const x of [-5.8,5.8])for(const z of [-2.9,2.9]){cyl(table,.32,.48,3.7,v(x,-2,z),oak,[0,0,0]);cyl(table,.58,.58,.18,v(x,-3.8,z),brass);}
for(let i=-5;i<=5;i+=2){const decor=cyl(table,.15,.15,.12,v(i,.38,-3.75),brass);decor.rotation.x=Math.PI/2;}
function makeNotebook(){const g=new THREE.Group();g.position.set(-.6,2.25,1.25);g.rotation.x=-.08;box(g,[4.2,.16,3.1],v(0,0,0),mat(0x4b2e26));box(g,[4,.09,2.9],v(0,.12,0),paper);const page=textTexture(['ОСЕННИЕ ЗАМЕТКИ','────────────','Кофе, планы, тёплый свет','и шорох листьев за окном.'],{width:900,height:650,big:42,top:120,gap:105});plane(g,3.78,2.65,v(0,.175,0),[-Math.PI/2,0,0],new THREE.MeshBasicMaterial({map:page}));for(let i=-1.5;i<1.7;i+=.38)cyl(g,.045,.045,.2,v(i,.2,1.51),brass,[Math.PI/2,0,0]);return g;} const notebook=makeNotebook();scene.add(notebook);
function makeLaptop(){const g=new THREE.Group();g.position.set(4.2,2.3,.25);g.rotation.y=-.28;box(g,[3.8,.17,2.55],v(0,0,0),mat(0x20242b,.25,.65),.1);const screen=new THREE.Group();g.add(screen);screen.position.set(0,1.65,-1.12);screen.rotation.x=-.16;box(screen,[3.8,2.55,.16],v(0,0,0),mat(0x15191e,.2,.5),.08);const lock=textTexture(['09:41','Среда, 1 октября','', 'Введите пароль'],{width:900,height:600,gradient:true,big:110,top:180,gap:85,color:'#fff'});plane(screen,3.48,2.23,v(0,0,.09),[0,0,0],new THREE.MeshBasicMaterial({map:lock}));return g;}const laptop=makeLaptop();scene.add(laptop);
function makeCalendar(){const g=new THREE.Group();g.position.set(-4.55,2.55,.7);g.rotation.y=.23;box(g,[2.35,2.3,.24],v(0,0,0),oak);const cal=textTexture(['ОКТЯБРЬ','01','СРЕДА','Ранняя осень'],{width:700,height:700,big:72,top:100,gap:122,color:'#9e2d20'});plane(g,1.92,1.86,v(0,0,.14),[0,0,0],new THREE.MeshBasicMaterial({map:cal}));for(const x of [-.62,.62])cyl(g,.07,.07,.2,v(x,1.02,.18),brass,[Math.PI/2,0,0]);return g;}const calendar=makeCalendar();scene.add(calendar);
const mug=new THREE.Group();scene.add(mug);mug.position.set(1.9,2.6,-1.9);cyl(mug,.55,.48,.85,v(0,0,0),mat(0xc9ddd5),[0,0,0]);const handle=new THREE.Mesh(new THREE.TorusGeometry(.3,.08,10,20,Math.PI),mat(0xc9ddd5));handle.position.set(.52,.05,0);handle.rotation.y=Math.PI/2;mug.add(handle);
for(let i=0;i<18;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.13,7,5),mat([0xb84120,0xd27824,0x8c321d][i%3]));leaf.scale.set(1.4,.2,.75);leaf.position.set(-5+Math.random()*10,4+Math.random()*7,-4+Math.random()*5);leaf.rotation.set(Math.random(),Math.random(),Math.random());scene.add(leaf);leaves.push(leaf);}

const targets={window:{object:windowGroup,pos:v(-2.3,5.0,2.4),look:v(-2.4,4.3,-6.4)},laptop:{object:laptop,pos:v(5.5,4.8,5.5),look:v(4.15,3.25,.1)},notebook:{object:notebook,pos:v(.1,5.5,7.2),look:v(-.6,2.35,1.2)},calendar:{object:calendar,pos:v(-5.1,4.45,5.0),look:v(-4.5,3.2,.65)}};
for(const [name,t] of Object.entries(targets)){t.object.traverse(o=>{if(o.isMesh){o.userData.target=name;pickables.push(o);}});}
function focusTarget(name){if(focus===name){focus=null;desired={pos:home.pos.clone(),look:home.look.clone()};return;}focus=name;desired={pos:targets[name].pos.clone(),look:targets[name].look.clone()};}
function reset(){if(focus)focusTarget(focus);}
function onPick(event){const r=canvas.getBoundingClientRect();pointer.set(((event.clientX-r.left)/r.width)*2-1,-((event.clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickables,false)[0];hit?focusTarget(hit.object.userData.target):reset();}
canvas.addEventListener('pointerup',e=>{if(e.pointerType==='touch'||Math.abs(e.movementX||0)<8)onPick(e)});window.addEventListener('keydown',e=>{if(e.key==='Escape')reset()});
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<650?52:42;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
camera.position.copy(home.pos);const currentLook=home.look.clone();
function animate(){requestAnimationFrame(animate);const delta=clock.getDelta(),t=clock.getElapsedTime(), damp=1-Math.exp(-delta*3.5);camera.position.lerp(desired.pos,damp);currentLook.lerp(desired.look,damp);camera.lookAt(currentLook);curtains.forEach((c,i)=>{const p=c.geometry.attributes.position;for(let j=0;j<p.count;j++)p.setZ(j,Math.sin(t*1.5+p.getY(j)*1.4+i)*.14);p.needsUpdate=true;});leaves.forEach((leaf,i)=>{leaf.position.y-=.012+(i%4)*.003;leaf.position.x+=Math.sin(t+i)*.006;leaf.rotation.x+=.015;leaf.rotation.z+=.01;if(leaf.position.y<1.8)leaf.position.set(-5+Math.random()*10,9+Math.random()*4,-4+Math.random()*5);});windowGroup.children.forEach(o=>{if(o.userData.phase!==undefined)o.position.y+=Math.sin(t*3+o.userData.phase)*.002;});renderer.render(scene,camera);}animate();
