// ============================================================
// JH GODOWN — Progress Bar Component
// ============================================================

class JHProgress {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      showDetail: true,
      autoHide: true,
      hideDelay: 2000,
      ...options,
    };
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="jh-progress-wrap" id="jh-prog-${this.container.id}" style="display:none">
        <div class="jh-progress-label">
          <span id="jh-prog-status-${this.container.id}">Preparing...</span>
          <span id="jh-prog-pct-${this.container.id}">0%</span>
        </div>
        <div class="jh-progress-bar-bg">
          <div class="jh-progress-bar-fill" id="jh-prog-fill-${this.container.id}"></div>
        </div>
        ${this.options.showDetail ? `<div class="jh-progress-detail" id="jh-prog-detail-${this.container.id}"></div>` : ""}
        <div class="jh-progress-steps" id="jh-prog-steps-${this.container.id}"></div>
      </div>
    `;
  }

  show(label = "Starting...") {
    const wrap = document.getElementById(`jh-prog-${this.container.id}`);
    if (wrap) {
      wrap.style.display = "block";
      wrap.classList.remove("jh-progress-error", "jh-progress-success");
    }
    this.update(0, label);
  }

  update(pct, status, detail = "") {
    const fill = document.getElementById(`jh-prog-fill-${this.container.id}`);
    const pctEl = document.getElementById(`jh-prog-pct-${this.container.id}`);
    const statEl = document.getElementById(`jh-prog-status-${this.container.id}`);
    const detEl = document.getElementById(`jh-prog-detail-${this.container.id}`);

    if (!fill) return;

    const clamped = Math.max(0, Math.min(100, pct));
    fill.style.width = clamped + "%";

    // Color gradient based on progress
    if (clamped < 30) {
      fill.style.background = "linear-gradient(90deg, var(--accent-blue), #00e5ff)";
    } else if (clamped < 70) {
      fill.style.background = "linear-gradient(90deg, #00e5ff, var(--accent-green))";
    } else if (clamped < 100) {
      fill.style.background = "linear-gradient(90deg, var(--accent-green), #00ff88)";
    } else {
      fill.style.background = "linear-gradient(90deg, var(--accent-green), #00ff88)";
    }

    if (pctEl) pctEl.textContent = clamped + "%";
    if (statEl) statEl.textContent = status;
    if (detEl) detEl.textContent = detail;
  }

  success(msg = "Done!") {
    this.update(100, msg, "");
    const wrap = document.getElementById(`jh-prog-${this.container.id}`);
    if (wrap) wrap.classList.add("jh-progress-success");
    if (this.options.autoHide) {
      setTimeout(() => this.hide(), this.options.hideDelay);
    }
  }

  error(msg) {
    const wrap = document.getElementById(`jh-prog-${this.container.id}`);
    if (wrap) {
      wrap.classList.add("jh-progress-error");
    }
    this.update(100, "Error: " + msg, "");
  }

  hide() {
    const wrap = document.getElementById(`jh-prog-${this.container.id}`);
    if (wrap) wrap.style.display = "none";
  }

  // Multi-step progress
  setSteps(steps) {
    const stepsEl = document.getElementById(`jh-prog-steps-${this.container.id}`);
    if (!stepsEl) return;
    stepsEl.innerHTML = steps.map((s, i) =>
      `<span class="jh-step" id="jh-step-${this.container.id}-${i}">${s}</span>`
    ).join(" → ");
  }

  setStepActive(index) {
    const steps = document.querySelectorAll(`#jh-prog-steps-${this.container.id} .jh-step`);
    steps.forEach((s, i) => {
      s.classList.toggle("jh-step-active", i === index);
      s.classList.toggle("jh-step-done", i < index);
    });
  }
}

// Legacy alias
const TotkaProgress = JHProgress;
