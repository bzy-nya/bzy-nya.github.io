(function () {
  "use strict";

  const canvas = document.getElementById("galaxy-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const palette = [
    "#75d9cc",
    "#ff7aa2",
    "#ffd57d",
    "#9ab6ff",
    "#c98cff",
    "#ff9d66",
    "#a7f070",
  ];
  const MIN_GALAXIES = 3;
  const MAX_GALAXIES = 8;
  const STARS_PER_GALAXY = 1000;
  const SIMULATION_SPEED = 3.0;
  const AUTO_RESET_TIME = 68;
  const STEADY_CHECK_AFTER = 26;
  const STEADY_REQUIRED_TIME = 5.5;
  const STEADY_CORE_RADIUS = 145;
  const STEADY_AVG_SPEED = 13;
  const GRAVITY = 88;
  const STAR_SOFTENING_SQ = 360;
  const GALAXY_SOFTENING_SQ = 2500;
  const MAX_SUBSTEP = 1 / 90;
  const sim = {
    galaxies: [],
    stars: [],
    time: 0,
    speed: SIMULATION_SPEED,
    paused: false,
    steadyTime: 0,
    width: 0,
    height: 0,
    dpr: 1,
    panX: 0,
    panY: 0,
    zoom: 1,
    dragging: false,
    dragX: 0,
    dragY: 0,
  };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function resize() {
    sim.dpr = Math.min(window.devicePixelRatio || 1, 2);
    sim.width = window.innerWidth;
    sim.height = window.innerHeight;
    canvas.width = Math.floor(sim.width * sim.dpr);
    canvas.height = Math.floor(sim.height * sim.dpr);
    ctx.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
  }

  function createGalaxy(index, total, starsPerGalaxy) {
    const centerRadius = Math.min(sim.width, sim.height) * rand(0.52, 0.78);
    const angle = (index / total) * Math.PI * 2 + rand(-0.28, 0.28);
    const x = Math.cos(angle) * centerRadius;
    const y = Math.sin(angle) * centerRadius;
    const tangent = angle + Math.PI / 2;
    const inward = Math.atan2(-y, -x);
    const speed = rand(10, 18);
    const size = rand(44, 72);

    return {
      id: index,
      x,
      y,
      vx: Math.cos(inward) * speed + Math.cos(tangent) * rand(-9, 9),
      vy: Math.sin(inward) * speed + Math.sin(tangent) * rand(-9, 9),
      mass: starsPerGalaxy * rand(0.92, 1.18),
      radius: size,
      spin: Math.random() > 0.5 ? 1 : -1,
      winding: rand(0.06, 0.09),
      color: palette[index % palette.length],
    };
  }

  function addSoftenedAcceleration(
    source,
    targetX,
    targetY,
    gravity,
    softeningSq,
  ) {
    const dx = source.x - targetX;
    const dy = source.y - targetY;
    const softened = dx * dx + dy * dy + softeningSq;
    const invSoftenedDistCubed = 1 / Math.pow(softened, 1.5);

    return {
      x: gravity * source.mass * dx * invSoftenedDistCubed,
      y: gravity * source.mass * dy * invSoftenedDistCubed,
    };
  }

  function createSpiralStars(galaxy, count) {
    const stars = [];
    const arms = Math.floor(rand(2, 5));
    const tilt = rand(-0.38, 0.38);

    for (let i = 0; i < count; i++) {
      const t = Math.pow(Math.random(), 0.62);
      const radius = 4 + t * galaxy.radius * rand(0.55, 1.32);
      const arm = i % arms;
      const base = (arm / arms) * Math.PI * 2;
      const theta =
        base +
        radius * galaxy.winding * galaxy.spin +
        rand(-0.28, 0.28) * (1 + t);
      const diskNoise = rand(-4, 4) * (1 + t * 2.4);
      const flatten = 0.58 + tilt;
      const localX =
        Math.cos(theta) * radius + Math.cos(theta + Math.PI / 2) * diskNoise;
      const localY =
        (Math.sin(theta) * radius + Math.sin(theta + Math.PI / 2) * diskNoise) *
        flatten;
      const px = galaxy.x + localX;
      const py = galaxy.y + localY;
      const dx = px - galaxy.x;
      const dy = py - galaxy.y;
      const dist = Math.max(6, Math.hypot(dx, dy));
      const hostPull = addSoftenedAcceleration(
        galaxy,
        px,
        py,
        GRAVITY,
        STAR_SOFTENING_SQ,
      );
      const inwardX = -dx / dist;
      const inwardY = -dy / dist;
      const inwardAcceleration = Math.max(
        0,
        hostPull.x * inwardX + hostPull.y * inwardY,
      );
      const orbital = Math.sqrt(inwardAcceleration * dist);
      const tangentX = (-dy / dist) * galaxy.spin;
      const tangentY = (dx / dist) * galaxy.spin;

      stars.push({
        galaxyId: galaxy.id,
        x: px,
        y: py,
        vx: galaxy.vx + tangentX * orbital * rand(0.96, 1.04),
        vy: galaxy.vy + tangentY * orbital * rand(0.96, 1.04),
        size: rand(0.7, 1.65),
        alpha: rand(0.58, 0.98),
        color: galaxy.color,
      });
    }

    return stars;
  }

  function resetSimulation() {
    const count = randInt(MIN_GALAXIES, MAX_GALAXIES);
    const starsPerGalaxy = STARS_PER_GALAXY;
    sim.time = 0;
    sim.steadyTime = 0;
    sim.paused = false;
    sim.panX = 0;
    sim.panY = 0;
    sim.zoom = count > 5 ? 0.72 : 0.82;
    sim.galaxies = [];
    sim.stars = [];

    for (let i = 0; i < count; i++) {
      const galaxy = createGalaxy(i, count, starsPerGalaxy);
      sim.galaxies.push(galaxy);
    }

    for (const galaxy of sim.galaxies) {
      sim.stars.push(...createSpiralStars(galaxy, starsPerGalaxy));
    }
  }

  function updateGalaxies(dt) {
    const acceleration = sim.galaxies.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < sim.galaxies.length; i++) {
      const a = sim.galaxies[i];

      for (let j = i + 1; j < sim.galaxies.length; j++) {
        const b = sim.galaxies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const softened = dx * dx + dy * dy + GALAXY_SOFTENING_SQ;
        const invSoftenedDistCubed = 1 / Math.pow(softened, 1.5);
        const pairForceX = GRAVITY * dx * invSoftenedDistCubed;
        const pairForceY = GRAVITY * dy * invSoftenedDistCubed;

        acceleration[i].x += b.mass * pairForceX;
        acceleration[i].y += b.mass * pairForceY;
        acceleration[j].x -= a.mass * pairForceX;
        acceleration[j].y -= a.mass * pairForceY;
      }
    }

    for (let i = 0; i < sim.galaxies.length; i++) {
      const galaxy = sim.galaxies[i];
      galaxy.vx += acceleration[i].x * dt;
      galaxy.vy += acceleration[i].y * dt;
      galaxy.x += galaxy.vx * dt;
      galaxy.y += galaxy.vy * dt;
    }
  }

  function updateStars(dt) {
    for (const star of sim.stars) {
      let ax = 0;
      let ay = 0;

      for (const galaxy of sim.galaxies) {
        const acceleration = addSoftenedAcceleration(
          galaxy,
          star.x,
          star.y,
          GRAVITY,
          STAR_SOFTENING_SQ,
        );
        ax += acceleration.x;
        ay += acceleration.y;
      }

      star.vx += ax * dt;
      star.vy += ay * dt;
      star.x += star.vx * dt;
      star.y += star.vy * dt;
    }
  }

  function drawBackground() {
    ctx.fillStyle = "#050711";
    ctx.fillRect(0, 0, sim.width, sim.height);

    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 140; i++) {
      const x = (i * 179.3) % sim.width;
      const y = (i * 311.7) % sim.height;
      const twinkle = 0.42 + Math.sin(sim.time * 0.9 + i) * 0.22;
      ctx.fillStyle = `rgba(222, 230, 255, ${twinkle})`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }

  function draw() {
    drawBackground();
    ctx.save();
    ctx.translate(sim.width / 2 + sim.panX, sim.height / 2 + sim.panY);
    ctx.scale(sim.zoom, sim.zoom);

    ctx.globalCompositeOperation = "lighter";
    for (const star of sim.stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
    for (const galaxy of sim.galaxies) {
      const glow = ctx.createRadialGradient(
        galaxy.x,
        galaxy.y,
        0,
        galaxy.x,
        galaxy.y,
        22,
      );
      glow.addColorStop(0, "rgba(255,255,255,0.82)");
      glow.addColorStop(0.28, galaxy.color);
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.86;
      ctx.beginPath();
      ctx.arc(galaxy.x, galaxy.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function step(timestamp) {
    if (!step.last) {
      step.last = timestamp;
    }
    const frameDt = Math.min(0.04, (timestamp - step.last) / 1000);
    step.last = timestamp;

    if (!sim.paused) {
      const dt = frameDt * sim.speed;
      let remaining = dt;

      while (remaining > 0) {
        const substep = Math.min(MAX_SUBSTEP, remaining);
        updateGalaxies(substep);
        updateStars(substep);
        sim.time += substep;
        remaining -= substep;
      }

      updateAutoReset(dt);
    }

    draw();
    requestAnimationFrame(step);
  }

  function getCoreStats() {
    let totalMass = 0;
    let centerX = 0;
    let centerY = 0;
    let centerVx = 0;
    let centerVy = 0;
    let avgSpeed = 0;

    for (const galaxy of sim.galaxies) {
      totalMass += galaxy.mass;
      centerX += galaxy.x * galaxy.mass;
      centerY += galaxy.y * galaxy.mass;
      centerVx += galaxy.vx * galaxy.mass;
      centerVy += galaxy.vy * galaxy.mass;
    }

    centerX /= totalMass;
    centerY /= totalMass;
    centerVx /= totalMass;
    centerVy /= totalMass;

    for (const galaxy of sim.galaxies) {
      avgSpeed += Math.hypot(galaxy.vx - centerVx, galaxy.vy - centerVy);
    }

    avgSpeed /= sim.galaxies.length;

    let maxRadius = 0;
    for (const galaxy of sim.galaxies) {
      maxRadius = Math.max(
        maxRadius,
        Math.hypot(galaxy.x - centerX, galaxy.y - centerY),
      );
    }

    return { avgSpeed, maxRadius };
  }

  function updateAutoReset(dt) {
    if (sim.time >= AUTO_RESET_TIME) {
      resetSimulation();
      return;
    }

    if (sim.time < STEADY_CHECK_AFTER) {
      sim.steadyTime = 0;
      return;
    }

    const stats = getCoreStats();
    const isSteady =
      stats.maxRadius < STEADY_CORE_RADIUS && stats.avgSpeed < STEADY_AVG_SPEED;
    sim.steadyTime = isSteady ? sim.steadyTime + dt : 0;

    if (sim.steadyTime >= STEADY_REQUIRED_TIME) {
      resetSimulation();
    }
  }

  function bindControls() {
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        sim.paused = !sim.paused;
      } else if (event.code === "Escape") {
        event.preventDefault();
        resetSimulation();
      }
    });

    canvas.addEventListener("pointerdown", (event) => {
      sim.dragging = true;
      sim.dragX = event.clientX;
      sim.dragY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!sim.dragging) {
        return;
      }
      sim.panX += event.clientX - sim.dragX;
      sim.panY += event.clientY - sim.dragY;
      sim.dragX = event.clientX;
      sim.dragY = event.clientY;
    });
    canvas.addEventListener("pointerup", () => {
      sim.dragging = false;
    });
    canvas.addEventListener("pointercancel", () => {
      sim.dragging = false;
    });
    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        sim.zoom = Math.min(2.2, Math.max(0.45, sim.zoom + direction * 0.08));
      },
      { passive: false },
    );
  }

  window.addEventListener("resize", () => {
    resize();
    resetSimulation();
  });

  resize();
  bindControls();
  resetSimulation();
  requestAnimationFrame(step);
})();
