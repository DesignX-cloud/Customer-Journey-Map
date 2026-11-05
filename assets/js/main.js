"use strict";

// Only completed sibling stage pages belong here; relative links preserve hosting prefixes.
(() => {
  const stagePages = {
    3: "../03-consultation/index.html",
    4: "../04-visit/index.html",
    5: "../05-contract/index.html"
  };
  document.querySelectorAll(".flow-stage-nav li").forEach(item => {
    const stage = [...item.parentElement.children].indexOf(item) + 1;
    if (item.hasAttribute("aria-current")) return;
    if (!stagePages[stage]) {
      item.setAttribute("aria-disabled", "true");
      return;
    }
    const link = document.createElement("a");
    link.setAttribute("href", stagePages[stage]);
    link.append(...item.childNodes);
    item.append(link);
  });
})();

// Each canvas uses its reference coordinates. Scale the whole layer
// once so HTML nodes, labels, swimlanes and SVG connections cannot drift apart.
(() => {
  const canvas = document.querySelector("[data-flow-canvas]") || document.getElementById("consultation-flowchart");
  if (!canvas) return;
  const viewport = canvas.closest(".flowchart-container");
  const surface = canvas.parentElement;
  const status = document.getElementById("flowchart-status");
  const output = document.getElementById("flowchart-scale");
  const buttons = [...document.querySelectorAll("[data-flow-zoom]")];
  const width = Number(canvas.dataset.width) || 2400;
  const height = Number(canvas.dataset.height) || 1505;
  const nodeCount = Number(canvas.dataset.nodeCount) || 22;
  const maxScale = 3;
  let scale;
  let automatic = true;
  const fitScale = () => viewport.clientWidth / width;
  const initialScale = () => matchMedia("(max-width: 767px)").matches
    ? Math.max(1, fitScale()) : fitScale();
  const minScale = () => Math.min(fitScale(), initialScale());

  function render(next, center = false) {
    const old = scale || next;
    const x = (viewport.scrollLeft + viewport.clientWidth / 2) / old;
    const y = (viewport.scrollTop + viewport.clientHeight / 2) / old;
    scale = Math.max(minScale(), Math.min(maxScale, next));
    canvas.style.transform = `scale(${scale})`;
    surface.style.width = `${width * scale}px`;
    surface.style.height = `${height * scale}px`;
    output.textContent = `${Math.round(scale * 100)}%`;
    buttons.find(b => b.dataset.flowZoom === "out").disabled = scale <= minScale() + .0001;
    buttons.find(b => b.dataset.flowZoom === "in").disabled = scale >= maxScale - .0001;
    if (center) {
      viewport.scrollLeft = x * scale - viewport.clientWidth / 2;
      viewport.scrollTop = y * scale - viewport.clientHeight / 2;
    }
  }
  render(initialScale());
  buttons.find(b => b.dataset.flowZoom === "reset").disabled = false;
  buttons.forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.flowZoom === "reset") {
        automatic = true;
        render(initialScale());
        viewport.scrollTo(0, 0);
      } else {
        automatic = false;
        render(scale * (button.dataset.flowZoom === "in" ? 1.25 : .8), true);
      }
    });
  });
  new ResizeObserver(() => render(automatic ? initialScale() : scale)).observe(viewport);

  // Opt in with ?flowDebug=1; keep diagnostics limited to migrated nodes.
  const contractDebugEnabled = canvas.id === "contract-flowchart"
    && new URLSearchParams(window.location.search).get("flowDebug") === "1";
  const contractDebug = {
    nodeId: "contract-002", jsonUrl: null, displayText: null,
    svgNodeId: null, phase: "initial", result: "pending", reason: null,
    fallback: true
  };
  const contractDebugNodes = { "contract-002": contractDebug };
  function traceContract(details, nodeId = "contract-002") {
    if (canvas.id !== "contract-flowchart") return;
    const state = contractDebugNodes[nodeId] ||= {
      nodeId, jsonUrl: contractDebug.jsonUrl, displayText: null,
      svgNodeId: null, phase: "initial", result: "pending", reason: null,
      fallback: true
    };
    Object.assign(state, details);
    if (contractDebugEnabled) {
      window.__contract002Debug = structuredClone(contractDebug);
      window.__contractTextDebug = structuredClone(contractDebugNodes);
      console.info(`[${nodeId}]`, structuredClone(state));
    }
  }

  // Explicit semantic IDs only: never infer text ownership from path order.
  async function renderContractLabel(svg, materials, { nodeId, groupId, textId, shapeId, type, field = "displayText" }) {
    const trace = details => traceContract(details, nodeId);
    const value = materials[nodeId]?.[field];
    let lines = field === "title" && typeof value === "string" ? [value] : value;
    trace({ phase: "text-data", sourceField: field, sourceText: value ?? null,
      displayText: lines ?? null, renderStarted: true });
    if (lines === undefined) {
      trace({ result: "skipped", reason: `缺少 ${nodeId}.${field}，保留原 SVG。` });
      return false;
    }
    if (!Array.isArray(lines) || !lines.length
      || lines.some(line => typeof line !== "string" || !line.trim() || /[\r\n]/.test(line))) {
      throw new Error(`${nodeId}.${field} 文字格式無效。`);
    }
    let text;
    try {
      const group = svg.querySelector(`[id="${groupId}"]`);
      const original = group?.querySelector(`${type}[id="${textId}"]`);
      const shape = group?.querySelector(`path[id="${shapeId}"]`);
      trace({ phase: "svg-target", svgNodeId: original?.id ?? null, shapeId: shape?.id ?? null });
      if (!original) throw new Error(`SVG 節點檢查失敗：${groupId} 內找不到 ${textId}（${type}）。`);
      if (!shape) throw new Error(`SVG 節點檢查失敗：${groupId} 內找不到 ${shapeId}。`);
      const backupId = original.getAttribute("data-flow-backup");
      const backup = backupId ? group.querySelector(`g[id="${backupId}"]`) : null;
      if (backupId && !backup?.querySelector("path")) {
        throw new Error(`SVG 原文字備援檢查失敗：找不到 ${backupId} 的文字 path。`);
      }
      if (type === "g" && !original.querySelector("path")) {
        throw new Error(`SVG 文字群組檢查失敗：${textId} 沒有原始文字 path。`);
      }
      const sourceStyle = getComputedStyle(original);
      let fontSize = parseFloat(sourceStyle.fontSize);
      const fontWeight = sourceStyle.fontWeight;
      text = type === "text" ? original.cloneNode(true)
        : document.createElementNS(svg.namespaceURI, "text");
      text.id = `${textId}-dynamic`;
      text.dataset.flowTextFor = nodeId;
      text.style.fontSize = `${fontSize}px`;
      text.style.fontWeight = fontWeight;
      text.style.removeProperty("display");
      original.before(text);

      // Preserve the exported size and weight; geometry comes from the SVG,
      // never from JSON or a coordinate-based search for nearby text.
      const originalLines = [...text.querySelectorAll("tspan")];
      let originalLineHeight = originalLines.length > 1
        ? Number(originalLines[1].getAttribute("y")) - Number(originalLines[0].getAttribute("y"))
        : fontSize * 1.5;
      if (!Number.isFinite(originalLineHeight) || originalLineHeight <= 0) {
        throw new Error(`${textId} 的原始文字基線間距無效，保留原 SVG 文字。`);
      }
      const fontFamily = '"Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';
      text.style.fontFamily = fontFamily;
      text.style.fill = "#344553";
      text.style.textAnchor = "middle";
      text.setAttribute("aria-label", lines.join("，"));
      trace({ phase: "font-measurement" });
      await document.fonts.load(`${fontSize}px ${fontFamily}`, lines.join(""));
      await document.fonts.ready;
      const box = shape.getBBox();
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      // Measure before placing tspans. Spread lines toward 1.5em only as far
      // as the unchanged node permits, with symmetric 0.25em inner padding.
      const context = document.createElement("canvas").getContext("2d");
      const horizontalPadding = field === "title" && !materials[nodeId].url?.trim() ? 16 : 44;
      const maxWidth = box.width - horizontalPadding * 2;
      if (field === "title") {
        // These two nodes display the complete JSON title. Preserve every
        // character and fit wrapped lines inside the unchanged rectangle.
        let fitted = false;
        for (let size = fontSize; size >= 12; size--) {
          context.font = `${fontWeight} ${size}px ${fontFamily}`;
          const wrapped = [];
          let line = "";
          for (const character of value) {
            if (line && context.measureText(line + character).width > maxWidth) {
              wrapped.push(line);
              line = character;
            } else {
              line += character;
            }
          }
          if (line) wrapped.push(line);
          const measured = wrapped.map(part => context.measureText(part));
          const top = Math.min(...measured.map((metric, index) => index * size * 1.5 - metric.actualBoundingBoxAscent));
          const bottom = Math.max(...measured.map((metric, index) => index * size * 1.5 + metric.actualBoundingBoxDescent));
          if (bottom - top <= box.height - 2 - size / 2
            && measured.every(metric => metric.width <= maxWidth)) {
            lines = wrapped;
            fontSize = size;
            originalLineHeight = size * 1.5;
            text.style.fontSize = `${size}px`;
            fitted = true;
            break;
          }
        }
        if (!fitted) throw new Error(`${nodeId}.title 完整文字在 12px 以上仍無法容納，保留原 SVG。`);
      }
      context.font = `${getComputedStyle(text).fontWeight} ${fontSize}px ${fontFamily}`;
      const metrics = lines.map(line => context.measureText(line));
      const verticalPadding = fontSize / 4;
      const maxHeight = box.height - 2 - verticalPadding * 2;
      const glyphHeight = Math.max(...metrics.map(metric => metric.actualBoundingBoxAscent))
        + Math.max(...metrics.map(metric => metric.actualBoundingBoxDescent));
      const fittingLineHeight = lines.length > 1
        ? (maxHeight - glyphHeight) / (lines.length - 1) : originalLineHeight;
      // Do not compress beyond the source spacing when extra JSON lines do
      // not fit; the existing size check will retain the original SVG instead.
      const lineHeight = Math.max(originalLineHeight,
        Math.min(fontSize * 1.5, fittingLineHeight));
      text.style.lineHeight = String(lineHeight / fontSize);
      text.replaceChildren(...lines.map((line, index) => {
        const span = document.createElementNS(svg.namespaceURI, "tspan");
        span.setAttribute("x", centerX);
        span.setAttribute("y", index * lineHeight);
        span.textContent = line;
        return span;
      }));
      const bounds = text.getBBox();
      const dx = centerX - bounds.x - bounds.width / 2;
      // SVG getBBox includes unused font ascent/descent space. Measure actual
      // glyph ink for vertical centering, using the same font and weight.
      const inkTop = Math.min(...metrics.map((metric, index) =>
        index * lineHeight - metric.actualBoundingBoxAscent));
      const inkBottom = Math.max(...metrics.map((metric, index) =>
        index * lineHeight + metric.actualBoundingBoxDescent));
      const inkHeight = inkBottom - inkTop;
      const dy = centerY - inkTop - inkHeight / 2;
      // Keep the existing symmetric 44px icon gutters and measured vertical
      // padding, in addition to the 2px stroke.
      // Explicit displayText lines keep their original size; complete titles
      // use the measured fitting pass above. Never truncate either source.
      trace({ phase: "size-check", measurements: {
        fontSize, originalLineHeight, lineHeight, verticalPadding,
        textWidth: bounds.width, textHeight: inkHeight,
        svgBBoxHeight: bounds.height, nodeWidth: box.width, nodeHeight: box.height,
        maxWidth, maxHeight
      } });
      const failures = [];
      if (!Number.isFinite(fontSize) || fontSize <= 0) failures.push(`字級無效：${fontSize}`);
      if (!Number.isFinite(bounds.width) || bounds.width <= 0) failures.push(`SVG 文字寬度無效：${bounds.width}`);
      if (!Number.isFinite(bounds.height) || bounds.height <= 0) failures.push(`SVG 文字高度無效：${bounds.height}`);
      if (!Number.isFinite(inkHeight) || inkHeight <= 0) failures.push(`實際字形高度無效：${inkHeight}`);
      if (!Number.isFinite(maxWidth) || maxWidth <= 0) failures.push(`可用寬度無效：${maxWidth}`);
      if (!Number.isFinite(maxHeight) || maxHeight <= 0) failures.push(`可用高度無效：${maxHeight}`);
      if (bounds.width > maxWidth) failures.push(`文字寬度 ${bounds.width.toFixed(2)}px > 安全區寬度 ${maxWidth.toFixed(2)}px`);
      if (inkHeight > maxHeight) failures.push(`文字高度 ${inkHeight.toFixed(2)}px > 安全區高度 ${maxHeight.toFixed(2)}px`);
      if (failures.length) throw new Error(`${nodeId} 尺寸檢查失敗：${failures.join("；")}。保留原 SVG。`);
      text.setAttribute("transform", `translate(${dx} ${dy})`);
      if (type === "text") {
        text.id = textId;
        original.replaceWith(text);
        if (backup) {
          backup.style.display = "none";
          backup.setAttribute("aria-hidden", "true");
        }
      } else {
        // Keep all original glyph paths for fallback; hide only this verified
        // text group after the replacement has passed every measurement.
        original.style.display = "none";
        original.setAttribute("aria-hidden", "true");
      }
      if (field === "title") {
        // Derived runtime lines only. Keep JSON title as the single editable
        // source instead of maintaining a second, stale displayText value.
        materials[nodeId].displayText = [...lines];
      }
      trace({ phase: "complete", result: "success", reason: null, fallback: false,
        displayText: [...lines],
        renderedNodeId: text.id,
        renderedText: [...text.children].map(span => span.textContent) });
      return true;
    } catch (error) {
      text?.remove();
      throw error;
    }
  }

  async function renderContractPoc(materials) {
    const targets = [
      { nodeId: "contract-002", groupId: "customer-review-contract", textId: "text159", shapeId: "rect153", type: "text" },
      { nodeId: "contract-004", groupId: "staff-send-contract", textId: "text177", shapeId: "rect171", type: "text", field: "title" },
      { nodeId: "contract-005", groupId: "customer-sign", textId: "text186", shapeId: "rect180", type: "text", field: "title" }
    ];
    const image = canvas.querySelector("img.contract-diagram");
    if (!image) throw new Error("找不到 Stage 05 SVG 底圖。");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let svg;
    try {
      traceContract({ phase: "svg-fetch", svgUrl: image.src });
      const response = await fetch(image.src, { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`SVG HTTP ${response.status}`);
      const source = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
      if (source.querySelector("parsererror") || source.documentElement.localName !== "svg") {
        throw new Error("SVG 格式錯誤");
      }
      svg = document.importNode(source.documentElement, true);
      svg.setAttribute("class", image.className);
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", image.alt);
      svg.style.visibility = "hidden";
      image.before(svg);
      let rendered = false;
      const failures = [];
      for (const target of targets) {
        try {
          rendered = await renderContractLabel(svg, materials, target) || rendered;
        } catch (error) {
          traceContract({ result: "failure", reason: error.message, fallback: true }, target.nodeId);
          failures.push(`${target.nodeId}：${error.message}`);
        }
      }
      if (rendered) {
        svg.style.removeProperty("visibility");
        image.replaceWith(svg);
      } else {
        svg.remove();
      }
      // An individual failure must not roll back another node's valid text.
      if (failures.length) throw new Error(failures.join("；"));
    } catch (error) {
      if (image.isConnected) svg?.remove();
      for (const target of targets) {
        if (!contractDebugNodes[target.nodeId]
          || contractDebugNodes[target.nodeId].result === "pending") {
          traceContract({ result: "failure", reason: error.message, fallback: true }, target.nodeId);
        }
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  // An SVG loaded as <img> cannot inherit the page's label styles. Inline a
  // runtime copy, keeping the source artwork and the HTML hit areas intact.
  async function renderSvgLabels(materials) {
    if (canvas.id === "contract-flowchart") return renderContractPoc(materials);
    const image = canvas.querySelector('img[src$=".svg"]');
    if (!image) return;
    const response = await fetch(image.src, { cache: "no-cache" });
    if (!response.ok) throw new Error(`SVG HTTP ${response.status}`);
    const source = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
    if (source.querySelector("parsererror") || source.documentElement.localName !== "svg") {
      throw new Error("SVG 格式錯誤");
    }
    const svg = document.importNode(source.documentElement, true);
    // Stages exported entirely as paths need no DOM or rendering change.
    if (!svg.querySelector("text")) return;
    svg.setAttribute("class", image.className);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", image.alt);
    image.replaceWith(svg);
    try {
      await document.fonts.ready;
      const nodes = [...canvas.querySelectorAll("[data-flow-node]")];
      for (const text of svg.querySelectorAll("text")) {
        const box = text.getBBox();
        const node = nodes.find(node => {
          const { left, top, width, height } = node.style;
          return box.x + box.width / 2 >= parseFloat(left)
            && box.x + box.width / 2 <= parseFloat(left) + parseFloat(width)
            && box.y + box.height / 2 >= parseFloat(top)
            && box.y + box.height / 2 <= parseFloat(top) + parseFloat(height);
        });
        if (!node || typeof materials[node.id]?.title !== "string") continue;
        const fontSize = getComputedStyle(text).fontSize;
        // Clear exported inline styles on both levels; keep the original size.
        text.removeAttribute("style");
        text.classList.add("flow-svg-label");
        text.style.fontSize = fontSize;
        text.removeAttribute("transform");
        text.replaceChildren();
        const x = parseFloat(node.style.left) + parseFloat(node.style.width) / 2;
        const y = parseFloat(node.style.top) + parseFloat(node.style.height) / 2;
        // Only Stage 05 material labels reserve symmetric space for the hint.
        const contractMaterial = canvas.classList.contains("contract-canvas")
          && typeof materials[node.id].url === "string" && materials[node.id].url.trim();
        let labelPadding = 16;
        if (contractMaterial) {
          node.classList.add("flow-node--linked");
          labelPadding = parseFloat(getComputedStyle(node).paddingRight) || 44;
          node.classList.remove("flow-node--linked");
        }
        const maxWidth = parseFloat(node.style.width) - labelPadding * 2;
        const lineHeight = parseFloat(fontSize) * (contractMaterial ? 1.25 : 1.5);
        const span = document.createElementNS(svg.namespaceURI, "tspan");
        text.append(span);
        const lines = [];
        let line = "";
        for (const character of materials[node.id].title) {
          span.textContent = line + character;
          if (line && (character === "\n" || span.getComputedTextLength() > maxWidth)) {
            lines.push(line);
            line = character === "\n" ? "" : character;
          } else {
            line += character;
          }
        }
        if (line) lines.push(line);
        text.replaceChildren(...lines.map((line, index) => {
          const tspan = document.createElementNS(svg.namespaceURI, "tspan");
          tspan.setAttribute("x", x);
          tspan.setAttribute("y", index * lineHeight);
          tspan.textContent = line;
          return tspan;
        }));
        // Center actual glyph bounds rather than relying on font baseline metrics.
        const bounds = text.getBBox();
        text.setAttribute("transform", `translate(0 ${y - bounds.y - bounds.height / 2})`);
      }
    } catch (error) {
      svg.replaceWith(image);
      throw error;
    }
  }

  async function loadMaterials() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const dataUrl = new URL(canvas.dataset.nodes, document.baseURI);
    let httpStatus = null;
    let contractRenderError = null;
    traceContract({ phase: "json-fetch", jsonUrl: dataUrl.href, cacheMode: "no-cache" });
    try {
      if (!["http:", "https:"].includes(dataUrl.protocol)) {
        throw new Error("請使用 HTTP Server 開啟頁面；file:// 無法可靠載入 JSON。");
      }
      const response = await fetch(dataUrl, {
        signal: controller.signal,
        cache: "no-cache"
      });
      httpStatus = response.status;
      traceContract({ jsonResponseUrl: response.url, httpStatus,
        responseHeaders: {
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          cacheControl: response.headers.get("cache-control")
        } });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}：${dataUrl.href}`);
      let materials;
      try {
        materials = await response.json();
      } catch (error) {
        if (error.name === "AbortError") throw error;
        throw new Error(`nodes.json 格式錯誤：${error.message}`);
      }
      if (!materials || typeof materials !== "object" || Array.isArray(materials)) {
        throw new Error("nodes.json 必須是以節點 ID 為 Key 的 JSON 物件。");
      }
      traceContract({ phase: "json-loaded", displayText: materials["contract-002"]?.displayText ?? null });
      const nodes = [...canvas.querySelectorAll("[data-flow-node]")];
      if (nodes.length !== nodeCount || new Set(nodes.map(node => node.id)).size !== nodeCount) {
        throw new Error(`HTML 節點數量或 ID 異常：找到 ${nodes.length} 個節點，預期 ${nodeCount} 個唯一 ID。`);
      }
      // Label failures must not prevent native links or zoom from working.
      try {
        await renderSvgLabels(materials);
      } catch (error) {
        if (canvas.id === "contract-flowchart") {
          contractRenderError = error.message;
        }
        console.error("SVG 文字樣式載入失敗，保留原圖：", error);
      }
      let linked = 0;
      let issues = 0;
      nodes.forEach(node => {
        const item = materials[node.id];
        if (!item || typeof item.title !== "string" || typeof item.url !== "string") {
          console.error("教材節點資料缺漏或格式錯誤：", { id: node.id, item, url: dataUrl.href });
          issues++;
          return;
        }
        if (!item.url.trim()) return;
        let url;
        try {
          url = new URL(item.url.trim(), dataUrl);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
        } catch (error) {
          console.error("教材網址無效：", { id: node.id, url: item.url, error });
          issues++;
          return;
        }
        // Real anchors provide native mouse, keyboard, context menu and copy-link behavior.
        const link = document.createElement("a");
        for (const attribute of node.attributes) link.setAttribute(attribute.name, attribute.value);
        link.classList.add("flow-node--linked");
        link.append(...node.childNodes);
        const icon = document.createElement("i");
        icon.className = "fa-solid fa-arrow-up-right-from-square flow-node-link-icon";
        icon.setAttribute("aria-hidden", "true");
        link.append(icon);
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `${item.title}（另開分頁）`);
        link.addEventListener("keydown", event => {
          if (event.key === " ") {
            event.preventDefault();
            link.click();
          }
        });
        node.replaceWith(link);
        linked++;
      });
      const unmatched = Object.keys(materials).filter(id => !nodes.some(node => node.id === id));
      if (unmatched.length) console.error("JSON 含有未對應的節點 ID：", unmatched);
      issues += unmatched.length;
      status.hidden = issues === 0 && !contractRenderError;
      status.textContent = issues
        ? `教材資料有 ${issues} 筆對應或網址問題，請檢查 nodes.json。`
        : `已載入 ${nodes.length} 個節點，${linked} 個提供教材連結。`;
      if (contractRenderError) {
        status.textContent += ` 部分動態文字未更新：${contractRenderError} 失敗節點保留原始 SVG 文字。`;
      }
    } catch (error) {
      traceContract({ result: "failure", reason: error.name === "AbortError"
        ? "JSON 載入逾時（15 秒）。" : error.message, fallback: true });
      console.error("教材資料載入失敗：", {
        url: dataUrl.href,
        pageUrl: window.location.href,
        httpStatus,
        error
      });
      const reason = error.name === "AbortError" ? "請求超過 15 秒，請檢查網路或伺服器。" : error.message;
      status.hidden = false;
      status.textContent = `教材資料載入失敗：${reason} 流程圖仍可閱讀與縮放；詳細原因請查看 Console。`;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  loadMaterials();
})();
