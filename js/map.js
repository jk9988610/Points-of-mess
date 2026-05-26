(function () {
  const INTERACT_RADIUS = 0.12;
  const PLAYER_RADIUS = 0.018;
  const CHAR_RADIUS = 0.022;
  const MOVE_SPEED = 0.42;

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  window.GameMap = {
    INTERACT_RADIUS,
    PLAYER_RADIUS,
    CHAR_RADIUS,
    MOVE_SPEED,
    dist,
    worldToCanvas(canvas, x, y) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: x * rect.width,
        y: y * rect.height,
        rect,
      };
    },
    canvasToWorld(canvas, clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    },
    draw(ctx, canvas, { player, characters, talkingId, highlightId, highlightDocId }) {
      const w = canvas.clientWidth || canvas.width;
      const h = canvas.clientHeight || canvas.height;
      ctx.save();
      const dpr = canvas.width / w || 1;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, w * 0.75);
      bg.addColorStop(0, "#1e1b4b");
      bg.addColorStop(1, "#0f172a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 40; i++) {
        const sx = ((i * 97) % 1000) / 1000;
        const sy = ((i * 53) % 1000) / 1000;
        ctx.beginPath();
        ctx.arc(sx * w, sy * h, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fill();
      }

      window.GameDesktop?.drawDesktopDocs?.(ctx, canvas, {
        player,
        highlightDocId,
        talkingId,
      });

      for (const ch of characters) {
        const cx = ch.x * w;
        const cy = ch.y * h;
        const near =
          highlightId === ch.id ||
          (player && dist(player, ch) < INTERACT_RADIUS);
        const active = talkingId === ch.id;

        if (near || active) {
          ctx.beginPath();
          ctx.arc(cx, cy, CHAR_RADIUS * w * 2.8, 0, Math.PI * 2);
          ctx.strokeStyle = active ? "rgba(249,115,22,0.9)" : "rgba(255,255,255,0.35)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, CHAR_RADIUS * w, 0, Math.PI * 2);
        ctx.fillStyle = ch.color || "#f97316";
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = `${Math.max(12, w * 0.028)}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(ch.name, cx, cy + CHAR_RADIUS * w + 18);
      }

      if (player) {
        const px = player.x * w;
        const py = player.y * h;
        ctx.beginPath();
        ctx.arc(px, py, PLAYER_RADIUS * w, 0, Math.PI * 2);
        ctx.fillStyle = "#818cf8";
        ctx.fill();
        ctx.strokeStyle = "#c7d2fe";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    },
    tickMove(player, moveTarget, dt) {
      if (!moveTarget) {
        return player;
      }
      const d = dist(player, moveTarget);
      if (d < 0.004) {
        return { ...moveTarget };
      }
      const step = MOVE_SPEED * dt;
      const t = Math.min(1, step / d);
      return {
        x: player.x + (moveTarget.x - player.x) * t,
        y: player.y + (moveTarget.y - player.y) * t,
      };
    },
    hitCharacter(characters, worldPoint) {
      let best = null;
      let bestD = INTERACT_RADIUS;
      for (const ch of characters) {
        const d = dist(worldPoint, ch);
        if (d < bestD) {
          bestD = d;
          best = ch;
        }
      }
      return best;
    },
    isNearPlayer(player, character) {
      return dist(player, character) < INTERACT_RADIUS;
    },
  };
})();
