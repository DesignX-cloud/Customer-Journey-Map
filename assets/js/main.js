"use strict";

// The canvas uses the reference's 2400 × 1505 coordinates. Scale the whole layer
// once so HTML nodes, labels, swimlanes and SVG connections cannot drift apart.
(() => {
  const canvas = document.getElementById("consultation-flowchart");
  if (!canvas) return;
  const viewport = canvas.closest(".flowchart-container");
  const surface = canvas.parentElement;
  const status = document.getElementById("flowchart-status");
  const output = document.getElementById("flowchart-scale");
  const buttons = [...document.querySelectorAll("[data-flow-zoom]")];
  const width = 2400;
  const height = 1505;
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

  async function loadMaterials() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const dataUrl = new URL(canvas.dataset.nodes, document.baseURI);
    let httpStatus = null;
    try {
      if (!["http:", "https:"].includes(dataUrl.protocol)) {
        throw new Error("請使用 HTTP Server 開啟頁面；file:// 無法可靠載入 JSON。");
      }
      const response = await fetch(dataUrl, {
        signal: controller.signal,
        cache: "no-cache"
      });
      httpStatus = response.status;
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
      const nodes = [...canvas.querySelectorAll("[data-flow-node]")];
      if (nodes.length !== 22 || new Set(nodes.map(node => node.id)).size !== 22) {
        throw new Error(`HTML 節點數量或 ID 異常：找到 ${nodes.length} 個節點，預期 22 個唯一 ID。`);
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
      status.hidden = issues === 0;
      status.textContent = issues
        ? `教材資料有 ${issues} 筆對應或網址問題，請檢查 nodes.json。`
        : `已載入 ${nodes.length} 個節點，${linked} 個提供教材連結。`;
    } catch (error) {
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
