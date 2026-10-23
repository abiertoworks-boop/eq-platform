/* =========================================================
   EQ Platform Ver2.0 — holo.js
   MAP① 成長・実践の全体構造：6つの学びの場のホログラム（Three.js r128 + OrbitControls）
   ・円周上に6つのノード。縦のライン＝縦成長、横のリング＝横成長。全体が円柱状の格子でつながる
   ・高さ＝縦成長の深さ（EQ Gate がいちばん下の入口、EIA の先に EQ Humanity）
   ・中段のリング＝EQTM（すべての学びの場を横断して実践する）
   ・発光は加算合成のグローで出す（ページの背景を透かしたまま光らせるため、ブルームの後処理は使わない）
   ・走査線は CSS の重ね（.holo::after）
   ・ドラッグ／スワイプで回転、ホバーでノードが光って拡大、クリックでその説明へ
   ・何も触っていない間は、ノードを順番に照らして、つながりを案内する
   ========================================================= */
(() => {
  'use strict';
  const root = document.getElementById('holo');
  if (!root || !window.THREE) return;
  const THREE = window.THREE;

  const canvas = root.querySelector('.holo__canvas');
  const labelsEl = root.querySelector('.holo__labels');
  const infoK = root.querySelector('.holo__info-k');
  const infoName = root.querySelector('.holo__info-name');
  const infoDesc = root.querySelector('.holo__info-desc');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 色：サイアンブルー基調、縦成長はアンバー、EQTM は青緑 ---------- */
  const CYAN = new THREE.Color('#5ff6ff');
  const AMBER = new THREE.Color('#ffb547');
  const TEAL = new THREE.Color('#4dffcf');
  const COLOR = { yoko: CYAN, tate: AMBER, entry: CYAN, tm: TEAL, biz: AMBER };

  /* ---------- 6つの学びの場（角度は60度ずつ。高さ＝縦成長の深さ） ---------- */
  const R = 2.6, LOW = -1.25, MID = 0, TOP = 1.25;
  const NODES = [
    { id: 'skills', name: 'EQ Skills', role: '横成長', deg: 30, y: MID, c: CYAN, href: '#stage-3',
      desc: '自分と関わる力・他者と関わる力を、スキルとして身につける。横成長のリングを広げていきます。' },
    { id: 'gate', name: 'EQ Gate', role: '入口', deg: 90, y: LOW, c: AMBER, href: '#stage-1',
      desc: 'EQとの出会いの入口。ここから、EQ Skills・EIAへつながります。' },
    { id: 'eia', name: 'EIA', role: '縦成長', deg: 150, y: -0.35, c: CYAN, href: '#stage-2',
      desc: '自分を知り、整え、選び直せる力を育てる。縦成長の土台として、EQ Humanityへ伸びていきます。' },
    { id: 'humanity', name: 'EQ Humanity', role: '専門人材育成', deg: 210, y: TOP, c: CYAN, href: '#stage-4',
      desc: 'EIAで育てた力を土台に、組織No.2・EQプロへ。自分の成長を、人と組織の成長へ。' },
    { id: 'nexus', name: 'EQ Business Nexus', role: 'ビジネス活用', deg: 270, y: 0.45, c: AMBER, href: '#nexus',
      desc: 'ビジネス専門領域・独立した入口。EQ認識理論などを、経営・事業・組織づくりへ活かします。' },
    { id: 'eqtm', name: 'EQTM', role: '横断的な実践', deg: 330, y: MID, c: TEAL, href: '#stage-5',
      desc: '中段のリングが、すべての学びの場を横断する実践の輪。学びながら、EQを高め、使い続けます。' },
  ];
  const byId = {};
  NODES.forEach((n, i) => { n.i = i; n.a = THREE.MathUtils.degToRad(n.deg); byId[n.id] = n; });

  // つながり（type で色と意味が決まる）
  const LINKS = [
    { a: 'gate', b: 'skills', type: 'entry' },
    { a: 'gate', b: 'eia', type: 'entry' },
    { a: 'skills', b: 'eia', type: 'yoko', far: true },
    { a: 'eia', b: 'humanity', type: 'tate' },
    { a: 'skills', b: 'eqtm', type: 'tm' },
    { a: 'nexus', b: 'eqtm', type: 'biz' },
    { a: 'nexus', b: 'eia', type: 'biz', far: true },
  ];

  /* ---------- renderer / scene / camera ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 2.4, 9.2);
  const world = new THREE.Group();
  scene.add(world);

  const add = (o) => { world.add(o); return o; };
  const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const lineMat = (color, opacity) => new THREE.LineBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const onCyl = (a, y, r = R) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  function circle(r, y, seg, color, opacity) {
    const pts = [];
    for (let i = 0; i <= seg; i++) { const t = (i / seg) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r)); }
    return add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color, opacity)));
  }

  // 光の粒・グローに使う、ぼかした丸のテクスチャ
  const dot = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,.75)');
    grd.addColorStop(0.45, 'rgba(255,255,255,.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); return t;
  })();
  const halo = (color, size, opacity) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1); return s;
  };

  /* ---------- 投影装置（トライコム・バッジ）と光の円錐 ---------- */
  const BASE = LOW - 0.55;
  [0.35, 0.62, 0.9].forEach((r, i) => circle(r, BASE, 96, CYAN, 0.55 - i * 0.12));
  const ticks = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2, r0 = 1.0, r1 = i % 4 ? 1.08 : 1.2;
    ticks.push(new THREE.Vector3(Math.cos(t) * r0, BASE, Math.sin(t) * r0), new THREE.Vector3(Math.cos(t) * r1, BASE, Math.sin(t) * r1));
  }
  const tickRing = add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), lineMat(CYAN, 0.45)));
  const emitter = add(halo(CYAN, 1.6, 0.55)); emitter.position.set(0, BASE, 0);
  const cone = add(new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.02, 0.5, TOP - BASE + 0.4, 48, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: CYAN }, uTime: { value: 0 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying float vY; void main(){ float a = (1.0 - vY) * 0.07 + 0.01; a *= 0.85 + 0.15 * sin(vY * 60.0 - uTime * 3.0); gl_FragColor = vec4(uColor, a); }',
    }),
  ));
  cone.position.y = (TOP + 0.4 + BASE) / 2;

  /* ---------- 中心軸と EQ認識理論のコア ---------- */
  add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, BASE, 0), new THREE.Vector3(0, TOP + 0.6, 0)]), lineMat(CYAN, 0.5)));
  const core = add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.42, 1)), lineMat(CYAN, 0.55)));
  const coreGlow = add(halo(CYAN, 1.5, 0.35));

  /* ---------- 円柱状の格子：横のリング（3段）と縦のライン（12本） ---------- */
  const rings = { low: circle(R, LOW, 160, CYAN, 0.22), top: circle(R, TOP, 160, CYAN, 0.22) };
  // 中段は EQTM のリング（太く見せるため、チューブ＋外側のぼかし）
  const ringCurve = new THREE.CatmullRomCurve3(Array.from({ length: 64 }, (_, i) => onCyl((i / 64) * Math.PI * 2, MID)), true);
  const tmRing = add(new THREE.Mesh(new THREE.TubeGeometry(ringCurve, 256, 0.012, 6, true), glowMat(TEAL, 0.8)));
  const tmRingGlow = add(new THREE.Mesh(new THREE.TubeGeometry(ringCurve, 256, 0.05, 8, true), glowMat(TEAL, 0.12)));
  const meridians = [];
  for (let i = 0; i < 12; i++) {
    const a = THREE.MathUtils.degToRad(30 + i * 30);
    const isNode = i % 2 === 0;
    const l = add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([onCyl(a, LOW - 0.2), onCyl(a, TOP + 0.2)]),
      lineMat(isNode ? AMBER : CYAN, isNode ? 0.34 : 0.12),
    ));
    l.userData.base = isNode ? 0.34 : 0.12;
    meridians.push(l);
  }
  // 中心から各ノードの縦のラインへ伸びる、かすかな放射線
  NODES.forEach((n) => {
    add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, n.y, 0), onCyl(n.a, n.y)]), lineMat(CYAN, 0.08)));
  });

  /* ---------- ノード：フレネルの球（縁が光る）＋芯＋グロー＋回る輪 ---------- */
  const fresnel = (color) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: color }, uPower: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uPower; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.0); gl_FragColor = vec4(uColor, (f * 1.15 + 0.06) * uPower); }',
  });
  const pickables = [];
  NODES.forEach((n) => {
    const g = new THREE.Group();
    g.position.copy(onCyl(n.a, n.y));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 28), fresnel(n.c));
    const coreDot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const glow = halo(n.c, 1.5, 0.45);
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => { const t = (i / 64) * Math.PI * 2; return new THREE.Vector3(Math.cos(t) * 0.46, Math.sin(t) * 0.46, 0); })),
      lineMat(n.c, 0.6),
    );
    // 当たり判定は見た目より少し大きく
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.node = n;
    g.add(shell, coreDot, glow, orbit, hit);
    add(g);
    pickables.push(hit);
    Object.assign(n, { g, shell, glow, orbit, scale: 1, heat: 0 });
  });

  /* ---------- つながり：円柱に沿って外へふくらむ光の線と、その上を流れる光 ---------- */
  function linkCurve(A, B, far) {
    let d = B.a - A.a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, bump = Math.sin(Math.PI * t);
      pts.push(onCyl(A.a + d * t, A.y + (B.y - A.y) * t + bump * 0.18, R + bump * (far ? 0.9 : 0.45)));
    }
    return new THREE.CatmullRomCurve3(pts);
  }
  const links = LINKS.map((L) => {
    const A = byId[L.a], B = byId[L.b], color = COLOR[L.type];
    const curve = linkCurve(A, B, L.far);
    const strong = L.type === 'tate';
    const tube = add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, strong ? 0.016 : 0.009, 6, false), glowMat(color, 0.7)));
    const glow = add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, strong ? 0.07 : 0.04, 8, false), glowMat(color, strong ? 0.16 : 0.08)));
    const pulses = [0, 0.5].map((o) => { const p = add(halo(color, strong ? 0.42 : 0.3, 0.9)); p.userData.o = o; return p; });
    return { ...L, A, B, curve, tube, glow, pulses, base: { tube: 0.7, glow: strong ? 0.16 : 0.08 } };
  });
  // 縦成長の矢印：EIA から EQ Humanity へ昇る光の帯
  const tateLink = links.find((l) => l.type === 'tate');

  /* ---------- 漂う光の粒子（それぞれの位相でかすかに明滅） ---------- */
  const PN = 700;
  const pPos = new Float32Array(PN * 3), pPhase = new Float32Array(PN), pSize = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    const r = Math.sqrt(Math.random()) * 5.2, t = Math.random() * Math.PI * 2;
    pPos[i * 3] = Math.cos(t) * r; pPos[i * 3 + 1] = BASE + Math.random() * 3.6; pPos[i * 3 + 2] = Math.sin(t) * r;
    pPhase[i] = Math.random() * Math.PI * 2; pSize[i] = 0.6 + Math.random() * 1.6;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPhase, 1));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uTex: { value: dot }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: 'attribute float aPhase; attribute float aSize; uniform float uTime; uniform float uPx; varying float vA; void main(){ vec3 p = position; p.y += sin(uTime * 0.3 + aPhase) * 0.12; vec4 mv = modelViewMatrix * vec4(p,1.0); vA = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * 1.6 + aPhase * 3.0), 3.0); gl_PointSize = aSize * uPx * (14.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D uTex; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vec3(0.6, 0.97, 1.0), t.a * vA * 0.8); }',
  });
  add(new THREE.Points(pGeo, pMat));

  /* ---------- ラベル（HTML。日本語をくっきり見せるため） ---------- */
  NODES.forEach((n) => {
    const el = document.createElement('div');
    el.className = 'holo__label';
    el.style.setProperty('--lc', '#' + n.c.getHexString());
    el.innerHTML = `<small>${n.role}</small><b>${n.name}</b>`;
    labelsEl.appendChild(el);
    n.label = el;
  });
  const coreLabel = document.createElement('div');
  coreLabel.className = 'holo__label holo__label--core';
  coreLabel.innerHTML = '<small>土台</small><b>EQ認識理論</b>';
  labelsEl.appendChild(coreLabel);

  /* ---------- 回転（OrbitControls） ---------- */
  let controls = null;
  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, canvas);
    Object.assign(controls, {
      enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.07, rotateSpeed: 0.75,
      autoRotate: !reduceMotion, autoRotateSpeed: 0.55, minPolarAngle: 0.12, maxPolarAngle: Math.PI - 0.12,
    });
    controls.target.set(0, 0, 0);
    let idle = 0;
    controls.addEventListener('start', () => { clearTimeout(idle); controls.autoRotate = false; root.classList.add('is-touched'); });
    controls.addEventListener('end', () => { clearTimeout(idle); idle = setTimeout(() => { controls.autoRotate = !reduceMotion; }, 4000); });
  }

  /* ---------- ホバーとクリック ---------- */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2(9, 9);
  let hover = null, focus = null, downAt = null;
  const rectOf = () => canvas.getBoundingClientRect();
  canvas.addEventListener('pointermove', (e) => {
    const r = rectOf();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  canvas.addEventListener('pointerleave', () => { ptr.set(9, 9); });
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    const r = rectOf();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const n = pick();
    if (!n) return;
    // タッチはまず照らすだけ。同じノードをもう一度タップしたら移動する
    if (e.pointerType !== 'mouse' && focus !== n) { setFocus(n, true); return; }
    const a = root.querySelector(`.holo__a11y a[href="${n.href}"]`);
    if (a) a.click();
  });
  function pick() {
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.node : null;
  }

  // 照らすノードと、そのつながり
  let pinned = false, tourAt = 0, tourI = 0;
  function setFocus(n, pin) {
    pinned = !!pin;
    if (focus === n) return;
    focus = n;
    if (n) {
      const names = links.filter((l) => l.A === n || l.B === n).map((l) => (l.A === n ? l.B : l.A).name);
      if (n.id === 'eqtm') names.splice(0, names.length, 'すべての学びの場');
      infoK.textContent = n.role;
      infoName.textContent = n.name;
      infoDesc.textContent = n.desc + (names.length ? `　つながり：${names.join('・')}` : '');
    }
  }

  /* ---------- サイズ ---------- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 縦長の画面では少し引いて、6つ全部が入るように
    const d = camera.aspect < 0.9 ? 13.2 : camera.aspect < 1.3 ? 11.4 : 10.4;
    camera.position.setLength(d);
    camera.updateProjectionMatrix();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();

  /* ---------- 描画（画面に見えている間だけ） ---------- */
  let running = false, raf = 0;
  const clock = new THREE.Clock();
  const v = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const lerp = THREE.MathUtils.lerp;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (controls) controls.update();

    // ホバー判定。触れていない間は、順番にノードを照らす（つながりの案内）
    const hit = ptr.x < 2 ? pick() : null;
    if (hit !== hover) { hover = hit; root.classList.toggle('is-pointing', !!hit); }
    if (hover) setFocus(hover, false);
    else if (!pinned && !reduceMotion && t - tourAt > 3.2) { tourAt = t; setFocus(NODES[tourI++ % NODES.length], false); }

    // ノード：照らされたものは光が強くなり、少し大きく
    NODES.forEach((n) => {
      const on = n === focus ? (hover === n ? 1 : 0.7) : 0;
      n.heat = lerp(n.heat, on, 1 - Math.pow(0.001, dt));
      const s = 1 + n.heat * 0.38 + Math.sin(t * 2 + n.i) * 0.02;
      n.g.scale.setScalar(s);
      n.shell.material.uniforms.uPower.value = 0.85 + n.heat * 1.1;
      n.glow.material.opacity = 0.4 + n.heat * 0.5;
      n.glow.scale.setScalar(1.5 + n.heat * 1.1);
      n.orbit.quaternion.copy(camera.quaternion);
      n.orbit.rotateX(1.1); n.orbit.rotateZ(t * 0.6 + n.i);
      n.orbit.material.opacity = 0.35 + n.heat * 0.6;
    });

    // つながり：照らされたノードに関わる線だけ明るく、光の粒が流れる速さも上がる
    links.forEach((l) => {
      const rel = focus && (l.A === focus || l.B === focus || (focus.id === 'eqtm' && l.type === 'tm'));
      const k = focus ? (rel ? 1.6 : 0.35) : 1;
      l.tube.material.opacity = lerp(l.tube.material.opacity, l.base.tube * k, 0.12);
      l.glow.material.opacity = lerp(l.glow.material.opacity, l.base.glow * k, 0.12);
      l.pulses.forEach((p) => {
        const u = (t * (rel ? 0.42 : 0.2) + p.userData.o) % 1;
        p.position.copy(l.curve.getPointAt(u));
        p.material.opacity = (rel || !focus ? 0.9 : 0.25) * Math.sin(Math.PI * u);
      });
    });
    // EQTM を照らしたときは、中段のリングと縦のラインがすべて光る
    const tmOn = focus && focus.id === 'eqtm' ? 1 : 0;
    tmRing.material.opacity = lerp(tmRing.material.opacity, 0.55 + tmOn * 0.45, 0.1);
    tmRingGlow.material.opacity = lerp(tmRingGlow.material.opacity, 0.1 + tmOn * 0.22, 0.1);
    const tateOn = focus && (focus.id === 'eia' || focus.id === 'humanity') ? 1 : 0;
    meridians.forEach((m, i) => {
      const own = i % 2 === 0 && focus && NODES[i / 2] === focus;
      m.material.opacity = lerp(m.material.opacity, m.userData.base * (1 + tmOn * 1.4 + (own ? 1.6 : 0)), 0.1);
    });
    tateLink.glow.material.opacity = Math.max(tateLink.glow.material.opacity, 0.12 + tateOn * 0.2 + Math.sin(t * 3) * 0.03);

    // 投影装置・コア・粒子
    core.rotation.y = t * 0.35; core.rotation.x = t * 0.18;
    coreGlow.material.opacity = 0.3 + Math.sin(t * 1.7) * 0.08;
    tickRing.rotation.y = -t * 0.15;
    emitter.material.opacity = 0.45 + Math.sin(t * 2.3) * 0.1;
    cone.material.uniforms.uTime.value = t;
    pMat.uniforms.uTime.value = t;
    rings.low.material.opacity = rings.top.material.opacity = 0.2 + Math.sin(t * 1.3) * 0.04;

    renderer.render(scene, camera);

    // ラベルをノードの位置へ。奥にあるものは薄く
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const place = (el, pos, lift, below) => {
      v.copy(pos); v.y += lift; v.project(camera);
      tmp.copy(pos).applyMatrix4(camera.matrixWorldInverse);
      const depth = THREE.MathUtils.clamp((-tmp.z - (camera.position.length() - R)) / (2 * R), 0, 1);
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px,${(-v.y * 0.5 + 0.5) * h}px) translate(-50%,${below ? '0' : '-100%'})`;
      el.style.opacity = (1 - depth * 0.72).toFixed(2);
      el.style.zIndex = String(100 - Math.round(depth * 50));
    };
    NODES.forEach((n) => {
      n.g.getWorldPosition(tmp);
      place(n.label, tmp.clone(), 0.4 + n.heat * 0.16);
      n.label.classList.toggle('is-on', n === focus);
    });
    place(coreLabel, new THREE.Vector3(0, 0, 0), -0.5, true);
  }
  function start() { if (running) return; running = true; clock.getDelta(); frame(); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())), { rootMargin: '120px' }).observe(root);
  } else start();
  if (reduceMotion) setFocus(byId.eia, true);
})();
