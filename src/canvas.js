import { BRAND, LINK_TYPES, groupDisplayId, groupFullLabel, findGroup } from './model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(c);
  return node;
}

export class SpiderCanvas {
  constructor(container, callbacks) {
    this.container = container;
    this.cb = callbacks; // { onSelect, onChangeGeometry, onJumpToGroup, onAddGroupAt, onDeleteSelected }
    this.data = null;
    this.institutionUid = null;
    this.selection = null; // {type:'group'|'frame', uid}
    this.tx = 40;
    this.ty = 40;
    this.scale = 1;
    this._buildDom();
    this._wireEvents();
  }

  _buildDom() {
    this.svg = el('svg', { class: 'spider-svg', width: '100%', height: '100%' });
    this.defs = el('defs');
    this._buildMarkers();
    this.viewport = el('g', { class: 'viewport' });
    this.framesLayer = el('g', { class: 'layer-frames' });
    this.linksLayer = el('g', { class: 'layer-links' });
    this.groupsLayer = el('g', { class: 'layer-groups' });
    this.viewport.appendChild(this.framesLayer);
    this.viewport.appendChild(this.linksLayer);
    this.viewport.appendChild(this.groupsLayer);
    this.svg.appendChild(this.defs);
    this.svg.appendChild(this.viewport);
    this.container.innerHTML = '';
    this.container.appendChild(this.svg);
  }

  _buildMarkers() {
    for (const [key, def] of Object.entries(LINK_TYPES)) {
      const marker = el(
        'marker',
        {
          id: `arrow-${key}`,
          viewBox: '0 0 10 10',
          refX: 9,
          refY: 5,
          markerWidth: 7,
          markerHeight: 7,
          orient: 'auto-start-reverse',
        },
        [el('path', { d: 'M0,0 L10,5 L0,10 z', fill: def.color })]
      );
      this.defs.appendChild(marker);
    }
  }

  setData(data, institutionUid, selection) {
    this.data = data;
    this.institutionUid = institutionUid;
    this.selection = selection;
    this.render();
  }

  centerViewport() {
    const rect = this.container.getBoundingClientRect();
    this.tx = rect.width ? rect.width / 2 - 300 : 40;
    this.ty = 40;
    this.scale = 1;
    this._applyTransform();
  }

  _applyTransform() {
    this.viewport.setAttribute('transform', `translate(${this.tx},${this.ty}) scale(${this.scale})`);
  }

  screenToWorld(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const x = (clientX - rect.left - this.tx) / this.scale;
    const y = (clientY - rect.top - this.ty) / this.scale;
    return { x, y };
  }

  get institution() {
    return this.data && this.data.institutions.find((i) => i.uid === this.institutionUid);
  }

  render() {
    this.framesLayer.innerHTML = '';
    this.linksLayer.innerHTML = '';
    this.groupsLayer.innerHTML = '';
    const inst = this.institution;
    if (!inst) return;
    this._applyTransform();

    for (const frame of inst.frames) {
      this.framesLayer.appendChild(this._renderFrame(frame));
    }
    const groupUids = new Set(inst.groups.map((g) => g.uid));
    const relatedLinks = this.data.links.filter((l) => groupUids.has(l.aUid) || groupUids.has(l.bUid));
    for (const link of relatedLinks) {
      const node = this._renderLink(link, inst, groupUids);
      if (node) this.linksLayer.appendChild(node);
    }
    for (const group of inst.groups) {
      this.groupsLayer.appendChild(this._renderGroup(group, inst));
    }
  }

  _renderFrame(frame) {
    const selected = this.selection && this.selection.type === 'frame' && this.selection.uid === frame.uid;
    const g = el('g', { class: 'frame-node', 'data-uid': frame.uid, 'data-kind': 'frame' });
    g.appendChild(
      el('rect', {
        x: frame.x,
        y: frame.y,
        width: frame.w,
        height: frame.h,
        rx: 10,
        fill: BRAND.blueLight,
        'fill-opacity': 0.5,
        stroke: selected ? BRAND.orange : BRAND.blue,
        'stroke-width': selected ? 2.5 : 1.5,
        'stroke-dasharray': '6,4',
      })
    );
    const label = el('text', { x: frame.x + 10, y: frame.y + 20, class: 'frame-label' });
    label.textContent = frame.name;
    g.appendChild(label);
    g.appendChild(this._resizeHandle(frame, 'frame'));
    return g;
  }

  _renderGroup(group, inst) {
    const selected = this.selection && this.selection.type === 'group' && this.selection.uid === group.uid;
    const g = el('g', { class: 'group-node', 'data-uid': group.uid, 'data-kind': 'group' });
    g.appendChild(
      el('rect', {
        x: group.x,
        y: group.y,
        width: group.w,
        height: group.h,
        rx: 8,
        fill: BRAND.white,
        stroke: selected ? BRAND.orange : BRAND.blue,
        'stroke-width': selected ? 3 : 2,
      })
    );
    g.appendChild(
      el('rect', {
        x: group.x,
        y: group.y,
        width: group.w,
        height: 22,
        rx: 8,
        fill: BRAND.blue,
      })
    );
    // spodní rohy horního pruhu nesmí být kulaté – překrytí
    g.appendChild(el('rect', { x: group.x, y: group.y + 12, width: group.w, height: 10, fill: BRAND.blue }));
    const idText = el('text', { x: group.x + 8, y: group.y + 16, class: 'group-id-label' });
    idText.textContent = groupDisplayId(inst, group);
    g.appendChild(idText);

    const nameText = el('text', { x: group.x + 8, y: group.y + 40, class: 'group-name-label' });
    wrapText(nameText, group.name, group.w - 16, 15);
    g.appendChild(nameText);

    const info = [];
    info.push(group.reps.length ? `${group.reps.length} zástupce` : 'bez zástupce');
    if (group.topicUids.length) info.push(`${group.topicUids.length} téma(t)`);
    const infoText = el('text', { x: group.x + 8, y: group.y + group.h - 10, class: 'group-info-label' });
    infoText.textContent = info.join(' · ');
    g.appendChild(infoText);

    g.appendChild(this._resizeHandle(group, 'group'));
    return g;
  }

  _resizeHandle(shape, kind) {
    return el('rect', {
      x: shape.x + shape.w - 10,
      y: shape.y + shape.h - 10,
      width: 12,
      height: 12,
      class: 'resize-handle',
      'data-handle': kind,
    });
  }

  _renderLink(link, inst, groupUids) {
    const def = LINK_TYPES[link.type];
    const aIn = groupUids.has(link.aUid);
    const bIn = groupUids.has(link.bUid);
    const commonAttrs = {
      stroke: def.color,
      'stroke-width': 2.2,
      'stroke-dasharray': def.dash || undefined,
      fill: 'none',
    };
    if (link.arrow === 'forward') commonAttrs['marker-end'] = `url(#arrow-${link.type})`;
    if (link.arrow === 'both') {
      commonAttrs['marker-end'] = `url(#arrow-${link.type})`;
      commonAttrs['marker-start'] = `url(#arrow-${link.type})`;
    }

    if (aIn && bIn) {
      const a = inst.groups.find((g) => g.uid === link.aUid);
      const b = inst.groups.find((g) => g.uid === link.bUid);
      const p1 = centerOf(a);
      const p2 = centerOf(b);
      return el('path', { d: `M${p1.x},${p1.y} L${p2.x},${p2.y}`, ...commonAttrs, class: 'link-line' });
    }
    // cross-instituce/mirror mimo tento pavouk → symbolický "pahýl" k okraji
    const localUid = aIn ? link.aUid : link.bUid;
    const otherUid = aIn ? link.bUid : link.aUid;
    const localGroup = inst.groups.find((g) => g.uid === localUid);
    if (!localGroup) return null;
    const start = centerOf(localGroup);
    const end = { x: start.x + 90, y: start.y - 46 };
    const wrap = el('g', { class: 'link-stub', 'data-jump': otherUid });
    wrap.appendChild(el('path', { d: `M${start.x},${start.y} L${end.x},${end.y}`, ...commonAttrs }));
    const label = groupFullLabel(this.data, otherUid);
    const chip = el('g', { transform: `translate(${end.x},${end.y})` });
    const textEl = el('text', { x: 6, y: 4, class: 'link-stub-label' });
    textEl.textContent = label;
    chip.appendChild(el('rect', { x: 0, y: -12, width: label.length * 6.4 + 12, height: 20, rx: 4, fill: def.color, 'fill-opacity': 0.15, stroke: def.color }));
    chip.appendChild(textEl);
    wrap.appendChild(chip);
    return wrap;
  }

  _wireEvents() {
    let dragMode = null; // {kind:'pan'|'move'|'resize', uid, startX, startY, orig}
    let didDrag = false;

    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const before = this.screenToWorld(e.clientX, e.clientY);
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale = Math.min(3, Math.max(0.2, this.scale * delta));
      const after = this.screenToWorld(e.clientX, e.clientY);
      this.tx += (after.x - before.x) * this.scale;
      this.ty += (after.y - before.y) * this.scale;
      this._applyTransform();
    }, { passive: false });

    this.svg.addEventListener('mousedown', (e) => {
      didDrag = false;
      const handle = e.target.closest('[data-handle]');
      const nodeEl = e.target.closest('[data-kind]');
      const world = this.screenToWorld(e.clientX, e.clientY);
      if (handle) {
        const kind = handle.getAttribute('data-handle');
        const parent = handle.closest('[data-uid]');
        const uid = parent.getAttribute('data-uid');
        const shape = this._findShape(kind, uid);
        dragMode = { kind: 'resize', shapeKind: kind, uid, startX: world.x, startY: world.y, orig: { ...shape } };
      } else if (nodeEl) {
        const kind = nodeEl.getAttribute('data-kind');
        const uid = nodeEl.getAttribute('data-uid');
        const shape = this._findShape(kind, uid);
        dragMode = { kind: 'move', shapeKind: kind, uid, startX: world.x, startY: world.y, orig: { ...shape } };
        this.cb.onSelect({ type: kind, uid });
      } else {
        dragMode = { kind: 'pan', startX: e.clientX, startY: e.clientY, origTx: this.tx, origTy: this.ty };
        this.cb.onSelect(null);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragMode) return;
      didDrag = true;
      if (dragMode.kind === 'pan') {
        this.tx = dragMode.origTx + (e.clientX - dragMode.startX);
        this.ty = dragMode.origTy + (e.clientY - dragMode.startY);
        this._applyTransform();
        return;
      }
      const world = this.screenToWorld(e.clientX, e.clientY);
      const dx = world.x - dragMode.startX;
      const dy = world.y - dragMode.startY;
      const shape = this._findShape(dragMode.shapeKind, dragMode.uid);
      if (!shape) return;
      if (dragMode.kind === 'move') {
        shape.x = Math.round(dragMode.orig.x + dx);
        shape.y = Math.round(dragMode.orig.y + dy);
      } else if (dragMode.kind === 'resize') {
        shape.w = Math.max(120, Math.round(dragMode.orig.w + dx));
        shape.h = Math.max(60, Math.round(dragMode.orig.h + dy));
      }
      this.render();
    });

    window.addEventListener('mouseup', () => {
      if (dragMode && dragMode.kind !== 'pan' && didDrag) {
        this.cb.onChangeGeometry(dragMode.shapeKind, dragMode.uid);
      }
      dragMode = null;
    });

    this.svg.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump]');
      if (jump && !didDrag) {
        this.cb.onJumpToGroup(jump.getAttribute('data-jump'));
      }
    });

    this.svg.addEventListener('dblclick', (e) => {
      if (e.target.closest('[data-kind]')) return;
      const world = this.screenToWorld(e.clientX, e.clientY);
      this.cb.onAddGroupAt(world.x - 95, world.y - 45);
    });
  }

  _findShape(kind, uid) {
    const inst = this.institution;
    if (!inst) return null;
    if (kind === 'group') return inst.groups.find((g) => g.uid === uid);
    if (kind === 'frame') return inst.frames.find((f) => f.uid === uid);
    return null;
  }

  exportSvgElement() {
    const inst = this.institution;
    if (!inst) return null;
    const bbox = this._computeBBox(inst);
    const clone = this.svg.cloneNode(true);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.setAttribute('viewBox', `${bbox.minX - 20} ${bbox.minY - 20} ${bbox.w + 40} ${bbox.h + 40}`);
    clone.setAttribute('width', bbox.w + 40);
    clone.setAttribute('height', bbox.h + 40);
    const vp = clone.querySelector('.viewport');
    vp.removeAttribute('transform');
    // titulek pavouka
    const title = el('text', { x: bbox.minX - 10, y: bbox.minY - 30, class: 'export-title' });
    title.textContent = `${inst.name} (${inst.code})`;
    vp.insertBefore(title, vp.firstChild);
    clone.setAttribute('viewBox', `${bbox.minX - 20} ${bbox.minY - 55} ${bbox.w + 40} ${bbox.h + 75}`);
    clone.setAttribute('height', bbox.h + 75);
    clone.style.background = '#ffffff';
    applyInlineStyles(clone);
    return clone;
  }

  _computeBBox(inst) {
    let minX = 0, minY = 0, maxX = 800, maxY = 500;
    const shapes = [...inst.groups, ...inst.frames];
    if (shapes.length) {
      minX = Math.min(...shapes.map((s) => s.x));
      minY = Math.min(...shapes.map((s) => s.y));
      maxX = Math.max(...shapes.map((s) => s.x + s.w));
      maxY = Math.max(...shapes.map((s) => s.y + s.h));
    }
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  }
}

function centerOf(shape) {
  return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
}

function wrapText(textEl, text, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  const charsPerLine = Math.max(6, Math.floor(maxWidth / 7));
  let lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > charsPerLine) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  lines = lines.slice(0, 2);
  const x = textEl.getAttribute('x');
  lines.forEach((line, idx) => {
    const tspan = document.createElementNS(SVG_NS, 'tspan');
    tspan.setAttribute('x', x);
    tspan.setAttribute('dy', idx === 0 ? 0 : lineHeight);
    tspan.textContent = line;
    textEl.appendChild(tspan);
  });
}

// Pro export do samostatného SVG/PNG souboru potřebujeme styly vepsané
// přímo do elementů (bez spoléhání na externí <style> appky).
function applyInlineStyles(svgClone) {
  svgClone.querySelectorAll('.frame-label').forEach((n) => {
    n.setAttribute('fill', BRAND.blue);
    n.setAttribute('font-family', 'Verdana, Geneva, sans-serif');
    n.setAttribute('font-size', '12');
    n.setAttribute('font-weight', 'bold');
  });
  svgClone.querySelectorAll('.group-id-label').forEach((n) => {
    n.setAttribute('fill', '#ffffff');
    n.setAttribute('font-family', 'Verdana, Geneva, sans-serif');
    n.setAttribute('font-size', '10');
    n.setAttribute('font-weight', 'bold');
  });
  svgClone.querySelectorAll('.group-name-label').forEach((n) => {
    n.setAttribute('fill', BRAND.blue);
    n.setAttribute('font-family', 'Verdana, Geneva, sans-serif');
    n.setAttribute('font-size', '13');
    n.setAttribute('font-weight', 'bold');
  });
  svgClone.querySelectorAll('.group-info-label').forEach((n) => {
    n.setAttribute('fill', BRAND.gray);
    n.setAttribute('font-family', 'Verdana, Geneva, sans-serif');
    n.setAttribute('font-size', '10');
  });
  svgClone.querySelectorAll('.link-stub-label').forEach((n) => {
    n.setAttribute('fill', BRAND.blue);
    n.setAttribute('font-family', 'Verdana, Geneva, sans-serif');
    n.setAttribute('font-size', '10');
  });
  svgClone.querySelectorAll('.export-title').forEach((n) => {
    n.setAttribute('fill', BRAND.blue);
    n.setAttribute('font-family', 'Verdana, Geneva, sans-serif');
    n.setAttribute('font-size', '20');
    n.setAttribute('font-weight', 'bold');
  });
  svgClone.querySelectorAll('.resize-handle').forEach((n) => n.remove());
}
