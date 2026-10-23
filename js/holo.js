/* =========================================================
   EQ Platform Ver2.0 — holo.js
   MAP 全体マップ：6つの学びの場のホログラム（Three.js r128 + OrbitControls）
   ・縦成長：EIA の真上に EQ Humanity。1本の縦の光でつながり、その先に「組織No.2育成」「EQプロ育成」が枝分かれする
   ・横成長：EQ Skills のまわりに、横へ広がる光の弧
   ・EQTM：中段のリング。EQ Skills・EIA を通り、EQ Humanity・Nexus へも伸びる（すべてを横断する実践）
   ・EQ Business Nexus：円柱の外にある独立した入口。「組織No.2育成」と強くつながり、EIA へも細くつながる
   ・EQ Gate：いちばん下の入口。EQ Skills・EIA へつながる
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
  const infoLinksWrap = root.querySelector('.holo__info-links');
  const infoLinks = infoLinksWrap.querySelector('ul');
  const LINK_NAME = { tate: '縦成長', branch: '育成', entry: '入口', tm: '実践', biz: 'ビジネス' };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 色：意味ごとに分ける。縦成長＝アンバー、横成長＝サイアン、EQTM＝グリーン、Nexus＝ピンク、入口＝バイオレット。骨組みは目立たない青灰 ---------- */
  const CYAN = new THREE.Color('#5ff6ff');
  const AMBER = new THREE.Color('#ffb547');
  const GREEN = new THREE.Color('#5dff9e');
  const VIOLET = new THREE.Color('#b9a2ff');
  const AMBER2 = new THREE.Color('#ffd98a');
  const FRAME = new THREE.Color('#6f93b8');
  const CORE = new THREE.Color('#d8f0ff'); // EQ認識理論（すべての土台）
  const PINK = new THREE.Color('#ff7eb9');
  const COLOR = { tate: AMBER, branch: AMBER2, entry: VIOLET, tm: GREEN, biz: PINK };

  /* ---------- 学びの場（deg＝円周上の角度、y＝高さ、r＝中心からの距離。sub＝EQ Humanity の中の育成） ---------- */
  const R = 2.6, LOW = -1.25, MID = 0, TOP = 1.35;
  const NODES = [
    { id: 'gate', name: 'EQ Gate', role: 'はじめの入口', deg: 90, y: LOW, c: VIOLET, href: '#stage-1',
      desc: 'EQとの出会いの入口。無料のコンテンツから、EQ Skills・EIAへつながります。' },
    { id: 'skills', name: 'EQ Skills', role: '横成長', deg: 30, y: MID, c: CYAN, href: '#stage-3',
      desc: '感情を手がかりに、自分と関わる力・他者と関わる力を、スキルとして身につける。できること・関われる力を、横へ広げる成長です。' },
    { id: 'eia', name: 'EIA', role: '縦成長の土台', deg: 150, y: MID, c: AMBER, href: '#stage-2',
      desc: '自分を知り、整え、選び直せる力を育てる。自己理解・自己受容・あり方・判断軸・行動変容を通して、メタ認知力を育てる領域です。' },
    { id: 'humanity', name: 'EQ Humanity', role: '縦成長・専門人材育成', deg: 150, y: TOP, c: AMBER, href: '#stage-4',
      desc: 'EIAで育てたメタ認知力・あり方・判断力を土台に、他者・組織・社会へ良い影響を与える人材を育てる領域です。' },
    { id: 'no2', name: '組織No.2育成', role: 'EQ Humanity', deg: 118, y: TOP + 0.62, c: AMBER2, href: '#stage-4', sub: true,
      desc: '人と組織の成長を支える人材を育てる。EQ Business Nexusとつながり、経営者の右腕として、組織の中で力を発揮します。' },
    { id: 'pro', name: 'EQプロ育成', role: 'EQ Humanity', deg: 182, y: TOP + 0.62, c: AMBER2, href: '#stage-4', sub: true,
      desc: 'EQを活用して、人を育てる専門人材を育てる。' },
    { id: 'eqtm', name: 'EQTM', role: 'すべてを横断する実践', deg: 270, y: MID, c: GREEN, href: '#stage-5',
      desc: 'EQ Total Management。EQを高め、伸ばし、人生・仕事・人間関係・組織の中で実践・活用するPlatform。中段のリングが、すべての学びの場を横断します。' },
    { id: 'nexus', name: 'EQ Business Nexus', role: 'ビジネスへの活用', deg: 345, y: TOP + 0.15, r: R + 1.7, c: PINK, href: '#nexus',
      desc: 'ビジネス専門領域・独立した入口。EQを活用したビジネスコンサルティングの提供と、そのスキルの習得。組織No.2育成と結びつき、経営・事業・組織づくりへ活かします。' },
  ];
  // スマホ：外側の Nexus と、上の2つの育成を内側へ寄せて、全体を大きく映せるようにする
  const COMPACT = window.matchMedia('(max-width:700px)').matches;
  if (COMPACT) {
    NODES.forEach((n) => {
      if (n.id === 'nexus') { n.r = R + 0.7; n.y = TOP + 0.3; }
      if (n.sub) n.y = TOP + 0.48;
    });
  }
  const byId = {};
  NODES.forEach((n, i) => { n.i = i; n.a = THREE.MathUtils.degToRad(n.deg); n.r = n.r || R; byId[n.id] = n; });

  // つながり（type で色と意味が決まる）
  const LINKS = [
    { a: 'eia', b: 'humanity', type: 'tate' },            // 縦成長：EIA の真上へ
    { a: 'humanity', b: 'no2', type: 'branch' },
    { a: 'humanity', b: 'pro', type: 'branch' },
    { a: 'gate', b: 'skills', type: 'entry' },
    { a: 'gate', b: 'eia', type: 'entry' },
    { a: 'eqtm', b: 'humanity', type: 'tm' },             // EQTM は EQ Humanity・Nexus でも実践する
    { a: 'eqtm', b: 'nexus', type: 'tm', far: true },
    { a: 'nexus', b: 'no2', type: 'biz', strong: true },  // 組織No.2育成 × EQ Business Nexus
    { a: 'nexus', b: 'eia', type: 'biz' },                // 経営者・企業は EIA からも
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
  [0.35, 0.62, 0.9].forEach((r, i) => circle(r, BASE, 96, FRAME, 0.55 - i * 0.12));
  const ticks = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2, r0 = 1.0, r1 = i % 4 ? 1.08 : 1.2;
    ticks.push(new THREE.Vector3(Math.cos(t) * r0, BASE, Math.sin(t) * r0), new THREE.Vector3(Math.cos(t) * r1, BASE, Math.sin(t) * r1));
  }
  const tickRing = add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), lineMat(FRAME, 0.5)));
  const emitter = add(halo(CORE, 1.6, 0.5)); emitter.position.set(0, BASE, 0);
  const cone = add(new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.02, 0.5, TOP - BASE + 0.4, 48, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: FRAME }, uTime: { value: 0 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying float vY; void main(){ float a = (1.0 - vY) * 0.07 + 0.01; a *= 0.85 + 0.15 * sin(vY * 60.0 - uTime * 3.0); gl_FragColor = vec4(uColor, a); }',
    }),
  ));
  cone.position.y = (TOP + 0.4 + BASE) / 2;

  /* ---------- 中心軸と EQ認識理論のコア ---------- */
  add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, BASE, 0), new THREE.Vector3(0, TOP + 0.6, 0)]), lineMat(CORE, 0.4)));
  const core = add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.42, 1)), lineMat(CORE, 0.6)));
  const coreGlow = add(halo(CORE, 1.5, 0.3));

  /* ---------- 円柱状の格子：横のリング（3段）と縦のライン（12本） ---------- */
  const rings = { low: circle(R, LOW, 160, FRAME, 0.16), top: circle(R, TOP, 160, FRAME, 0.16) };
  // 中段は EQTM のリング（太く見せるため、チューブ＋外側のぼかし）。EQ Skills と EIA はこの上にある
  const ringCurve = new THREE.CatmullRomCurve3(Array.from({ length: 64 }, (_, i) => onCyl((i / 64) * Math.PI * 2, MID)), true);
  const tmRing = add(new THREE.Mesh(new THREE.TubeGeometry(ringCurve, 256, 0.012, 6, true), glowMat(GREEN, 0.7)));
  const tmRingGlow = add(new THREE.Mesh(new THREE.TubeGeometry(ringCurve, 256, 0.05, 8, true), glowMat(GREEN, 0.1)));
  const meridians = [];
  for (let i = 0; i < 12; i++) {
    const a = THREE.MathUtils.degToRad(i * 30);
    const base = i % 2 ? 0.08 : 0.14;
    const l = add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([onCyl(a, LOW - 0.2), onCyl(a, TOP + 0.2)]), lineMat(FRAME, base)));
    l.userData.base = base;
    meridians.push(l);
  }

  /* ---------- ノード：フレネルの球（縁が光る）＋芯＋グロー＋回る輪 ---------- */
  const fresnel = (color) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: color }, uPower: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uPower; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.0); gl_FragColor = vec4(uColor, (f * 1.15 + 0.06) * uPower); }',
  });
  const pickables = [];
  NODES.forEach((n) => {
    const k = n.sub ? 0.55 : 1; // EQ Humanity の中の育成は小さく
    const g = new THREE.Group();
    g.position.copy(onCyl(n.a, n.y, n.r));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3 * k, 40, 28), fresnel(n.c));
    const coreDot = new THREE.Mesh(new THREE.SphereGeometry(0.09 * k, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const glow = halo(n.c, 1.5 * k, 0.45);
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => { const t = (i / 64) * Math.PI * 2; return new THREE.Vector3(Math.cos(t) * 0.46 * k, Math.sin(t) * 0.46 * k, 0); })),
      lineMat(n.c, 0.6),
    );
    // 当たり判定は見た目より少し大きく
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.5 * Math.max(k, 0.7), 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.node = n;
    g.add(shell, coreDot, glow, orbit, hit);
    add(g);
    pickables.push(hit);
    Object.assign(n, { g, shell, glow, orbit, k, heat: 0 });
  });

  /* ---------- つながり：円柱に沿って外へふくらむ光の線と、その上を流れる光 ---------- */
  function linkCurve(A, B, L) {
    let d = B.a - A.a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const out = L.type === 'tate' ? 0.12 : L.far ? 0.9 : 0.4;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, bump = Math.sin(Math.PI * t);
      pts.push(onCyl(A.a + d * t, A.y + (B.y - A.y) * t + (L.type === 'tate' ? 0 : bump * 0.2), A.r + (B.r - A.r) * t + bump * out));
    }
    return new THREE.CatmullRomCurve3(pts);
  }
  const links = LINKS.map((L) => {
    const A = byId[L.a], B = byId[L.b], color = COLOR[L.type];
    const curve = linkCurve(A, B, L);
    const strong = L.type === 'tate' || L.strong;
    const thin = L.type === 'branch';
    const r0 = strong ? 0.018 : thin ? 0.007 : 0.009;
    const tube = add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, r0, 6, false), glowMat(color, 0.7)));
    const glow = add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, strong ? 0.075 : 0.04, 8, false), glowMat(color, strong ? 0.18 : 0.08)));
    // 走る光：太い線は5つ、ほかは3つ。つながりの向きが分かるように、粒の後ろに小さな尾を付ける
    const count = strong ? 5 : 3;
    const pulses = Array.from({ length: count }, (_, i) => {
      const p = add(halo(color, strong ? 0.46 : 0.34, 0.9));
      p.userData.o = i / count;
      p.userData.tail = [0.025, 0.05].map((lag) => { const s = add(halo(color, (strong ? 0.3 : 0.22) * (1 - lag * 8), 0.5)); s.userData.lag = lag; return s; });
      return p;
    });
    return { ...L, A, B, curve, tube, glow, pulses, base: { tube: 0.7, glow: strong ? 0.18 : 0.08 } };
  });

  /* ---------- 横成長：EQ Skills から、水平に広がっていく光の波紋（できること・関われる力が横へ広がる） ---------- */
  const ripples = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), glowMat(CYAN, 0));
    m.material.side = THREE.DoubleSide;
    m.rotation.x = -Math.PI / 2;
    m.position.copy(byId.skills.g.position);
    m.userData.o = i / 3;
    return add(m);
  });

  /* ---------- EQTM のリングの上を回り続ける光（すべての学びの場を横断する実践） ---------- */
  const ringPulses = Array.from({ length: 6 }, (_, i) => { const p = add(halo(GREEN, 0.36, 0.9)); p.userData.o = i / 6; return p; });

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
    el.className = n.sub ? 'holo__label holo__label--sub' : 'holo__label';
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
    controls.target.set(0, 0.45, 0);
    let idle = 0;
    controls.addEventListener('start', () => { clearTimeout(idle); controls.autoRotate = false; root.classList.add('is-touched'); });
    controls.addEventListener('end', () => { clearTimeout(idle); idle = setTimeout(() => { controls.autoRotate = !reduceMotion && !zoomed; }, 4000); });
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
    const touch = e.pointerType !== 'mouse';
    // タッチ：何もない所をタップすると、全体の眺めへ戻る
    if (!n) { if (touch && zoomed) goHome(); return; }
    // タッチ：1回目はその球へ寄って照らす。同じ球をもう一度タップしたら、その説明へ移動する
    if (touch && (focus !== n || !zoomed)) { setFocus(n, true); flyToNode(n); return; }
    if (full) setFull(false);
    const a = root.querySelector(`.holo__a11y a[href="${n.href}"]`);
    if (a) a.click();
  });

  /* ---------- カメラを寄せる・戻す（タップで寄ったとき） ---------- */
  const HOME = new THREE.Vector3(0, 0.45, 0);
  let baseDist = 11, fly = null, zoomed = false;
  function flyToNode(n) {
    const p = new THREE.Vector3();
    n.g.getWorldPosition(p);
    fly = { target: p, dist: baseDist * 0.55 };
    zoomed = true;
    if (controls) controls.autoRotate = false;
    root.classList.add('is-zoomed');
  }
  function goHome() {
    fly = { target: HOME.clone(), dist: baseDist };
    zoomed = false;
    pinned = false;
    if (controls) controls.autoRotate = !reduceMotion;
    root.classList.remove('is-zoomed');
  }
  const backBtn = root.querySelector('.holo__back');
  if (backBtn) backBtn.addEventListener('click', goHome);

  /* ---------- 全画面で見る（iPhone でも動くよう、画面いっぱいに固定した表示に切り替える） ---------- */
  const fsBtn = root.querySelector('.holo__fs');
  let full = false, home = null;
  function setFull(on) {
    if (on === full) return;
    full = on;
    // 親の .panel は backdrop-filter で固定表示の基準になってしまうので、body の直下へ移す
    if (on) { home = document.createComment('holo'); root.before(home); document.body.appendChild(root); }
    else if (home) { home.replaceWith(root); home = null; }
    document.documentElement.classList.toggle('holo-open', on);
    root.classList.toggle('is-full', on);
    if (fsBtn) {
      fsBtn.setAttribute('aria-label', on ? '全画面を閉じる' : '全画面で見る');
      fsBtn.querySelector('span').textContent = on ? '閉じる' : '全画面';
    }
    // 全画面ではピンチ・ホイールで拡大縮小もできる
    if (controls) controls.enableZoom = on;
    resize();
  }
  if (fsBtn) fsBtn.addEventListener('click', () => setFull(!full));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && full) setFull(false); });
  // 全画面の間は、ホイールで後ろのページが動かないように
  root.addEventListener('wheel', (e) => { if (full) e.stopPropagation(); }, { passive: true });
  function pick() {
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.node : null;
  }

  // 照らすノードと、そのつながり
  let pinned = false, tourAt = 0, tourI = 0;
  const TOUR = ['gate', 'skills', 'eia', 'humanity', 'no2', 'nexus', 'eqtm', 'pro'];
  const related = new Set();
  function setFocus(n, pin) {
    pinned = !!pin;
    if (focus === n) return;
    focus = n;
    if (n) {
      const peers = links.filter((l) => l.A === n || l.B === n).map((l) => ({ node: l.A === n ? l.B : l.A, type: l.type }));
      // EQ Skills・EIA は EQTM のリングの上にある
      if (n.id === 'eqtm') peers.unshift({ node: byId.skills, type: 'tm' }, { node: byId.eia, type: 'tm' });
      if (n.id === 'skills' || n.id === 'eia') peers.push({ node: byId.eqtm, type: 'tm' });
      related.clear();
      related.add(n.id);
      peers.forEach((p) => related.add(p.node.id));
      infoK.textContent = n.role;
      infoK.style.color = '#' + n.c.getHexString();
      infoName.textContent = n.name;
      infoDesc.textContent = n.desc;
      // つながりは別の段落に、線の色のチップで並べる
      infoLinks.replaceChildren(...peers.map(({ node, type }) => {
        const li = document.createElement('li');
        li.style.setProperty('--lc', '#' + COLOR[type].getHexString());
        li.innerHTML = `<i>${LINK_NAME[type]}</i>${node.name}`;
        return li;
      }));
      infoLinksWrap.hidden = !peers.length;
    }
  }

  /* ---------- サイズ ---------- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 画面の縦横比から、外側の Nexus まで全部が入る距離を出す（横の半幅、縦の半高 約2.6）
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = COMPACT ? 3.7 : camera.aspect < 1.2 ? 5.5 : 4.7; // スマホは内側へ寄せた分だけ大きく映せる
    baseDist = Math.max(halfW / (tanV * camera.aspect), 2.6 / tanV) + 1.6;
    if (controls) {
      controls.minDistance = baseDist * 0.35;
      controls.maxDistance = baseDist * 1.5;
      if (!zoomed) {
        const off = camera.position.clone().sub(controls.target).setLength(baseDist);
        camera.position.copy(controls.target).add(off);
      }
    } else camera.position.setLength(baseDist);
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
    // タップで寄る・戻る：注視点と距離を、なめらかに近づける
    if (fly && controls) {
      controls.target.lerp(fly.target, 0.1);
      const off = camera.position.clone().sub(controls.target);
      const L = lerp(off.length(), fly.dist, 0.1);
      camera.position.copy(controls.target).add(off.setLength(L));
      if (controls.target.distanceTo(fly.target) < 0.005 && Math.abs(L - fly.dist) < 0.01) fly = null;
    }
    if (controls) controls.update();

    // ホバー判定。触れていない間は、順番にノードを照らす（つながりの案内）
    const hit = ptr.x < 2 ? pick() : null;
    if (hit !== hover) { hover = hit; root.classList.toggle('is-pointing', !!hit); }
    if (hover) setFocus(hover, false);
    else if (!pinned && !reduceMotion && t - tourAt > 3.2) { tourAt = t; setFocus(byId[TOUR[tourI++ % TOUR.length]], false); }

    // ノード：照らされたものは光が強くなり、少し大きく
    NODES.forEach((n) => {
      const on = n === focus ? (hover === n ? 1 : 0.7) : 0;
      n.heat = lerp(n.heat, on, 1 - Math.pow(0.001, dt));
      const s = 1 + n.heat * 0.38 + Math.sin(t * 2 + n.i) * 0.02;
      n.g.scale.setScalar(s);
      n.shell.material.uniforms.uPower.value = 0.85 + n.heat * 1.1;
      n.glow.material.opacity = 0.4 + n.heat * 0.5;
      n.glow.scale.setScalar((1.5 + n.heat * 1.1) * n.k);
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
      const a = rel || !focus ? 1 : 0.22;
      l.pulses.forEach((p) => {
        const u = (t * (rel ? 0.36 : 0.18) + p.userData.o) % 1;
        p.position.copy(l.curve.getPointAt(u));
        p.material.opacity = a * 0.95 * Math.sin(Math.PI * u);
        p.userData.tail.forEach((s) => {
          const w = Math.max(u - s.userData.lag, 0);
          s.position.copy(l.curve.getPointAt(w));
          s.material.opacity = a * 0.5 * Math.sin(Math.PI * w);
        });
      });
    });
    // EQTM のリング：EQTM を照らすと強く、リングの上にある EQ Skills・EIA を照らすと少し光る
    const id = focus ? focus.id : '';
    const tmOn = id === 'eqtm' ? 1 : id === 'skills' || id === 'eia' ? 0.45 : 0;
    tmRing.material.opacity = lerp(tmRing.material.opacity, 0.5 + tmOn * 0.5, 0.1);
    tmRingGlow.material.opacity = lerp(tmRingGlow.material.opacity, 0.08 + tmOn * 0.24, 0.1);
    meridians.forEach((m) => { m.material.opacity = lerp(m.material.opacity, m.userData.base * (1 + (id === 'eqtm' ? 1.5 : 0)), 0.1); });
    // リングの上を回る光：EQTM を照らすと速く、明るく
    ringPulses.forEach((p) => {
      const u = (t * (tmOn === 1 ? 0.09 : 0.04) + p.userData.o) % 1;
      p.position.copy(ringCurve.getPointAt(u));
      p.material.opacity = 0.45 + tmOn * 0.5;
    });
    // 横成長の波紋：EQ Skills から水平に広がって消える。EQ Skills を照らすと強く
    const yOn = id === 'skills' ? 1 : focus ? 0.35 : 0.7;
    ripples.forEach((m) => {
      const u = (t * 0.32 + m.userData.o) % 1;
      m.scale.setScalar(0.35 + u * 1.25);
      m.material.opacity = yOn * 0.55 * (1 - u);
    });

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
      place(n.label, tmp.clone(), (0.4 + n.heat * 0.16) * n.k);
      n.label.classList.toggle('is-on', n === focus);
      // スマホ：照らしている球と、そのつながり先の名前だけを出す（重なりを防ぐ）
      if (COMPACT && focus && !related.has(n.id)) n.label.style.opacity = '0';
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
