(() => {
  'use strict';

  const state = {
    map: null,
    baseLayer: null,
    layers: [],
    nextId: 1,
    tolerance: 0.10,
    northVisible: true,
    northLayer: null,
    northBearing: null,
    activeAttrLayerId: null,
    attrSearch: '',
    attrSortKey: null,
    attrSortDir: 'asc',
    moveMode: false,
    moveSelected: new Set(),
    moveDrag: null,
    moveHistory: [],
    styleLayerId: null,
    descType: 'land',
    editMode: false,
    editHistory: [],
    cutDrawMode: false,
    cutCoords: [],
    cutLayer: null,
    cutPolygon: null,
    cutTip: null,
    deletedSnapshots: [],
    mapCompassScale: 1,
    collapsedGroups: new Set(),
    featurePan: null,
    suppressFeatureClickUntil: 0,
    cadOccupationMode: 'hatch',
    cadPreviewBlob: null,
    cadPreviewDataUrl: '',
    cadPreviewFilename: 'CAD_boundary_north.png',
    cadSymbolText: 'إشغال',
    cadFontSize: 28,
    cadLineWidth: 1,
    cadHatchSpacing: 18,
    cadHatchAngle: 45,
    cadPreviewZoom: 1,
    cadPreviewPanX: 0,
    cadPreviewPanY: 0,
    cadPreviewDrag: null,
    cadSendPending: false,
    cadManualLabels: [],
    cadActiveLetter: '',
    cadLabelPlacement: false,
    cadLabelDrag: null,
    cadManualHatchKeys: new Set(),
    cadHatchPlacement: false,
    cadPreviewTransform: null,
    cadHatchCandidates: []
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const uid = () => `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const COLORS = ['#48C8F2','#55CEF6','#63D3F8','#3FC1EE','#6BD7FA','#4ACAF4','#72DAFB','#5FD1F7'];

  const els = {
    basemapSelect: $('basemapSelect'),
    fitAllBtn: $('fitAllBtn'),
    focusMapBtn: $('focusMapBtn'),
    exitFocusMapBtn: $('exitFocusMapBtn'),
    uploadBtn: $('uploadBtn'),
    fileInput: $('fileInput'),
    mapStage: $('mapStage'),
    dropOverlay: $('dropOverlay'),
    importCard: $('importCard'),
    layerList: $('layerList'),
    emptyLayers: $('emptyLayers'),
    statLayers: $('statLayers'),
    statFeatures: $('statFeatures'),
    statPoints: $('statPoints'),
    toleranceInput: $('toleranceInput'),
    recheckBtn: $('recheckBtn'),
    utmZone: $('utmZone'),
    utmHemi: $('utmHemi'),
    northToggle: $('northToggle'),
    northBearingText: $('northBearingText'),
    moveToolBtn: $('moveToolBtn'),
    editGeometryBtn: $('editGeometryBtn'),
    editBanner: $('editBanner'),
    editStatusText: $('editStatusText'),
    drawCutBtn: $('drawCutBtn'),
    excludeSelectedBtn: $('excludeSelectedBtn'),
    keepSelectedBtn: $('keepSelectedBtn'),
    undoEditBtn: $('undoEditBtn'),
    resetEditBtn: $('resetEditBtn'),
    exitEditBtn: $('exitEditBtn'),
    cutDecision: $('cutDecision'),
    keepInsideCutBtn: $('keepInsideCutBtn'),
    removeInsideCutBtn: $('removeInsideCutBtn'),
    cancelCutBtn: $('cancelCutBtn'),
    areaCalcBtn: $('areaCalcBtn'),
    smartDescBtn: $('smartDescBtn'),
    clearAllBtn: $('clearAllBtn'),
    restoreDeletedBtn: $('restoreDeletedBtn'),
    mapCompass: $('mapCompass'),
    coordsChip: $('coordsChip'),
    moveBanner: $('moveBanner'),
    exitMoveBtn: $('exitMoveBtn'),
    undoMoveBtn: $('undoMoveBtn'),
    resetMoveBtn: $('resetMoveBtn'),
    zoomInBtn: $('zoomInBtn'),
    zoomOutBtn: $('zoomOutBtn'),
    homeBtn: $('homeBtn'),
    styleModal: $('styleModal'),
    styleLayerTitle: $('styleLayerTitle'),
    styleStroke: $('styleStroke'),
    styleFill: $('styleFill'),
    styleOpacity: $('styleOpacity'),
    styleWeight: $('styleWeight'),
    styleRadius: $('styleRadius'),
    styleOpacityText: $('styleOpacityText'),
    styleWeightText: $('styleWeightText'),
    styleRadiusText: $('styleRadiusText'),
    styleResetBtn: $('styleResetBtn'),
    styleApplyBtn: $('styleApplyBtn'),
    attributeModal: $('attributeModal'),
    attributeTitle: $('attributeTitle'),
    attributeSearch: $('attributeSearch'),
    attributeCount: $('attributeCount'),
    attributeTable: $('attributeTable'),
    moveModal: $('moveModal'),
    moveLayerChoices: $('moveLayerChoices'),
    resetOffsetsBtn: $('resetOffsetsBtn'),
    startMoveBtn: $('startMoveBtn'),
    areaModal: $('areaModal'),
    areaInput: $('areaInput'),
    fedResult: $('fedResult'),
    kiratResult: $('kiratResult'),
    sahmResult: $('sahmResult'),
    pickLargestAreaBtn: $('pickLargestAreaBtn'),
    smartModal: $('smartModal'),
    descType: $('descType'),
    descParcelName: $('descParcelName'),
    descLandArea: $('descLandArea'),
    descRoadArea: $('descRoadArea'),
    descLegalizeArea: $('descLegalizeArea'),
    descLocation: $('descLocation'),
    descBuildings: $('descBuildings'),
    useLargestForDesc: $('useLargestForDesc'),
    generateDescBtn: $('generateDescBtn'),
    descOutput: $('descOutput'),
    copyDescBtn: $('copyDescBtn'),
    toastHost: $('toastHost'),
    occupationRenderMode: $('occupationRenderMode'),
    previewCadBtn: $('previewCadBtn'),
    cadPreviewModal: $('cadPreviewModal'),
    cadPreviewImage: $('cadPreviewImage'),
    cadMarkerOverlay: $('cadMarkerOverlay'),
    cadPreviewViewport: $('cadPreviewViewport'),
    cadPreviewLoading: $('cadPreviewLoading'),
    cadModeTabs: $('cadModeTabs'),
    cadSymbolPanel: $('cadSymbolPanel'),
    cadHatchPanel: $('cadHatchPanel'),
    cadSymbolText: $('cadSymbolText'),
    cadFontSize: $('cadFontSize'),
    cadFontPlus: $('cadFontPlus'),
    cadFontMinus: $('cadFontMinus'),
    cadLineWidth: $('cadLineWidth'),
    cadLineWidthLabel: $('cadLineWidthLabel'),
    cadHatchSpacing: $('cadHatchSpacing'),
    cadHatchDensePlus: $('cadHatchDensePlus'),
    cadHatchDenseMinus: $('cadHatchDenseMinus'),
    cadHatchAngle: $('cadHatchAngle'),
    cadHatchAngleLabel: $('cadHatchAngleLabel'),
    cadPreviewZoomIn: $('cadPreviewZoomIn'),
    cadPreviewZoomOut: $('cadPreviewZoomOut'),
    cadPreviewReset: $('cadPreviewReset'),
    cadZoomReadout: $('cadZoomReadout'),
    cadCancelBtn: $('cadCancelBtn'),
    cadSendStatus: $('cadSendStatus'),
    cadLetterPalette: $('cadLetterPalette'),
    cadMarkerModeLabel: $('cadMarkerModeLabel'),
    cadUndoMarkerBtn: $('cadUndoMarkerBtn'),
    cadClearMarkersBtn: $('cadClearMarkersBtn'),
    cadPickHatchBtn: $('cadPickHatchBtn'),
    cadClearHatchBtn: $('cadClearHatchBtn'),
    cadHatchModeLabel: $('cadHatchModeLabel'),
    downloadCadBtn: $('downloadCadBtn'),
    sendCadBtn: $('sendCadBtn')
  };

  function toast(message, type = 'ok', timeout = 3200) {
    if (state.silentActionDepth > 0) return;
    const node = document.createElement('div');
    node.className = `toast ${type === 'error' ? 'error' : type === 'warn' ? 'warn' : ''}`;
    node.textContent = message;
    els.toastHost.appendChild(node);
    setTimeout(() => node.remove(), timeout);
  }

  function openModal(id) { $(id)?.classList.add('show'); }
  function closeModal(id) { $(id)?.classList.remove('show'); }

  function escapeHtml(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function fmt(n, digits = 2) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString('en-US', { maximumFractionDigits: digits });
  }

  function isOccupationLayer(layer) {
    const name = `${layer?.name || ''} ${layer?.groupName || ''} ${layer?.source || ''}`.toLowerCase();
    return /(occup|occupation|ishg|eshgh|work|works|utilit|service|اشغال|إشغال|إشغالات|اشغالات|مبان|building|road)/i.test(name);
  }

  function featureLayerName(feature, fallback='Feature') {
    const props = feature?.properties || {};
    return props.name || props.Name || props.layer || props.Layer || props.type || props.Type || fallback;
  }

  function normalizeFeatureCollection(data) {
    if (!data) return null;
    if (data.type === 'FeatureCollection') return data;
    if (data.type === 'Feature') return { type: 'FeatureCollection', features: [data] };
    if (data.type && data.coordinates) {
      return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: data }] };
    }
    return null;
  }


  function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function prepareWorkingGeojson(fc) {
    const working = cloneValue(fc || { type: 'FeatureCollection', features: [] });
    (working.features || []).forEach((feature, idx) => {
      if (!Number.isInteger(feature.__gaSourceIndex)) feature.__gaSourceIndex = idx;
      feature.__gaExcluded = Boolean(feature.__gaExcluded);
      feature.__gaSelected = false;
    });
    return working;
  }

  function getWorkingGeojson(layer) {
    if (!layer) return null;
    if ((layer.kind === 'shapefile' || layer.kind === 'geojson') && !layer.exportGeojson && layer.geojson) {
      layer.exportGeojson = prepareWorkingGeojson(layer.geojson);
    }
    return layer.exportGeojson || layer.geojson;
  }

  function cleanExportFeature(feature) {
    const out = cloneValue(feature);
    delete out.__gaSourceIndex;
    delete out.__gaExcluded;
    delete out.__gaSelected;
    return out;
  }

  function isPolygonFeature(feature) {
    return feature?.geometry?.type === 'Polygon' || feature?.geometry?.type === 'MultiPolygon';
  }

  // Reference area engine copied from the published Gis_APP algorithm:
  // WGS84 lon/lat -> WGS84 UTM -> shoelace polygon area.
  // Feddan = m2 / 4200.83. Display truncates, never rounds.
  const FEDDAN_M2 = 4200.83;

  function truncToFixed(n, decimals) {
    const value = Number(n);
    if (!Number.isFinite(value)) return (0).toFixed(decimals);
    const m = Math.pow(10, decimals);
    const negative = value < 0;
    const v = Math.trunc(Math.abs(value) * m) / m;
    return (negative ? '-' : '') + v.toFixed(decimals);
  }

  function utmZoneFromLonReference(lon) {
    let z = Math.floor((Number(lon) + 180) / 6) + 1;
    if (z < 1) z = 1;
    if (z > 60) z = 60;
    return z;
  }

  function toUtmReference(lonLat, zone, hemi) {
    const south = hemi === 'S' ? ' +south' : '';
    const dst = `+proj=utm +zone=${zone}${south} +datum=WGS84 +units=m +no_defs`;
    return proj4('EPSG:4326', dst, [Number(lonLat[0]), Number(lonLat[1])]);
  }

  function ringAreaUtmReference(ring, zone, hemi) {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    const pts = ring.map(c => toUtmReference(c, zone, hemi));
    let s = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  }

  function ringAreaSphericalReference(ring) {
    const R = 6378137;
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    const rad = d => d * Math.PI / 180;
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[(i + 1) % ring.length];
      area += rad(lon2 - lon1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
    }
    return Math.abs(area * R * R / 2);
  }

  function geometryMeanLonLat(geometry) {
    let sx = 0, sy = 0, n = 0;
    const walk = v => {
      if (!Array.isArray(v)) return;
      if (v.length >= 2 && Number.isFinite(Number(v[0])) && Number.isFinite(Number(v[1]))) {
        sx += Number(v[0]); sy += Number(v[1]); n++; return;
      }
      v.forEach(walk);
    };
    walk(geometry?.coordinates);
    return n ? [sx / n, sy / n] : null;
  }

  function polygonAreaMetersReference(rings, zone, hemi) {
    if (!rings || !rings.length) return 0;
    const fn = zone ? (r => ringAreaUtmReference(r, zone, hemi)) : ringAreaSphericalReference;
    let total = fn(rings[0]);
    for (let i = 1; i < rings.length; i++) total -= fn(rings[i]);
    return Math.max(0, total);
  }

  function featureAreaMetersReference(feature) {
    const clean = cleanExportFeature(feature);
    const g = clean?.geometry;
    if (!g || !['Polygon','MultiPolygon'].includes(g.type)) return 0;
    const center = geometryMeanLonLat(g);
    let zone = null, hemi = 'N';
    if (center) {
      zone = utmZoneFromLonReference(center[0]);
      hemi = center[1] >= 0 ? 'N' : 'S';
    }
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let area = 0;
    for (const rings of polys) area += polygonAreaMetersReference(rings, zone, hemi);
    return area;
  }

  function feddanFromSqm(sqm) {
    return Number(sqm) / FEDDAN_M2;
  }

  function areaPopupHtml(feature) {
    if (!isPolygonFeature(feature)) return '';
    const sqm = featureAreaMetersReference(feature);
    const fed = feddanFromSqm(sqm);
    const sqmText = truncToFixed(sqm, 2);
    const fedText = truncToFixed(fed, 4);
    return `<div class="ga-area-popup">
      <div class="ga-area-row"><span>المتر المربع</span><strong><span class="ga-number">${sqmText}</span><span class="ga-unit" dir="rtl">م2</span></strong><button class="ga-copy-btn" data-copy-area="${sqmText}" data-copy-kind="sqm" title="نسخ ذكي">نسخ</button></div>
      <div class="ga-area-row"><span>الفدان</span><strong><span class="ga-number">${fedText}</span><span class="ga-unit" dir="rtl">فدان</span></strong><button class="ga-copy-btn" data-copy-area="${fedText}" data-copy-kind="fed" title="نسخ ذكي">نسخ</button></div>
    </div>`;
  }

  async function copyPlainText(text, label = 'القيمة') {
    try {
      await navigator.clipboard.writeText(String(text));
      toast(`تم نسخ ${label}`);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = String(text); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      toast(`تم نسخ ${label}`);
    }
  }

  function flattenShpResult(result) {
    if (!result) return null;
    if (Array.isArray(result)) {
      const features = result.flatMap(fc => normalizeFeatureCollection(fc)?.features || []);
      return { type: 'FeatureCollection', features };
    }
    return normalizeFeatureCollection(result);
  }

  function inferGeomLabel(fc) {
    const types = new Set((fc?.features || []).map(f => f?.geometry?.type).filter(Boolean));
    if (!types.size) return 'Unknown';
    if (types.size === 1) return [...types][0];
    return 'Mixed';
  }

  function countPointsInGeometry(geom) {
    if (!geom) return 0;
    if (geom.type === 'Point') return 1;
    if (geom.type === 'MultiPoint') return geom.coordinates.length;
    return 0;
  }

  function getBasemapConfig(name) {
    if (name === 'google') {
      return {
        url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        options: { maxNativeZoom: 21, maxZoom: 28, subdomains: ['0','1','2','3'], attribution: 'Google' }
      };
    }
    if (name === 'osm') {
      return { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', options: { maxZoom: 20, attribution: '&copy; OpenStreetMap contributors' } };
    }
    if (name === 'carto') {
      return { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', options: { maxZoom: 20, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO' } };
    }
    return { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', options: { maxNativeZoom: 19, maxZoom: 28, attribution: 'Tiles &copy; Esri' } };
  }

  function setBasemap(name) {
    const config = getBasemapConfig(name);
    if (state.baseLayer) state.map.removeLayer(state.baseLayer);
    state.baseLayer = L.tileLayer(config.url, { ...config.options, crossOrigin: true }).addTo(state.map);
    state.baseLayer.bringToBack();
  }

  function updateMapCompassScale() {
    if (!els.mapCompass || !state.map) return;
    const z = state.map.getZoom();
    const scale = clamp(0.82 + Math.max(0, z - 6) * 0.045, 0.82, 1.36);
    state.mapCompassScale = scale;
    els.mapCompass.style.setProperty('--compass-scale', scale.toFixed(3));
  }

  function initMap() {
    state.map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([26.8, 30.8], 6);
    setBasemap('google');

    state.map.on('mousemove', (e) => {
      els.coordsChip.textContent = `Lat ${e.latlng.lat.toFixed(6)} · Lng ${e.latlng.lng.toFixed(6)}`;
      if (state.moveMode && state.moveDrag) handleMoveDrag(e.latlng);
    });

    state.map.on('mousedown', (e) => {
      if (!state.moveMode || !state.moveSelected.size) return;
      state.moveDrag = { last: e.latlng, start: e.latlng, selected: [...state.moveSelected] };
      state.map.dragging.disable();
    });

    state.map.on('mouseup', () => endMoveDrag());
    state.map.on('mouseout', () => endMoveDrag());
    state.map.on('click', handleCutMapClick);
    state.map.on('dblclick', finishCutDrawing);

    document.addEventListener('mousemove', handleFeaturePanMove);
    document.addEventListener('mouseup', endFeaturePan);
  }

  function startFeaturePan(ev) {
    const oe = ev?.originalEvent;
    if (!oe || state.moveMode || state.cutDrawMode) return;
    state.featurePan = { x: oe.clientX, y: oe.clientY, moved: false };
  }

  function handleFeaturePanMove(e) {
    const pan = state.featurePan;
    if (!pan || state.moveMode || !state.map) return;
    const dx = e.clientX - pan.x;
    const dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 3) return;
    pan.moved = true;
    state.map.panBy([-dx, -dy], { animate: false });
    pan.x = e.clientX;
    pan.y = e.clientY;
  }

  function endFeaturePan() {
    if (!state.featurePan) return;
    if (state.featurePan.moved) state.suppressFeatureClickUntil = Date.now() + 220;
    state.featurePan = null;
  }

  function endMoveDrag() {
    if (!state.moveDrag) return;
    const drag = state.moveDrag;
    const moved = drag.selected.map(id => {
      const layer = state.layers.find(l => l.id === id);
      return layer ? { id, dLat: layer.visualOffset.lat, dLng: layer.visualOffset.lng } : null;
    }).filter(Boolean);
    if (moved.length) state.moveHistory.push({ layers: moved });
    state.moveDrag = null;
    if (!state.moveMode) state.map.dragging.enable();
  }

  function applyDeltaToLeafletLayer(leafletLayer, dLat, dLng) {
    if (!leafletLayer) return;
    if (leafletLayer instanceof L.Marker || leafletLayer instanceof L.CircleMarker || leafletLayer instanceof L.Circle) {
      const ll = leafletLayer.getLatLng();
      leafletLayer.setLatLng([ll.lat + dLat, ll.lng + dLng]);
      return;
    }
    if (leafletLayer instanceof L.Polyline || leafletLayer instanceof L.Polygon) {
      const shift = (arr) => arr.map(v => Array.isArray(v) ? shift(v) : L.latLng(v.lat + dLat, v.lng + dLng));
      leafletLayer.setLatLngs(shift(leafletLayer.getLatLngs()));
      return;
    }
    if (leafletLayer.eachLayer) leafletLayer.eachLayer(child => applyDeltaToLeafletLayer(child, dLat, dLng));
  }

  function handleMoveDrag(current) {
    const last = state.moveDrag.last;
    const dLat = current.lat - last.lat;
    const dLng = current.lng - last.lng;
    if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) return;
    for (const id of state.moveSelected) {
      const layer = state.layers.find(l => l.id === id && l.visible);
      if (!layer?.leafletLayer) continue;
      applyDeltaToLeafletLayer(layer.leafletLayer, dLat, dLng);
      layer.visualOffset.lat += dLat;
      layer.visualOffset.lng += dLng;
    }
    if (state.northLayer) applyDeltaToLeafletLayer(state.northLayer, dLat, dLng);
    state.moveDrag.last = current;
  }

  function makeLayerName(filename) {
    return filename.replace(/\.(zip|rar|shp|shx|dbf|prj|cpg|xlsx|xls|csv|geojson|json)$/i, '');
  }

  function stableHash(input) {
    const s = String(input || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  function layerFingerprint(meta) {
    try {
      if (meta.geojson?.features?.length) {
        const geometryOnly = meta.geojson.features.map(f => f?.geometry || null);
        return `${meta.kind || ''}:${meta.geomType || ''}:${stableHash(JSON.stringify(geometryOnly))}`;
      }
      if (meta.pointFeatures?.length) {
        const coords = meta.pointFeatures.map(f => f?.geometry?.coordinates || null);
        return `${meta.kind || ''}:Point:${stableHash(JSON.stringify(coords))}`;
      }
    } catch {}
    return `${meta.kind || ''}:${String(meta.source || meta.name || '').toLowerCase()}`;
  }

  function setActiveLayer(id) {
    state.activeLayerId = id || null;
    state.layers.forEach(layer => {
      if (!layer.leafletLayer?.eachLayer) return;
      const active = layer.id === state.activeLayerId;
      layer.leafletLayer.eachLayer(item => {
        if (!item?.setStyle) return;
        const feature = item.feature;
        if (feature) {
          const base = styleFeature(layer, feature);
          item.setStyle(active ? { ...base, color:'#00BFFF', fillColor:'#66D9FF', weight:Math.max(3.2, Number(base.weight || 2)+1), fillOpacity:Math.max(.18, Number(base.fillOpacity || 0)) } : base);
        } else {
          item.setStyle(active ? { color:'#00BFFF', fillColor:'#66D9FF', weight:2.6, fillOpacity:.95 } : { color:layer.style.stroke, fillColor:layer.style.fill, weight:Math.max(1,layer.style.weight/2), fillOpacity:.95 });
        }
      });
    });
    renderLayerList();
  }

  function addLayer(meta) {
    const fingerprint = layerFingerprint(meta);
    const duplicate = state.layers.find(l => l.fingerprint === fingerprint);
    if (duplicate) return duplicate;
    const layer = {
      id: uid(),
      name: meta.name || `Layer ${state.nextId++}`,
      kind: meta.kind,
      source: meta.source || '',
      groupId: meta.groupId || null,
      groupName: meta.groupName || null,
      color: COLORS[state.layers.length % COLORS.length],
      visible: true,
      exportEnabled: meta.exportEnabled !== false,
      geojson: meta.geojson || null,
      exportGeojson: meta.geojson ? prepareWorkingGeojson(meta.geojson) : null,
      rows: meta.rows || [],
      pointFeatures: meta.pointFeatures || [],
      leafletLayer: null,
      geomType: meta.geomType || 'Unknown',
      visualOffset: { lat: 0, lng: 0 },
      style: { stroke: meta.color || '#42C6F2', fill: meta.color || '#69D7FA', fillOpacity: 0.11, weight: 2.2, radius: 5.0 },
      toleranceResults: [],
      fingerprint
    };
    layer.style.stroke = layer.color; layer.style.fill = layer.color;
    state.layers.push(layer);
    renderLayer(layer);
    renderLayerList();
    updateStats();
    updateNorthEdge();
    return layer;
  }

  function styleFeature(layer, feature) {
    const geom = feature?.geometry?.type || '';
    if (feature?.__gaExcluded) {
      return { color: '#8b98a0', weight: 2, fillColor: '#a7b0b5', fillOpacity: 0.06, opacity: 0.55, dashArray: '7 6' };
    }
    if (layer?.id === state.activeLayerId) {
      if (geom.includes('Polygon')) return { color:'#00BFFF', weight:Math.max(3.2, layer.style.weight + 1), fillColor:'#66D9FF', fillOpacity:.18, opacity:1 };
      if (geom.includes('LineString')) return { color:'#00BFFF', weight:Math.max(3.2, layer.style.weight + 1), opacity:1 };
      if (geom.includes('Point')) return { color:'#00BFFF', weight:2.6, fillColor:'#66D9FF', fillOpacity:.95, opacity:1 };
    }
    if (feature?.__gaSelected && geom.includes('Polygon')) {
      return { color: '#18AEE7', weight: Math.max(2.8, layer.style.weight + 0.8), fillColor: '#7EDCFA', fillOpacity: 0.17, opacity: 0.98 };
    }
    if (geom.includes('Polygon')) {
      return { color: layer.style.stroke, weight: layer.style.weight, fillColor: layer.style.fill, fillOpacity: layer.style.fillOpacity, opacity: 0.88 };
    }
    if (geom.includes('LineString')) {
      return { color: layer.style.stroke, weight: Math.max(2, layer.style.weight), opacity: 0.9 };
    }
    return {};
  }

  function refreshSelectionStyles() {
    exportEditableLayers().forEach(layer => {
      if (!layer.leafletLayer?.eachLayer) return;
      layer.leafletLayer.eachLayer(leafletFeature => {
        const feature = leafletFeature.feature;
        if (feature && leafletFeature.setStyle) leafletFeature.setStyle(styleFeature(layer, feature));
      });
    });
    updateEditStatus();
  }


  function smallestPolygonHitAt(latlng) {
    if (!latlng || !window.turf) return null;
    const point = turf.point([Number(latlng.lng), Number(latlng.lat)]);
    const hits = [];
    exportEditableLayers().forEach(layer => {
      if (!layer.visible) return;
      const working = getWorkingGeojson(layer);
      (working?.features || []).forEach(feature => {
        if (!isPolygonFeature(feature) || feature.__gaExcluded) return;
        try {
          if (turf.booleanPointInPolygon(point, cleanExportFeature(feature))) {
            hits.push({ layer, feature, area: featureAreaMetersReference(feature) });
          }
        } catch (_) {}
      });
    });
    hits.sort((a,b) => a.area - b.area);
    return hits[0] || null;
  }

  function selectExactPolygonAt(latlng, multi = false) {
    const target = smallestPolygonHitAt(latlng);
    if (!target) return null;
    const feature = target.feature;
    const wasSelected = Boolean(feature.__gaSelected);
    if (!multi) {
      exportEditableLayers().forEach(otherLayer => {
        (getWorkingGeojson(otherLayer)?.features || []).forEach(otherFeature => {
          if (isPolygonFeature(otherFeature)) otherFeature.__gaSelected = false;
        });
      });
    }
    feature.__gaSelected = multi ? !wasSelected : true;
    refreshSelectionStyles();
    try {
      L.popup({ maxWidth: 290, closeButton: true, autoPan: true })
        .setLatLng(latlng)
        .setContent(areaPopupHtml(feature))
        .openOn(state.map);
    } catch (_) {}
    return target;
  }

  function renderLayer(layer) {
    if (layer.leafletLayer) state.map.removeLayer(layer.leafletLayer);
    layer.visualOffset = { lat: 0, lng: 0 };

    if (layer.kind === 'shapefile' || layer.kind === 'geojson') {
      const workingGeojson = getWorkingGeojson(layer);
      layer.leafletLayer = L.geoJSON(workingGeojson, {
        style: feature => styleFeature(layer, feature),
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
          radius: layer.style.radius, color: layer.style.stroke, weight: Math.max(1, layer.style.weight/2), fillColor: layer.style.fill, fillOpacity: Math.max(.45, layer.style.fillOpacity)
        }),
        onEachFeature: (feature, leafletFeature) => {
          leafletFeature.on('mousedown', (ev) => startFeaturePan(ev));
          if (isPolygonFeature(feature)) {
            leafletFeature.on('click', (ev) => {
              if (Date.now() < state.suppressFeatureClickUntil) return;
              if (state.cutDrawMode) return;
              const multi = Boolean(ev?.originalEvent?.shiftKey);
              // IMPORTANT: when polygons overlap (e.g. a building inside the land parcel),
              // always select the SMALLEST polygon under the cursor, not the outer land.
              selectExactPolygonAt(ev.latlng, multi);
            });
          }
        }
      });
    } else if (layer.kind === 'sheet') {
      const group = L.layerGroup();
      layer.pointFeatures.forEach((feat, idx) => {
        const [lng, lat] = feat.geometry.coordinates;
        const marker = L.circleMarker([lat, lng], {
          radius: layer.style.radius, color: layer.style.stroke, weight: Math.max(1, layer.style.weight/2), fillColor: layer.style.fill, fillOpacity: 0.95
        });
        marker.__sheetIndex = idx;
        marker.bindPopup(() => pointPopupHtml(layer, idx));
        group.addLayer(marker);
      });
      layer.leafletLayer = group;
    }

    if (layer.visible && layer.leafletLayer) layer.leafletLayer.addTo(state.map);
    if (layer.kind === 'sheet') refreshToleranceForLayer(layer);
  }

  function pointPopupHtml(layer, idx) {
    const feat = layer.pointFeatures[idx];
    const props = feat?.properties || {};
    const result = layer.toleranceResults[idx];
    const distanceLine = result
      ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #ddd"><strong>المسافة عن الحد:</strong> ${fmt(result.distance,3)} m<br><strong>الحالة:</strong> ${result.ok ? 'داخل السماحية' : 'خارج السماحية'}</div>`
      : '<div style="margin-top:6px">لا توجد حدود Polygon ظاهرة للمقارنة.</div>';
    const rows = Object.entries(props).slice(0, 8).map(([k,v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`).join('');
    return `<div dir="rtl" style="font-family:Cairo;font-size:11px"><b>${escapeHtml(layer.name)} · نقطة ${idx+1}</b>${rows}${distanceLine}</div>`;
  }

  function allVisibleBounds() {
    const bounds = [];
    for (const layer of state.layers) {
      if (!layer.visible || !layer.leafletLayer?.getBounds) continue;
      const b = layer.leafletLayer.getBounds();
      if (b?.isValid?.()) bounds.push(b);
    }
    if (!bounds.length) return null;
    let merged = bounds[0];
    for (let i = 1; i < bounds.length; i++) merged = merged.extend(bounds[i]);
    return merged;
  }

  function fitAll() {
    const b = allVisibleBounds();
    if (b) state.map.fitBounds(b.pad(0.12), { maxZoom: 18 });
    else state.map.setView([26.8, 30.8], 6);
  }

  function updateStats() {
    let features = 0, points = 0;
    state.layers.forEach(layer => {
      if (layer.geojson?.features) {
        features += layer.geojson.features.length;
        points += layer.geojson.features.reduce((a, f) => a + countPointsInGeometry(f.geometry), 0);
      }
      if (layer.kind === 'sheet') {
        features += layer.pointFeatures.length;
        points += layer.pointFeatures.length;
      }
    });
    els.statLayers.textContent = state.layers.length;
    els.statFeatures.textContent = features;
    els.statPoints.textContent = points;
  }

  function renderLayerList() {
    els.layerList.innerHTML = '';
    if (!state.layers.length) {
      els.layerList.appendChild(els.emptyLayers);
      els.emptyLayers.style.display = 'flex';
      return;
    }
    els.emptyLayers.style.display = 'none';

    const grouped = new Map();
    const standalone = [];
    state.layers.forEach(layer => {
      if ((layer.kind === 'shapefile' || layer.kind === 'geojson') && layer.groupId) {
        if (!grouped.has(layer.groupId)) grouped.set(layer.groupId, { name: layer.groupName || 'Shapefile', layers: [] });
        grouped.get(layer.groupId).layers.push(layer);
      } else {
        standalone.push(layer);
      }
    });

    const makeChildCard = (layer, nested = false) => {
      const card = document.createElement('div');
      card.className = `layer-card ${nested ? 'nested-layer' : ''} ${state.moveSelected.has(layer.id) ? 'selected-move' : ''} ${state.activeLayerId === layer.id ? 'active-layer-card' : ''}`;
      const count = layer.kind === 'sheet' ? layer.pointFeatures.length : (layer.geojson?.features?.length || 0);
      card.innerHTML = `
        <div class="layer-top">
          <input class="layer-check" type="checkbox" data-action="visibility" ${layer.visible ? 'checked' : ''} aria-label="إظهار أو إخفاء ${escapeHtml(layer.name)}">
          <div class="color-swatch" style="background:${layer.color}"></div>
          <div class="layer-info">
            <b title="${escapeHtml(layer.name)}">${escapeHtml(layer.name)}</b>
            <span>${escapeHtml(layer.kind.toUpperCase())} · ${escapeHtml(layer.geomType)} · ${count}</span>
          </div>
          <label class="export-layer-toggle" title="إدخال الطبقة في التصدير">
            <input type="checkbox" data-action="export" ${layer.exportEnabled !== false ? 'checked' : ''}>
            <span>تصدير</span>
          </label>
        </div>
        <div class="layer-actions">
          <button data-action="zoom">تكبير</button>
          <button data-action="table">الجدول</button>
          <button data-action="style">تنسيق</button>
          <button data-action="move">تحريك</button>
          <button data-action="delete" class="danger">حذف</button>
        </div>`;
      card.querySelector('[data-action="visibility"]').onchange = () => setLayerVisibility(layer.id, !layer.visible);
      card.querySelector('[data-action="export"]').onchange = (e) => { layer.exportEnabled = Boolean(e.target.checked); renderLayerList(); };
      card.querySelector('[data-action="zoom"]').onclick = () => zoomLayer(layer.id);
      card.querySelector('[data-action="table"]').onclick = () => openAttributeTable(layer.id);
      card.querySelector('[data-action="style"]').onclick = () => openLayerStyle(layer.id);
      card.querySelector('[data-action="move"]').onclick = () => quickSelectMove(layer.id);
      card.querySelector('[data-action="delete"]').onclick = () => deleteLayer(layer.id);
      card.addEventListener('click', e => {
        if (e.target.closest('button,input,label,select,a')) return;
        setActiveLayer(layer.id);
      });
      return card;
    };

    [...grouped.entries()].reverse().forEach(([groupId, group]) => {
      const wrap = document.createElement('div');
      wrap.className = 'layer-group';
      const allVisible = group.layers.every(l => l.visible);
      const someVisible = group.layers.some(l => l.visible);
      const collapsed = state.collapsedGroups.has(groupId);
      wrap.innerHTML = `
        <div class="layer-group-head">
          <button class="group-chevron" type="button" title="فتح / غلق">${collapsed ? '◂' : '▾'}</button>
          <input class="layer-check group-check" type="checkbox" ${allVisible ? 'checked' : ''} aria-label="إظهار أو إخفاء كل طبقات ${escapeHtml(group.name)}">
          <div class="group-folder">▱</div>
          <div class="layer-info group-info">
            <b title="${escapeHtml(group.name)}">${escapeHtml(group.name)}</b>
            <span>Shapefile · ${group.layers.length} ${group.layers.length === 1 ? 'طبقة' : 'طبقات'}</span>
          </div>
          <label class="export-layer-toggle group-export-toggle" title="إدخال كل طبقات المجموعة في التصدير">
            <input type="checkbox" class="group-export-check">
            <span>تصدير</span>
          </label>
        </div>
        <div class="layer-group-children ${collapsed ? 'collapsed' : ''}"></div>`;
      const parentCheck = wrap.querySelector('.group-check');
      parentCheck.indeterminate = someVisible && !allVisible;
      parentCheck.onchange = () => setGroupVisibility(groupId, parentCheck.checked);
      const groupExportCheck = wrap.querySelector('.group-export-check');
      const allExport = group.layers.every(l => l.exportEnabled !== false);
      const someExport = group.layers.some(l => l.exportEnabled !== false);
      groupExportCheck.checked = allExport;
      groupExportCheck.indeterminate = someExport && !allExport;
      groupExportCheck.onchange = () => { group.layers.forEach(l => l.exportEnabled = groupExportCheck.checked); renderLayerList(); };
      wrap.querySelector('.group-chevron').onclick = () => {
        if (state.collapsedGroups.has(groupId)) state.collapsedGroups.delete(groupId);
        else state.collapsedGroups.add(groupId);
        renderLayerList();
      };
      const children = wrap.querySelector('.layer-group-children');
      group.layers.forEach(layer => children.appendChild(makeChildCard(layer, true)));
      els.layerList.appendChild(wrap);
    });

    [...standalone].reverse().forEach(layer => els.layerList.appendChild(makeChildCard(layer, false)));
  }

  function setLayerVisibility(id, visible) {
    const layer = state.layers.find(l => l.id === id);
    if (!layer?.leafletLayer) return;
    layer.visible = Boolean(visible);
    if (layer.visible) layer.leafletLayer.addTo(state.map); else state.map.removeLayer(layer.leafletLayer);
    renderLayerList();
    refreshAllTolerance();
    updateNorthEdge();
  }

  function setGroupVisibility(groupId, visible) {
    const groupLayers = state.layers.filter(l => l.groupId === groupId);
    groupLayers.forEach(layer => {
      layer.visible = Boolean(visible);
      if (!layer.leafletLayer) return;
      if (layer.visible) layer.leafletLayer.addTo(state.map); else state.map.removeLayer(layer.leafletLayer);
    });
    renderLayerList();
    refreshAllTolerance();
    updateNorthEdge();
  }

  function toggleLayer(id) {
    const layer = state.layers.find(l => l.id === id);
    if (!layer) return;
    setLayerVisibility(id, !layer.visible);
  }

  function zoomLayer(id) {
    const layer = state.layers.find(l => l.id === id);
    if (layer?.leafletLayer?.getBounds) {
      const b = layer.leafletLayer.getBounds();
      if (b.isValid()) state.map.fitBounds(b.pad(0.15), { maxZoom: 19 });
    }
  }

  function snapshotLayerData() {
    return state.layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      kind: layer.kind,
      source: layer.source,
      groupId: layer.groupId || null,
      groupName: layer.groupName || null,
      color: layer.color,
      visible: layer.visible,
      exportEnabled: layer.exportEnabled !== false,
      geojson: cloneValue(layer.geojson),
      exportGeojson: cloneValue(layer.exportGeojson),
      rows: cloneValue(layer.rows || []),
      pointFeatures: cloneValue(layer.pointFeatures || []),
      geomType: layer.geomType,
      style: cloneValue(layer.style),
      visualOffset: cloneValue(layer.visualOffset || { lat:0, lng:0 }),
      fingerprint: layer.fingerprint || layerFingerprint(layer)
    }));
  }

  function rememberDeletedState() {
    if (!state.layers.length) return;
    state.deletedSnapshots.push(snapshotLayerData());
    if (state.deletedSnapshots.length > 10) state.deletedSnapshots.shift();
  }

  function removeAllLayersFromMap() {
    if (state.editMode) { state.editMode = false; els.editBanner?.classList.remove('show'); els.editGeometryBtn?.classList.remove('is-active'); }
    cancelCutDrawing();
    state.layers.forEach(l => l.leafletLayer && state.map.removeLayer(l.leafletLayer));
    state.layers = [];
    state.moveSelected.clear();
    state.activeLayerId = null;
    if (state.northLayer) state.map.removeLayer(state.northLayer);
    state.northLayer = null;
  }

  function restoreDeleted(options = {}) {
    const snapshot = state.deletedSnapshots.pop();
    if (!snapshot) { if (!options.silent) toast('لا توجد بيانات محذوفة لاسترجاعها', 'warn'); return; }
    removeAllLayersFromMap();
    state.layers = snapshot.map(meta => ({
      ...meta,
      geojson: cloneValue(meta.geojson),
      exportGeojson: cloneValue(meta.exportGeojson),
      rows: cloneValue(meta.rows || []),
      pointFeatures: cloneValue(meta.pointFeatures || []),
      style: cloneValue(meta.style),
      visualOffset: { lat:0, lng:0 },
      leafletLayer: null,
      toleranceResults: []
    }));
    state.layers.forEach(renderLayer);
    renderLayerList();
    updateStats();
    refreshAllTolerance();
    updateNorthEdge();
    fitAll();
    if (!options.silent) toast('تم استرجاع آخر بيانات تم مسحها');
  }

  function deleteLayer(id) {
    const idx = state.layers.findIndex(l => l.id === id);
    if (idx < 0) return;
    rememberDeletedState();
    const [layer] = state.layers.splice(idx, 1);
    if (layer.leafletLayer) state.map.removeLayer(layer.leafletLayer);
    state.moveSelected.delete(id);
    if (state.activeLayerId === id) state.activeLayerId = null;
    renderLayerList();
    updateStats();
    refreshAllTolerance();
    updateNorthEdge();
    toast(`تم حذف طبقة ${layer.name} · Shift+Z للاسترجاع`);
  }

  function clearAll(options = {}) {
    if (!state.layers.length) return;
    if (options.remember !== false) rememberDeletedState();
    removeAllLayersFromMap();
    renderLayerList();
    updateStats();
    updateNorthEdge();
    if (!options.silent) toast('تم حذف جميع طبقات الشيب فايل والنقاط · Shift+Z للاسترجاع');
  }

  function removeKindsForReplacement(kinds) {
    const set = new Set(kinds);
    if (set.has('shapefile') || set.has('geojson')) {
      state.cadManualHatchKeys.clear();
      state.cadManualLabels = [];
      state.cadHatchPlacement = false;
      state.cadLabelPlacement = false;
      state.cadActiveLetter = '';
    }
    const targets = state.layers.filter(l => set.has(l.kind));
    if (!targets.length) return false;
    rememberDeletedState();
    targets.forEach(layer => {
      if (layer.leafletLayer) state.map.removeLayer(layer.leafletLayer);
      state.moveSelected.delete(layer.id);
      if (state.activeLayerId === layer.id) state.activeLayerId = null;
    });
    state.layers = state.layers.filter(l => !set.has(l.kind));
    renderLayerList();
    updateStats();
    refreshAllTolerance();
    updateNorthEdge();
    return true;
  }

  function getLargestVisiblePolygonFeature() {
    let best = null;
    for (const layer of state.layers) {
      const working = getWorkingGeojson(layer);
      if (!layer.visible || !(layer.kind === 'shapefile' || layer.kind === 'geojson') || !working?.features) continue;
      for (const feature of working.features) {
        if (feature.__gaExcluded) continue;
        const t = feature?.geometry?.type;
        if (t !== 'Polygon' && t !== 'MultiPolygon') continue;
        let area = 0;
        try { area = featureAreaMetersReference(feature); } catch { area = 0; }
        if (!best || area > best.area) best = { feature, area, layer };
      }
    }
    return best;
  }

  function polygonBoundaryLines(feature) {
    try {
      const geom = feature.geometry;
      if (geom.type === 'Polygon') {
        const line = turf.polygonToLine(feature);
        if (line.type === 'FeatureCollection') return line.features;
        return [line];
      }
      if (geom.type === 'MultiPolygon') {
        const out = [];
        geom.coordinates.forEach(coords => {
          const p = turf.polygon(coords);
          const line = turf.polygonToLine(p);
          if (line.type === 'FeatureCollection') out.push(...line.features); else out.push(line);
        });
        return out;
      }
    } catch {}
    return [];
  }

  function refreshAllTolerance() {
    state.layers.filter(l => l.kind === 'sheet').forEach(refreshToleranceForLayer);
  }

  function refreshToleranceForLayer(layer) {
    const largest = getLargestVisiblePolygonFeature();
    const lines = largest ? polygonBoundaryLines(largest.feature) : [];
    layer.toleranceResults = [];
    const markers = [];
    if (layer.leafletLayer?.eachLayer) layer.leafletLayer.eachLayer(m => markers.push(m));

    layer.pointFeatures.forEach((feat, idx) => {
      let minDist = Infinity;
      if (lines.length) {
        for (const line of lines) {
          try {
            const d = turf.pointToLineDistance(feat, line, { units: 'kilometers' }) * 1000;
            if (d < minDist) minDist = d;
          } catch {}
        }
      }
      const has = Number.isFinite(minDist);
      const ok = has ? minDist <= state.tolerance : null;
      layer.toleranceResults[idx] = has ? { distance: minDist, ok } : null;
      const marker = markers.find(m => m.__sheetIndex === idx);
      if (marker?.setStyle) {
        const fill = !has ? layer.color : ok ? '#2fe0a4' : '#ff6b6b';
        marker.setStyle({ fillColor: fill, color: '#fff', weight: 1.5, fillOpacity: 0.96 });
      }
    });
  }


  function exportEditableLayers() {
    return state.layers.filter(layer => layer.kind === 'shapefile' || layer.kind === 'geojson');
  }

  function renderEditableLayers() {
    exportEditableLayers().forEach(renderLayer);
    refreshAllTolerance();
    updateNorthEdge();
    renderLayerList();
    updateEditStatus();
  }

  function updateEditStatus() {
    if (!els.editStatusText) return;
    let selected = 0, excluded = 0, active = 0;
    exportEditableLayers().forEach(layer => {
      (getWorkingGeojson(layer)?.features || []).forEach(feature => {
        if (!isPolygonFeature(feature)) return;
        if (feature.__gaSelected) selected++;
        if (feature.__gaExcluded) excluded++; else active++;
      });
    });
    els.editStatusText.textContent = `جاهز للتصدير: ${active} · مستبعد: ${excluded} · محدد الآن: ${selected}`;
  }

  function snapshotEditState() {
    return exportEditableLayers().map(layer => ({ id: layer.id, exportGeojson: cloneValue(getWorkingGeojson(layer)) }));
  }

  function pushEditHistory() {
    state.editHistory.push(snapshotEditState());
    if (state.editHistory.length > 20) state.editHistory.shift();
  }

  function restoreEditSnapshot(snapshot) {
    snapshot.forEach(item => {
      const layer = state.layers.find(l => l.id === item.id);
      if (layer) layer.exportGeojson = cloneValue(item.exportGeojson);
    });
    renderEditableLayers();
  }

  function enterEditMode() {
    if (!exportEditableLayers().some(l => (getWorkingGeojson(l)?.features || []).some(isPolygonFeature))) {
      toast('ارفع Shapefile يحتوي Polygon أولاً', 'warn'); return;
    }
    if (state.moveMode) exitMoveMode();
    state.editMode = true;
    state.editHistory = [];
    exportEditableLayers().forEach(layer => { getWorkingGeojson(layer); });
    els.editBanner?.classList.add('show');
    els.editGeometryBtn?.classList.add('is-active');
    renderEditableLayers();
    toast('وضع تحرير التصدير نشط: اضغط القطع لتحديدها');
  }

  function exitEditMode() {
    cancelCutDrawing();
    state.editMode = false;
    els.editBanner?.classList.remove('show');
    els.editGeometryBtn?.classList.remove('is-active');
    exportEditableLayers().forEach(layer => (getWorkingGeojson(layer)?.features || []).forEach(f => { f.__gaSelected = false; }));
    renderEditableLayers();
  }

  function selectedFeatures() {
    const out = [];
    exportEditableLayers().filter(layer => layer.exportEnabled !== false && layer.visible).forEach(layer => (getWorkingGeojson(layer)?.features || []).forEach(feature => {
      if (isPolygonFeature(feature) && feature.__gaSelected) out.push({ layer, feature });
    }));
    return out;
  }

  function excludeSelected() {
    const selected = selectedFeatures();
    if (!selected.length) { toast('حدد قطعة أو أكثر بالضغط عليها أولاً', 'warn'); return; }
    pushEditHistory();
    selected.forEach(({ feature }) => { feature.__gaExcluded = true; feature.__gaSelected = false; });
    renderEditableLayers();
    toast(`تم استبعاد ${selected.length} قطعة من التصدير`);
  }

  function keepOnlySelected() {
    const selected = selectedFeatures();
    if (!selected.length) { toast('حدد القطع التي تريد الاحتفاظ بها أولاً', 'warn'); return; }
    const selectedSet = new Set(selected.map(({ layer, feature }) => `${layer.id}:${feature.__gaSourceIndex}`));
    pushEditHistory();
    exportEditableLayers().forEach(layer => (getWorkingGeojson(layer)?.features || []).forEach(feature => {
      if (!isPolygonFeature(feature)) return;
      const keep = selectedSet.has(`${layer.id}:${feature.__gaSourceIndex}`);
      feature.__gaExcluded = !keep;
      feature.__gaSelected = false;
    }));
    renderEditableLayers();
    toast(`سيتم تصدير ${selected.length} قطعة محددة فقط`);
  }

  function resetExportGeometry() {
    if (!exportEditableLayers().length) return;
    pushEditHistory();
    exportEditableLayers().forEach(layer => { layer.exportGeojson = prepareWorkingGeojson(layer.geojson); });
    cancelCutDrawing();
    renderEditableLayers();
    toast('تم إرجاع شكل التصدير إلى الشيب فايل الأصلي');
  }

  function undoEdit() {
    const snapshot = state.editHistory.pop();
    if (!snapshot) { toast('لا توجد خطوة تحرير للتراجع', 'warn'); return; }
    cancelCutDrawing();
    restoreEditSnapshot(snapshot);
    toast('تم التراجع عن آخر تعديل');
  }

  function ensureCutTip() {
    if (state.cutTip) return state.cutTip;
    const tip = document.createElement('div');
    tip.className = 'edit-drawing-tip';
    tip.textContent = 'اضغط نقاط حول المنطقة المطلوبة · Double Click لإنهاء الرسم';
    els.mapStage.appendChild(tip);
    state.cutTip = tip;
    return tip;
  }

  function startCutDrawing() {
    if (!state.editMode) enterEditMode();
    if (!state.editMode) return;
    cancelCutDrawing();
    state.cutDrawMode = true;
    state.cutCoords = [];
    state.map.doubleClickZoom.disable();
    ensureCutTip().classList.add('show');
    els.cutDecision?.classList.remove('show');
    toast('ارسم Polygon حول الجزء المطلوب ثم Double Click');
  }

  function updateCutPreview() {
    if (state.cutLayer) state.map.removeLayer(state.cutLayer);
    if (!state.cutCoords.length) { state.cutLayer = null; return; }
    const latlngs = state.cutCoords.map(([lng, lat]) => [lat, lng]);
    state.cutLayer = L.polyline(latlngs, { color:'#789ba1', weight:3, dashArray:'8 6' }).addTo(state.map);
  }

  function handleCutMapClick(e) {
    if (!state.editMode || !state.cutDrawMode) return;
    state.cutCoords.push([e.latlng.lng, e.latlng.lat]);
    updateCutPreview();
  }

  function finishCutDrawing(e) {
    if (!state.editMode || !state.cutDrawMode) return;
    if (e?.originalEvent) L.DomEvent.stop(e.originalEvent);
    if (state.cutCoords.length < 3) { toast('ارسم 3 نقاط على الأقل', 'warn'); return; }
    const coords = [...state.cutCoords];
    while (coords.length > 3) {
      const a = coords[coords.length-1], b = coords[coords.length-2];
      if (Math.abs(a[0]-b[0]) < 1e-12 && Math.abs(a[1]-b[1]) < 1e-12) coords.pop(); else break;
    }
    coords.push([...coords[0]]);
    try {
      state.cutPolygon = turf.polygon([coords]);
      if (state.cutLayer) state.map.removeLayer(state.cutLayer);
      state.cutLayer = L.geoJSON(state.cutPolygon, { style:{ color:'#789ba1', weight:3, fillColor:'#8aa9ad', fillOpacity:.08, dashArray:'8 5' } }).addTo(state.map);
      state.cutDrawMode = false;
      state.map.doubleClickZoom.enable();
      ensureCutTip().classList.remove('show');
      els.cutDecision?.classList.add('show');
    } catch (err) {
      console.error(err); toast('الرسم غير صالح. حاول مرة أخرى.', 'error'); cancelCutDrawing();
    }
  }

  function cancelCutDrawing() {
    state.cutDrawMode = false;
    state.cutCoords = [];
    state.cutPolygon = null;
    if (state.cutLayer) { try { state.map.removeLayer(state.cutLayer); } catch {} }
    state.cutLayer = null;
    state.map?.doubleClickZoom?.enable();
    state.cutTip?.classList.remove('show');
    els.cutDecision?.classList.remove('show');
  }

  function applyCut(mode) {
    if (!state.cutPolygon) { toast('ارسم منطقة القص أولاً', 'warn'); return; }
    pushEditHistory();
    let changed = 0;
    const cutter = cleanExportFeature(state.cutPolygon);
    exportEditableLayers().filter(layer => layer.visible).forEach(layer => {
      const fc = getWorkingGeojson(layer);
      fc.features = (fc.features || []).map(feature => {
        if (!isPolygonFeature(feature) || feature.__gaExcluded) return feature;
        const sourceIndex = feature.__gaSourceIndex;
        const originalProps = cloneValue(feature.properties || {});
        const source = cleanExportFeature(feature);
        let intersects = false;
        try { intersects = turf.booleanIntersects(source, cutter); } catch { intersects = false; }
        if (!intersects) {
          if (mode === 'keep') { feature.__gaExcluded = true; changed++; }
          feature.__gaSelected = false;
          return feature;
        }
        try {
          const result = mode === 'keep' ? turf.intersect(source, cutter) : turf.difference(source, cutter);
          changed++;
          if (!result || !isPolygonFeature(result)) {
            feature.__gaExcluded = true; feature.__gaSelected = false; return feature;
          }
          return {
            type:'Feature', properties: originalProps, geometry: cloneValue(result.geometry),
            __gaSourceIndex: sourceIndex, __gaExcluded:false, __gaSelected:false
          };
        } catch (err) {
          console.warn('Cut failed for feature', err);
          return feature;
        }
      });
    });
    cancelCutDrawing();
    renderEditableLayers();
    toast(mode === 'keep' ? `تم الاحتفاظ بالجزء داخل الرسم · ${changed} عنصر` : `تم حذف الجزء داخل الرسم · ${changed} عنصر`);
  }

  function bearingFromNorth(a, b) {
    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;
    const lat1 = toRad(a[1]), lat2 = toRad(b[1]), dLon = toRad(b[0] - a[0]);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function getNorthmostSegment(feature) {
    if (!feature?.geometry) return null;
    const rings = [];
    if (feature.geometry.type === 'Polygon') rings.push(feature.geometry.coordinates[0]);
    if (feature.geometry.type === 'MultiPolygon') feature.geometry.coordinates.forEach(p => rings.push(p[0]));
    let best = null;
    rings.forEach(ring => {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i], b = ring[i+1];
        const score = (a[1] + b[1]) / 2;
        if (!best || score > best.score) best = { a, b, score };
      }
    });
    if (!best) return null;
    const az1 = bearingFromNorth(best.a, best.b);
    const az2 = (az1 + 180) % 360;
    const d1 = Math.min(az1, 360 - az1), d2 = Math.min(az2, 360 - az2);
    const bearing = d1 <= d2 ? az1 : az2;
    return { ...best, bearing };
  }

  function updateNorthEdge() {
    if (state.northLayer) state.map.removeLayer(state.northLayer);
    state.northLayer = null;
    state.northBearing = null;
    const largest = getLargestVisiblePolygonFeature();
    if (!largest || !state.northVisible) {
      els.northBearingText.textContent = largest ? 'مخفي' : 'غير محدد';
      els.northToggle.classList.toggle('is-active', state.northVisible);
      return;
    }
    const seg = getNorthmostSegment(largest.feature);
    if (!seg) return;
    state.northBearing = seg.bearing;
    state.northLayer = L.polyline([[seg.a[1],seg.a[0]],[seg.b[1],seg.b[0]]], {
      color: '#ffd84a', weight: 6, opacity: .95, dashArray: '12 7'
    }).addTo(state.map);
    state.northLayer.bindTooltip(`اتجاه البحري · ${seg.bearing.toFixed(1)}°`, { permanent: false, direction: 'top' });
    els.northBearingText.textContent = `${seg.bearing.toFixed(1)}°`;
    els.northToggle.classList.add('is-active');
  }

  function toggleNorth() {
    state.northVisible = !state.northVisible;
    updateNorthEdge();
  }

  const ALLOWED_UTM_ZONES = new Set([35, 36, 37]);

  function validateUtmZone(zone, source = 'الإحداثيات') {
    const z = Number(zone);
    if (!ALLOWED_UTM_ZONES.has(z)) {
      throw new Error(`${source}: UTM Zone ${zone} غير مسموح. المسموح فقط 35 أو 36 أو 37.`);
    }
    return z;
  }

  function getUTMDef() {
    const zone = validateUtmZone(Number(els.utmZone.value));
    const hemi = els.utmHemi.value;
    const south = hemi === 'S' ? ' +south' : '';
    return { zone, hemi, def: `+proj=utm +zone=${zone}${south} +datum=WGS84 +units=m +no_defs` };
  }

  function findCoordinateColumns(headers) {
    const normalized = headers.map(h => ({ raw: h, n: String(h).trim().toLowerCase().replace(/[ _\-]/g,'') }));
    const find = candidates => normalized.find(x => candidates.some(c => x.n === c || x.n.includes(c)));
    const lat = find(['latitude','lat','خطالعرض','عرض']);
    const lng = find(['longitude','lon','lng','long','خطالطول','طول']);
    const east = find(['easting','east','x','شرقي','شرق']);
    const north = find(['northing','north','y','شمالي','شمال']);
    if (lat && lng) return { mode: 'latlng', a: lat.raw, b: lng.raw };
    if (east && north) return { mode: 'utm', a: east.raw, b: north.raw };
    return null;
  }

  function normalizeHeaderName(value) {
    return String(value ?? '').replace(/\r/g,' ').replace(/\n/g,' ').replace(/\s+/g,' ').trim();
  }

  function detectZoneFromSheetMatrix(matrix) {
    for (let r = 0; r < Math.min(matrix.length, 30); r++) {
      const row = matrix[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = normalizeHeaderName(row[c]);
        const combined = [cell, normalizeHeaderName(row[c+1]), normalizeHeaderName(row[c+2]), normalizeHeaderName(row[c+3])].join(' ');
        if (/\bzone\b/i.test(combined) || /زون/i.test(combined)) {
          const m = combined.match(/\b(\d{1,2})\s*(North|South|N|S)?\b/i);
          if (m) {
            const zone = validateUtmZone(Number(m[1]), 'ملف الجيوديسي');
            const hemiText = (m[2] || 'North').toLowerCase();
            const hemi = hemiText.startsWith('s') ? 'S' : 'N';
            return { zone, hemi };
          }
        }
      }
    }
    return null;
  }

  function matrixToGeodeticRows(matrix) {
    if (!Array.isArray(matrix) || !matrix.length) return null;
    let headerRow = -1;
    let eastCol = -1, northCol = -1;
    for (let r = 0; r < Math.min(matrix.length, 80); r++) {
      const cells = (matrix[r] || []).map(v => normalizeHeaderName(v).toLowerCase().replace(/[ _\-]/g,''));
      const e = cells.findIndex(v => v.includes('easting') || v === 'east' || v.includes('شرقي') || v === 'شرق');
      const n = cells.findIndex(v => v.includes('northing') || v === 'north' || v.includes('شمالي') || v === 'شمال');
      if (e >= 0 && n >= 0) { headerRow = r; eastCol = e; northCol = n; break; }
    }
    if (headerRow < 0) return null;

    const headerCells = matrix[headerRow] || [];
    const headers = headerCells.map((v, i) => normalizeHeaderName(v) || `Column_${i+1}`);
    const seen = new Map();
    const uniqueHeaders = headers.map((h, i) => {
      let key = h;
      const n = (seen.get(key) || 0) + 1; seen.set(key, n);
      if (n > 1) key = `${key}_${n}`;
      return key;
    });
    const rows = [];
    for (let r = headerRow + 1; r < matrix.length; r++) {
      const row = matrix[r] || [];
      const e = Number(row[eastCol]);
      const n = Number(row[northCol]);
      if (!Number.isFinite(e) || !Number.isFinite(n)) continue;
      const obj = {};
      uniqueHeaders.forEach((h, c) => { if (row[c] !== '' && row[c] != null) obj[h] = row[c]; });
      // canonical aliases guarantee coordinate detection regardless of report formatting.
      obj.Easting = e;
      obj.Northing = n;
      rows.push(obj);
    }
    if (!rows.length) return null;
    return { rows, headerRow, eastCol, northCol };
  }

  function rowsToPointFeatures(rows) {
    if (!rows.length) return { features: [], mode: null, columns: null };
    const headers = Object.keys(rows[0]);
    const coord = findCoordinateColumns(headers);
    if (!coord) return { features: [], mode: null, columns: null };
    const utm = getUTMDef();
    const features = [];
    rows.forEach((row, idx) => {
      let lng, lat;
      if (coord.mode === 'latlng') {
        lat = Number(row[coord.a]); lng = Number(row[coord.b]);
      } else {
        const e = Number(row[coord.a]), n = Number(row[coord.b]);
        if (Number.isFinite(e) && Number.isFinite(n)) {
          try { [lng, lat] = proj4(utm.def, 'EPSG:4326', [e, n]); } catch {}
        }
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) return;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { ...row, __row: idx + 2 }
      });
    });
    return { features, mode: coord.mode, columns: coord };
  }

  function applyDetectedUtmFromWkt(wkt) {
    if (!wkt) return false;
    const text = String(wkt);
    let zone = null, hemi = 'N';
    let m = text.match(/UTM[^0-9]{0,20}Zone[^0-9]{0,10}(\d{1,2})\s*([NS])?/i)
      || text.match(/UTM[_\s-]*Zone[_\s-]*(\d{1,2})([NS])?/i)
      || text.match(/UTM[_\s-]*(\d{1,2})([NS])?/i);
    if (m) { zone = Number(m[1]); hemi = (m[2] || 'N').toUpperCase(); }
    if (!zone) {
      const cm = text.match(/Central_Meridian["',:\s]+(-?\d+(?:\.\d+)?)/i);
      if (cm) {
        const central = Number(cm[1]);
        const z = Math.round((central + 183) / 6);
        if (z >= 1 && z <= 60) zone = z;
      }
      if (/False_Northing["',:\s]+10000000/i.test(text)) hemi = 'S';
    }
    if (zone) {
      validateUtmZone(zone, 'ملف PRJ');
      els.utmZone.value = String(zone);
      els.utmHemi.value = hemi;
      // silent import: PRJ zone detected
      return true;
    }
    return false;
  }

  async function detectUtmInZipBuffer(ab) {
    try {
      const zip = await JSZip.loadAsync(ab);
      const prjName = Object.keys(zip.files).find(n => /\.prj$/i.test(n));
      if (!prjName) return false;
      const wkt = await zip.files[prjName].async('text');
      return applyDetectedUtmFromWkt(wkt);
    } catch { return false; }
  }

  function firstCoordinate(geometry) {
    if (!geometry) return null;
    if (geometry.type === 'GeometryCollection') {
      for (const g of geometry.geometries || []) {
        const c = firstCoordinate(g);
        if (c) return c;
      }
      return null;
    }
    const walk = value => {
      if (!Array.isArray(value)) return null;
      if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
        return [Number(value[0]), Number(value[1])];
      }
      for (const child of value) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(geometry.coordinates);
  }

  function transformCoordinateTree(value, transform) {
    if (!Array.isArray(value)) return value;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
      const original = value;
      const [x, y] = transform(Number(original[0]), Number(original[1]));
      return original.length > 2 ? [x, y, ...original.slice(2)] : [x, y];
    }
    return value.map(v => transformCoordinateTree(v, transform));
  }

  function ensureWgs84(fc) {
    const sample = (fc?.features || []).map(f => firstCoordinate(f?.geometry)).find(Boolean);
    if (!sample) return fc;
    const [x, y] = sample;
    // Leaflet expects longitude/latitude degrees. Large values normally mean a projected CRS such as UTM.
    if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return fc;

    const utm = getUTMDef();
    let converted = 0;
    for (const feature of fc.features || []) {
      const geom = feature?.geometry;
      if (!geom) continue;
      try {
        if (geom.type === 'GeometryCollection') {
          for (const g of geom.geometries || []) {
            if (!g?.coordinates) continue;
            g.coordinates = transformCoordinateTree(g.coordinates, (e, n) => proj4(utm.def, 'EPSG:4326', [e, n]));
          }
        } else if (geom.coordinates) {
          geom.coordinates = transformCoordinateTree(geom.coordinates, (e, n) => proj4(utm.def, 'EPSG:4326', [e, n]));
        }
        converted++;
      } catch (err) {
        console.warn('Projection conversion failed for feature', err);
      }
    }
    // silent import: coordinate conversion completed
    return fc;
  }

  function shapefileStem(name) {
    return name.split('/').pop().replace(/\.(shp|shx|dbf|prj|cpg)$/i, '').toLowerCase();
  }

  async function loadLooseShapefileGroups(files, groupMeta = {}) {
    const groups = new Map();
    for (const file of files) {
      const stem = shapefileStem(file.name);
      if (!groups.has(stem)) groups.set(stem, []);
      groups.get(stem).push(file);
    }

    let loaded = 0;
    for (const [stem, parts] of groups) {
      const shpPart = parts.find(f => /\.shp$/i.test(f.name));
      if (!shpPart) continue;
      try {
        const prjPart = parts.find(f => /\.prj$/i.test(f.name));
        if (prjPart) {
          applyDetectedUtmFromWkt(await prjPart.text());
        }
        const zip = new JSZip();
        for (const part of parts) zip.file(part.name.split('/').pop(), await part.arrayBuffer());
        const zipBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
        const parsed = await shp(zipBuffer);
        let fc = flattenShpResult(parsed);
        if (!fc?.features?.length) throw new Error('No features');
        fc = ensureWgs84(fc);
        const displayName = shpPart.name.replace(/\.shp$/i, '');
        const layer = addLayer({ name: displayName, kind: 'shapefile', source: shpPart.name, groupId: groupMeta.groupId || null, groupName: groupMeta.groupName || null, geojson: fc, geomType: inferGeomLabel(fc) });
        // silent import: layer loaded
        zoomLayer(layer.id);
        loaded++;
      } catch (err) {
        console.error(err);
        console.error('Shapefile read failed:', shpPart.name, err);
      }
    }
    if (!loaded) console.warn('No readable Shapefile parts were found.');
    refreshAllTolerance();
    return loaded;
  }

  async function importArchiveZipBuffer(ab, sourceName = 'archive.zip') {
    const zip = await JSZip.loadAsync(ab);
    const entries = Object.values(zip.files).filter(entry => !entry.dir);
    if (!entries.length) throw new Error('Archive is empty');

    const virtualFiles = [];
    for (const entry of entries) {
      const cleanName = entry.name.split('/').pop();
      if (!cleanName || !/\.(shp|shx|dbf|prj|cpg|xlsx|xls|csv|geojson|json)$/i.test(cleanName)) continue;
      const bytes = await entry.async('uint8array');
      virtualFiles.push(new File([bytes], cleanName));
    }
    if (!virtualFiles.length) throw new Error('لا توجد ملفات GIS/Excel مدعومة داخل الأرشيف');

    const archiveHasShape = virtualFiles.some(f => /\.shp$/i.test(f.name));
    const archiveHasSheet = virtualFiles.some(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    const archiveHasGeo = virtualFiles.some(f => /\.(geojson|json)$/i.test(f.name));
    const replaceKinds = [];
    if (archiveHasShape || archiveHasGeo) replaceKinds.push('shapefile','geojson');
    if (archiveHasSheet) replaceKinds.push('sheet');
    if (replaceKinds.length) removeKindsForReplacement(replaceKinds);

    let loaded = 0;
    const shapeFiles = virtualFiles.filter(f => /\.(shp|shx|dbf|prj|cpg)$/i.test(f.name));
    if (shapeFiles.some(f => /\.shp$/i.test(f.name))) {
      loaded += await loadLooseShapefileGroups(shapeFiles, { groupId: `G${uid()}`, groupName: makeLayerName(sourceName) });
    }

    for (const file of virtualFiles) {
      const n = file.name.toLowerCase();
      if (/\.(shp|shx|dbf|prj|cpg)$/i.test(n)) continue;
      if (/\.(xlsx|xls|csv)$/i.test(n)) {
        await loadSheet(file);
        loaded++;
      } else if (/\.(geojson|json)$/i.test(n)) {
        await loadGeoJson(file);
        loaded++;
      }
    }

    if (!loaded) throw new Error(`لم يتم العثور على بيانات قابلة للتحميل داخل ${sourceName}`);
    refreshAllTolerance();
    return loaded;
  }

  async function loadZipShapefile(file) {
    try {
      const ab = await file.arrayBuffer();
      const loaded = await importArchiveZipBuffer(ab, file.name);
      // silent import: ZIP loaded
    } catch (err) {
      console.error(err);
      console.error('ZIP read failed:', file.name, err);
    }
  }

  async function loadRar(file) {
    try {
      // silent import: extracting RAR
      const response = await fetch('/api/unrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-GeoAudit-Filename': encodeURIComponent(file.name)
        },
        body: file
      });

      if (!response.ok) {
        const serverMessage = await response.text().catch(() => '');
        throw new Error(serverMessage || `RAR server returned ${response.status}`);
      }

      const engine = response.headers.get('X-GeoAudit-Extractor') || 'Windows';
      const zipBuffer = await response.arrayBuffer();
      const loaded = await importArchiveZipBuffer(zipBuffer, file.name);
      // silent import: RAR extracted and loaded
    } catch (err) {
      console.error('RAR import failed:', err);
      const msg = String(err?.message || err || 'خطأ غير معروف');
      console.error('RAR import failed:', file.name, msg);
    }
  }

  async function loadGeoJson(file) {
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      let fc = normalizeFeatureCollection(data);
      if (!fc?.features?.length) throw new Error('No features');
      fc = ensureWgs84(fc);
      const layer = addLayer({ name: makeLayerName(file.name), kind: 'geojson', source: file.name, geojson: fc, geomType: inferGeomLabel(fc) });
      // silent import: GeoJSON layer loaded
      zoomLayer(layer.id);
      refreshAllTolerance();
    } catch (err) {
      console.error(err);
      console.error('Invalid GeoJSON:', file.name);
    }
  }

  async function loadSheet(file) {
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      if (!matrix.length) throw new Error('Empty sheet');

      const detectedZone = detectZoneFromSheetMatrix(matrix);
      if (detectedZone) {
        els.utmZone.value = String(detectedZone.zone);
        els.utmHemi.value = detectedZone.hemi;
      }

      const geodetic = matrixToGeodeticRows(matrix);
      let rows;
      if (geodetic) rows = geodetic.rows;
      else rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) throw new Error('Empty sheet');

      const parsed = rowsToPointFeatures(rows);
      if (!parsed.features.length) {
        console.error('No readable coordinate columns in:', file.name);
        return;
      }
      const fc = { type: 'FeatureCollection', features: parsed.features };
      const layer = addLayer({ name: makeLayerName(file.name), kind: 'sheet', source: file.name, rows, pointFeatures: parsed.features, geojson: fc, geomType: 'Point' });
      const zoneText = parsed.mode === 'utm' ? ` · UTM ${els.utmZone.value}${els.utmHemi.value}` : '';
      // silent import: geodetic file loaded
      // If a shapefile is already visible, fit both together so the user can verify overlay immediately.
      fitAll();
      refreshAllTolerance();
    } catch (err) {
      console.error(err);
      console.error('Geodetic read failed:', file.name, err);
    }
  }

  async function handleFiles(fileList, options = {}) {
    const files = [...fileList];
    if (!files.length) return;
    const silent = Boolean(options.silent);
    if (silent) state.silentActionDepth++;
    try {

    const hasLooseShape = files.some(f => /\.shp$/i.test(f.name));
    const hasSheet = files.some(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    const hasGeoJson = files.some(f => /\.(geojson|json)$/i.test(f.name));
    const replaceKinds = [];
    if (hasLooseShape || hasGeoJson) replaceKinds.push('shapefile','geojson');
    if (hasSheet) replaceKinds.push('sheet');
    if (replaceKinds.length) removeKindsForReplacement(replaceKinds);

    const looseShapeParts = files.filter(f => /\.(shp|shx|dbf|prj|cpg)$/i.test(f.name));
    if (looseShapeParts.length) {
      const shpNames = looseShapeParts.filter(f => /\.shp$/i.test(f.name));
      const groupName = shpNames.length === 1 ? makeLayerName(shpNames[0].name) : 'Shapefile';
      await loadLooseShapefileGroups(looseShapeParts, { groupId: `G${uid()}`, groupName });
    }

    for (const file of files) {
      const n = file.name.toLowerCase();
      if (/\.(shp|shx|dbf|prj|cpg)$/i.test(n)) continue;
      if (n.endsWith('.zip')) await loadZipShapefile(file);
      else if (n.endsWith('.rar')) await loadRar(file);
      else if (n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv')) await loadSheet(file);
      else if (n.endsWith('.geojson') || n.endsWith('.json')) await loadGeoJson(file);
      else toast(`نوع ملف غير مدعوم: ${file.name}`, 'warn');
    }
    if (options.autoFit) fitAll();
    } finally {
      if (silent) state.silentActionDepth = Math.max(0, state.silentActionDepth - 1);
    }
  }

  async function pollDownloadedShapefile() {
    try {
      const response = await fetch('/api/auto-shapefile', { cache:'no-store' });
      if (response.status === 204) return;
      if (!response.ok) return;
      const blob = await response.blob();
      const encoded = response.headers.get('X-GeoAudit-Filename') || 'download.zip';
      let filename = 'download.zip';
      try { filename = decodeURIComponent(encoded); } catch { filename = encoded; }
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      await handleFiles([file], { silent:true, autoFit:true, source:'downloads' });
    } catch {}
  }

  function startDownloadedShapefileWatcher() {
    if (state.autoDownloadWatcherStarted) return;
    state.autoDownloadWatcherStarted = true;
    setInterval(pollDownloadedShapefile, 1800);
  }

  function openAttributeTable(id) {
    const layer = state.layers.find(l => l.id === id);
    if (!layer) return;
    state.activeAttrLayerId = id;
    state.attrSearch = '';
    state.attrSortKey = null;
    state.attrSortDir = 'asc';
    els.attributeSearch.value = '';
    els.attributeTitle.textContent = `${layer.name} · جدول البيانات`;
    renderAttributeTable();
    openModal('attributeModal');
  }

  function getLayerRows(layer) {
    if (layer.kind === 'sheet') return layer.rows.map((r,i) => ({ __sourceIndex:i, ...r }));
    return (layer.geojson?.features || []).map((f, i) => ({ __sourceIndex:i, ...(f.properties || {}) }));
  }

  function renderAttributeTable() {
    const layer = state.layers.find(l => l.id === state.activeAttrLayerId);
    if (!layer) return;
    let rows = getLayerRows(layer);
    const q = state.attrSearch.trim().toLowerCase();
    if (q) rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => !k.startsWith('__')).slice(0, 40);
    if (state.attrSortKey) {
      const k = state.attrSortKey, dir = state.attrSortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a,b) => String(a[k] ?? '').localeCompare(String(b[k] ?? ''), 'ar', { numeric: true }) * dir);
    }
    els.attributeCount.textContent = `${rows.length} سجل`;
    const head = `<thead><tr>${keys.map(k => `<th data-key="${escapeHtml(k)}">${escapeHtml(k)}${state.attrSortKey===k ? (state.attrSortDir==='asc'?' ▲':' ▼') : ''}</th>`).join('')}</tr></thead>`;
    const body = `<tbody>${rows.map((r, idx) => `<tr data-row="${idx}" data-source="${r.__sourceIndex}">${keys.map(k => `<td>${escapeHtml(r[k])}</td>`).join('')}</tr>`).join('')}</tbody>`;
    els.attributeTable.innerHTML = head + body;
    els.attributeTable.querySelectorAll('tbody tr').forEach(tr => tr.onclick = () => zoomToSourceFeature(layer, Number(tr.dataset.source)));
    els.attributeTable.querySelectorAll('th').forEach(th => th.onclick = () => {
      const key = th.dataset.key;
      if (state.attrSortKey === key) state.attrSortDir = state.attrSortDir === 'asc' ? 'desc' : 'asc';
      else { state.attrSortKey = key; state.attrSortDir = 'asc'; }
      renderAttributeTable();
    });
  }

  function openLayerStyle(id) {
    const layer = state.layers.find(l => l.id === id);
    if (!layer) return;
    state.styleLayerId = id;
    els.styleLayerTitle.textContent = `تنسيق · ${layer.name}`;
    els.styleStroke.value = layer.style.stroke;
    els.styleFill.value = layer.style.fill;
    els.styleOpacity.value = layer.style.fillOpacity;
    els.styleWeight.value = layer.style.weight;
    els.styleRadius.value = layer.style.radius;
    updateStyleLabels();
    openModal('styleModal');
  }

  function updateStyleLabels() {
    els.styleOpacityText.textContent = `${Math.round(Number(els.styleOpacity.value)*100)}%`;
    els.styleWeightText.textContent = els.styleWeight.value;
    els.styleRadiusText.textContent = els.styleRadius.value;
  }

  function applyLayerStyle() {
    const layer = state.layers.find(l => l.id === state.styleLayerId);
    if (!layer) return;
    layer.style = {
      stroke: els.styleStroke.value,
      fill: els.styleFill.value,
      fillOpacity: Number(els.styleOpacity.value),
      weight: Number(els.styleWeight.value),
      radius: Number(els.styleRadius.value)
    };
    layer.color = layer.style.stroke;
    renderLayer(layer);
    refreshToleranceForLayer(layer);
    updateNorthEdge();
    renderLayerList();
    closeModal('styleModal');
    toast('تم تطبيق تنسيق الطبقة');
  }

  function resetLayerStyle() {
    const layer = state.layers.find(l => l.id === state.styleLayerId);
    if (!layer) return;
    els.styleStroke.value = layer.color || '#20d3b0';
    els.styleFill.value = layer.color || '#20d3b0';
    els.styleOpacity.value = 0.09;
    els.styleWeight.value = 2;
    els.styleRadius.value = 5.5;
    updateStyleLabels();
  }

  function undoLastMove() {
    const op = state.moveHistory.pop();
    if (!op) { toast('لا توجد حركة للتراجع', 'warn'); return; }
    op.layers.forEach(rec => {
      const layer = state.layers.find(l => l.id === rec.id);
      if (!layer) return;
      renderLayer(layer);
    });
    refreshAllTolerance();
    updateNorthEdge();
    renderLayerList();

  }

  function zoomToSourceFeature(layer, sourceIndex) {
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0) return;
    try {
      if (layer.kind === 'sheet') {
        const feat = layer.pointFeatures[sourceIndex];
        if (!feat) return;
        const [lng,lat] = feat.geometry.coordinates;
        closeModal('attributeModal');
        state.map.flyTo([lat,lng], Math.max(state.map.getZoom(), 18), { duration:.6 });
      } else {
        const feat = layer.geojson?.features?.[sourceIndex];
        if (!feat) return;
        const center = turf.centroid(feat).geometry.coordinates;
        closeModal('attributeModal');
        state.map.flyTo([center[1],center[0]], Math.max(state.map.getZoom(), 18), { duration:.6 });
      }
    } catch {}
  }

  function renderMoveChoices() {
    els.moveLayerChoices.innerHTML = '';
    const visibleLayers = state.layers.filter(l => l.visible);
    if (!visibleLayers.length) {
      els.moveLayerChoices.innerHTML = '<div class="modal-note">لا توجد طبقات.</div>';
      return;
    }
    const allRow = document.createElement('div');
    allRow.className = 'choice-item move-select-all';
    const allChecked = visibleLayers.every(l => state.moveSelected.has(l.id));
    allRow.innerHTML = `<label><input type="checkbox" ${allChecked ? 'checked' : ''}> <span>تحديد الكل</span></label><small>${visibleLayers.length} طبقة</small>`;
    allRow.querySelector('input').onchange = e => {
      if (e.target.checked) visibleLayers.forEach(l => state.moveSelected.add(l.id));
      else visibleLayers.forEach(l => state.moveSelected.delete(l.id));
      renderMoveChoices();
      renderLayerList();
    };
    els.moveLayerChoices.appendChild(allRow);
    visibleLayers.forEach(layer => {
      const div = document.createElement('div');
      div.className = 'choice-item';
      div.innerHTML = `<label><input type="checkbox" ${state.moveSelected.has(layer.id)?'checked':''}> <span>${escapeHtml(layer.name)}</span></label><small>${escapeHtml(layer.kind)}</small>`;
      div.querySelector('input').onchange = e => {
        if (e.target.checked) state.moveSelected.add(layer.id); else state.moveSelected.delete(layer.id);
        renderLayerList();
      };
      els.moveLayerChoices.appendChild(div);
    });
  }

  function quickSelectMove(id) {
    state.moveSelected = new Set([id]);
    renderMoveChoices();
    renderLayerList();
    openModal('moveModal');
  }

  function startMoveMode() {
    if (!state.moveSelected.size) {
      toast('اختر طبقة واحدة على الأقل للتحريك', 'warn');
      return;
    }
    closeModal('moveModal');
    state.moveMode = true;
    els.moveBanner.classList.add('show');
    els.moveToolBtn.classList.add('is-active');
    state.map.dragging.disable();

  }

  function exitMoveMode() {
    state.moveMode = false;
    state.moveDrag = null;
    els.moveBanner.classList.remove('show');
    els.moveToolBtn.classList.remove('is-active');
    state.map.dragging.enable();
  }

  function resetOffsets() {
    state.layers.forEach(layer => {
      if (Math.abs(layer.visualOffset.lat) > 0 || Math.abs(layer.visualOffset.lng) > 0) renderLayer(layer);
    });
    refreshAllTolerance();
    updateNorthEdge();
    renderLayerList();
    state.moveHistory = [];

  }

  function calcAreaUnits() {
    const sqm = Number(els.areaInput.value) || 0;
    const feddanSqm = FEDDAN_M2;
    const qiratSqm = feddanSqm / 24;
    const sahmSqm = qiratSqm / 24;
    const wholeFed = Math.floor(sqm / feddanSqm);
    const rem1 = sqm - wholeFed * feddanSqm;
    const wholeQ = Math.floor(rem1 / qiratSqm);
    const rem2 = rem1 - wholeQ * qiratSqm;
    const sahm = rem2 / sahmSqm;
    els.fedResult.textContent = fmt(sqm / feddanSqm, 4);
    els.kiratResult.textContent = fmt((sqm % feddanSqm) / qiratSqm, 3);
    els.sahmResult.textContent = fmt(sahm, 2);
    els.areaInput.title = `${wholeFed} فدان · ${wholeQ} قيراط · ${sahm.toFixed(2)} سهم`;
  }

  function useLargestArea(targetInput) {
    const largest = getLargestVisiblePolygonFeature();
    if (!largest) { toast('لا توجد قطعة Polygon ظاهرة', 'warn'); return; }
    targetInput.value = largest.area.toFixed(2);
    if (targetInput === els.areaInput) calcAreaUnits();
  }

  function setDescType(type) {
    state.descType = type;
    els.descType.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.type === type));
    els.smartModal.querySelector('.modal')?.classList.toggle('show-building', type === 'building');
  }

  function generateDescription() {
    const name = els.descParcelName.value.trim() || 'القطعة محل المعاينة';
    const total = Number(els.descLandArea.value) || 0;
    const road = Number(els.descRoadArea.value) || 0;
    const legal = Number(els.descLegalizeArea.value) || Math.max(0, total - road);
    if (road > total && total > 0) {
      toast('مساحة الطريق لا يمكن أن تكون أكبر من المساحة الكلية', 'error');
      return;
    }
    if (legal > total && total > 0) {
      toast('المساحة المطلوب تقنينها أكبر من المساحة الكلية', 'error');
      return;
    }
    const location = els.descLocation.value.trim();
    const buildings = els.descBuildings.value.trim();
    const largest = getLargestVisiblePolygonFeature();
    const bearing = state.northBearing !== null ? ` واتجاه الضلع البحري بزاوية تقريبية ${state.northBearing.toFixed(1)}° من الشمال.` : '';
    let text = `بالمعاينة والرجوع إلى البيانات المكانية، تبين أن ${name} تبلغ مساحتها الإجمالية نحو ${fmt(total,2)} م².`;
    if (road > 0) text += ` ويقع ضمنها/بمحاذاتها جزء مخصص للطريق بمساحة تقريبية ${fmt(road,2)} م².`;
    text += ` وتبلغ المساحة محل الإجراء/التقنين نحو ${fmt(legal,2)} م².`;
    if (location) text += ` ${location.replace(/[.،]+$/,'')}.`;
    if (state.descType === 'building' && buildings) text += ` كما تبين وجود ${buildings.replace(/[.،]+$/,'')}.`;
    if (largest) text += bearing;
    text += ` وقد أُعد هذا الوصف اعتمادًا على المساحات والبيانات المدخلة للمراجعة، مع الرجوع إلى المستندات والرفع المساحي المعتمد عند الاستخدام الرسمي.`;
    els.descOutput.value = text;
  }

  async function copyDescription() {
    const text = els.descOutput.value;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast('تم نسخ الوصف'); }
    catch { els.descOutput.select(); document.execCommand('copy'); toast('تم نسخ الوصف'); }
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function visibleSourceEntries(options = {}) {
    const out = [];
    const gisOnly = Boolean(options.gisOnly);
    state.layers.filter(l => l.visible && l.exportEnabled !== false).forEach(layer => {
      if (layer.kind === 'sheet') {
        if (!gisOnly) layer.pointFeatures.forEach(feature => out.push({ layer, feature: cloneValue(feature) }));
        return;
      }
      const working = getWorkingGeojson(layer);
      (working?.features || []).forEach((feature, idx) => {
        if (feature.__gaExcluded) return;
        const sourceIndex = Number.isInteger(feature.__gaSourceIndex) ? feature.__gaSourceIndex : idx;
        out.push({ layer, feature: cleanExportFeature(feature), featureKey: `${layer.id}:${sourceIndex}` });
      });
    });
    return out;
  }

  function visibleSourceFeatures(options = {}) {
    return visibleSourceEntries(options).map(item => item.feature);
  }

  function getCadManualLabels() {
    return (state.cadManualLabels || []).map(item => ({ text: String(item.text || ''), x: Number(item.x) || 0, y: Number(item.y) || 0 })).filter(item => item.text);
  }


  function cadPointFromClient(clientX, clientY) {
    if (!els.cadPreviewImage) return null;
    const rect = els.cadPreviewImage.getBoundingClientRect();
    const naturalW = els.cadPreviewImage.naturalWidth || 1600;
    const naturalH = els.cadPreviewImage.naturalHeight || 1600;
    if (!rect.width || !rect.height) return null;
    const x = ((clientX - rect.left) / rect.width) * naturalW;
    const y = ((clientY - rect.top) / rect.height) * naturalH;
    if (x < 0 || y < 0 || x > naturalW || y > naturalH) return null;
    return { x, y };
  }

  function renderCadMarkerOverlay() {
    if (!els.cadMarkerOverlay || !els.cadPreviewViewport || !els.cadPreviewImage) return;
    const overlay = els.cadMarkerOverlay;
    overlay.innerHTML = '';
    const vpRect = els.cadPreviewViewport.getBoundingClientRect();
    const imgRect = els.cadPreviewImage.getBoundingClientRect();
    const naturalW = els.cadPreviewImage.naturalWidth || 1600;
    const naturalH = els.cadPreviewImage.naturalHeight || 1600;
    if (!imgRect.width || !imgRect.height) return;
    const fontScale = imgRect.width / naturalW;
    (state.cadManualLabels || []).forEach((item, index) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cad-draggable-marker';
      el.dataset.markerIndex = String(index);
      el.textContent = String(item.text || '');
      el.style.left = `${imgRect.left - vpRect.left + (Number(item.x)||0) / naturalW * imgRect.width}px`;
      el.style.top = `${imgRect.top - vpRect.top + (Number(item.y)||0) / naturalH * imgRect.height}px`;
      el.style.fontSize = `${Math.max(11, state.cadFontSize * fontScale)}px`;
      el.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        const pt = cadPointFromClient(e.clientX, e.clientY);
        if (!pt) return;
        state.cadLabelDrag = {
          index,
          offsetX: pt.x - Number(item.x || 0),
          offsetY: pt.y - Number(item.y || 0),
          pointerId: e.pointerId
        };
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('dragging');
      });
      overlay.appendChild(el);
    });
  }

  function updateCadMarkerUi() {
    const active = state.cadActiveLetter || '';
    if (els.cadLetterPalette) els.cadLetterPalette.querySelectorAll('[data-letter]').forEach(btn => btn.classList.toggle('active', btn.dataset.letter === active));
    if (els.cadMarkerModeLabel) {
      els.cadMarkerModeLabel.textContent = active ? `وضع الإضافة نشط: ${active} — اضغط داخل المعاينة لوضعه` : 'اختر حرفًا أو اكتب النص ثم اضغط داخل المعاينة';
    }
  }

  function addCadMarkerAt(clientX, clientY) {
    const letter = (state.cadActiveLetter || state.cadSymbolText || '').trim();
    if (!letter || !els.cadPreviewImage) return false;
    const pt = cadPointFromClient(clientX, clientY);
    if (!pt) return false;
    state.cadManualLabels.push({ text: letter, x: pt.x, y: pt.y });
    state.cadLabelPlacement = false;
    state.cadActiveLetter = '';
    updateCadMarkerUi();
    renderCadMarkerOverlay();
    return true;
  }

  function updateCadHatchUi() {
    const count = state.cadManualHatchKeys?.size || 0;
    if (els.cadPickHatchBtn) {
      els.cadPickHatchBtn.classList.toggle('active', Boolean(state.cadHatchPlacement));
      els.cadPickHatchBtn.textContent = state.cadHatchPlacement ? '✓ وضع اختيار التهشير نشط' : '⌖ اختيار أماكن التهشير';
    }
    if (els.cadHatchModeLabel) {
      els.cadHatchModeLabel.textContent = state.cadHatchPlacement
        ? `اضغط على أي Polygon داخل المعاينة لإضافة/إزالة التهشير · المحدد ${count}`
        : (count ? `المناطق المهشرة: ${count}` : 'لا توجد مناطق مهشرة');
    }
    els.cadPreviewViewport?.classList.toggle('hatch-pick-mode', Boolean(state.cadHatchPlacement));
  }

  function toggleCadHatchAt(clientX, clientY) {
    if (!els.cadPreviewImage || !state.cadPreviewTransform) return false;
    const rect = els.cadPreviewImage.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const px = ((clientX - rect.left) / rect.width) * (els.cadPreviewImage.naturalWidth || 1600);
    const py = ((clientY - rect.top) / rect.height) * (els.cadPreviewImage.naturalHeight || 1600);
    const t = state.cadPreviewTransform;
    if (px < 0 || py < 0 || px > t.W || py > t.H) return false;
    const gx = t.minX + (px - t.ox) / t.scale;
    const gy = t.minY + (t.oy + t.usedH - py) / t.scale;
    const pt = turf.point([gx, gy]);
    const hits = (state.cadHatchCandidates || []).filter(item => {
      try { return turf.booleanPointInPolygon(pt, item.feature); } catch { return false; }
    });
    if (!hits.length) {
      toast('اضغط داخل Polygon تريد تهشيره', 'warn', 1800);
      return true;
    }
    hits.sort((a,b) => {
      try { return featureAreaMetersReference(a.feature) - featureAreaMetersReference(b.feature); } catch { return 0; }
    });
    const key = hits[0].featureKey;
    if (!key) return false;
    if (state.cadManualHatchKeys.has(key)) state.cadManualHatchKeys.delete(key);
    else state.cadManualHatchKeys.add(key);
    updateCadHatchUi();
    generateCadPreview(false);
    return true;
  }


  function buildCadSvg(options = {}) {
    const entries = visibleSourceEntries({ gisOnly:true }).filter(item => ['Polygon','MultiPolygon','LineString','MultiLineString'].includes(item.feature.geometry?.type));
    if (!entries.length) throw new Error('No features');
    const withNorthArrow = options.withNorthArrow !== false;
    const occupationMode = options.occupationMode || state.cadOccupationMode || 'hatch';
    const symbolTextRaw = options.symbolText ?? state.cadSymbolText ?? 'إشغال';
    const symbolText = String(symbolTextRaw || 'إشغال').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
    const fontSize = clamp(Number(options.fontSize ?? state.cadFontSize) || 28, 12, 72);
    const lineScale = clamp(Number(options.lineWidth ?? state.cadLineWidth) || 1, .6, 3);
    const lineWidth = 2.5 * lineScale;
    const hatchSpacing = clamp(Number(options.hatchSpacing ?? state.cadHatchSpacing) || 18, 8, 40);
    const hatchAngle = clamp(Number(options.hatchAngle ?? state.cadHatchAngle) || 45, 0, 180);
    const hatchStroke = Math.max(1.3, 1.7 * lineScale);
    const W = 1600, H = 1600;
    const marginX = 90, topReserved = withNorthArrow ? 175 : 90, bottomMargin = 85;
    const allCoords = [];
    entries.forEach(({ feature }) => coordsWalk(feature.geometry, (coords, kind) => {
      if (kind === 'point') allCoords.push(coords); else allCoords.push(...coords);
    }));
    if (!allCoords.length) throw new Error('No coordinates');
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    allCoords.forEach(([x,y]) => { minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y); });
    const dx=Math.max(maxX-minX,1e-12), dy=Math.max(maxY-minY,1e-12);
    const boxW=W-marginX*2, boxH=H-topReserved-bottomMargin;
    const scale=Math.min(boxW/dx,boxH/dy);
    const usedW=dx*scale, usedH=dy*scale;
    const ox=marginX+(boxW-usedW)/2;
    const oy=topReserved+(boxH-usedH)/2;
    const tx=x=>ox+(x-minX)*scale;
    const ty=y=>oy+usedH-(y-minY)*scale;
    state.cadPreviewTransform = { minX, minY, scale, ox, oy, usedH, W, H };
    state.cadHatchCandidates = entries
      .filter(item => ['Polygon','MultiPolygon'].includes(item.feature.geometry?.type))
      .map(item => ({ featureKey:item.featureKey, feature:cloneValue(item.feature) }));

    const hatchParts = [];
    const outlineParts = [];
    const symbolParts = [];
    const manualLabelParts = [];
    const manualLabels = (options.manualLabels || getCadManualLabels());
    const ringPath = (ring) => ring.map(([x,y],i) => `${i ? 'L' : 'M'} ${tx(x).toFixed(2)} ${ty(y).toFixed(2)}`).join(' ') + ' Z';
    entries.forEach(({ layer, feature, featureKey }) => {
      const geom = feature.geometry?.type || '';
      const shouldHatch = Boolean(featureKey && state.cadManualHatchKeys.has(featureKey) && (occupationMode === 'hatch' || occupationMode === 'both'));
      if (geom === 'Polygon') {
        const d = (feature.geometry.coordinates || []).map(ringPath).join(' ');
        if (shouldHatch) hatchParts.push(`<path d="${d}" fill="url(#occHatch)" fill-rule="evenodd" stroke="none"/>`);
        outlineParts.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="${lineWidth.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`);
      } else if (geom === 'MultiPolygon') {
        (feature.geometry.coordinates || []).forEach(poly => {
          const d = (poly || []).map(ringPath).join(' ');
          if (shouldHatch) hatchParts.push(`<path d="${d}" fill="url(#occHatch)" fill-rule="evenodd" stroke="none"/>`);
          outlineParts.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="${lineWidth.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`);
        });
      } else if (geom === 'LineString') {
        const pts = feature.geometry.coordinates.map(([x,y]) => `${tx(x).toFixed(2)},${ty(y).toFixed(2)}`).join(' ');
        outlineParts.push(`<polyline points="${pts}" fill="none" stroke="#000" stroke-width="${lineWidth.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`);
      } else if (geom === 'MultiLineString') {
        (feature.geometry.coordinates || []).forEach(line => {
          const pts = line.map(([x,y]) => `${tx(x).toFixed(2)},${ty(y).toFixed(2)}`).join(' ');
          outlineParts.push(`<polyline points="${pts}" fill="none" stroke="#000" stroke-width="${lineWidth.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`);
        });
      }
    });

    manualLabels.forEach(item => {
      const t = String(item.text || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
      if (!t) return;
      const x = clamp(Number(item.x) || 0, 20, W - 20).toFixed(2);
      const y = clamp(Number(item.y) || 0, 20, H - 20).toFixed(2);
      manualLabelParts.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="Cairo, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#000" direction="rtl">${t}</text>`);
    });

    const northArrow = withNorthArrow ? `<g transform="translate(122,105)">
          <text x="0" y="-50" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#000">N</text>
          <path d="M 0 -38 L -30 55 L 0 38 L 30 55 Z" fill="#000"/>
        </g>` : '';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <pattern id="occHatch" width="${hatchSpacing}" height="${hatchSpacing}" patternUnits="userSpaceOnUse" patternTransform="rotate(${hatchAngle})">
          <rect width="${hatchSpacing}" height="${hatchSpacing}" fill="#fff"/>
          <path d="M 0 0 L 0 ${hatchSpacing}" stroke="#000" stroke-width="${hatchStroke.toFixed(2)}"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#fff"/>
      <g>${hatchParts.join('')}</g>
      <g>${outlineParts.join('')}</g>
      <g>${symbolParts.join('')}</g>
      <g>${manualLabelParts.join('')}</g>
      ${northArrow}
    </svg>`;
    return { svg, width: W, height: H };
  }

  async function buildCadPng(options = {}) {
    const { svg, width, height } = buildCadSvg(options);
    const svgBlob = new Blob([svg], { type:'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    await new Promise((resolve,reject)=>{ img.onload=resolve; img.onerror=reject; img.src=url; });
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height); ctx.drawImage(img,0,0);
    URL.revokeObjectURL(url);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png',1));
    const dataUrl = canvas.toDataURL('image/png');
    return { blob, dataUrl, filename: state.cadPreviewFilename || 'CAD_boundary_north.png' };
  }

  function updateCadModeUi() {
    if (els.cadModeTabs) els.cadModeTabs.querySelectorAll('[data-cad-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.cadMode === state.cadOccupationMode));
    if (els.cadSymbolPanel) els.cadSymbolPanel.classList.toggle('symbol-hidden', state.cadOccupationMode === 'hatch');
    if (els.cadHatchPanel) els.cadHatchPanel.classList.toggle('hidden', state.cadOccupationMode === 'symbol');
  }

  function syncCadControls() {
    if (els.cadSymbolText) els.cadSymbolText.value = state.cadSymbolText;
    if (els.cadFontSize) els.cadFontSize.value = String(state.cadFontSize);
    if (els.cadLineWidth) els.cadLineWidth.value = String(state.cadLineWidth);
    if (els.cadLineWidthLabel) els.cadLineWidthLabel.textContent = `×${Number(state.cadLineWidth).toFixed(1)}`;
    if (els.cadHatchSpacing) els.cadHatchSpacing.value = String(state.cadHatchSpacing);
    if (els.cadHatchAngle) els.cadHatchAngle.value = String(state.cadHatchAngle);
    if (els.cadHatchAngleLabel) els.cadHatchAngleLabel.textContent = `${state.cadHatchAngle}°`;
    updateCadModeUi();
    updateCadHatchUi();
  }

  function applyCadPreviewTransform() {
    if (!els.cadPreviewImage || !els.cadPreviewViewport) return;
    const vp = els.cadPreviewViewport;
    const w = Math.max(1, vp.clientWidth - 36), h = Math.max(1, vp.clientHeight - 36);
    const naturalW = els.cadPreviewImage.naturalWidth || 1600, naturalH = els.cadPreviewImage.naturalHeight || 1600;
    const fit = Math.min(w / naturalW, h / naturalH);
    els.cadPreviewImage.style.width = `${naturalW * fit}px`;
    els.cadPreviewImage.style.height = `${naturalH * fit}px`;
    els.cadPreviewImage.style.transform = `translate(-50%, -50%) translate(${state.cadPreviewPanX}px, ${state.cadPreviewPanY}px) scale(${state.cadPreviewZoom})`;
    if (els.cadZoomReadout) els.cadZoomReadout.textContent = `${Math.round(state.cadPreviewZoom * 100)}%`;
    requestAnimationFrame(renderCadMarkerOverlay);
  }

  function resetCadPreviewView() {
    state.cadPreviewZoom = 1; state.cadPreviewPanX = 0; state.cadPreviewPanY = 0; applyCadPreviewTransform();
  }

  let cadPreviewTimer = null;
  function scheduleCadPreview(delay = 140) {
    clearTimeout(cadPreviewTimer);
    cadPreviewTimer = setTimeout(() => generateCadPreview(false), delay);
  }

  async function generateCadPreview(resetView = false) {
    if (els.cadPreviewLoading) { els.cadPreviewLoading.textContent = 'جاري تجهيز الرسم…'; els.cadPreviewLoading.classList.remove('hidden'); }
    try {
      const result = await buildCadPng({ withNorthArrow:true, occupationMode:state.cadOccupationMode, symbolText:state.cadSymbolText, fontSize:state.cadFontSize, lineWidth:state.cadLineWidth, hatchSpacing:state.cadHatchSpacing, hatchAngle:state.cadHatchAngle, manualLabels:[] });
      state.cadPreviewBlob=result.blob; state.cadPreviewDataUrl=result.dataUrl; state.cadPreviewFilename=result.filename;
      if (els.cadPreviewImage) {
        els.cadPreviewImage.onload = () => { if (resetView) resetCadPreviewView(); else applyCadPreviewTransform(); renderCadMarkerOverlay(); if (els.cadPreviewLoading) els.cadPreviewLoading.classList.add('hidden'); };
        els.cadPreviewImage.src=result.dataUrl;
      }
      if (els.cadSendStatus && !state.cadSendPending) { els.cadSendStatus.textContent='جاهز للتنزيل'; els.cadSendStatus.className='cad-send-status'; }
      return result;
    } catch(err) {
      console.error(err);
      if (els.cadPreviewLoading) { els.cadPreviewLoading.textContent='تعذر إنشاء المعاينة'; els.cadPreviewLoading.classList.remove('hidden'); }
      toast('تعذر إنشاء معاينة صورة الأوتوكاد','error'); return null;
    }
  }

  async function previewCadImage() {
    syncCadControls(); openModal('cadPreviewModal'); resetCadPreviewView(); await generateCadPreview(true);
  }

  function setCadSendStatus(text,type='') {
    if (!els.cadSendStatus) return;
    els.cadSendStatus.textContent=text; els.cadSendStatus.className=`cad-send-status${type?` ${type}`:''}`;
  }

  async function sendCadPreview() {
    if (state.cadSendPending) return;
    state.cadSendPending=true; if (els.sendCadBtn) els.sendCadBtn.disabled=true;
    setCadSendStatus('جاري تنزيل صورة الكاد وإرفاقها تلقائيًا…');
    try {
      const result=await buildCadPng({ withNorthArrow:true, occupationMode:state.cadOccupationMode, symbolText:state.cadSymbolText, fontSize:state.cadFontSize, lineWidth:state.cadLineWidth, hatchSpacing:state.cadHatchSpacing, hatchAngle:state.cadHatchAngle, manualLabels:getCadManualLabels() }); if (!result?.blob) throw new Error('تعذر تجهيز صورة الكاد');
      const base=(result.filename||'CAD_boundary_north.png').replace(/\.png$/i,'');
      const stamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,17);
      const filename=`${base}-${stamp}.png`;

      // 1) Normal browser download to the user's Downloads folder.
      downloadBlob(result.blob, filename);

      // 2) Ask the local GeoAudit helper to attach that same downloaded file
      // directly to the work-site AutoCAD file input (#attach_cad_img).
      const response = await fetch('/api/send-cad', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({dataUrl:result.dataUrl, filename})
      });
      let payload={};
      try { payload=await response.json(); } catch(_) {}
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'تعذر إرفاق صورة الكاد تلقائيًا');

      setCadSendStatus('تم التنزيل والإرفاق تلقائيًا ✓','ok');
      toast('تم تنزيل صورة الكاد ووضعها تلقائيًا في خانة صورة الأوتوكاد');
    } catch(err) {
      console.error(err);
      setCadSendStatus(err?.message || 'تعذر تنزيل وإرفاق صورة الكاد.','error');
      toast(err?.message || 'تعذر تنزيل وإرفاق صورة الكاد','error',5500);
    } finally {
      state.cadSendPending=false; if (els.sendCadBtn) els.sendCadBtn.disabled=false;
    }
  }

  async function exportPNG() {
    try {
      const result = await buildCadPng({ withNorthArrow: true, occupationMode: state.cadOccupationMode, manualLabels:getCadManualLabels() });
      downloadBlob(result.blob, result.filename);
      toast('تم تصدير صورة CAD بدون إطار وبسهم شمال ثابت');
    } catch(err){ console.error(err); toast('تعذر إنشاء صورة CAD','error'); }
  }

  function coordsWalk(geom, cb) {
    if (!geom) return;
    const t = geom.type;
    if (t === 'Point') cb(geom.coordinates, 'point');
    else if (t === 'MultiPoint') geom.coordinates.forEach(c => cb(c, 'point'));
    else if (t === 'LineString') cb(geom.coordinates, 'line');
    else if (t === 'MultiLineString') geom.coordinates.forEach(c => cb(c, 'line'));
    else if (t === 'Polygon') geom.coordinates.forEach(r => cb(r, 'poly'));
    else if (t === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(r => cb(r, 'poly')));
  }

  function exportDXF() {
    const features = visibleSourceFeatures({ gisOnly:true });
    if (!features.length) { toast('لا توجد طبقات مرئية للتصدير', 'warn'); return; }
    const utm = getUTMDef();
    const p = c => {
      try { return proj4('EPSG:4326', utm.def, c); } catch { return c; }
    };
    const lines = [
      '0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','0','ENDSEC',
      '0','SECTION','2','ENTITIES'
    ];
    let count = 0;
    features.forEach((f, idx) => {
      const layerName = `GIS_${String(idx+1).padStart(3,'0')}`;
      coordsWalk(f.geometry, (coords, kind) => {
        if (kind === 'point') {
          const [x,y] = p(coords);
          lines.push('0','POINT','8',layerName,'10',String(x),'20',String(y),'30','0');
          count++;
          return;
        }
        const arr = coords.map(p);
        lines.push('0','POLYLINE','8',layerName,'66','1','70', kind === 'poly' ? '1' : '0');
        arr.forEach(([x,y]) => lines.push('0','VERTEX','8',layerName,'10',String(x),'20',String(y),'30','0'));
        lines.push('0','SEQEND');
        count++;
      });
    });
    lines.push('0','ENDSEC','0','EOF');
    downloadBlob(new Blob([lines.join('\n')], { type: 'application/dxf' }), `geoaudit_UTM${utm.zone}${utm.hemi}.dxf`);
    toast(`تم تصدير DXF · ${count} عنصر`);
  }

  function xmlEscape(v) {
    return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  }

  function coordString(coords) { return coords.map(c => `${c[0]},${c[1]},0`).join(' '); }

  function featureToKML(feature, name) {
    const g = feature.geometry;
    if (!g) return '';
    const props = feature.properties || {};
    const desc = Object.entries(props).slice(0,15).map(([k,v]) => `${k}: ${v}`).join('\n');
    const head = `<Placemark><name>${xmlEscape(name)}</name><description>${xmlEscape(desc)}</description>`;
    if (g.type === 'Point') return `${head}<Point><coordinates>${coordString([g.coordinates])}</coordinates></Point></Placemark>`;
    if (g.type === 'LineString') return `${head}<LineString><tessellate>1</tessellate><coordinates>${coordString(g.coordinates)}</coordinates></LineString></Placemark>`;
    if (g.type === 'Polygon') {
      const outer = coordString(g.coordinates[0]);
      const holes = g.coordinates.slice(1).map(r => `<innerBoundaryIs><LinearRing><coordinates>${coordString(r)}</coordinates></LinearRing></innerBoundaryIs>`).join('');
      return `${head}<Polygon><outerBoundaryIs><LinearRing><coordinates>${outer}</coordinates></LinearRing></outerBoundaryIs>${holes}</Polygon></Placemark>`;
    }
    if (g.type === 'MultiPolygon') {
      const parts = g.coordinates.map(p => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordString(p[0])}</coordinates></LinearRing></outerBoundaryIs>${p.slice(1).map(r=>`<innerBoundaryIs><LinearRing><coordinates>${coordString(r)}</coordinates></LinearRing></innerBoundaryIs>`).join('')}</Polygon>`).join('');
      return `${head}<MultiGeometry>${parts}</MultiGeometry></Placemark>`;
    }
    if (g.type === 'MultiLineString') return `${head}<MultiGeometry>${g.coordinates.map(c=>`<LineString><coordinates>${coordString(c)}</coordinates></LineString>`).join('')}</MultiGeometry></Placemark>`;
    if (g.type === 'MultiPoint') return `${head}<MultiGeometry>${g.coordinates.map(c=>`<Point><coordinates>${coordString([c])}</coordinates></Point>`).join('')}</MultiGeometry></Placemark>`;
    return '';
  }

  function exportKML() {
    const features = visibleSourceFeatures({ gisOnly:true }).filter(f => ['Polygon','MultiPolygon'].includes(f.geometry?.type));
    if (!features.length) { toast('لا توجد مضلعات مرئية للتصدير إلى KML', 'warn'); return; }
    const placemarks = features.map((f,i) => featureToKML(f, f.properties?.name || f.properties?.Name || `Feature ${i+1}`)).join('\n');
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>GeoAudit Studio</name>${placemarks}</Document></kml>`;
    downloadBlob(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), 'geoaudit.kml');
    toast(`تم تصدير KML · ${features.length} عنصر`);
  }

  function utmWkt(zone, hemi) {
    const cm = zone * 6 - 183;
    const falseN = hemi === 'S' ? 10000000 : 0;
    return `PROJCS["WGS_1984_UTM_Zone_${zone}${hemi}",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000],PARAMETER["False_Northing",${falseN}],PARAMETER["Central_Meridian",${cm}],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0],UNIT["Meter",1]]`;
  }

  function transformCoordinatesRecursive(coords, fn) {
    if (!Array.isArray(coords)) return coords;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') return fn(coords);
    return coords.map(c => transformCoordinatesRecursive(c, fn));
  }

  function selectedPolygonFeaturesForExport() {
    const out = [];
    state.layers.filter(l => l.visible && (l.kind === 'shapefile' || l.kind === 'geojson')).forEach(layer => {
      (getWorkingGeojson(layer)?.features || []).forEach(feature => {
        if (feature.__gaExcluded || !isPolygonFeature(feature) || !feature.__gaSelected) return;
        out.push(cleanExportFeature(feature));
      });
    });
    return out;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }

  function wgs84PrjWkt() {
    return 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]';
  }

  function largestPolygonFeature(features) {
    let best = null;
    let bestArea = -1;
    for (const source of features || []) {
      if (!isPolygonFeature(source)) continue;
      const f = cleanExportFeature(source);
      let area = 0;
      try { area = featureAreaMetersReference(f); } catch {}
      if (area > bestArea) { bestArea = area; best = f; }
    }
    return best;
  }

  function bboxCenter(b) {
    return [(Number(b[0]) + Number(b[2])) / 2, (Number(b[1]) + Number(b[3])) / 2];
  }

  async function verifyExportedShapefileRoundTrip(zipBlob, expectedFeature) {
    // Re-read our own ZIP before download. This catches bad CRS / nested ZIP / invalid geometry
    // before the file ever reaches the work site.
    const ab = await zipBlob.arrayBuffer();
    const parsed = await shp(ab);
    const fc = flattenShpResult(parsed);
    if (!fc?.features?.length) throw new Error('فشل فحص ملف Shapefile بعد إنشائه');
    if (fc.features.length !== 1) throw new Error('ملف الموقع يجب أن يحتوي على Polygon واحد فقط');
    const got = fc.features[0];
    if (!isPolygonFeature(got)) throw new Error('الملف الناتج ليس Polygon صالحًا');

    const sample = firstCoordinate(got.geometry);
    if (!sample || Math.abs(sample[0]) > 180 || Math.abs(sample[1]) > 90) {
      throw new Error('إحداثيات Shapefile الناتج ليست WGS84 صحيحة');
    }

    try {
      const eb = turf.bbox(expectedFeature);
      const gb = turf.bbox(got);
      const [ex, ey] = bboxCenter(eb);
      const [gx, gy] = bboxCenter(gb);
      // shp-write is lossless enough for this workflow; a generous threshold still catches
      // the classic UTM-vs-WGS84 world-view failure immediately.
      if (Math.abs(ex-gx) > 0.02 || Math.abs(ey-gy) > 0.02) {
        throw new Error('فشل فحص مكان Shapefile: الإحداثيات تحركت عن الموقع الأصلي');
      }
    } catch (err) {
      if (/فشل فحص مكان/.test(String(err?.message || ''))) throw err;
    }
    return true;
  }

  async function exportSHP() {
    const selected = selectedPolygonFeaturesForExport();
    if (selected.length > 1) {
      toast('حدد قطعة واحدة فقط قبل تصدير Shapefile، لأن موقع العمل يقبل Polygon واحد فقط.', 'warn', 6500);
      return;
    }

    const visiblePolygons = visibleSourceFeatures({ gisOnly:true }).filter(isPolygonFeature);
    let sourceFeature = null;
    let exportLabel = '';

    if (selected.length === 1) {
      sourceFeature = cleanExportFeature(selected[0]);
      exportLabel = 'الجزء المحدد';
    } else {
      // No selection = whole land. Use the largest visible polygon as the outer land boundary,
      // not occupation/building polygons inside it.
      sourceFeature = largestPolygonFeature(visiblePolygons);
      exportLabel = 'الأرض كاملة';
    }

    if (!sourceFeature) { toast('لا يوجد Polygon صالح للتصدير', 'warn'); return; }

    try {
      // IMPORTANT: Work-site map expects a directly displayable single polygon.
      // Keep coordinates in WGS84 lon/lat; do NOT convert them to UTM for SHP export.
      // UTM 35/36/37 remains used for geodetic input and DXF, but SHP upload stays WGS84.
      let area = 0;
      try { area = featureAreaMetersReference(sourceFeature); } catch {}
      sourceFeature.properties = {
        ...(sourceFeature.properties || {}),
        Area_m2: Number(truncToFixed(area, 2)),
        Area_fed: Number(truncToFixed(feddanFromSqm(area), 4)),
        ExportMode: exportLabel
      };

      const fc = { type: 'FeatureCollection', features: [sourceFeature] };
      const opts = {
        filename: 'boundary',
        outputType: 'blob',
        compression: 'DEFLATE',
        prj: wgs84PrjWkt(),
        // No `folder`: SHP/SHX/DBF/PRJ must sit directly at ZIP root for maximum compatibility.
        types: { point:'points', polygon:'boundary', polyline:'lines' }
      };

      let data = shpwrite.zip(fc, opts);
      if (data && typeof data.then === 'function') data = await data;

      let zipBlob;
      if (data instanceof Blob) zipBlob = data;
      else if (data instanceof ArrayBuffer) zipBlob = new Blob([data], { type:'application/zip' });
      else if (typeof data === 'string') {
        const binary = atob(data.replace(/^data:.*?;base64,/,''));
        const bytes = new Uint8Array(binary.length);
        for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
        zipBlob = new Blob([bytes], {type:'application/zip'});
      } else throw new Error('Unexpected shpwrite output');

      // Verify the generated ZIP by reopening it before download/upload.
      await verifyExportedShapefileRoundTrip(zipBlob, sourceFeature);

      const stamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,17);
      const filename=`boundary-WGS84-${stamp}.zip`;

      // Same V17 CAD workflow preserved for automatic attachment.
      downloadBlob(zipBlob, filename);
      const dataUrl = await blobToDataUrl(zipBlob);
      const response = await fetch('/api/send-shp', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({dataUrl, filename})
      });
      let payload={};
      try { payload=await response.json(); } catch(_) {}
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'تعذر إرفاق Shapefile تلقائيًا');

      toast(`تم تصدير وإرفاق ${exportLabel} ✓ · Polygon واحد · WGS84 · ${truncToFixed(area, 2)} م2`, 'ok', 5200);
    } catch (err) {
      console.error(err);
      toast(err?.message || 'تعذر تصدير وإرفاق Shapefile', 'error', 7000);
    }
  }

  function exportByType(type) {
    if (type === 'png') exportPNG();
    else if (type === 'dxf') exportDXF();
    else if (type === 'kml') exportKML();
    else if (type === 'shp') exportSHP();
  }

  function setMapFocusMode(enabled) {
    document.body.classList.toggle('map-focus-mode', Boolean(enabled));
    window.setTimeout(() => {
      try { state.map?.invalidateSize(true); } catch {}
    }, 80);
  }

  function wireEvents() {
    els.basemapSelect.onchange = e => setBasemap(e.target.value);
    els.uploadBtn.onclick = () => els.fileInput.click();
    els.importCard.onclick = () => els.fileInput.click();
    els.fileInput.onchange = e => { handleFiles(e.target.files); e.target.value = ''; };
    els.fitAllBtn.onclick = fitAll;
    if (els.focusMapBtn) els.focusMapBtn.onclick = () => setMapFocusMode(true);
    if (els.exitFocusMapBtn) els.exitFocusMapBtn.onclick = () => setMapFocusMode(false);
    els.homeBtn.onclick = fitAll;
    els.zoomInBtn.onclick = () => state.map.zoomIn();
    els.zoomOutBtn.onclick = () => state.map.zoomOut();
    els.clearAllBtn.onclick = () => clearAll();
    if (els.restoreDeletedBtn) els.restoreDeletedBtn.onclick = restoreDeleted;
    els.editGeometryBtn.onclick = () => state.editMode ? exitEditMode() : enterEditMode();
    els.drawCutBtn.onclick = startCutDrawing;
    els.excludeSelectedBtn.onclick = excludeSelected;
    els.keepSelectedBtn.onclick = keepOnlySelected;
    els.undoEditBtn.onclick = undoEdit;
    els.resetEditBtn.onclick = resetExportGeometry;
    els.exitEditBtn.onclick = exitEditMode;
    els.keepInsideCutBtn.onclick = () => applyCut('keep');
    els.removeInsideCutBtn.onclick = () => applyCut('remove');
    els.cancelCutBtn.onclick = cancelCutDrawing;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-copy-area]');
      if (!btn) return;
      const isFed = btn.dataset.copyKind === 'fed';
      const numberText = `${btn.dataset.copyArea}`;
      const fullText = `${numberText}${isFed ? ' فدان' : ' م2'}`;
      copyPlainText(numberText, isFed ? 'الفدان' : 'المساحة');
      fetch('/api/smart-copy', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ number:numberText, full:fullText, unit:isFed ? 'فدان' : 'م2' })
      }).catch(()=>{});
    });

    els.toleranceInput.oninput = e => {
      state.tolerance = Math.max(0, Number(e.target.value) || 0);
      refreshAllTolerance();
    };
    els.recheckBtn.onclick = () => { refreshAllTolerance(); toast(`تم الفحص بسماحية ${fmt(state.tolerance,3)} م`); };
    els.northToggle.onclick = toggleNorth;

    els.moveToolBtn.onclick = () => { renderMoveChoices(); openModal('moveModal'); };
    els.resetOffsetsBtn.onclick = resetOffsets;
    els.startMoveBtn.onclick = startMoveMode;
    els.exitMoveBtn.onclick = exitMoveMode;
    els.undoMoveBtn.onclick = undoLastMove;
    els.resetMoveBtn.onclick = resetOffsets;

    els.styleOpacity.oninput = updateStyleLabels;
    els.styleWeight.oninput = updateStyleLabels;
    els.styleRadius.oninput = updateStyleLabels;
    els.styleApplyBtn.onclick = applyLayerStyle;
    els.styleResetBtn.onclick = resetLayerStyle;

    els.areaCalcBtn.onclick = () => { calcAreaUnits(); openModal('areaModal'); };
    els.areaInput.oninput = calcAreaUnits;
    els.pickLargestAreaBtn.onclick = () => useLargestArea(els.areaInput);

    if (els.smartDescBtn) els.smartDescBtn.onclick = () => openModal('smartModal');
    els.descType.querySelectorAll('button').forEach(b => b.onclick = () => setDescType(b.dataset.type));
    els.useLargestForDesc.onclick = () => {
      useLargestArea(els.descLandArea);
      if (!els.descLegalizeArea.value) els.descLegalizeArea.value = els.descLandArea.value;
    };
    els.generateDescBtn.onclick = generateDescription;
    els.copyDescBtn.onclick = copyDescription;

    els.attributeSearch.oninput = e => { state.attrSearch = e.target.value; renderAttributeTable(); };
    document.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => closeModal(btn.dataset.close));
    document.querySelectorAll('.modal-backdrop').forEach(bg => bg.addEventListener('mousedown', e => { if (e.target === bg) bg.classList.remove('show'); }));
    document.querySelectorAll('[data-export]').forEach(btn => btn.onclick = () => exportByType(btn.dataset.export));
    if (els.previewCadBtn) els.previewCadBtn.onclick = previewCadImage;
    if (els.sendCadBtn) els.sendCadBtn.onclick = sendCadPreview;
    if (els.cadCancelBtn) els.cadCancelBtn.onclick = () => closeModal('cadPreviewModal');

    if (els.cadModeTabs) els.cadModeTabs.querySelectorAll('[data-cad-mode]').forEach(btn => {
      btn.onclick = () => {
        state.cadOccupationMode = btn.dataset.cadMode;
        if (state.cadOccupationMode === 'symbol') state.cadHatchPlacement = false;
        if (state.cadOccupationMode === 'hatch') { state.cadLabelPlacement = false; state.cadActiveLetter = ''; }
        updateCadModeUi(); updateCadMarkerUi(); updateCadHatchUi(); scheduleCadPreview(40);
      };
    });
    if (els.cadSymbolText) els.cadSymbolText.oninput = e => { state.cadSymbolText = e.target.value || 'إشغال'; state.cadActiveLetter = (e.target.value || '').trim(); state.cadLabelPlacement = Boolean(state.cadActiveLetter); if (state.cadLabelPlacement) state.cadHatchPlacement = false; updateCadMarkerUi(); updateCadHatchUi(); scheduleCadPreview(); };
    if (els.cadLetterPalette) els.cadLetterPalette.querySelectorAll('[data-letter]').forEach(btn => btn.onclick = () => { state.cadActiveLetter = btn.dataset.letter; state.cadLabelPlacement = true; state.cadHatchPlacement = false; if (els.cadSymbolText) els.cadSymbolText.value = state.cadActiveLetter; updateCadMarkerUi(); updateCadHatchUi(); });
    if (els.cadUndoMarkerBtn) els.cadUndoMarkerBtn.onclick = () => { state.cadManualLabels.pop(); renderCadMarkerOverlay(); };
    if (els.cadClearMarkersBtn) els.cadClearMarkersBtn.onclick = () => { state.cadManualLabels = []; renderCadMarkerOverlay(); };
    if (els.cadPickHatchBtn) els.cadPickHatchBtn.onclick = () => {
      state.cadHatchPlacement = !state.cadHatchPlacement;
      if (state.cadHatchPlacement) { state.cadLabelPlacement = false; state.cadActiveLetter = ''; }
      updateCadMarkerUi(); updateCadHatchUi();
    };
    if (els.cadClearHatchBtn) els.cadClearHatchBtn.onclick = () => {
      state.cadManualHatchKeys.clear();
      state.cadHatchPlacement = false;
      updateCadHatchUi();
      generateCadPreview(false);
    };
    const setCadFont = value => {
      state.cadFontSize = clamp(Math.round(Number(value) || 28), 12, 72);
      if (els.cadFontSize) els.cadFontSize.value = String(state.cadFontSize);
      renderCadMarkerOverlay();
      scheduleCadPreview(60);
    };
    if (els.cadFontSize) els.cadFontSize.oninput = e => setCadFont(e.target.value);
    if (els.cadFontPlus) els.cadFontPlus.onclick = () => setCadFont(state.cadFontSize + 1);
    if (els.cadFontMinus) els.cadFontMinus.onclick = () => setCadFont(state.cadFontSize - 1);
    if (els.cadLineWidth) els.cadLineWidth.oninput = e => {
      state.cadLineWidth = clamp(Number(e.target.value) || 1, .6, 3);
      if (els.cadLineWidthLabel) els.cadLineWidthLabel.textContent = `×${state.cadLineWidth.toFixed(1)}`;
      scheduleCadPreview();
    };
    const setHatchSpacing = value => {
      state.cadHatchSpacing = clamp(Math.round(Number(value) || 18), 8, 40);
      if (els.cadHatchSpacing) els.cadHatchSpacing.value = String(state.cadHatchSpacing);
      scheduleCadPreview(70);
    };
    if (els.cadHatchSpacing) els.cadHatchSpacing.oninput = e => setHatchSpacing(e.target.value);
    if (els.cadHatchDensePlus) els.cadHatchDensePlus.onclick = () => setHatchSpacing(state.cadHatchSpacing - 1);
    if (els.cadHatchDenseMinus) els.cadHatchDenseMinus.onclick = () => setHatchSpacing(state.cadHatchSpacing + 1);
    if (els.cadHatchAngle) els.cadHatchAngle.oninput = e => {
      state.cadHatchAngle = clamp(Number(e.target.value) || 0, 0, 180);
      if (els.cadHatchAngleLabel) els.cadHatchAngleLabel.textContent = `${state.cadHatchAngle}°`;
      scheduleCadPreview();
    };
    const setCadZoom = z => { state.cadPreviewZoom = clamp(z, .5, 4); applyCadPreviewTransform(); };
    if (els.cadPreviewZoomIn) els.cadPreviewZoomIn.onclick = () => setCadZoom(state.cadPreviewZoom + .2);
    if (els.cadPreviewZoomOut) els.cadPreviewZoomOut.onclick = () => setCadZoom(state.cadPreviewZoom - .2);
    if (els.cadPreviewReset) els.cadPreviewReset.onclick = resetCadPreviewView;
    if (els.cadPreviewViewport) {
      els.cadPreviewViewport.addEventListener('wheel', e => {
        e.preventDefault(); setCadZoom(state.cadPreviewZoom + (e.deltaY < 0 ? .12 : -.12));
      }, { passive:false });
      els.cadPreviewViewport.addEventListener('pointerdown', e => {
        if (e.target.closest?.('.cad-preview-tools')) return;
        if (state.cadLabelPlacement && addCadMarkerAt(e.clientX, e.clientY)) {
          e.preventDefault();
          return;
        }
        if (state.cadHatchPlacement && toggleCadHatchAt(e.clientX, e.clientY)) {
          e.preventDefault();
          return;
        }
        state.cadPreviewDrag = { x:e.clientX, y:e.clientY, px:state.cadPreviewPanX, py:state.cadPreviewPanY };
        els.cadPreviewViewport.classList.add('dragging');
        els.cadPreviewViewport.setPointerCapture?.(e.pointerId);
      });
      els.cadPreviewViewport.addEventListener('pointermove', e => {
        if (state.cadLabelDrag) {
          const pt = cadPointFromClient(e.clientX, e.clientY);
          const item = state.cadManualLabels[state.cadLabelDrag.index];
          if (pt && item) {
            item.x = clamp(pt.x - state.cadLabelDrag.offsetX, 20, (els.cadPreviewImage.naturalWidth || 1600) - 20);
            item.y = clamp(pt.y - state.cadLabelDrag.offsetY, 20, (els.cadPreviewImage.naturalHeight || 1600) - 20);
            renderCadMarkerOverlay();
          }
          return;
        }
        if (!state.cadPreviewDrag) return;
        state.cadPreviewPanX = state.cadPreviewDrag.px + e.clientX - state.cadPreviewDrag.x;
        state.cadPreviewPanY = state.cadPreviewDrag.py + e.clientY - state.cadPreviewDrag.y;
        applyCadPreviewTransform();
      });
      const endCadDrag = () => {
        state.cadPreviewDrag = null;
        state.cadLabelDrag = null;
        els.cadPreviewViewport?.classList.remove('dragging');
        els.cadMarkerOverlay?.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
      };
      els.cadPreviewViewport.addEventListener('pointerup', endCadDrag);
      els.cadPreviewViewport.addEventListener('pointercancel', endCadDrag);
    }


    document.querySelectorAll('[data-section-toggle]').forEach(head => {
      head.addEventListener('click', e => {
        if (e.target.closest('button') || e.target === head || e.target.closest('.section-head-right') || e.target.tagName !== 'SELECT') {
          const section = head.closest('.panel-section');
          section?.classList.toggle('is-collapsed');
        }
      });
    });

    const drawerBackdrop = document.getElementById('drawerBackdrop');
    const inspectorMenuBtn = document.getElementById('inspectorMenuBtn');
    const layersMenuBtn = document.getElementById('layersMenuBtn');
    const reviewMenuBtn = document.getElementById('reviewMenuBtn');
    const closeInspectorDrawer = document.getElementById('closeInspectorDrawer');
    const closeLayersDrawer = document.getElementById('closeLayersDrawer');
    const closeReviewDrawer = document.getElementById('closeReviewDrawer');
    const setDrawerState = (name, visible) => {
      const classes = ['show-inspector-drawer','show-layers-drawer','show-review-drawer'];
      const targetClass = name === 'inspector' ? classes[0] : (name === 'layers' ? classes[1] : classes[2]);
      if (visible) classes.forEach(c => { if (c !== targetClass) document.body.classList.remove(c); });
      document.body.classList.toggle(targetClass, !!visible);
      const anyOpen = classes.some(c => document.body.classList.contains(c));
      if (drawerBackdrop) drawerBackdrop.classList.toggle('show', anyOpen);
      setTimeout(() => { try { state.map?.invalidateSize(); } catch(_){} }, 220);
    };
    window.GeoAuditSetDrawerState = setDrawerState;
    inspectorMenuBtn && inspectorMenuBtn.addEventListener('click', ()=> setDrawerState('inspector', !document.body.classList.contains('show-inspector-drawer')));
    layersMenuBtn && layersMenuBtn.addEventListener('click', ()=> setDrawerState('layers', !document.body.classList.contains('show-layers-drawer')));
    reviewMenuBtn && reviewMenuBtn.addEventListener('click', ()=> setDrawerState('review', !document.body.classList.contains('show-review-drawer')));
    closeInspectorDrawer && closeInspectorDrawer.addEventListener('click', ()=> setDrawerState('inspector', false));
    closeLayersDrawer && closeLayersDrawer.addEventListener('click', ()=> setDrawerState('layers', false));
    closeReviewDrawer && closeReviewDrawer.addEventListener('click', ()=> setDrawerState('review', false));
    drawerBackdrop && drawerBackdrop.addEventListener('click', ()=> { classes.forEach(c => document.body.classList.remove(c)); drawerBackdrop.classList.remove('show'); });

    // All drawers behave like true popovers: any click outside closes the open drawer immediately.
    document.addEventListener('pointerdown', e => {
      const inspectorOpen = document.body.classList.contains('show-inspector-drawer');
      const layersOpen = document.body.classList.contains('show-layers-drawer');
      const reviewOpen = document.body.classList.contains('show-review-drawer');

      if (inspectorOpen) {
        const panel = document.querySelector('.inspector-panel');
        if (!panel?.contains(e.target) && !inspectorMenuBtn?.contains(e.target)) setDrawerState('inspector', false);
      }
      if (layersOpen) {
        const panel = document.querySelector('.layers-panel');
        if (!panel?.contains(e.target) && !layersMenuBtn?.contains(e.target)) setDrawerState('layers', false);
      }
      if (reviewOpen) {
        const panel = document.getElementById('reviewPanel');
        if (!panel?.contains(e.target) && !reviewMenuBtn?.contains(e.target)) setDrawerState('review', false);
      }
    }, true);

    updateCadMarkerUi();
    updateCadHatchUi();

    window.addEventListener('message', e => {
      if (e.source !== window || !e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'GEOAUDIT_CAD_EXTENSION_ACCEPTED') {
        if (state.cadSendPending) setCadSendStatus('تم تسليم الصورة للوصلة… جاري وضعها في خانة صورة الأوتوكاد.');
      }
      if (e.data.type === 'GEOAUDIT_CAD_ACK') {
        clearTimeout(sendCadPreview._timer);
        state.cadSendPending = false;
        if (els.sendCadBtn) els.sendCadBtn.disabled = false;
        if (e.data.ok) {
          setCadSendStatus('تم تنزيل الصورة وإرفاقها تلقائيًا في خانة صورة الأوتوكاد ✓','ok');
          toast('تم إرسال صورة الأوتوكاد إلى الموقع ووضعها في الخانة تلقائيًا');
          setTimeout(() => closeModal('cadPreviewModal'), 900);
        } else {
          setCadSendStatus(e.data.message || 'تعذر العثور على خانة صورة الأوتوكاد في الصفحة المفتوحة.','error');
          toast(e.data.message || 'تعذر وضع الصورة في الموقع','error',6500);
        }
      }
    });
    window.addEventListener('resize', () => { if (els.cadPreviewModal?.classList.contains('show')) applyCadPreviewTransform(); });

    ['dragenter','dragover'].forEach(type => document.addEventListener(type, e => {
      e.preventDefault();
      els.dropOverlay.classList.add('show');
    }));
    ['dragleave','drop'].forEach(type => document.addEventListener(type, e => {
      e.preventDefault();
      if (type === 'drop') handleFiles(e.dataTransfer.files);
      els.dropOverlay.classList.remove('show');
    }));

    const handleGeoAuditShortcut = e => {
      const tag = String(e.target?.tagName || '').toUpperCase();
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable;
      const code = e.code || '';
      const key = String(e.key || '').toLowerCase();
      const shiftS = e.shiftKey && (code === 'KeyS' || key === 's' || key === 'س');
      const shiftZ = e.shiftKey && (code === 'KeyZ' || key === 'z' || key === 'ئ');
      if (!editable && shiftS) {
        e.preventDefault(); e.stopPropagation();
        clearAll({ silent:true });
        return true;
      }
      if (!editable && shiftZ) {
        e.preventDefault(); e.stopPropagation();
        restoreDeleted({ silent:true });
        return true;
      }
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.show').forEach(m => m.classList.remove('show'));
        if (state.moveMode) exitMoveMode();
      }
      return false;
    };
    document.addEventListener('keydown', handleGeoAuditShortcut, true);
    window.addEventListener('keydown', handleGeoAuditShortcut, true);
  }

  window.GeoAuditActions = { clearAll: () => clearAll({silent:true}), restoreDeleted: () => restoreDeleted({silent:true}) };

  window.GeoAuditCad = {
    getPreviewDataUrl: () => state.cadPreviewDataUrl || '',
    getPreviewFilename: () => state.cadPreviewFilename || 'CAD_boundary_north.png',
    async generate(options = {}) {
      const result = await buildCadPng({ withNorthArrow: options.withNorthArrow !== false, occupationMode: options.occupationMode || state.cadOccupationMode, manualLabels:getCadManualLabels() });
      state.cadPreviewBlob = result.blob;
      state.cadPreviewDataUrl = result.dataUrl;
      state.cadPreviewFilename = result.filename;
      return result;
    }
  };

  function startupCheck() {
    if (window.location.protocol === 'file:') {
      toast('شغّل البرنامج من START_GeoAudit.bat حتى تعمل قراءة RAR والخدمات المحلية.', 'error', 10000);
    }
    const missing = [];
    if (!window.L) missing.push('Leaflet');
    if (!window.shp) missing.push('shpjs');
    if (!window.XLSX) missing.push('XLSX');
    if (!window.proj4) missing.push('proj4');
    if (!window.turf) missing.push('Turf');
    if (missing.length) toast(`تعذر تحميل مكتبات: ${missing.join(', ')}`, 'error', 8000);
  }

  function showFatalStartupError(missing) {
    document.body.innerHTML = `
      <div dir="rtl" style="min-height:100vh;background:#071a20;color:#fff;display:grid;place-items:center;padding:30px;font-family:Arial,Tahoma,sans-serif">
        <div style="max-width:760px;background:#0d252d;border:1px solid #23434c;border-radius:20px;padding:28px;box-shadow:0 20px 60px #0007">
          <h1 style="margin-top:0;color:#32e0c4">GeoAudit Studio</h1>
          <h2>الصفحة فتحت، لكن بعض مكتبات GIS لم يتم تحميلها.</h2>
          <p style="line-height:1.9">المكتبات غير المتاحة: <b>${missing.join(', ')}</b></p>
          <p style="line-height:1.9">تأكد أن الجهاز متصل بالإنترنت ثم اضغط Ctrl+F5. لو استمرت الرسالة، استخدم Chrome أو Edge.</p>
          <p style="line-height:1.9;color:#9ec6cf">شغّل البرنامج دائماً من START_GeoAudit.bat واترك النافذة السوداء مفتوحة.</p>
        </div>
      </div>`;
  }

  const startupMissing = [];
  if (!window.L) startupMissing.push('Leaflet');
  if (!window.shp) startupMissing.push('shpjs');
  if (!window.XLSX) startupMissing.push('XLSX');
  if (!window.proj4) startupMissing.push('proj4');
  if (!window.turf) startupMissing.push('Turf');
  if (!window.JSZip) startupMissing.push('JSZip');

  if (startupMissing.length) {
    showFatalStartupError(startupMissing);
    return;
  }

  initMap();
  wireEvents();
  renderLayerList();
  updateStats();
  setDescType('land');
  startupCheck();
  startDownloadedShapefileWatcher();
})();
