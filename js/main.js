/* =========================================================
   EQ Platform Ver2.0 — main.js
   1. HERO   動画をつなぎ目なくループ。スクロールすると、光る球体を画面の中心へ
             運びながらズームし、光が画面を満たしたところで3D空間へ抜ける。
   2. SPACE  ページの奥に固定した Three.js の空間。各セクションの data-anchor が
             カメラの立ち位置で、スクロールするたびに次の球体へ移動しながら近づく。
             大きな球体は動画の球体と同じ模様（その1コマから作った matcap）の完全な球体。
             カメラが着くと、球体の中にそのステージの写真がレンズ越しのように浮かぶ。
   3. MOTION Lenis のなめらかスクロール、文字が散らばった所から集まる見出し、
             ぼかしから立ち上がるパネル、大きなステージ番号（EQ Platform / Brifu と同じ動き）。
             Step と学びの循環は、光が線・輪を流れ、届いた項目が光る。
   4. TEXT   文章は「、」「。」の位置でだけ改行する。認識理論の3項目は、カーソル（タップ）で
             「だから、どうなる？」が現れ、そのまま表示され続ける。
   ?capture=1[&p=0..1][&sec=#id]  ヘッドレス撮影用：p=ヒーローのズーム量、sec=そのセクションの位置で止める
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const CAPTURE = params.has('capture');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const hasThree = typeof THREE !== 'undefined';
  const MOTION = hasGSAP && !reduceMotion && !CAPTURE;
  root.classList.add('js');
  if (CAPTURE) root.classList.add('capture');
  if (hasGSAP) { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.config({ ignoreMobileResize: true }); }

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep: rests at both ends

  /* =========================================================
     4. TEXT — each clause (up to 、 or 。) becomes an unbreakable span,
        so a line can only wrap at punctuation
     ========================================================= */
  const PUNCT = /[、。！？]/;
  function phraseWrap(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        // .eyebrow is a flex row: splitting it would turn every clause into its own column
        if (!p || !PUNCT.test(n.nodeValue) || p.closest('.scramble, .ph, .eyebrow, script, style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      const parts = n.nodeValue.match(/[^、。！？]*[、。！？]+[」』）)]*|[^、。！？]+/g);
      if (!parts || parts.length < 2) return;
      const frag = document.createDocumentFragment();
      parts.forEach((t) => {
        if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
        const s = document.createElement('span');
        s.className = 'ph';
        s.textContent = t.trim();
        frag.appendChild(s);
      });
      n.parentNode.replaceChild(frag, n);
    });
  }
  document.querySelectorAll('.hero__content p, .journey p, .journey li, .site-footer span').forEach(phraseWrap);

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (MOTION && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const el = id.length > 1 ? document.querySelector(id) : null;
      if (!el) return;
      e.preventDefault();
      // land where the camera rests: the section's centre
      const y = el.getBoundingClientRect().top + window.scrollY + Math.max(0, (el.offsetHeight - innerHeight) / 2);
      if (lenis) lenis.scrollTo(id === '#top' ? 0 : y, { duration: 1.8 });
      else window.scrollTo({ top: id === '#top' ? 0 : y, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Header ---------- */
  const header = document.getElementById('siteHeader');
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- EQ認識理論：「だから、どうなる？」を開く（一度開いたら閉じない） ---------- */
  let relayout = 0;
  document.querySelectorAll('.principle').forEach((li) => {
    const open = () => {
      if (li.classList.contains('is-open')) return;
      li.classList.add('is-open');
      li.setAttribute('aria-expanded', 'true');
      clearTimeout(relayout);
      relayout = setTimeout(() => { if (hasGSAP) ScrollTrigger.refresh(); measureStops(); measureTimeline(); }, 900);
    };
    li.addEventListener('mouseenter', open);
    li.addEventListener('focus', open);
    li.addEventListener('click', open);
    if (CAPTURE) open();
  });

  /* =========================================================
     1. HERO
     ========================================================= */
  const hero = document.querySelector('.hero');
  const pin = document.getElementById('heroPin');
  const stage = document.getElementById('heroStage');
  const light = document.getElementById('heroLight');
  const content = document.getElementById('heroContent');
  const cue = document.querySelector('.scroll-cue');
  const vids = Array.from(document.querySelectorAll('.hero__video'));

  // Where the glowing orb sits in the 1280x720 clip (fractions of the frame), measured from the video.
  const ORB = { x: 0.5, y: 0.398, r: 0.056 };
  const heroRange = () => Math.max(1, hero.offsetHeight - innerHeight);

  // The video is object-fit:cover, so find the orb in viewport pixels.
  function orbPoint() {
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const s = Math.max(vw / 1280, vh / 720);
    const w = 1280 * s, h = 720 * s;
    return { x: (vw - w) / 2 + ORB.x * w, y: (vh - h) / 2 + ORB.y * h, r: ORB.r * w, vw, vh };
  }

  function paintHero(p) {
    const o = orbPoint();
    const carry = smooth(clamp(p / 0.62));                         // the orb travels to the centre...
    const maxScale = (Math.max(o.vw, o.vh) * 1.6) / (2 * o.r);     // ...until it is wider than the screen
    const scale = Math.pow(maxScale, Math.pow(p, 1.3));            // exponential zoom reads as a steady dive
    const dx = (o.vw / 2 - o.x) * carry, dy = (o.vh / 2 - o.y) * carry;
    stage.style.transformOrigin = `${o.x}px ${o.y}px`;
    stage.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${-4 * carry}deg) scale(${scale})`;

    const lp = clamp((p - 0.42) / 0.42);                            // the orb's light fills the screen
    light.style.opacity = smooth(lp).toFixed(3);
    light.style.transform = `scale(${(0.35 + lp * 2.1).toFixed(3)})`;

    const cp = clamp(p / 0.28);                                      // the words step back first
    content.style.opacity = (1 - cp).toFixed(3);
    content.style.transform = `translate3d(0,${(-70 * cp).toFixed(1)}px,0)`;
    content.style.filter = cp > 0.01 ? `blur(${(cp * 8).toFixed(1)}px)` : 'none';
    if (cue) cue.style.opacity = (1 - clamp(p / 0.06)).toFixed(3);

    pin.style.opacity = (1 - smooth(clamp((p - 0.86) / 0.14))).toFixed(3); // step through into the 3D space
  }

  /* The clip is a slow push-in, so a hard loop would jump back.
     Two copies take turns: the next one starts and fades in before the current one ends. */
  const playVid = (v) => { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); };
  let cur = 0, videoOn = false;
  if (vids.length && !reduceMotion && !CAPTURE) {
    const FADE = 0.9;
    vids.forEach((v) => { v.muted = true; });
    vids[0].addEventListener('canplay', () => {
      if (vids[1] && vids[1].preload !== 'auto') { vids[1].preload = 'auto'; vids[1].load(); }
    }, { once: true });
    videoOn = true;
    playVid(vids[0]);
    const swap = () => {
      const a = vids[cur], b = vids[1 - cur];
      if (!b || !a.duration || a.currentTime < a.duration - FADE || !b.paused) return;
      b.currentTime = 0;
      playVid(b);
      b.classList.add('is-on');
      a.classList.remove('is-on');
      setTimeout(() => { if (!a.classList.contains('is-on')) a.pause(); }, FADE * 1000 + 250);
      cur = 1 - cur;
    };
    vids.forEach((v) => v.addEventListener('timeupdate', swap));
    if (vids.length === 1) vids[0].loop = true;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && videoOn && vids[cur].paused) playVid(vids[cur]);
    });
  }

  /* =========================================================
     2. SPACE
     ========================================================= */
  const canvas = document.getElementById('space');
  let space = null;
  if (canvas && hasThree && !reduceMotion) {
    try { space = buildSpace(canvas); } catch (err) { console.warn('3D space disabled:', err); }
  }
  if (!space && canvas) canvas.style.display = 'none';

  function buildSpace(cv) {
    const small = window.innerWidth < 900;
    const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: !small, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040a16, 0.026);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 240);
    scene.add(new THREE.HemisphereLight(0xdcecff, 0x0a0f1c, 0.85));
    const key = new THREE.PointLight(0xffffff, 0.9, 0, 2);
    scene.add(key);

    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const halo = (color, size, opacity) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.setScalar(size);
      s.renderOrder = 3;
      return s;
    };

    // motes of light drifting upward, like the water in the video
    const N = small ? 700 : 1600;
    const mp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      mp[i * 3] = (Math.random() - 0.5) * 60;
      mp[i * 3 + 1] = (Math.random() - 0.5) * 36;
      mp[i * 3 + 2] = 16 - Math.random() * 112;
    }
    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    scene.add(new THREE.Points(mGeo, new THREE.PointsMaterial({
      map: glowTex, color: 0xbfe3ff, size: 0.17, transparent: true, opacity: 0.75,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    })));

    // A photo cut into a circle with a soft edge and a light vignette. No lens distortion: the
    // middle of the photo stays true (the user asked for an undistorted centre).
    function lensTexture(url) {
      const tex = new THREE.CanvasTexture(document.createElement('canvas'));
      const img = new Image();
      img.onload = () => {
        const S = 512, h = S / 2;
        const c = document.createElement('canvas'); c.width = c.height = S;
        const g = c.getContext('2d');
        const k = Math.max(S / img.width, S / img.height);
        g.drawImage(img, (S - img.width * k) / 2, (S - img.height * k) / 2, img.width * k, img.height * k);
        const src = g.getImageData(0, 0, S, S).data;
        const out = g.createImageData(S, S), d = out.data;
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const u = (x + 0.5 - h) / h, v = (y + 0.5 - h) / h, r = Math.hypot(u, v);
            if (r >= 1) continue; // stays transparent
            const i = (y * S + x) * 4, o = i, shade = 0.84 + 0.16 * (1 - r * r);
            d[o] = src[i] * shade; d[o + 1] = src[i + 1] * shade; d[o + 2] = src[i + 2] * shade;
            d[o + 3] = 255 * clamp((1 - r) / 0.07);
          }
        }
        g.putImageData(out, 0, 0);
        tex.image = c;
        tex.needsUpdate = true;
      };
      img.src = url;
      return tex;
    }
    const inner = (url, size) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: lensTexture(url), transparent: true, opacity: 0, depthWrite: false }));
      s.scale.setScalar(size);
      s.renderOrder = 1; // drawn before the glass shell, so it reads as being inside
      return s;
    };

    // the great sphere: a perfect sphere wearing the orb from the hero video (a matcap made from that frame)
    const greatMat = new THREE.MeshMatcapMaterial({
      matcap: new THREE.TextureLoader().load('images/orb-matcap.png'), transparent: true, opacity: 1, depthWrite: false,
    });
    const great = new THREE.Mesh(new THREE.SphereGeometry(2.4, small ? 48 : 72, small ? 32 : 48), greatMat);
    great.renderOrder = 2;
    // the photo is not a child of the sphere: each frame it is moved to the centre of the sphere's
    // on-screen outline (see placePic), which drifts outward when the sphere is off to one side
    const greatPic = inner('images/spheres/theory.jpg', 2.4 * 1.72);
    const greatHalo = halo(0x8fd8ff, 11, 0.38);
    great.add(greatHalo);
    scene.add(greatPic);
    great.userData = { r: 2.4, pic: greatPic, halo: greatHalo };
    scene.add(great);

    // one sphere per stage, in the order of the Brifu original: Gate → EIA → Skills → Humanity → EQTM → Nexus.
    // Each wears the same mottled pattern as the hero orb (a grey copy of it), tinted with its stage colour.
    const greyMatcap = new THREE.TextureLoader().load('images/orb-matcap-gray.png');
    const ORBS = [
      { color: 0xe0a24f, p: [-3.0, 1.2, -12], r: 0.95, pic: 'gate' },     // EQ Gate
      { color: 0x52b683, p: [3.0, -0.8, -22], r: 0.95, pic: 'eia' },      // EIA
      { color: 0x5b8fe6, p: [-2.6, -1.4, -32], r: 0.95, pic: 'skills' },  // EQ Skills
      { color: 0x9a84d8, p: [2.8, 1.0, -42], r: 0.95, pic: 'humanity' },  // EQ Humanity
      { color: 0x45a99b, p: [-1.6, 0.6, -52], r: 0.95, pic: 'eqtm' },     // EQTM
      { color: 0xd496aa, p: [0.8, -0.4, -64], r: 1.35, pic: 'nexus' },    // EQ Business Nexus
    ];
    const orbs = ORBS.map((o, i) => {
      const mat = new THREE.MeshMatcapMaterial({ matcap: greyMatcap, color: o.color, transparent: true, opacity: 1, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(o.r, small ? 40 : 56, small ? 28 : 40), mat);
      mesh.position.set(o.p[0], o.p[1], o.p[2]);
      mesh.renderOrder = 2;
      const pic = inner(`images/spheres/${o.pic}.jpg`, o.r * 1.72);
      const h = halo(o.color, o.r * 6.5, 0.3);
      mesh.add(h);
      scene.add(pic);
      mesh.userData = { r: o.r, spin: (i % 2 ? -1 : 1) * (0.12 + i * 0.03), mat, pic, halo: h };
      scene.add(mesh);
      return mesh;
    });
    const bodies = [great, ...orbs];

    // Put a sphere's photo at the centre of the sphere's outline on screen, sized to fit inside it.
    // Off to one side, perspective turns the outline into an ellipse whose centre lies further out than
    // the projected centre of the sphere, so a photo at the true centre would look off-centre.
    const camSpace = new THREE.Vector3();
    function placePic(body) {
      const pic = body.userData.pic, r = body.userData.r * body.scale.x;
      camSpace.copy(body.position).applyMatrix4(camera.matrixWorldInverse); // camera looks down -z
      const depth = -camSpace.z, dist = camSpace.length();
      if (depth <= r * 1.05) { pic.visible = false; return; }
      pic.visible = true;
      const off = Math.hypot(camSpace.x, camSpace.y);
      const theta = Math.atan2(off, depth);                 // how far off the view axis
      const alpha = Math.asin(Math.min(0.999, r / dist));   // half-angle of the outline cone
      const mid = (Math.tan(theta - alpha) + Math.tan(theta + alpha)) / 2;
      const k = off > 1e-6 ? mid / (off / depth) : 1;
      camSpace.set(camSpace.x * k, camSpace.y * k, camSpace.z).applyMatrix4(camera.matrixWorld);
      pic.position.copy(camSpace);
      pic.scale.setScalar(2 * (Math.tan(alpha) / Math.cos(theta)) * depth * 0.86);
    }

    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // camera anchors: where the camera rests while each section is centred on screen
    function anchor(name) {
      const wide = camera.aspect >= 1;
      const m = /^orb-(\d)$/.exec(name);
      if (m) {
        const o = orbs[+m[1]].position;
        // wide screens: the sphere sits to the right of the text; tall screens: below it
        const off = wide ? V(-1.9, 0.25, 3.8) : V(0, 1.2, 4.8);
        return { pos: o.clone().add(off), look: o.clone().add(V(off.x, off.y * 0.4, 0)) };
      }
      switch (name) {
        case 'entry': return { pos: V(0, 0, 3.0), look: V(0, 0, 0) };            // inside the light
        case 'far': return wide ? { pos: V(-6, 1.4, 16), look: V(-2.6, 0.3, 0) } : { pos: V(0, 2.4, 17), look: V(0, 1.2, 0) };
        case 'glow': return wide ? { pos: V(-3.4, 0.4, 7.4), look: V(-3.4, 0.4, 0) } : { pos: V(0, 2.4, 9), look: V(0, 1.0, 0) };
        case 'about': return { pos: V(7.5, 2.6, -1), look: V(0, 0, -10) };
        case 'steps': return { pos: V(0, 8.5, -5), look: V(0, 0, -26) };
        case 'growth': return { pos: V(-10.5, 1.2, -18), look: V(0, 0, -27) };
        case 'overview': return { pos: V(0, 3.4, 1.5), look: V(0, -0.8, -40) };  // looking down the road of spheres
        case 'trail': return { pos: V(11, 3.6, -30), look: V(0, 0, -36) };      // from the side: the whole path
        case 'back': return { pos: V(0.6, 4.6, -86), look: V(0, 3.4, -10) };    // looking back toward the start
        case 'home': return { pos: V(0, 0.4, 15), look: V(0, 0, -30) };
        default: return { pos: V(0, 0, 12), look: V(0, 0, 0) };
      }
    }

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    const camPos = V(0, 0, 3), camLook = V(0, 0, 0), weight = {};
    camera.position.copy(camPos);
    return {
      anchor,
      step(dt, t, target, snap) {
        const k = snap ? 1 : 1 - Math.pow(0.0008, dt);   // frame-rate independent easing
        camPos.lerp(target.pos, k); camLook.lerp(target.look, k);
        camera.position.copy(camPos); camera.lookAt(camLook);
        key.position.copy(camPos);
        Object.keys(weight).concat(Object.keys(target.weights)).forEach((n) => {
          weight[n] = (weight[n] || 0) + ((target.weights[n] || 0) - (weight[n] || 0)) * k;
        });
        const shown = (n) => smooth(clamp(((weight[n] || 0) - 0.3) / 0.6)); // pictures appear as the camera arrives

        const mpos = mGeo.attributes.position.array;
        for (let i = 0; i < N; i++) {
          mpos[i * 3 + 1] += dt * 0.25;
          if (mpos[i * 3 + 1] > 18) mpos[i * 3 + 1] -= 36;
        }
        mGeo.attributes.position.needsUpdate = true;

        const g = shown('glow');
        greatMat.opacity = 1 - 0.62 * g;
        greatPic.material.opacity = g;
        orbs.forEach((orb, i) => {
          const s = shown('orb-' + i);
          const near = clamp(1 - (camPos.distanceTo(orb.position) - 4) / 9);
          orb.rotation.y += dt * orb.userData.spin;
          orb.scale.setScalar((1 + near * 0.1) * (1 + Math.sin(t * 1.2 + i) * 0.03));
          orb.userData.mat.opacity = 1 - 0.6 * s;
          orb.userData.pic.material.opacity = s;
          orb.userData.halo.material.opacity = (0.22 + near * 0.4) * (1 - 0.6 * s);
        });
        // Draw the spheres back to front, each photo just before its own glass. None of them write
        // depth, so a fixed order would let a far sphere's glass paint over a near sphere's photo.
        bodies.sort((a, b) => b.position.distanceToSquared(camPos) - a.position.distanceToSquared(camPos));
        bodies.forEach((b, r) => {
          b.userData.pic.renderOrder = 10 + r * 3;
          b.renderOrder = 11 + r * 3;
          b.userData.halo.renderOrder = 12 + r * 3;
        });
        camera.updateMatrixWorld();
        bodies.forEach((b) => { if (b.userData.pic.material.opacity > 0.001) placePic(b); });
        renderer.render(scene, camera);
      },
    };
  }

  // scroll positions where the camera rests, one per data-anchor section
  let stops = [];
  function measureStops() {
    const vh = window.innerHeight;
    const shift = parseFloat(document.body.style.marginTop) || 0; // capture mode shifts the page
    const start = heroRange();
    stops = [{ y: 0, name: 'entry' }, { y: start, name: 'entry' }];
    document.querySelectorAll('[data-anchor]').forEach((sec) => {
      const top = sec.getBoundingClientRect().top + window.scrollY - shift;
      stops.push({ y: Math.max(start + 1, top + sec.offsetHeight / 2 - vh / 2), name: sec.dataset.anchor });
    });
    stops.sort((a, b) => a.y - b.y);
  }
  function cameraTarget(y) {
    let k = 0;
    while (k < stops.length - 2 && y > stops[k + 1].y) k++;
    const a = stops[k], b = stops[Math.min(k + 1, stops.length - 1)];
    const u = b.y > a.y ? smooth(clamp((y - a.y) / (b.y - a.y))) : 1;
    const A = space.anchor(a.name), B = space.anchor(b.name);
    const pos = A.pos.lerp(B.pos, u);
    pos.y += Math.sin(Math.PI * u) * 1.3;           // travel in an arc, not a straight line
    const weights = {};
    weights[a.name] = (weights[a.name] || 0) + (1 - u);
    weights[b.name] = (weights[b.name] || 0) + u;
    return { pos, look: A.look.lerp(B.look, u), weights };
  }

  /* ---------- Step（育てる順番）と学びの循環：光が流れ、届いた項目が光る ---------- */
  const tl = document.querySelector('.timeline');
  const tlLight = tl ? tl.querySelector('.timeline__light') : null;
  const tlSteps = tl ? Array.from(tl.querySelectorAll('.tstep')) : [];
  let tlFracs = [];
  function measureTimeline() {
    if (!tl) return;
    const H = tl.offsetHeight || 1;
    tlFracs = tlSteps.map((s) => (s.offsetTop + 16) / H);
  }
  function paintTimeline(t) {
    const P = 9, p = (t % P) / P;
    tlLight.style.top = (p * 100).toFixed(2) + '%';
    tlLight.style.opacity = clamp(Math.min(p, 1 - p) / 0.04).toFixed(2);
    tlSteps.forEach((s, i) => { const d = p - tlFracs[i]; s.classList.toggle('is-lit', d > -0.01 && d < 0.1); });
  }
  const cyc = document.querySelector('.cycle__ring');
  const cycItems = Array.from(document.querySelectorAll('[data-cycle]'));
  function paintCycle(t) {
    const P = 10, a = ((t % P) / P) * 360;          // clockwise from the top, like the diagram
    cyc.style.setProperty('--a', a.toFixed(2) + 'deg');
    cycItems.forEach((n) => { const d = (a - Number(n.dataset.cycle) * 72 + 360) % 360; n.classList.toggle('is-lit', d < 32); });
  }
  const onScreen = new Set();
  if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target))), { rootMargin: '10% 0px' });
    [tl, cyc].forEach((el) => el && vio.observe(el));
  }

  /* ---------- 横成長・縦成長：枠の背景の動画は、画面にある間だけ再生する ---------- */
  const growthVids = Array.from(document.querySelectorAll('.gcard__bg'));
  if (growthVids.length && !reduceMotion && !CAPTURE && 'IntersectionObserver' in window) {
    const gio = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) playVid(e.target); else e.target.pause();
    }), { rootMargin: '10% 0px' });
    growthVids.forEach((v) => { v.muted = true; gio.observe(v); });
  }
  if (CAPTURE && params.has('hover')) root.classList.add('capture-hover');

  const remeasure = () => { measureStops(); measureTimeline(); };
  remeasure();
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  if (hasGSAP) ScrollTrigger.addEventListener('refresh', remeasure);

  /* section tint behind the space */
  const bg = document.getElementById('space-bg');
  if (bg && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) bg.style.setProperty('--tint', en.target.dataset.tint); });
    }, { rootMargin: '-50% 0px -50% 0px' });
    document.querySelectorAll('[data-tint]').forEach((s) => io.observe(s));
  }

  /* =========================================================
     3. MOTION（EQ Platform / Brifu と同じ動き）
     ========================================================= */
  // headings: every character flies in from a scattered position and settles
  function scramble(el) {
    const tmp = document.createElement('div');
    const lines = el.innerHTML.split(/<br\s*\/?>/i).map((html) => { tmp.innerHTML = html; return tmp.textContent.trim(); }).filter(Boolean);
    el.setAttribute('aria-label', lines.join(''));
    el.textContent = '';
    const chars = [];
    lines.forEach((line, li) => {
      const wrap = document.createElement('span');
      wrap.setAttribute('aria-hidden', 'true');
      Array.from(line).forEach((c) => {
        const s = document.createElement('span');
        s.className = 'sc';
        s.textContent = c === ' ' ? ' ' : c;
        wrap.appendChild(s);
        chars.push(s);
      });
      el.appendChild(wrap);
      if (li < lines.length - 1) el.appendChild(document.createElement('br'));
    });
    return chars;
  }

  if (MOTION) {
    document.querySelectorAll('.scramble').forEach((el) => {
      const chars = scramble(el);
      gsap.set(chars, {
        x: () => (Math.random() - 0.5) * 520, y: () => (Math.random() - 0.5) * 360,
        rotate: () => Math.random() * 140 - 70, opacity: 0,
      });
      ScrollTrigger.create({
        trigger: el, start: 'top 86%', once: true,
        onEnter: () => gsap.to(chars, { x: 0, y: 0, rotate: 0, opacity: 1, duration: 1.1, ease: 'back.out(1.6)', stagger: { each: 0.026, from: 'random' } }),
      });
    });

    // each stage arrives in its own way, then every panel blurs away as it leaves
    const arrivals = {
      'stage-1': { x: -160, rotateZ: -4 },
      'stage-2': { y: 90 },
      'stage-3': { scale: 0.62 },
      'stage-4': { scaleY: 0.35, transformOrigin: 'bottom center' },
      'stage-5': { y: 140 },
      nexus: { scale: 0.72 },
    };
    document.querySelectorAll('.sec').forEach((sec) => {
      const panel = sec.querySelector('.panel');
      if (!panel) return;
      const from = Object.assign({ opacity: 0, filter: 'blur(12px)' }, arrivals[sec.id] || { y: 70, scale: 0.96 });
      gsap.fromTo(panel, from, {
        opacity: 1, x: 0, y: 0, scale: 1, scaleY: 1, rotateZ: 0, filter: 'blur(0px)', ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top 30%', scrub: 0.6 },
      });
      if (!sec.classList.contains('sec--last')) {
        gsap.to(panel, {
          opacity: 0, y: -40, scale: 0.98, filter: 'blur(6px)', ease: 'none', immediateRender: false,
          scrollTrigger: { trigger: sec, start: 'bottom 62%', end: 'bottom 12%', scrub: 0.6 },
        });
      }
      const num = sec.querySelector('.giant-num');
      if (num) {
        gsap.fromTo(num, { x: 340, opacity: 0 }, {
          x: 0, opacity: 0.1, ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top 35%', scrub: 0.6 },
        });
      }
      const chips = sec.querySelectorAll('.chips li');
      if (chips.length) {
        gsap.fromTo(chips, { opacity: 0, y: 14 }, {
          opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06,
          scrollTrigger: { trigger: panel, start: 'top 70%', toggleActions: 'play none none reverse' },
        });
      }
    });

    // cards inside the wide panels arrive one after another
    ['.issues li', '.folders .fcard', '.tstep', '.growth-grid .gcard', '.route-map a', '.nsteps .nstep', '.oc-grid .oc-card', '.doors .door'].forEach((sel) => {
      const els = gsap.utils.toArray(sel);
      if (!els.length) return;
      gsap.fromTo(els, { opacity: 0, y: 26 }, {
        opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08, clearProps: 'transform',
        scrollTrigger: { trigger: els[0], start: 'top 86%', toggleActions: 'play none none reverse' },
      });
    });

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', () => setTimeout(refresh, 300));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(refresh, 120));
  }

  /* ---------- Capture mode (visual QA only) ---------- */
  let captureY = null, captureP = null;
  if (CAPTURE) {
    captureP = parseFloat(params.get('p'));
    if (isNaN(captureP)) captureP = 0;
    const el = params.get('sec') ? document.querySelector(params.get('sec')) : null;
    // Headless Edge settles its viewport size late and every section is sized in vh,
    // so measure again a few times instead of trusting the first layout.
    const place = () => {
      document.body.style.marginTop = '0px';
      remeasure();
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY + Math.max(0, (el.offsetHeight - innerHeight) / 2);
      captureY = y; captureP = 1;
      document.body.style.marginTop = -y + 'px';
      header.classList.add('is-scrolled');
    };
    window.addEventListener('load', () => [200, 900, 2000, 4000, 7000].forEach((ms) => setTimeout(place, ms)));
    window.addEventListener('resize', place);
  }

  /* ---------- One loop drives the hero, the lights and the camera ---------- */
  let heroP = 0, last = performance.now(), first = true;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const tsec = CAPTURE ? 2.2 : now / 1000;
    const y = captureY !== null ? captureY : window.scrollY;
    const target = CAPTURE ? captureP : clamp(y / heroRange());
    heroP = (lenis || CAPTURE) ? target : heroP + (target - heroP) * (1 - Math.pow(0.0005, dt));
    if (!reduceMotion && stage) paintHero(heroP);

    if (videoOn) {
      const v = vids[cur];
      if (heroP > 0.985 && !v.paused) v.pause();
      else if (heroP <= 0.985 && v.paused && !document.hidden) playVid(v);
    }

    if (!reduceMotion) {
      if (tl && (CAPTURE || onScreen.has(tl))) paintTimeline(tsec);
      if (cyc && (CAPTURE || onScreen.has(cyc))) paintCycle(tsec);
    }

    // the space is hidden behind the hero until the light opens up
    if (space && (heroP > 0.7 || first)) {
      space.step(dt, tsec, cameraTarget(y), CAPTURE || first);
      first = false;
    }
  }
  requestAnimationFrame(tick);
})();
