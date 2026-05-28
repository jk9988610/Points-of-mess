(function () {
  /** 对话圈：判定与绘制共用同一半径（世界坐标 0～1） */
  const DIALOGUE_ZONE_RADIUS = 0.24;
  const INTERACT_RADIUS = DIALOGUE_ZONE_RADIUS;
  const TALK_ZONE_RADIUS = DIALOGUE_ZONE_RADIUS;
  /** 仅点中角色圆点才算点到角色（橙圈内空地可移动） */
  const HIT_CHARACTER_RADIUS = 0.045;
  const PLAYER_RADIUS = 0.018;
  const CHAR_RADIUS = 0.022;
  const MOVE_SPEED = 0.42;

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function clampPointToTalkZone(point, character) {
    const d = dist(point, character);
    if (d <= TALK_ZONE_RADIUS || d < 1e-6) {
      return { ...point };
    }
    const t = TALK_ZONE_RADIUS / d;
    return {
      x: character.x + (point.x - character.x) * t,
      y: character.y + (point.y - character.y) * t,
    };
  }

  window.GameMap = {
    DIALOGUE_ZONE_RADIUS,
    HIT_CHARACTER_RADIUS,
    INTERACT_RADIUS,
    TALK_ZONE_RADIUS,
    PLAYER_RADIUS,
    CHAR_RADIUS,
    MOVE_SPEED,
    dist,
    isInTalkZone(player, character) {
      if (!player || !character) {
        return false;
      }
      return dist(player, character) < TALK_ZONE_RADIUS;
    },
    clampPointToTalkZone,
    clampPlayerToTalkZone(player, character) {
      return clampPointToTalkZone(player, character);
    },
    talkZoneRadiusPx(canvas) {
      const w = canvas.clientWidth || canvas.width;
      const h = canvas.clientHeight || canvas.height;
      return TALK_ZONE_RADIUS * Math.min(w, h);
    },
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

      const zonePx = TALK_ZONE_RADIUS * Math.min(w, h);

      for (const ch of characters) {
        const cx = ch.x * w;
        const cy = ch.y * h;
        const near =
          highlightId === ch.id ||
          (player && dist(player, ch) < DIALOGUE_ZONE_RADIUS);
        const active = talkingId === ch.id;
        const playerInZone =
          active && player && dist(player, ch) < DIALOGUE_ZONE_RADIUS;

        if (active || near) {
          ctx.beginPath();
          ctx.arc(cx, cy, zonePx, 0, Math.PI * 2);
          if (active) {
            ctx.fillStyle = playerInZone
              ? "rgba(249,115,22,0.08)"
              : "rgba(249,115,22,0.04)";
            ctx.fill();
            ctx.strokeStyle = playerInZone
              ? "rgba(249,115,22,0.85)"
              : "rgba(249,115,22,0.45)";
            ctx.lineWidth = 2;
            ctx.setLineDash(playerInZone ? [] : [6, 5]);
          } else {
            ctx.strokeStyle = "rgba(255,255,255,0.35)";
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
          }
          ctx.stroke();
          ctx.setLineDash([]);
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
    hitCharacter(characters, worldPoint, radius = HIT_CHARACTER_RADIUS) {
      let best = null;
      let bestD = radius;
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
