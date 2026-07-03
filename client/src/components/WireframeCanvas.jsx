import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function WireframeCanvas({ style }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth;
    const H = el.clientHeight;

    // ─── Renderer ───────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    // ─── Scene & Camera ─────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 500);
    camera.position.set(0, 18, 38);
    camera.lookAt(0, 0, 0);

    // ─── Material ────────────────────────────────────────────────────
    const mat = new THREE.LineBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.55 });
    const matDark = new THREE.LineBasicMaterial({ color: 0x0f766e, transparent: true, opacity: 0.35 });
    const matLight = new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.3 });

    // Helper: Wireframe from geometry
    function wireframe(geo, m = mat) {
      const edges = new THREE.EdgesGeometry(geo);
      return new THREE.LineSegments(edges, m);
    }

    // Helper: Dense wireframe (subdivided)
    function denseWireframe(geo, m = mat) {
      const wf = new THREE.WireframeGeometry(geo);
      return new THREE.LineSegments(wf, m);
    }

    // ─── ROOT pivot (all structure rotates together) ─────────────────
    const root = new THREE.Group();
    scene.add(root);

    // ════════════════════════════════════════════════════════════════
    // 1. BASE PLATFORM — wide flat ring at the bottom
    // ════════════════════════════════════════════════════════════════
    const baseDisk = new THREE.CylinderGeometry(10, 10.5, 0.4, 64, 1, false);
    root.add(wireframe(baseDisk, matDark));

    // Base ring details
    for (let i = 0; i < 3; i++) {
      const r = 7 - i * 1.5;
      const ring = new THREE.TorusGeometry(r, 0.05, 4, 80);
      const m = new THREE.LineSegments(new THREE.WireframeGeometry(ring), matDark);
      m.rotation.x = Math.PI / 2;
      m.position.y = -0.2 - i * 0.15;
      root.add(m);
    }

    // ════════════════════════════════════════════════════════════════
    // 2. TRIANGULAR / GEO BASE SPIRES — the angular bottom elements
    // ════════════════════════════════════════════════════════════════
    const spireAngles = [0, 60, 120, 180, 240, 300];
    spireAngles.forEach((deg, idx) => {
      const angle = (deg * Math.PI) / 180;
      const radius = 8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Cone spire
      const cone = new THREE.ConeGeometry(1.2, 5, 5, 3);
      const spire = wireframe(cone, matDark);
      spire.position.set(x, 2, z);
      root.add(spire);

      // Connecting diagonal beams to center
      const points = [
        new THREE.Vector3(x, 0.2, z),
        new THREE.Vector3(0, 3, 0),
      ];
      const lg = new THREE.BufferGeometry().setFromPoints(points);
      root.add(new THREE.Line(lg, matDark));

      // Cross beams between adjacent spires
      if (idx < spireAngles.length - 1) {
        const nextAngle = ((spireAngles[idx + 1]) * Math.PI) / 180;
        const nx = Math.cos(nextAngle) * radius;
        const nz = Math.sin(nextAngle) * radius;
        const crossPts = [new THREE.Vector3(x, 2, z), new THREE.Vector3(nx, 2, nz)];
        const cg = new THREE.BufferGeometry().setFromPoints(crossPts);
        root.add(new THREE.Line(cg, matDark));
      }
    });

    // ════════════════════════════════════════════════════════════════
    // 3. CENTER CYLINDRICAL TOWER STACK
    // ════════════════════════════════════════════════════════════════
    // Main column
    const col = new THREE.CylinderGeometry(1.2, 1.6, 14, 16, 8);
    root.add(denseWireframe(col, mat));

    // Stacked disc rings along the column (like a spool)
    [-2, 0, 2, 4, 6].forEach(y => {
      const disc = new THREE.CylinderGeometry(2.2 - Math.abs(y) * 0.05, 2.2 - Math.abs(y) * 0.05, 0.25, 32, 1);
      const d = wireframe(disc, mat);
      d.position.y = y;
      root.add(d);
    });

    // ════════════════════════════════════════════════════════════════
    // 4. SWEEPING RAMP / MONORAIL TRACKS — the signature curved arcs
    // ════════════════════════════════════════════════════════════════
    // Build a curved ramp sweep using CatmullRomCurve3 + TubeGeometry
    function addRampTrack(controlPoints, tubeSeg = 80, tubeRad = 0.06, m = mat) {
      const curve = new THREE.CatmullRomCurve3(controlPoints);
      const tube = new THREE.TubeGeometry(curve, tubeSeg, tubeRad, 6, false);
      root.add(wireframe(tube, m));
    }

    // Upper sweeping left ramp (the large wing-like arc at top of image)
    addRampTrack([
      new THREE.Vector3(-10, 8, -2),
      new THREE.Vector3(-6, 11, 1),
      new THREE.Vector3(0, 13, 0),
      new THREE.Vector3(6, 11, -1),
      new THREE.Vector3(9, 8, 2),
    ], 100, 0.07, mat);

    // Parallel ramp slightly lower (double-track effect)
    addRampTrack([
      new THREE.Vector3(-10, 6.5, -1),
      new THREE.Vector3(-5, 9.5, 1.5),
      new THREE.Vector3(0, 11.5, 0.5),
      new THREE.Vector3(5, 9.5, -1),
      new THREE.Vector3(9, 6.5, 1.5),
    ], 100, 0.05, matLight);

    // Right spiral ramp going from mid to top
    addRampTrack([
      new THREE.Vector3(3, 0, 3),
      new THREE.Vector3(5, 3, 5),
      new THREE.Vector3(7, 6, 3),
      new THREE.Vector3(8, 9, 0),
      new THREE.Vector3(7, 12, -3),
      new THREE.Vector3(4, 14, -5),
    ], 120, 0.07, mat);

    // Left spiral ramp (mirror)
    addRampTrack([
      new THREE.Vector3(-3, 0, 3),
      new THREE.Vector3(-5, 3, 5),
      new THREE.Vector3(-7, 6, 3),
      new THREE.Vector3(-8, 9, 0),
      new THREE.Vector3(-7, 12, -3),
      new THREE.Vector3(-4, 14, -5),
    ], 120, 0.07, matLight);

    // Lower loop – the winding figure-8 base track
    addRampTrack([
      new THREE.Vector3(8, 1, 0),
      new THREE.Vector3(5, 2, 6),
      new THREE.Vector3(0, 3, 8),
      new THREE.Vector3(-5, 2, 6),
      new THREE.Vector3(-8, 1, 0),
      new THREE.Vector3(-5, 0, -6),
      new THREE.Vector3(0, -0.5, -8),
      new THREE.Vector3(5, 0, -6),
      new THREE.Vector3(8, 1, 0),
    ], 140, 0.06, matDark);

    // ════════════════════════════════════════════════════════════════
    // 5. DISK PLATFORM (the central mushroom cap disc)
    // ════════════════════════════════════════════════════════════════
    const cap = new THREE.CylinderGeometry(5, 4, 0.5, 48, 4);
    const capMesh = denseWireframe(cap, mat);
    capMesh.position.y = 3.5;
    root.add(capMesh);

    // Spoke lines from center to edge on cap
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const pts = [
        new THREE.Vector3(0, 3.5, 0),
        new THREE.Vector3(Math.cos(a) * 4.8, 3.5, Math.sin(a) * 4.8),
      ];
      const sg = new THREE.BufferGeometry().setFromPoints(pts);
      root.add(new THREE.Line(sg, matLight));
    }

    // ════════════════════════════════════════════════════════════════
    // 6. SUPPORT PILLARS — vertical columns from base to cap
    // ════════════════════════════════════════════════════════════════
    [0, 72, 144, 216, 288].forEach(deg => {
      const a = (deg * Math.PI) / 180;
      const x = Math.cos(a) * 4;
      const z = Math.sin(a) * 4;
      const pillar = new THREE.CylinderGeometry(0.15, 0.2, 4, 8, 4);
      const p = wireframe(pillar, matDark);
      p.position.set(x, 1.5, z);
      root.add(p);
    });

    // ════════════════════════════════════════════════════════════════
    // 7. UPPER STRUCTURE — the sweeping plane wings at the top
    // ════════════════════════════════════════════════════════════════
    // Left wing panel (plane)
    const leftWing = new THREE.PlaneGeometry(8, 3, 10, 5);
    const lw = new THREE.LineSegments(new THREE.WireframeGeometry(leftWing), matLight);
    lw.position.set(-6, 12, 0);
    lw.rotation.y = Math.PI / 6;
    lw.rotation.x = -0.2;
    root.add(lw);

    // Right wing panel
    const rightWing = new THREE.PlaneGeometry(8, 3, 10, 5);
    const rw = new THREE.LineSegments(new THREE.WireframeGeometry(rightWing), mat);
    rw.position.set(6, 12, 0);
    rw.rotation.y = -Math.PI / 6;
    rw.rotation.x = -0.2;
    root.add(rw);

    // ════════════════════════════════════════════════════════════════
    // 8. FLOATING CONNECTOR BEAMS between ramps and center tower
    // ════════════════════════════════════════════════════════════════
    const connectors = [
      [[-5, 10, 0], [-1.5, 5, 0]],
      [[5, 10, 0], [1.5, 5, 0]],
      [[-7, 7, 2], [-2, 4, 1]],
      [[7, 7, 2], [2, 4, 1]],
      [[-4, 14, -4], [0, 7, 0]],
      [[4, 14, -4], [0, 7, 0]],
    ];
    connectors.forEach(([a, b]) => {
      const pts = [new THREE.Vector3(...a), new THREE.Vector3(...b)];
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      root.add(new THREE.Line(g, matDark));
    });

    // ════════════════════════════════════════════════════════════════
    // 9. OUTER ORBIT RING (the grand encircling torus)
    // ════════════════════════════════════════════════════════════════
    const outerRing = new THREE.TorusGeometry(10.5, 0.1, 8, 120);
    const or = new THREE.LineSegments(new THREE.WireframeGeometry(outerRing), matDark);
    or.rotation.x = Math.PI * 0.28;
    or.position.y = 4;
    root.add(or);

    // Second tilted orbit ring
    const or2 = new THREE.TorusGeometry(9, 0.08, 6, 100);
    const orb2 = new THREE.LineSegments(new THREE.WireframeGeometry(or2), matLight);
    orb2.rotation.x = -Math.PI * 0.18;
    orb2.rotation.z = Math.PI * 0.08;
    orb2.position.y = 5;
    root.add(orb2);

    // ─── Animation loop ──────────────────────────────────────────────
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      root.rotation.y += 0.0025;
      renderer.render(scene, camera);
    };
    animate();

    // ─── Resize handler ──────────────────────────────────────────────
    const onResize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        ...style,
      }}
    />
  );
}
