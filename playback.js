/* Shared by the live page and the offline zip page. The zip copies this file in. */
(function (root) {
  const SHARE_KEYS = ["x", "y", "z", "jaar", "jaar2", "van", "tot", "sat", "lijn", "split", "tempo", "plaats", "modus", "links", "rechts", "overgang"];
  const NOTE_ICON = 24;
  const NOTE_ICON_GAP = 7;
  const NOTE_PART_GAP = 20;
  const KIND_ICONS = {
    map: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M1 4 8 1l8 3 7-3v19l-7 3-8-3-7 3ZM8 1v19M16 4v19" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    sat: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M2 7h5l2-4h6l2 4h5v14H2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="14" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const KIND_NAMES = { map: "kaart", sat: "luchtfoto" };

  function smooth(amount) {
    return amount * amount * (3 - 2 * amount);
  }

  function composite(context, under, over, split, blend, width, height) {
    const t = Math.min(1, Math.max(0, split));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.drawImage(under, 0, 0);
    if (t > 0) {
      context.save();
      if (blend === "fade") {
        context.globalAlpha = t;
      } else {
        const edge = (1 - t) * width;
        context.beginPath();
        context.rect(edge, 0, width - edge, height);
        context.clip();
      }
      context.drawImage(over, 0, 0);
      context.restore();
    }
    context.globalAlpha = 1;
  }

  function wipe(context, from, to, axis, sign, t, width, height) {
    const amount = Math.min(1, Math.max(0, t));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.drawImage(from, 0, 0);
    context.save();
    context.beginPath();
    if (axis === "x") {
      if (sign > 0) context.rect(0, 0, amount * width, height);
      else context.rect((1 - amount) * width, 0, amount * width, height);
    } else if (sign > 0) {
      const edge = (1 - amount) * height;
      context.rect(0, edge, width, height - edge);
    } else {
      context.rect(0, 0, width, amount * height);
    }
    context.clip();
    context.drawImage(to, 0, 0);
    context.restore();
  }

  function drawMissing(context, kind, width, height) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.fillStyle = "#0c0c0c";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#f3ecdf";
    context.font = "600 42px 'Segoe UI', 'Helvetica Neue', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      kind === "map" ? "Geen kaart beschikbaar" : "Geen beeldmateriaal beschikbaar",
      width / 2,
      height / 2,
    );
    context.restore();
  }

  function drawNoteIcon(context, kind, x, y) {
    context.save();
    context.translate(x, y - NOTE_ICON / 2);
    context.lineWidth = 2.2;
    context.lineJoin = "round";
    context.strokeStyle = context.fillStyle;
    context.beginPath();
    if (kind === "map") {
      context.moveTo(1, 4);
      context.lineTo(8, 1);
      context.lineTo(16, 4);
      context.lineTo(23, 1);
      context.lineTo(23, 20);
      context.lineTo(16, 23);
      context.lineTo(8, 20);
      context.lineTo(1, 23);
      context.closePath();
      context.moveTo(8, 1);
      context.lineTo(8, 20);
      context.moveTo(16, 4);
      context.lineTo(16, 23);
      context.stroke();
    } else {
      context.moveTo(2, 7);
      context.lineTo(7, 7);
      context.lineTo(9, 3);
      context.lineTo(15, 3);
      context.lineTo(17, 7);
      context.lineTo(22, 7);
      context.lineTo(22, 21);
      context.lineTo(2, 21);
      context.closePath();
      context.stroke();
      context.beginPath();
      context.arc(12, 14, 4.5, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function noteParts(notes) {
    return [["map", notes?.map], ["sat", notes?.sat]]
      .filter(([, year]) => year != null && Number.isFinite(Number(year)))
      .map(([kind, year]) => ({ kind, text: String(year) }));
  }

  function stamp(context, {
    label, line, notes, box = "left", credit = "right", yearBox = true, creditLine = true,
    width, height, fallback,
  } = {}) {
    context.save();
    if (yearBox) {
      context.save();
      const scale = 0.75;
      if (box === "right") {
        context.translate(width, 0);
        context.scale(scale, scale);
        context.translate(-width, 0);
      } else {
        context.scale(scale, scale);
      }
      const parts = noteParts(notes);
      const padX = 18;
      context.font = "600 52px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
      const yearW = context.measureText(String(label)).width;
      context.font = "600 26px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
      for (const part of parts) part.width = context.measureText(part.text).width;
      const noteW = parts.reduce((sum, part) => sum + NOTE_ICON + NOTE_ICON_GAP + part.width, 0)
        + NOTE_PART_GAP * Math.max(0, parts.length - 1);
      const textW = Math.max(yearW, noteW);
      const boxH = parts.length ? 112 : 72;
      const boxW = textW + padX * 2;
      const boxX = box === "right" ? width - 28 - boxW : 28;
      context.fillStyle = "rgba(243, 236, 223, 0.94)";
      context.fillRect(boxX, 28, boxW, boxH);
      context.fillStyle = "#1c1916";
      context.textBaseline = "middle";
      context.font = "600 52px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
      const middle = boxX + padX + textW / 2;
      context.fillText(String(label), middle - yearW / 2, 28 + 36);
      if (parts.length) {
        context.font = "600 26px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
        context.fillStyle = "rgba(28, 25, 22, 0.78)";
        let x = middle - noteW / 2;
        const y = 28 + 84;
        for (const part of parts) {
          drawNoteIcon(context, part.kind, x, y);
          x += NOTE_ICON + NOTE_ICON_GAP;
          context.fillText(part.text, x, y + 1);
          x += part.width + NOTE_PART_GAP;
        }
      }
      context.restore();
    }
    if (creditLine) {
      context.font = "16px 'Segoe UI', 'Helvetica Neue', sans-serif";
      context.fillStyle = "rgba(243, 236, 223, 0.95)";
      context.textAlign = credit;
      context.textBaseline = "alphabetic";
      context.shadowColor = "rgba(28, 25, 22, 0.55)";
      context.shadowBlur = 6;
      context.fillText(line || fallback || "", credit === "right" ? width - 28 : 28, height - 26);
    }
    context.restore();
  }

  function drawMapCredits(context, { split, blend, width, height, credits }) {
    const t = Math.min(1, Math.max(0, Number(split) || 0));
    const fade = blend === "fade";
    const photoOnRight = (credits || []).some((credit, side) => {
      if (!credit || credit.overlay || credit.anchor === "left" || !credit.text) return false;
      if (fade) return true;
      return side === 0 ? t > 0.02 : t <= 0.02;
    });
    (credits || []).forEach((credit, side) => {
      if (!credit?.overlay || !credit.text) return;
      let left = 0;
      let right = width;
      if (!fade) {
        if (side === 0) {
          if (t <= 0.02) return;
          left = (1 - t) * width;
        } else {
          if (t >= 0.98) return;
          right = (1 - t) * width;
        }
      } else if (side === 0 && t <= 0.02) {
        return;
      }
      if (right - left < 48) return;
      const stacked = fade && side === 0 && credits[1]?.overlay;
      const lift = (right > width - 2 && photoOnRight ? 28 : 0) + (stacked ? 18 : 0);
      context.save();
      context.font = "13px 'Segoe UI', 'Helvetica Neue', sans-serif";
      context.fillStyle = "#000000";
      context.textAlign = "right";
      context.textBaseline = "alphabetic";
      context.shadowBlur = 0;
      context.beginPath();
      context.rect(left, 0, right - left, height);
      context.clip();
      context.fillText(credit.text, right - 12, height - 16 - lift);
      context.restore();
    });
  }

  function shareUrl(href, state) {
    const url = new URL(href, "https://local.invalid/");
    for (const key of SHARE_KEYS) url.searchParams.delete(key);
    url.searchParams.delete("t");
    const round = (value, digits) => String(Math.round(value * (10 ** digits)) / (10 ** digits));
    url.searchParams.set("x", round(state.x, 2));
    url.searchParams.set("y", round(state.y, 2));
    url.searchParams.set("z", round(state.zoom, 3));
    url.searchParams.set("jaar", String(state.year));
    if (state.compare) {
      url.searchParams.set("modus", "vergelijken");
      url.searchParams.set("jaar2", String(state.year2));
    }
    const shareKind = (kind) => (kind === "map" ? "kaart" : "foto");
    url.searchParams.set("links", shareKind(state.left));
    url.searchParams.set("rechts", shareKind(state.right));
    if (state.from) url.searchParams.set("van", state.from);
    if (state.to) url.searchParams.set("tot", state.to);
    url.searchParams.set("sat", state.satellite ? "1" : "0");
    url.searchParams.set("split", round(state.split, 3));
    if (state.hold) url.searchParams.set("tempo", String(state.hold));
    url.searchParams.set("overgang", state.blend === "fade" ? "vervagen" : "horizontaal");
    if (state.place) url.searchParams.set("plaats", String(state.place).slice(0, 120));
    return url.toString();
  }

  function copyText(text) {
    const fallback = () => {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.appendChild(field);
      field.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      field.remove();
      return copied;
    };
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, fallback);
    }
    return Promise.resolve(fallback());
  }

  function nextIndex(length, same, from, delta) {
    let index = from + delta;
    while (index >= 0 && index < length && same(index, from)) index += delta;
    if (index < 0 || index >= length) return from;
    if (delta < 0) {
      while (index > 0 && same(index - 1, index)) index -= 1;
    }
    return index;
  }

  function compareTiming(holdMs) {
    const hold = (Number(holdMs) || 800) * 2.5;
    return { holdMs: hold, fadeMs: Math.min(3500, hold) };
  }

  function compareMix(t, { holdMs, fadeMs }) {
    const p = t % (2 * (holdMs + fadeMs));
    if (p < holdMs) return 0;
    if (p < holdMs + fadeMs) return smooth((p - holdMs) / fadeMs);
    if (p < 2 * holdMs + fadeMs) return 1;
    return 1 - smooth((p - 2 * holdMs - fadeMs) / fadeMs);
  }

  function otherKind(kind) {
    return kind === "map" ? "sat" : "map";
  }

  function bindTabs(root) {
    const tabs = [...root.querySelectorAll("[role='tab']")];
    const select = (tab) => {
      for (const item of tabs) {
        const on = item === tab;
        item.setAttribute("aria-selected", String(on));
        const panel = root.querySelector(`#${item.getAttribute("aria-controls")}`);
        if (panel) panel.hidden = !on;
      }
    };
    for (const tab of tabs) tab.addEventListener("click", () => select(tab));
  }

  function colophonLines(entries) {
    const byText = new Map();
    const ordered = [...entries].filter((entry) => entry.text).sort((a, b) => a.year - b.year);
    for (const entry of ordered) {
      const years = byText.get(entry.text) || [];
      years.push(entry.year);
      byText.set(entry.text, years);
    }
    return [...byText.entries()].map(([text, years]) => {
      const ranges = [];
      for (const year of years) {
        const last = ranges.at(-1);
        if (last && year <= last[1] + 1) last[1] = year;
        else ranges.push([year, year]);
      }
      const label = ranges.map(([start, end]) => (start === end ? String(start) : `${start}–${end}`)).join(", ");
      return `${label}: ${text}`;
    });
  }

  function boxesOverlap(a, b, gap = 8) {
    return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
  }

  function unionRect(elements) {
    const rects = elements.map((el) => el.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function layoutHelp({ dialog, tipsRoot, tips, anchor }) {
    tipsRoot.replaceChildren();
    if (!dialog.open) return;
    const cardEl = dialog.querySelector(".help-card");
    const vw = dialog.clientWidth;
    const formBottom = anchor.getBoundingClientRect().bottom;
    const tipGap = 22;
    const gapTop = formBottom + tipGap;
    cardEl.style.maxHeight = "";
    cardEl.style.top = "";
    cardEl.style.transform = "";
    const cardRect = cardEl.getBoundingClientRect();
    const card = { left: cardRect.left, top: cardRect.top, right: cardRect.right, bottom: cardRect.bottom };
    const obstacles = [card];
    const bands = [];
    const items = [];
    const helpPiece = (className, box) => {
      const el = document.createElement("div");
      el.className = className;
      for (const [key, value] of Object.entries(box)) el.style[key] = `${Math.round(value)}px`;
      tipsRoot.append(el);
      return el;
    };
    for (const tip of tips) {
      const shown = [...document.querySelectorAll(tip.target)].filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const groups = tip.union ? (shown.length ? [shown] : []) : shown.map((el) => [el]);
      for (const group of groups) items.push({ ...tip, rect: unionRect(group) });
    }
    const addStem = (x, y, w, h) => {
      if (w < 1 || h < 1) return;
      const stem = { left: x, top: y, right: x + w, bottom: y + h };
      const hit = obstacles.find((other) => boxesOverlap(stem, other, 0));
      if (!hit) {
        helpPiece("help-stem", { left: x, top: y, width: w, height: h });
        return;
      }
      if (h <= 4) {
        if (stem.left < hit.left) addStem(stem.left, y, Math.min(stem.right, hit.left) - stem.left, h);
        if (stem.right > hit.right) addStem(Math.max(stem.left, hit.right), y, stem.right - Math.max(stem.left, hit.right), h);
      } else {
        if (stem.top < hit.top) addStem(x, stem.top, w, Math.min(stem.bottom, hit.top) - stem.top);
        if (stem.bottom > hit.bottom) addStem(x, Math.max(stem.top, hit.bottom), w, stem.bottom - Math.max(stem.top, hit.bottom));
      }
    };
    const connect = (entry, box) => {
      const rect = entry.item.rect;
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;
      const labelX = (box.left + box.right) / 2;
      const labelY = (box.top + box.bottom) / 2;
      const beside = Math.abs(targetX - labelX) > Math.abs(targetY - labelY)
        && box.bottom > rect.top && box.top < rect.bottom;
      if (beside) {
        const y = Math.min(box.bottom - 2, Math.max(box.top + 2, targetY));
        const from = targetX > labelX ? box.right : box.left;
        const to = targetX > labelX ? rect.left : rect.right;
        addStem(Math.min(from, to), y - 1, Math.abs(to - from), 2);
        return;
      }
      const yLabel = targetY >= labelY ? box.bottom : box.top;
      const yTarget = targetY >= labelY ? rect.top - 3 : rect.bottom + 3;
      if (Math.abs(labelX - targetX) < 18) {
        addStem(targetX - 1, Math.min(yLabel, yTarget), 2, Math.abs(yTarget - yLabel));
        return;
      }
      addStem(Math.min(labelX, targetX), yLabel - 1, Math.abs(targetX - labelX), 2);
      addStem(targetX - 1, Math.min(yLabel, yTarget), 2, Math.abs(yTarget - yLabel));
    };
    const alignRow = (row, rowTop) => {
      const boxes = row.map((entry) => {
        const cx = entry.item.rect.left + entry.item.rect.width / 2;
        const ideal = Math.min(vw - entry.w - 8, Math.max(8, cx - entry.w / 2));
        return { ...entry, cx, ideal, left: ideal };
      }).sort((a, b) => a.cx - b.cx);
      for (let i = 1; i < boxes.length; i += 1) {
        const minLeft = boxes[i - 1].left + boxes[i - 1].w + 8;
        if (boxes[i].left < minLeft) boxes[i].left = minLeft;
      }
      const overflow = boxes.length ? boxes.at(-1).left + boxes.at(-1).w - (vw - 8) : 0;
      if (overflow > 0) for (const box of boxes) box.left -= overflow;
      for (const pin of boxes.filter((box) => box.item.pin)) {
        pin.left = pin.ideal;
        const index = boxes.indexOf(pin);
        for (let i = index - 1; i >= 0; i -= 1) {
          const maxLeft = boxes[i + 1].left - 8 - boxes[i].w;
          if (boxes[i].item.pin || boxes[i].left <= maxLeft) continue;
          boxes[i].left = maxLeft;
        }
        for (let i = index + 1; i < boxes.length; i += 1) {
          const minLeft = boxes[i - 1].left + boxes[i - 1].w + 8;
          if (boxes[i].item.pin) break;
          if (boxes[i].left < minLeft) boxes[i].left = minLeft;
        }
      }
      for (const box of boxes) box.dy = 0;
      const stemOf = (box) => {
        const labelX = box.left + box.w / 2;
        const targetX = box.item.rect.left + box.item.rect.width / 2;
        const labelY = rowTop + box.h / 2;
        const targetY = box.item.rect.top + box.item.rect.height / 2;
        return {
          x1: Math.min(labelX, targetX),
          x2: Math.max(labelX, targetX),
          targetX,
          yEdge: targetY >= labelY ? rowTop + box.h : rowTop,
          down: targetY < labelY,
        };
      };
      const coversStem = (box, stem) => {
        if (stem.yEdge < rowTop - 1 || stem.yEdge > rowTop + box.h + 1) return false;
        const right = box.left + box.w;
        const onDrop = box.left < stem.targetX && right > stem.targetX;
        const onRun = box.left < stem.x2 - 8 && right > stem.x1 + 8;
        return onDrop || onRun;
      };
      const covered = [];
      for (const owner of boxes) {
        if (owner.item.wide) continue;
        const stem = stemOf(owner);
        for (const other of boxes) {
          if (other === owner || other.item.pin || other.item.wide) continue;
          if (coversStem(other, stem)) covered.push({ other, owner, down: stem.down });
        }
      }
      for (const { other, owner, down } of covered) {
        const mutual = covered.some((pair) => pair.other === owner && pair.owner === other);
        if (mutual && other.w > owner.w) continue;
        other.dy = down ? 14 : -14;
      }
      for (const box of boxes) {
        const top = rowTop + box.dy;
        const placed = { left: box.left, top, right: box.left + box.w, bottom: top + box.h };
        if (box.left < 4 || placed.right > vw - 4 || boxesOverlap(placed, card, 4)) {
          box.label.remove();
          continue;
        }
        box.label.style.left = `${Math.round(box.left)}px`;
        box.label.style.top = `${Math.round(top)}px`;
        obstacles.push(placed);
        connect(box, placed);
      }
    };
    const packAgainst = (entries, edge, grow, limit) => {
      let index = 0;
      let cursor = edge;
      const fits = (rowTop, rowH) => (grow < 0 ? rowTop >= limit - 2 : rowTop + rowH <= limit + 2);
      while (index < entries.length) {
        if (entries[index].item.wide) {
          const entry = entries[index];
          index += 1;
          const rowTop = grow < 0 ? cursor - entry.h : cursor;
          if (!fits(rowTop, entry.h)) {
            entry.label.remove();
            continue;
          }
          alignRow([entry], rowTop);
          cursor = grow < 0 ? rowTop - 4 : rowTop + entry.h + 4;
          continue;
        }
        const row = [];
        let used = 8;
        let rowH = 0;
        while (index < entries.length && !entries[index].item.wide) {
          const entry = entries[index];
          if (row.length && used + entry.w > vw - 8) break;
          row.push(entry);
          rowH = Math.max(rowH, entry.h);
          used += entry.w + 8;
          index += 1;
        }
        const rowTop = grow < 0 ? cursor - rowH : cursor;
        if (!fits(rowTop, rowH)) {
          for (const entry of row) entry.label.remove();
          for (let rest = index; rest < entries.length; rest += 1) entries[rest].label.remove();
          return;
        }
        alignRow(row, rowTop);
        cursor = grow < 0 ? rowTop - 4 : rowTop + rowH + 4;
      }
    };
    const measured = items.map((item) => {
      helpPiece("help-ring", {
        left: item.rect.left - 4,
        top: item.rect.top - 4,
        width: item.rect.width + 8,
        height: item.rect.height + 8,
      });
      const label = document.createElement("div");
      label.className = item.wide ? "help-tip wide" : "help-tip";
      label.textContent = item.text;
      if (item.wide) label.style.maxWidth = `${Math.round(Math.min(item.rect.width, vw - 24))}px`;
      tipsRoot.append(label);
      return { item, label, w: label.offsetWidth, h: label.offsetHeight };
    });
    const upper = measured
      .filter((entry) => entry.item.side !== "left" && entry.item.side !== "right" && entry.item.rect.top < card.top)
      .sort((a, b) => (a.item.wide ? 1 : 0) - (b.item.wide ? 1 : 0) || a.item.rect.left - b.item.rect.left);
    const lower = measured
      .filter((entry) => !upper.includes(entry))
      .sort((a, b) => (a.item.wide ? 1 : 0) - (b.item.wide ? 1 : 0) || a.item.rect.left - b.item.rect.left);
    packAgainst(upper, gapTop, 1, card.top - 8);
    const bottomRow = lower.filter((entry) => entry.item.row === "bottom");
    const beside = lower.filter((entry) => entry.item.row !== "bottom");
    if (bottomRow.length) {
      const rowH = Math.max(...bottomRow.map((entry) => entry.h));
      const anchorTop = Math.min(...bottomRow.map((entry) => entry.item.rect.top));
      let rowTop = anchorTop - tipGap - rowH;
      if (rowTop < card.bottom + 8) rowTop = card.bottom + 8;
      alignRow(bottomRow, rowTop);
      bands.push({ left: 0, top: rowTop, right: vw, bottom: rowTop + rowH });
    }
    placeBesideControls(beside);

    function placeBesideControls(entries) {
      const width = dialog.clientWidth;
      const controls = ["#splitbar", "#yearbars", "#play"].flatMap((sel) => {
        const el = document.querySelector(sel);
        if (!el || el.hidden) return [];
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return [];
        return [{ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }];
      });
      const taken = [];
      const blocked = (box) => [...obstacles, ...bands, ...controls, ...taken].some((other) => boxesOverlap(box, other, 4));
      const preferred = (entry) => {
        const rect = entry.item.rect;
        const gap = 8;
        let left = rect.left + rect.width / 2 - entry.w / 2;
        let top = rect.top - gap - entry.h;
        const roomLeft = rect.left - gap - entry.w >= 8;
        const roomRight = rect.right + gap + entry.w <= width - 8;
        if ((entry.item.side === "left" && roomLeft) || (entry.item.side === "right" && !roomRight && roomLeft)) {
          left = rect.left - gap - entry.w;
          top = rect.top + rect.height / 2 - entry.h / 2;
        } else if (entry.item.side === "right" && roomRight) {
          left = rect.right + gap;
          top = rect.top + rect.height / 2 - entry.h / 2;
        }
        left = Math.min(width - entry.w - 8, Math.max(8, left));
        return { left, top, right: left + entry.w, bottom: top + entry.h };
      };
      const liftClear = (box) => {
        for (let guard = 0; guard < 12; guard += 1) {
          const hits = [...obstacles, ...bands, ...controls, ...taken].filter((other) => boxesOverlap(box, other, 4));
          if (!hits.length) return box;
          const nextTop = Math.min(...hits.map((hit) => hit.top)) - 6 - (box.bottom - box.top);
          if (nextTop < 4) return null;
          box = { left: box.left, top: nextTop, right: box.right, bottom: nextTop + (box.bottom - box.top) };
        }
        return null;
      };
      const commit = (entry, box) => {
        if (!box || box.left < 4 || box.right > width - 4 || blocked(box)) {
          entry.label.remove();
          return;
        }
        entry.label.style.left = `${Math.round(box.left)}px`;
        entry.label.style.top = `${Math.round(box.top)}px`;
        taken.push(box);
        obstacles.push(box);
        connect(entry, box);
      };
      const shorts = entries.filter((entry) => !entry.item.wide)
        .sort((a, b) => a.w - b.w || a.item.rect.left - b.item.rect.left);
      for (const entry of shorts) commit(entry, liftClear(preferred(entry)));
      for (const entry of entries.filter((item) => item.item.wide)) commit(entry, liftClear(preferred(entry)));
    }
  }

  function mountViewer(movie) {
    const W = 1280;
    const H = 720;
    const years = movie.years || [];
    const last = Math.max(0, years.length - 1);
    let compare = Boolean(movie.compare);
    let kinds = (movie.kinds || ["map", "sat"]).slice(0, 2);
    if (kinds[0] !== "map" && kinds[0] !== "sat") kinds[0] = "map";
    if (kinds[1] !== "map" && kinds[1] !== "sat") kinds[1] = "sat";
    if (!compare) kinds[1] = otherKind(kinds[0]);
    let indexes = (movie.indexes || [movie.index || 0, movie.index || 0]).map((value) => (
      Math.min(last, Math.max(0, value | 0))
    ));
    let index = Math.min(last, Math.max(0, movie.index | 0));
    let split = movie.split == null ? 1 : Math.min(1, Math.max(0, Number(movie.split)));
    let blend = movie.blend === "fade" ? "fade" : "x";
    let hold = ["400", "800", "1500"].includes(String(movie.hold)) ? String(movie.hold) : "800";
    let active = 0;
    let playing = false;
    let playToken = 0;
    let hasPresented = false;
    let cancelWait = null;
    const toCanvas = document.createElement("canvas");
    const images = {};
    const leftCanvas = document.createElement("canvas");
    const rightCanvas = document.createElement("canvas");
    const fromCanvas = document.createElement("canvas");
    [leftCanvas, rightCanvas, fromCanvas, toCanvas].forEach((canvas) => {
      canvas.width = W;
      canvas.height = H;
    });

    document.title = movie.place ? `Tijdmachine · ${movie.place}` : "Tijdmachine";
    document.body.innerHTML = `<style>
      :root { color-scheme: dark; --ink: #1c1916; --paper: #f3ecdf; --muted: #b5a894; --red: #c4492c; --kind: var(--red); }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--ink); color: var(--paper); font: 16px/1.4 "Segoe UI", "Helvetica Neue", sans-serif; }
      header, form, .stage, .transport, .note { width: min(1100px, calc(100% - 32px)); margin-left: auto; margin-right: auto; }
      header { padding: 22px 0 8px; }
      .eyebrow { margin: 0 0 4px; color: var(--muted); font-size: 13px; letter-spacing: 0.04em; }
      h1 { margin: 0; font-family: Palatino, "Palatino Linotype", "Times New Roman", serif; font-size: 36px; font-weight: 500; }
      form { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 8px 0; }
      .form-actions { margin-left: auto; display: flex; gap: 8px; }
      button, select { font: 15px/1.2 "Segoe UI", sans-serif; color: var(--ink); background: #d9d0c2; border: 0; border-radius: 2px; padding: 10px 12px; }
      button { cursor: pointer; }
      button[aria-pressed="true"] { background: var(--paper); }
      .icon { width: 36px; height: 36px; padding: 0; display: grid; place-items: center; }
      .icon .icon-copied { display: none; }
      .icon.copied .icon-share { display: none; }
      .icon.copied .icon-copied { display: block; }
      .icon.failed { color: var(--red); }
      canvas { display: block; width: 100%; height: auto; background: #e7dcc4; aspect-ratio: 16/9; }
      .splitbar { display: grid; grid-template-columns: 3.2rem 30px minmax(0, 1fr) 30px 3.2rem; gap: 10px; align-items: center; margin-top: 8px; }
      .splitbar[hidden] { display: none; }
      .splitbar .bar-year:first-child { text-align: right; }
      .bar-year { color: var(--muted); font-variant-numeric: tabular-nums; }
      .transport { display: flex; gap: 12px; align-items: center; padding: 10px 0 18px; }
      #yearbars { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .yearbar { --kind: var(--red); display: grid; grid-template-columns: 30px minmax(0, 1fr) 3.4rem; gap: 10px; align-items: center; }
      .yearbar.sat, .kind-button.sat { --kind: #4f9a92; }
      .kind-button { width: 30px; height: 26px; padding: 0; display: grid; place-items: center; background: var(--kind); color: var(--ink); }
      .splitbar .kind-button { --kind: var(--red); }
      .track { position: relative; height: 36px; margin: 0 22px; cursor: ew-resize; touch-action: none; }
      .track::before { content: ""; position: absolute; left: -22px; right: -22px; top: 0; bottom: 0; }
      .zones { position: absolute; left: 0; right: 0; top: 14px; height: 8px; border-radius: 2px; overflow: hidden; pointer-events: none; }
      .zones i { position: absolute; top: 0; bottom: 0; }
      .zones i.none { background: repeating-linear-gradient(135deg, #5a5249 0 3px, #2f2924 3px 6px); }
      .zones i.have { background: var(--kind); }
      .zones i.repeat { background: #77706a; }
      .handle { position: absolute; top: 2px; width: 34px; height: 32px; margin-left: -17px; border-radius: 7px; border: 1px solid #1c1916; background: var(--paper); cursor: ew-resize; touch-action: none; }
      .handle::after { content: ""; position: absolute; left: 50%; top: 7px; bottom: 7px; width: 10px; margin-left: -5px; background: linear-gradient(to right, #1c1916 0 2px, transparent 2px 4px, #1c1916 4px 6px, transparent 6px 8px, #1c1916 8px 10px); pointer-events: none; }
      #yearbars:not(.compare) .yearbar:first-child { position: relative; z-index: 1; }
      #yearbars:not(.compare) .yearbar:first-child .handle { height: 74px; }
      #yearbars:not(.compare) .yearbar:last-child .handle { visibility: hidden; }
      .compare .yearbar.active .handle { outline: 2px solid var(--paper); outline-offset: 1px; }
      .compare .yearbar:not(.active) .handle { opacity: 0.8; }
      #play .icon-stop { display: none; }
      #play.playing .icon-play { display: none; }
      #play.playing .icon-stop { display: block; }
      .note { color: var(--muted); font-size: 13px; }
      dialog { border: 0; border-radius: 6px; padding: 16px 18px; background: var(--paper); color: var(--ink); }
      dialog::backdrop { background: rgba(28, 25, 22, 0.72); }
      dialog label { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin: 10px 0; }
      .dialog-actions { display: flex; justify-content: flex-end; margin-top: 12px; }
      #help { width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; background: transparent; overflow: hidden; }
      #help::backdrop { background: rgba(12, 11, 10, 0.6); }
      #help .help-card { position: absolute; left: 50%; top: 50%; width: min(62rem, calc(100% - 32px)); max-height: calc(100% - 48px); overflow: auto; transform: translate(-50%, -50%); padding: 12px 22px 8px; border-radius: 6px; background: var(--paper); color: var(--ink); }
      #help .help-columns { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 0 28px; }
      .dialog-tabs { display: flex; gap: 18px; margin: 0 0 16px; border-bottom: 1px solid #e4d9c8; }
      .dialog-tabs button { margin: 0; padding: 0 0 8px; background: transparent; border: 0; border-bottom: 2px solid transparent; border-radius: 0; color: #6d6256; font-size: 16px; }
      .dialog-tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--ink); }
      #settings { width: min(40rem, calc(100% - 32px)); }
      #panel-colofon { max-height: min(60vh, 28rem); overflow: auto; }
      #panel-colofon h3 { margin: 10px 0 4px; font-size: 14px; }
      #panel-colofon li { font-size: 13px; }
      #help p, #help li { font-size: 14.5px; line-height: 1.35; }
      #help-tips { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
      .help-tip { position: absolute; padding: 5px 10px; border-radius: 4px; background: #f7d774; color: var(--ink); font-size: 13px; font-weight: 600; white-space: nowrap; }
      .help-tip.wide { white-space: normal; text-align: center; font-weight: 500; line-height: 1.4; }
      .help-stem { position: absolute; background: #f7d774; }
      .help-ring { position: absolute; border: 2px solid #f7d774; border-radius: 5px; }
      @media (max-width: 800px) { #help .help-columns { grid-template-columns: 1fr; } }
    </style>
    <header><p class="eyebrow">Tijdmachine</p><h1 id="place"></h1></header>
    <form id="form">
      <button id="mode-sync" type="button">Door De Tijd Schuiven</button>
      <button id="mode-compare" type="button">Twee Jaren Vergelijken</button>
      <div class="form-actions">
        <button id="share" class="icon" type="button" aria-label="Link kopiëren" title="Link kopiëren">
          <svg class="icon-share" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.1 11.1 15.8 6.6M8.1 12.9l7.7 4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          <svg class="icon-copied" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button id="settings-open" class="icon" type="button" aria-label="Instellingen" title="Instellingen">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.49.49 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 10c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65Z"/></svg>
        </button>
        <button id="help-open" class="icon" type="button" aria-label="Hulp" title="Hulp">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.2 9.4a2.8 2.8 0 1 1 3.5 2.6c-.7.3-1.1.8-1.1 1.5V14.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="11.6" cy="17.3" r="1" fill="currentColor"/></svg>
        </button>
      </div>
    </form>
    <div class="stage">
      <canvas id="map" width="1280" height="720"></canvas>
      <div class="splitbar" id="splitbar">
        <span class="bar-year"></span>
        <button class="kind-button" type="button"></button>
        <div class="track" id="split-track" role="slider" aria-label="Scheiding tussen links en rechts" aria-valuemin="0" aria-valuemax="1">
          <div class="zones" id="split-zones"></div>
          <div class="handle" id="split-handle"></div>
        </div>
        <button class="kind-button" type="button"></button>
        <span class="bar-year"></span>
      </div>
    </div>
    <div class="transport">
      <div id="yearbars"></div>
      <button id="play" class="icon" type="button" aria-label="Afspelen" title="Afspelen">
        <svg class="icon-play" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5.14v13.72L19.5 12 8 5.14Z"/></svg>
        <svg class="icon-stop" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M6 6h12v12H6Z"/></svg>
      </button>
    </div>
    <p class="note" id="source"></p>
    <p class="note">Deze bladzijde leest de beelden naast zich. Uitgepakt openen in de browser. De link deelt dezelfde plek op de online pagina.</p>
    <dialog id="settings">
      <div class="dialog-tabs" role="tablist">
        <button id="tab-settings" type="button" role="tab" aria-controls="panel-settings" aria-selected="true">Instellingen</button>
        <button id="tab-colofon" type="button" role="tab" aria-controls="panel-colofon" aria-selected="false">Colofon</button>
      </div>
      <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings">
        <label>Afspeeltempo
          <select id="hold" aria-label="Afspeeltempo">
            <option value="400">snel</option>
            <option value="800">normaal</option>
            <option value="1500">langzaam</option>
          </select>
        </label>
        <label>Overgang
          <select id="blend" aria-label="Overgang">
            <option value="x">Horizontaal vegen</option>
            <option value="fade">Vervagen</option>
          </select>
        </label>
      </div>
      <div id="panel-colofon" role="tabpanel" aria-labelledby="tab-colofon" hidden>
        <p>Op het beeld staat de copyrighttekst van de dienst voor dat jaar.</p>
        <h3>Kaarten</h3>
        <ul id="colofon-maps"></ul>
        <h3>Luchtfoto's</h3>
        <ul id="colofon-photos"></ul>
      </div>
      <div class="dialog-actions"><button id="settings-close" type="button">Sluiten</button></div>
    </dialog>
    <dialog id="help">
      <div id="help-tips" aria-hidden="true"></div>
      <div class="help-card">
        <h2>Zo werkt deze bladzijde</h2>
        <div class="help-columns">
          <div>
            <p>Je kijkt naar twee lagen over elkaar: een linker en een rechter. Elke laag is een kaart of een luchtfoto.</p>
            <ul>
              <li><strong>Door De Tijd Schuiven</strong>: beide lagen hetzelfde jaar.</li>
              <li><strong>Twee Jaren Vergelijken</strong>: elke laag een eigen jaar.</li>
            </ul>
          </div>
          <div>
            <p>Met <strong>Link kopiëren</strong> kopieer je een link naar deze plek op de online pagina. Onder <strong>Instellingen</strong> staan het tempo en de overgang: horizontaal vegen of vervagen.</p>
          </div>
        </div>
        <div class="dialog-actions"><button id="help-close" type="button">Sluiten</button></div>
      </div>
    </dialog>`;

    const screen = document.getElementById("map");
    const ctx = screen.getContext("2d");
    const yearbars = document.getElementById("yearbars");
    const splitbar = document.getElementById("splitbar");
    const splitHandle = document.getElementById("split-handle");
    const splitZones = document.getElementById("split-zones");
    const splitYears = [...splitbar.querySelectorAll(".bar-year")];
    const splitKinds = [...splitbar.querySelectorAll(".kind-button")];
    const playBtn = document.getElementById("play");
    const holdInput = document.getElementById("hold");
    const blendInput = document.getElementById("blend");
    const helpDialog = document.getElementById("help");
    const settingsDialog = document.getElementById("settings");
    document.getElementById("place").textContent = movie.place || "Tijdmachine";
    document.getElementById("source").textContent = movie.source || "";
    holdInput.value = hold;
    blendInput.value = blend;
    yearbars.innerHTML = [0, 1].map(() => `<div class="yearbar">
      <button class="kind-button" type="button"></button>
      <div class="track" role="slider" aria-valuemin="0"><div class="zones"></div><div class="handle"></div></div>
      <span class="bar-year"></span>
    </div>`).join("");
    const bars = [...yearbars.querySelectorAll(".yearbar")];

    const tips = [
      { target: "#mode-sync, #mode-compare", text: "Tijd schuiven of jaren vergelijken", side: "below", union: true },
      { target: "#share", text: "Link kopiëren", side: "below" },
      { target: "#settings-open", text: "Instellingen", side: "below" },
      { target: "#splitbar .kind-button", text: "Laag wijzigen", side: "above", row: "bottom" },
      { target: "#split-handle", text: "Kiezen tussen linker laag en rechter laag", side: "above", row: "bottom" },
      { target: ".yearbar .kind-button", text: "Laag wijzigen", side: "left", union: true, row: "bottom" },
      { target: ".yearbar .track", text: "Met de schuifjes op de jaarbalken kies je het jaar voor elke laag. Gekleurd is een nieuw beeld, grijs hetzelfde beeld als ervoor, gestreept geen beeld. De pijltjestoetsen springen naar het volgende nieuwe beeld.", side: "above", union: true, wide: true },
      { target: "#play", text: "Afspelen", side: "right", row: "bottom" },
    ];

    function paneIndex(side) {
      return compare ? indexes[side] : index;
    }

    function sameLook(a, b) {
      const sides = compare ? [active] : [0, 1].filter((side) => (side === 0 ? split > 0 : split < 1));
      return sides.every((side) => movie[kinds[side]][a] === movie[kinds[side]][b]);
    }

    function paintPane(canvas, side) {
      const at = paneIndex(side);
      const kind = kinds[side];
      const context = canvas.getContext("2d");
      const id = movie[kind][at];
      const img = id == null ? null : images[id];
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      if (img) {
        context.fillStyle = "#e7dcc4";
        context.fillRect(0, 0, W, H);
        context.drawImage(img, 0, 0, W, H);
      } else drawMissing(context, kind === "map" ? "map" : "picture", W, H);
      const notes = compare
        ? { [kind]: movie[`${kind}Shown`][at] }
        : { map: movie.mapShown[at], sat: movie.satShown[at] };
      stamp(context, {
        label: years[at] || "",
        line: movie[`${kind}Credit`][at],
        notes,
        box: compare ? (side ? "right" : "left") : "left",
        credit: compare ? (side ? "right" : "left") : "right",
        creditLine: !(kind === "map" && img),
        width: W,
        height: H,
        fallback: kind === "map" ? "Esri Nederland; Kadaster" : "Beeldmateriaal.nl",
      });
    }

    function drawScreen() {
      paintPane(leftCanvas, 0);
      paintPane(rightCanvas, 1);
      composite(ctx, rightCanvas, leftCanvas, split, blend, W, H);
      drawMapCredits(ctx, {
        split,
        blend,
        width: W,
        height: H,
        credits: [0, 1].map((side) => {
          const at = paneIndex(side);
          const kind = kinds[side];
          const id = movie[kind][at];
          const fallback = kind === "map" ? "Esri Nederland; Kadaster" : "Beeldmateriaal.nl";
          return {
            kind,
            text: movie[`${kind}Credit`][at] || fallback,
            overlay: kind === "map" && id != null && images[id],
            anchor: compare ? (side ? "right" : "left") : "right",
          };
        }),
      });
      hasPresented = true;
    }

    function runs(ids) {
      const out = [];
      ids.forEach((id, i) => {
        const state = id == null ? "none" : id !== ids[i - 1] ? "have" : "repeat";
        const run = out.at(-1);
        if (run && run.state === state && state !== "have") run.end = i + 1;
        else out.push({ state, start: i, end: i + 1 });
      });
      return out;
    }

    function renderBars() {
      yearbars.classList.toggle("compare", compare);
      document.getElementById("mode-sync").setAttribute("aria-pressed", String(!compare));
      document.getElementById("mode-compare").setAttribute("aria-pressed", String(compare));
      const n = years.length || 1;
      bars.forEach((bar, side) => {
        const kind = kinds[side];
        bar.classList.toggle("sat", kind === "sat");
        bar.classList.toggle("active", compare && side === active);
        const button = bar.querySelector(".kind-button");
        button.innerHTML = KIND_ICONS[kind];
        button.classList.toggle("sat", kind === "sat");
        const other = otherKind(kind);
        button.title = `${side ? "Rechts" : "Links"} van de lijn: ${KIND_NAMES[kind]}. Klik voor ${KIND_NAMES[other]}.`;
        button.setAttribute("aria-label", button.title);
        const at = paneIndex(side);
        const cell = 100 / n;
        bar.querySelector(".zones").replaceChildren(...runs(movie[kind] || []).map((run) => {
          const piece = document.createElement("i");
          piece.className = run.state;
          piece.style.left = `${run.start * cell}%`;
          piece.style.width = `${(run.end - run.start) * cell}%`;
          return piece;
        }));
        bar.querySelector(".handle").style.left = `${((at + 0.5) / n) * 100}%`;
        bar.querySelector(".bar-year").textContent = years[at] || "";
        const track = bar.querySelector(".track");
        track.setAttribute("aria-valuemax", String(Math.max(0, years.length - 1)));
        track.setAttribute("aria-valuenow", String(at));
        track.setAttribute("aria-valuetext", years[at] || "");
      });
      const handle = 1 - split;
      const kindColor = (kind) => (kind === "sat" ? "#4f9a92" : "#c4492c");
      splitZones.replaceChildren(...[0, 1].map((side) => {
        const piece = document.createElement("i");
        piece.className = "have";
        piece.style.background = kindColor(kinds[side]);
        piece.style.left = side ? "0" : `${handle * 100}%`;
        piece.style.width = `${(side ? handle : split) * 100}%`;
        return piece;
      }));
      splitHandle.style.left = `${handle * 100}%`;
      splitKinds.forEach((button, side) => {
        button.innerHTML = KIND_ICONS[kinds[side]];
        button.classList.toggle("sat", kinds[side] === "sat");
        button.title = bars[side].querySelector(".kind-button").title;
        button.setAttribute("aria-label", button.title);
      });
      splitYears.forEach((element, side) => {
        const shown = movie[`${kinds[side]}Shown`][paneIndex(side)];
        element.textContent = shown == null ? "—" : String(shown);
      });
      splitbar.querySelector(".track").setAttribute("aria-valuenow", String(Math.round(handle * 100) / 100));
    }

    function show() {
      drawScreen();
      renderBars();
    }

    function stopPlay() {
      playToken += 1;
      playing = false;
      cancelWait?.();
      playBtn.classList.remove("playing");
      playBtn.setAttribute("aria-label", "Afspelen");
      splitbar.hidden = false;
    }

    function setKind(side) {
      stopPlay();
      kinds[side] = otherKind(kinds[side]);
      if (!compare) kinds[1 - side] = otherKind(kinds[side]);
      show();
    }

    function setCompare(on) {
      if (on === compare) return;
      stopPlay();
      compare = on;
      if (on) {
        indexes = [index, index];
      } else {
        index = indexes[active];
        kinds[1] = otherKind(kinds[0]);
      }
      show();
    }

    function scrub(side, at) {
      stopPlay();
      if (compare) {
        active = side;
        indexes[side] = at;
      } else index = at;
      show();
    }

    function fadeTo(drawNext) {
      const token = playToken;
      fromCanvas.getContext("2d").drawImage(screen, 0, 0);
      drawNext();
      toCanvas.getContext("2d").drawImage(screen, 0, 0);
      const ms = Math.min(320, (Number(hold) || 800) * 0.5);
      const started = performance.now();
      return new Promise((resolve) => {
        const tick = (now) => {
          if (token !== playToken) {
            resolve(false);
            return;
          }
          const amount = Math.min(1, (now - started) / Math.max(1, ms));
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1;
          ctx.drawImage(fromCanvas, 0, 0);
          ctx.globalAlpha = smooth(amount);
          ctx.drawImage(toCanvas, 0, 0);
          ctx.globalAlpha = 1;
          if (amount < 1) requestAnimationFrame(tick);
          else resolve(true);
        };
        requestAnimationFrame(tick);
      });
    }

    function holdFor(at) {
      const full = Number(hold) || 800;
      if (at === 0) return full;
      return sameLook(at, at - 1) ? full / 4 : full;
    }

    async function startPlay() {
      if (playing) {
        stopPlay();
        show();
        return;
      }
      const token = ++playToken;
      playing = true;
      playBtn.classList.add("playing");
      playBtn.setAttribute("aria-label", "Pauzeren");
      if (compare) {
        splitbar.hidden = true;
        paintPane(leftCanvas, 0);
        paintPane(rightCanvas, 1);
        const timing = compareTiming(hold);
        const started = performance.now();
        const tick = (now) => {
          if (token !== playToken) return;
          const mix = compareMix(now - started, timing);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1;
          ctx.drawImage(leftCanvas, 0, 0);
          if (mix > 0) {
            ctx.globalAlpha = mix;
            ctx.drawImage(rightCanvas, 0, 0);
            ctx.globalAlpha = 1;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return;
      }
      let cursor = index >= last ? 0 : index;
      while (token === playToken && cursor <= last) {
        index = cursor;
        renderBars();
        const shown = hasPresented
          ? await fadeTo(() => { drawScreen(); renderBars(); })
          : (show(), true);
        if (!shown || token !== playToken) return;
        if (cursor >= last) break;
        const wait = Math.max(0, holdFor(cursor) - Math.min(320, (Number(hold) || 800) * 0.5));
        const cancelled = await new Promise((resolve) => {
          const timer = setTimeout(() => {
            cancelWait = null;
            resolve(token !== playToken);
          }, wait);
          cancelWait = () => {
            clearTimeout(timer);
            cancelWait = null;
            resolve(true);
          };
        });
        if (cancelled) return;
        cursor += 1;
      }
      if (token === playToken) stopPlay();
    }

    function shareLink() {
      return shareUrl(movie.home, {
        x: movie.view.x,
        y: movie.view.y,
        zoom: movie.view.zoom,
        year: years[compare ? indexes[0] : index],
        year2: compare ? years[indexes[1]] : null,
        compare,
        left: kinds[0],
        right: kinds[1],
        from: movie.from || "",
        to: movie.to || "",
        satellite: split < 0.5,
        split,
        hold,
        blend,
        place: movie.place || "",
      });
    }

    function fillViewerColophon() {
      const write = (id, key) => {
        const list = document.getElementById(id);
        if (!list) return;
        const lines = colophonLines(years.map((year, index) => ({
          year: Number(year),
          text: movie[key][index] || "",
        })));
        list.replaceChildren(...lines.map((text) => {
          const item = document.createElement("li");
          item.textContent = text;
          return item;
        }));
      };
      write("colofon-maps", "mapCredit");
      write("colofon-photos", "satCredit");
    }

    function layoutHelpNow() {
      layoutHelp({
        dialog: helpDialog,
        tipsRoot: document.getElementById("help-tips"),
        tips,
        anchor: document.getElementById("form"),
      });
    }

    bars.forEach((bar, side) => {
      const track = bar.querySelector(".track");
      const indexAt = (clientX) => {
        const rect = track.getBoundingClientRect();
        if (!rect.width || !years.length) return 0;
        return Math.min(last, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * years.length)));
      };
      track.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        try { track.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
        scrub(side, indexAt(event.clientX));
        track.onpointermove = (move) => {
          if (move.pointerId !== event.pointerId) return;
          scrub(side, indexAt(move.clientX));
        };
        const end = () => { track.onpointermove = null; };
        track.addEventListener("pointerup", end, { once: true });
        track.addEventListener("pointercancel", end, { once: true });
      });
      bar.querySelector(".kind-button").addEventListener("click", () => setKind(side));
    });
    splitKinds.forEach((button, side) => button.addEventListener("click", () => setKind(side)));
    const splitTrack = splitbar.querySelector(".track");
    splitTrack.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      stopPlay();
      try { splitTrack.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
      const at = (clientX) => {
        const rect = splitTrack.getBoundingClientRect();
        if (!rect.width) return split;
        return 1 - Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      };
      split = at(event.clientX);
      show();
      splitTrack.onpointermove = (move) => {
        if (move.pointerId !== event.pointerId) return;
        split = at(move.clientX);
        show();
      };
      const end = () => { splitTrack.onpointermove = null; };
      splitTrack.addEventListener("pointerup", end, { once: true });
      splitTrack.addEventListener("pointercancel", end, { once: true });
    });
    document.getElementById("mode-sync").addEventListener("click", () => setCompare(false));
    document.getElementById("mode-compare").addEventListener("click", () => setCompare(true));
    playBtn.addEventListener("click", startPlay);
    bindTabs(settingsDialog);
    document.getElementById("settings-open").addEventListener("click", () => {
      fillViewerColophon();
      settingsDialog.showModal();
    });
    document.getElementById("settings-close").addEventListener("click", () => settingsDialog.close());
    holdInput.addEventListener("change", () => { hold = holdInput.value; });
    blendInput.addEventListener("change", () => { blend = blendInput.value === "fade" ? "fade" : "x"; show(); });
    const shareButton = document.getElementById("share");
    let shareTimer = 0;
    shareButton.addEventListener("click", async () => {
      const copied = await copyText(shareLink());
      window.clearTimeout(shareTimer);
      shareButton.classList.toggle("copied", copied);
      shareButton.classList.toggle("failed", !copied);
      shareButton.title = copied ? "Gekopieerd" : "Mislukt";
      shareButton.setAttribute("aria-label", shareButton.title);
      shareTimer = window.setTimeout(() => {
        shareButton.classList.remove("copied", "failed");
        shareButton.title = "Link kopiëren";
        shareButton.setAttribute("aria-label", "Link kopiëren");
      }, 1600);
    });
    document.getElementById("help-open").addEventListener("click", () => {
      helpDialog.showModal();
      layoutHelpNow();
    });
    document.getElementById("help-close").addEventListener("click", () => helpDialog.close());
    helpDialog.addEventListener("click", (event) => {
      if (event.target === helpDialog) helpDialog.close();
    });
    window.addEventListener("resize", () => {
      if (helpDialog.open) layoutHelpNow();
    });
    document.addEventListener("keydown", (event) => {
      if (event.target.matches("input, select, textarea")) return;
      if (event.code === "Space") {
        event.preventDefault();
        startPlay();
      } else if (event.code === "ArrowRight" || event.code === "ArrowLeft") {
        event.preventDefault();
        stopPlay();
        const delta = event.code === "ArrowRight" ? 1 : -1;
        const from = compare ? indexes[active] : index;
        const next = event.shiftKey
          ? Math.min(last, Math.max(0, from + delta))
          : nextIndex(years.length, sameLook, from, delta);
        if (next === from) return;
        if (compare) indexes[active] = next;
        else index = next;
        renderBars();
        fadeTo(() => show());
      }
    });

    const ids = [...new Set([...(movie.map || []), ...(movie.sat || [])].filter((id) => id != null))];
    Promise.all(ids.map((id) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[id] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = `i/${id}.jpg`;
    }))).then(show);
  }

  root.Playback = {
    SHARE_KEYS,
    KIND_ICONS,
    smooth,
    composite,
    wipe,
    drawMissing,
    stamp,
    shareUrl,
    drawMapCredits,
    copyText,
    nextIndex,
    compareTiming,
    compareMix,
    otherKind,
    colophonLines,
    bindTabs,
    layoutHelp,
    mountViewer,
  };
}(window));
