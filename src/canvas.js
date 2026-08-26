import { BRAND, LINK_TYPES, groupDisplayId, groupFullLabel, linkDisplayId, findGroup, findInstitution } from './model.js';

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
    this.cb = callbacks; // { onSelect, onChangeGeometry, onChangeLinkOffset, onChangeStubOffset, onChangeLabelOffset, onJumpToGroup, onJumpToInstitution, onAddGroupAt, onDeleteSelected }
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
    // Úchyty pro tažení konce vazby musí být VŽDY nad boxy skupin, protože
    // sedí přesně na hraně boxu B – jinak by je box (kreslený až po vazbách)
    // v hit-testingu myši zakrýval a šlo by za ně chytit jen náhodně.
    this.handlesLayer = el('g', { class: 'layer-handles' });
    this.viewport.appendChild(this.framesLayer);
    this.viewport.appendChild(this.linksLayer);
    this.viewport.appendChild(this.groupsLayer);
    this.viewport.appendChild(this.handlesLayer);
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

  // Vycentruje plátno na danou skupinu/rámeček (beze změny přiblížení) –
  // použito při "prokliku" na navazující skupinu z postranního panelu.
  focusOnShape(shape) {
    if (!shape) return;
    const rect = this.container.getBoundingClientRect();
    const center = centerOf(shape);
    this.tx = rect.width / 2 - center.x * this.scale;
    this.ty = rect.height / 2 - center.y * this.scale;
    this._applyTransform();
  }

  focusOnGroupUid(groupUid) {
    const inst = this.institution;
    if (!inst) return;
    const shape = inst.groups.find((g) => g.uid === groupUid);
    this.focusOnShape(shape);
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
    this.handlesLayer.innerHTML = '';
    const inst = this.institution;
    if (!inst) return;
    this._applyTransform();

    for (const frame of inst.frames) {
      this.framesLayer.appendChild(this._renderFrame(frame));
    }
    const groupUids = new Set(inst.groups.map((g) => g.uid));
    const relatedLinks = this.data.links.filter((l) => groupUids.has(l.aUid) || groupUids.has(l.bUid));
    const stubIndexByGroup = new Map();
    const endHandles = [];
    for (const link of relatedLinks) {
      const node = this._renderLink(link, inst, groupUids, stubIndexByGroup, endHandles);
      if (node) this.linksLayer.appendChild(node);
    }
    for (const group of inst.groups) {
      this.groupsLayer.appendChild(this._renderGroup(group, inst));
    }
    for (const handle of endHandles) {
      this.handlesLayer.appendChild(handle);
    }
  }

  _renderFrame(frame) {
    const selected = this.selection && this.selection.type === 'frame' && this.selection.uid === frame.uid;
    const refInst = frame.institutionRefUid ? findInstitution(this.data, frame.institutionRefUid) : null;
    const g = el('g', {
      class: refInst ? 'frame-node frame-node-ref' : 'frame-node',
      'data-uid': frame.uid,
      'data-kind': 'frame',
      'data-jump-institution': refInst ? refInst.uid : undefined,
    });
    g.appendChild(
      el('rect', {
        x: frame.x,
        y: frame.y,
        width: frame.w,
        height: frame.h,
        rx: 10,
        fill: refInst ? BRAND.grayLight : BRAND.blueLight,
        'fill-opacity': refInst ? 0.7 : 0.5,
        stroke: selected ? BRAND.orange : refInst ? BRAND.cyan : BRAND.blue,
        'stroke-width': selected ? 2.5 : 1.5,
        'stroke-dasharray': refInst ? undefined : '6,4',
      })
    );
    const label = el('text', { x: frame.x + 10, y: frame.y + 20, class: 'frame-label' });
    label.textContent = refInst ? `↗ ${refInst.code} – ${refInst.name}` : frame.name;
    if (refInst) label.setAttribute('fill', BRAND.cyan);
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
    const centerX = group.x + group.w / 2;
    const idText = el('text', { x: centerX, y: group.y + 16, class: 'group-id-label', 'text-anchor': 'middle' });
    idText.textContent = groupDisplayId(inst, group);
    g.appendChild(idText);

    const nameText = el('text', { x: centerX, y: group.y + 40, class: 'group-name-label', 'text-anchor': 'middle' });
    wrapText(nameText, group.name, group.w - 16, 15);
    g.appendChild(nameText);

    const info = [];
    info.push(group.reps.length ? `${group.reps.length} zástupce` : 'bez zástupce');
    if (group.topicUids.length) info.push(`${group.topicUids.length} téma(t)`);
    const infoText = el('text', { x: centerX, y: group.y + group.h - 10, class: 'group-info-label', 'text-anchor': 'middle' });
    infoText.textContent = info.join(' · ');
    g.appendChild(infoText);

    g.appendChild(this._resizeHandle(group, 'group'));
    return g;
  }

  // Úchyt pro ruční tažení konce vazby (skupina B) podél hrany boxu, na které
  // právě leží – `point.axis` říká, zda se táhne svisle ('y') nebo vodorovně ('x').
  _linkEndHandle(linkUid, point) {
    return el('circle', {
      cx: point.x,
      cy: point.y,
      r: 4.5,
      class: 'link-end-handle',
      'data-link-end': linkUid,
      'data-axis': point.axis,
    });
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

  _renderLink(link, inst, groupUids, stubIndexByGroup, endHandles) {
    const def = LINK_TYPES[link.type];
    const aIn = groupUids.has(link.aUid);
    const bIn = groupUids.has(link.bUid);
    const commonAttrs = {
      stroke: def.color,
      'stroke-width': 2.2,
      'stroke-dasharray': def.dash || undefined,
      fill: 'none',
    };

    if (aIn && bIn) {
      const a = inst.groups.find((g) => g.uid === link.aUid);
      const b = inst.groups.find((g) => g.uid === link.bUid);
      const idLabel = linkDisplayId(this.data, link);
      const g = el('g', { class: 'link-line' });
      // Konec vazby na skupině B lze ručně posunout (link.bEndOffset) – konec
      // na skupině A i trasa mezi nimi zůstávají vždy automatické, aby ruční
      // posun nešlo "utrhnout" od společné páteře u vzoru s více vazbami
      // z jedné skupiny (viz appendElbowLine). ID štítek lze navíc nezávisle
      // posunout kamkoli podél čáry (link.labelOffset).
      const points = linkGeometry(link, a, b);
      const t = typeof link.labelOffset === 'number' ? link.labelOffset : defaultLabelT(link, points);
      const labelPoint = pointAtT(points, t);
      if (link.lineStyle === 'elbow') {
        // lomená čára vždy vychází/vstupuje uprostřed levé nebo pravé hrany
        // (podle toho, na které straně cíl leží) – jinak by "trunk" u boxů
        // s cíli hodně nad/pod sebou procházel horní/dolní hranou a mohl
        // křížit sousední boxy ve stejném sloupci
        appendElbowLine(g, points, commonAttrs, link.type, link.arrow);
      } else {
        // čára jde od okraje boxu k okraji boxu (ne od středu), jinak by šipka
        // skončila schovaná pod neprůhledným boxem
        appendBrokenLine(g, points, idLabel, commonAttrs, link.type, link.arrow, labelPoint);
      }
      if (endHandles) {
        endHandles.push(this._linkEndHandle(link.uid, points[points.length - 1]));
        endHandles.push(buildLinkLabelChip(link.uid, labelPoint, idLabel, def.color));
      }
      return g;
    }
    // cross-instituce/mirror mimo tento pavouk → symbolický "pahýl" k okraji
    const localUid = aIn ? link.aUid : link.bUid;
    const otherUid = aIn ? link.bUid : link.aUid;
    const localGroup = inst.groups.find((g) => g.uid === localUid);
    if (!localGroup) return null;
    const idLabel = linkDisplayId(this.data, link);
    // více vazeb ze stejné skupiny na externí cíle se rozprostře do vějíře,
    // aby se jejich chipy nepřekrývaly na jednom místě
    const stubIndex = stubIndexByGroup ? stubIndexByGroup.get(localUid) || 0 : 0;
    if (stubIndexByGroup) stubIndexByGroup.set(localUid, stubIndex + 1);
    const angleDeg = -20 - stubIndex * 50;
    const angleRad = (angleDeg * Math.PI) / 180;
    const dist = 120 + Math.floor(stubIndex / 6) * 70;
    const localCenter = centerOf(localGroup);
    const autoAnchor = { x: localCenter.x + Math.cos(angleRad) * dist, y: localCenter.y + Math.sin(angleRad) * dist };
    // Ruční posun pahýlu je uložen zvlášť pro pohled od A a zvlášť od B (viz
    // makeLink) – tady se použije ta strana, ze které se na tento pavouk
    // díváme právě teď.
    const isASide = link.aUid === localUid;
    const stubOffset = isASide ? link.stubOffsetA : link.stubOffsetB;
    const chipAnchor = stubOffset ? { x: autoAnchor.x + stubOffset.dx, y: autoAnchor.y + stubOffset.dy } : autoAnchor;
    const start = rectBorderPoint(localGroup, chipAnchor);
    // čára končí kousek před chipem, aby tam byla vidět šipka
    const end = pullBack(start, chipAnchor, 10);
    const wrap = el('g', { class: 'link-stub', 'data-jump': otherUid });
    const lineAttrs = { ...commonAttrs };
    if (link.arrow === 'forward' || link.arrow === 'both') lineAttrs['marker-end'] = `url(#arrow-${link.type})`;
    if (link.arrow === 'both') lineAttrs['marker-start'] = `url(#arrow-${link.type})`;
    wrap.appendChild(el('path', { d: `M${start.x},${start.y} L${end.x},${end.y}`, ...lineAttrs }));
    const label = `${idLabel} → ${groupFullLabel(this.data, otherUid)}`;
    const chip = el('g', {
      class: 'link-stub-chip',
      transform: `translate(${chipAnchor.x},${chipAnchor.y})`,
      'data-stub-drag': link.uid,
      'data-stub-side': isASide ? 'A' : 'B',
    });
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
      const linkEndHandle = e.target.closest('[data-link-end]');
      const labelHandle = e.target.closest('[data-label-drag]');
      const stubHandle = e.target.closest('[data-stub-drag]');
      const handle = e.target.closest('[data-handle]');
      const nodeEl = e.target.closest('[data-kind]');
      const world = this.screenToWorld(e.clientX, e.clientY);
      if (linkEndHandle) {
        const linkUid = linkEndHandle.getAttribute('data-link-end');
        const axis = linkEndHandle.getAttribute('data-axis');
        const link = this.data.links.find((l) => l.uid === linkUid);
        if (link) {
          dragMode = { kind: 'linkend', linkUid, axis, startX: world.x, startY: world.y, origOffset: link.bEndOffset || 0 };
        }
      } else if (labelHandle) {
        const linkUid = labelHandle.getAttribute('data-label-drag');
        const link = this.data.links.find((l) => l.uid === linkUid);
        const inst = this.institution;
        const a = inst && link ? inst.groups.find((g) => g.uid === link.aUid) : null;
        const b = inst && link ? inst.groups.find((g) => g.uid === link.bUid) : null;
        if (link && a && b) {
          dragMode = { kind: 'labeloffset', linkUid, points: linkGeometry(link, a, b) };
        }
      } else if (stubHandle) {
        const linkUid = stubHandle.getAttribute('data-stub-drag');
        const side = stubHandle.getAttribute('data-stub-side');
        const link = this.data.links.find((l) => l.uid === linkUid);
        if (link) {
          const field = side === 'A' ? 'stubOffsetA' : 'stubOffsetB';
          const orig = link[field] || { dx: 0, dy: 0 };
          dragMode = { kind: 'stuboffset', linkUid, field, startX: world.x, startY: world.y, origDx: orig.dx, origDy: orig.dy };
        }
      } else if (handle) {
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
      if (dragMode.kind === 'linkend') {
        const link = this.data.links.find((l) => l.uid === dragMode.linkUid);
        if (!link) return;
        const delta = dragMode.axis === 'y' ? world.y - dragMode.startY : world.x - dragMode.startX;
        link.bEndOffset = Math.round(dragMode.origOffset + delta);
        this.render();
        return;
      }
      if (dragMode.kind === 'stuboffset') {
        const link = this.data.links.find((l) => l.uid === dragMode.linkUid);
        if (!link) return;
        link[dragMode.field] = {
          dx: Math.round(dragMode.origDx + (world.x - dragMode.startX)),
          dy: Math.round(dragMode.origDy + (world.y - dragMode.startY)),
        };
        this.render();
        return;
      }
      if (dragMode.kind === 'labeloffset') {
        const link = this.data.links.find((l) => l.uid === dragMode.linkUid);
        if (!link) return;
        link.labelOffset = closestTOnPolyline(dragMode.points, world);
        this.render();
        return;
      }
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

    const ownDragKinds = ['pan', 'linkend', 'stuboffset', 'labeloffset'];
    window.addEventListener('mouseup', () => {
      if (dragMode && dragMode.kind === 'linkend' && didDrag) {
        this.cb.onChangeLinkOffset(dragMode.linkUid);
      } else if (dragMode && dragMode.kind === 'stuboffset' && didDrag) {
        this.cb.onChangeStubOffset(dragMode.linkUid);
      } else if (dragMode && dragMode.kind === 'labeloffset' && didDrag) {
        this.cb.onChangeLabelOffset(dragMode.linkUid);
      } else if (dragMode && !ownDragKinds.includes(dragMode.kind) && didDrag) {
        this.cb.onChangeGeometry(dragMode.shapeKind, dragMode.uid);
      }
      dragMode = null;
    });

    this.svg.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump]');
      if (jump && !didDrag) {
        this.cb.onJumpToGroup(jump.getAttribute('data-jump'));
        return;
      }
      const jumpInst = e.target.closest('[data-jump-institution]');
      if (jumpInst && !didDrag) {
        this.cb.onJumpToInstitution(jumpInst.getAttribute('data-jump-institution'));
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

// Bod, kde paprsek ze středu obdélníku směrem k `towardPoint` protíná jeho okraj.
// Díky tomu čáry vazeb končí na hraně boxu (a šipka je vidět), ne pod ním.
function rectBorderPoint(rect, towardPoint) {
  const c = centerOf(rect);
  const dx = towardPoint.x - c.x;
  const dy = towardPoint.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

// Bod uprostřed levé/pravé hrany (podle směru k druhému konci) – pro lomené
// čáry, aby "trunk" vždy vycházel ze strany boxu, ne z horní/dolní hrany.
// `dir` (+1/-1) říká, na kterou stranu od boxu čára vychází – používá se pak
// pro krátký "výstupek" mezi hranou boxu a svislou páteří (viz appendElbowLine).
function elbowEdgePoint(rect, towardCenter) {
  const c = centerOf(rect);
  if (towardCenter.x >= c.x) {
    return { x: rect.x + rect.w, y: c.y, dir: 1 };
  }
  return { x: rect.x, y: c.y, dir: -1 };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Posune bod ležící na hraně boxu `rect` o `offsetPx` podél té hrany, na
// které aktuálně leží (svislá hrana → posun v Y, vodorovná hrana → posun
// v X), a ořízne výsledek tak, aby zůstal na dané hraně boxu. Vrácené
// `axis` říká úchytu, kterým směrem se má dát táhnout myší.
function applyEndOffset(rect, point, offsetPx) {
  const onVerticalEdge = Math.abs(point.x - rect.x) < 0.6 || Math.abs(point.x - (rect.x + rect.w)) < 0.6;
  const axis = onVerticalEdge ? 'y' : 'x';
  if (!offsetPx) return { x: point.x, y: point.y, axis };
  const margin = 10;
  if (axis === 'y') {
    return { x: point.x, y: clamp(point.y + offsetPx, rect.y + margin, rect.y + rect.h - margin), axis };
  }
  return { x: clamp(point.x + offsetPx, rect.x + margin, rect.x + rect.w - margin), y: point.y, axis };
}

function pullBack(from, to, distance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.max(0, (len - distance) / len);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

// Geometrie vazby v tomto pavouku jako lomená čára (pole bodů zlomů) – pro
// rovnou vazbu jde jen o [p1, p2], pro lomenou o [p1, výstupek, zlom, p2].
// Sdílí se mezi vykreslením a přetahováním ID štítku podél čáry.
const ELBOW_STUB_GAP = 22;
function linkGeometry(link, a, b) {
  if (link.lineStyle === 'elbow') {
    const p1 = elbowEdgePoint(a, centerOf(b));
    const p2 = applyEndOffset(b, elbowEdgePoint(b, centerOf(a)), link.bEndOffset);
    const dir = p1.dir || 1;
    const nub = { x: p1.x + dir * ELBOW_STUB_GAP, y: p1.y };
    const bend = { x: nub.x, y: p2.y };
    return [p1, nub, bend, p2];
  }
  const p1 = rectBorderPoint(a, centerOf(b));
  const p2 = applyEndOffset(b, rectBorderPoint(b, centerOf(a)), link.bEndOffset);
  return [p1, p2];
}

function polylineLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return len;
}

// Bod na lomené čáře `points` v relativní vzdálenosti `t` (0 = začátek u A,
// 1 = konec u B) od celkové délky čáry.
function pointAtT(points, t) {
  const total = polylineLength(points);
  if (total === 0) return points[0];
  let target = clamp(t, 0, 1) * total;
  for (let i = 1; i < points.length; i += 1) {
    const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (target <= segLen || i === points.length - 1) {
      const frac = segLen === 0 ? 0 : target / segLen;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * frac, y: points[i - 1].y + (points[i].y - points[i - 1].y) * frac };
    }
    target -= segLen;
  }
  return points[points.length - 1];
}

// Opak pointAtT – najde `t` odpovídající bodu na čáře nejbližšímu `world`
// (myš při tažení štítku se nikdy nedrží přesně na čáře).
function closestTOnPolyline(points, world) {
  const total = polylineLength(points);
  if (total === 0) return 0;
  let best = { t: 0, distSq: Infinity };
  let cum = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen > 0) {
      let u = ((world.x - a.x) * (b.x - a.x) + (world.y - a.y) * (b.y - a.y)) / (segLen * segLen);
      u = clamp(u, 0, 1);
      const px = a.x + (b.x - a.x) * u;
      const py = a.y + (b.y - a.y) * u;
      const distSq = (world.x - px) ** 2 + (world.y - py) ** 2;
      if (distSq < best.distSq) best = { t: (cum + u * segLen) / total, distSq };
    }
    cum += segLen;
  }
  return best.t;
}

// Výchozí poloha ID štítku, když ji uživatel ještě ručně nepřetáhl (link.labelOffset
// je null): u rovné vazby střed čáry, u lomené přesně u zlomu (stejné místo,
// kde štítek býval, než šlo jeho polohu měnit).
function defaultLabelT(link, points) {
  if (link.lineStyle !== 'elbow') return 0.5;
  const total = polylineLength(points);
  if (total === 0) return 0.5;
  let cum = 0;
  for (let i = 1; i <= 2; i += 1) cum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return cum / total;
}

// Vykreslí čáru vazby přerušenou v místě štítku (idLabel se kreslí zvlášť,
// viz buildLinkLabelChip), a šipkami (dle arrow) na koncích, které jsou díky
// rectBorderPoint viditelné.
function appendBrokenLine(parent, points, idLabel, commonAttrs, linkType, arrow, labelPoint) {
  const [p1, p2] = points;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const gapHalf = idLabel.length * 3 + 8;
  const segEndA = { x: labelPoint.x - ux * gapHalf, y: labelPoint.y - uy * gapHalf };
  const segStartB = { x: labelPoint.x + ux * gapHalf, y: labelPoint.y + uy * gapHalf };

  const attrsA = { ...commonAttrs };
  const attrsB = { ...commonAttrs };
  if (arrow === 'both') attrsA['marker-start'] = `url(#arrow-${linkType})`;
  if (arrow === 'forward' || arrow === 'both') attrsB['marker-end'] = `url(#arrow-${linkType})`;

  // segmenty se kreslí, jen když je na ně místo (krátké vazby by se jinak zalomily)
  if (len > gapHalf * 2 + 10) {
    parent.appendChild(el('path', { d: `M${p1.x},${p1.y} L${segEndA.x},${segEndA.y}`, ...attrsA }));
    parent.appendChild(el('path', { d: `M${segStartB.x},${segStartB.y} L${p2.x},${p2.y}`, ...attrsB }));
  } else {
    parent.appendChild(el('path', { d: `M${p1.x},${p1.y} L${p2.x},${p2.y}`, ...commonAttrs, ...attrsB, ...(arrow === 'both' ? attrsA : {}) }));
  }
}

// Lomená (pravoúhlá) čára s jedním zlomem – pro vzory "hierarchický strom"
// a "seznam napojený na jeden uzel". Mezi hranu boxu a svislou páteř se
// vloží krátký vodorovný "výstupek" (nub) – jinak by páteř splývala s hranou
// sousedních boxů ve stejném sloupci a nebylo by poznat, ze kterého boxu
// vazby ve skutečnosti vychází.
function appendElbowLine(parent, points, commonAttrs, linkType, arrow) {
  const attrs = { ...commonAttrs };
  if (arrow === 'both') attrs['marker-start'] = `url(#arrow-${linkType})`;
  if (arrow === 'forward' || arrow === 'both') attrs['marker-end'] = `url(#arrow-${linkType})`;
  const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
  parent.appendChild(el('path', { d, ...attrs }));
}

// ID štítek vazby jako samostatný, tažením posunutelný "chip" (bílý podklad
// nad čárou) – používá se pro rovné i lomené vazby v rámci jednoho pavouka.
function buildLinkLabelChip(linkUid, point, idLabel, color) {
  const labelWidth = idLabel.length * 6 + 12;
  const chip = el('g', {
    class: 'link-id-chip',
    transform: `translate(${point.x},${point.y})`,
    'data-label-drag': linkUid,
  });
  chip.appendChild(
    el('rect', { x: -labelWidth / 2, y: -10, width: labelWidth, height: 18, rx: 3, fill: '#ffffff', stroke: color, 'fill-opacity': 0.92 })
  );
  const labelEl = el('text', { x: 0, y: 3, class: 'link-id-label', 'text-anchor': 'middle', fill: color });
  labelEl.textContent = idLabel;
  chip.appendChild(labelEl);
  return chip;
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
  svgClone.querySelectorAll('.link-id-label').forEach((n) => {
    n.setAttribute('font-family', 'Verdana, Geneva, sans-serif');
    n.setAttribute('font-size', '10');
    n.setAttribute('font-weight', 'bold');
  });
  svgClone.querySelectorAll('.export-title').forEach((n) => {
    n.setAttribute('fill', BRAND.blue);
    n.setAttribute('font-family', 'Verdana, Geneva, sans-serif');
    n.setAttribute('font-size', '20');
    n.setAttribute('font-weight', 'bold');
  });
  svgClone.querySelectorAll('.resize-handle').forEach((n) => n.remove());
  svgClone.querySelectorAll('.link-end-handle').forEach((n) => n.remove());
}
