const pages = [
  ["Home Dashboard", "⌂"],
  ["Tickets", "□"],
  ["Tasks", "✓"],
  ["Pipelines", "⟠"],
  ["AI Automation", "AI"],
  ["Environment Center", "⌁"],
  ["Dashboards", "▦"],
  ["Achievements", "★"],
  ["Users", "◉"],
  ["Settings", "⚙"]
];

const metrics = [
  ["Total tickets", "1,284", "+18% this month", "#5aa7ff"],
  ["Completed tickets", "972", "+124 closed", "#58d68d"],
  ["Open tasks", "186", "42 due this week", "#ffd166"],
  ["Tasks completed", "3,410", "+31% velocity", "#35d7d1"],
  ["Active pipelines", "42", "8 running now", "#a98bff"],
  ["AI tasks executed", "18.6k", "94% success", "#5aa7ff"],
  ["Team performance", "91%", "+7 points", "#58d68d"],
  ["SLA health", "98.4%", "Enterprise grade", "#35d7d1"]
];

const tickets = [
  ["Azure sync failure on nightly import", "Sarah Kim", "Mandla Nkosi", "In Progress", "Urgent", "Today"],
  ["Add finance dashboard audit trail", "Priya Shah", "Sarah Kim", "Open", "High", "May 4"],
  ["Resolve duplicated task notifications", "Kaedy Smith", "System", "Completed", "Medium", "Apr 29"],
  ["Customer portal SSO claim mismatch", "Liam Botha", "Priya Shah", "Overdue", "Urgent", "Apr 27"],
  ["Create onboarding automation template", "Sarah Kim", "Kaedy Smith", "Open", "Low", "May 8"],
  ["Refresh leaderboard scoring rules", "Mandla Nkosi", "Kaedy Smith", "In Progress", "Medium", "May 3"]
];

const tasks = [
  ["Finalize executive KPI board", "Personal tasks", 74, "May 2", "AI suggests splitting data QA into 3 checks."],
  ["Review overdue customer tickets", "Assigned tasks", 58, "Today", "AI found 12 tickets with aging risk."],
  ["Ship Azure to SQL pipeline", "Team tasks", 83, "May 6", "AI suggests approval step before production sync."],
  ["Publish badge campaign", "Team tasks", 39, "May 9", "AI suggests using top performer criteria."],
  ["Document AI permissions", "Assigned tasks", 66, "May 5", "AI recommends role-based tool scopes."]
];

const activities = [
  "AI created a weekly reporting task for Sarah.",
  "Azure to SQL pipeline completed 21,402 records.",
  "Priya closed ticket PK-1428 with customer validation.",
  "Leaderboard recalculated for the support team.",
  "New dashboard connected to Finance Warehouse."
];

const statusColors = { Open: "#5aa7ff", "In Progress": "#ffd166", Completed: "#58d68d", Overdue: "#ff6b7a" };
const priorityColors = { Low: "#95a0b8", Medium: "#35d7d1", High: "#ffd166", Urgent: "#ff6b7a" };

let currentPage = "Home Dashboard";
let ticketView = "cards";

const nav = document.querySelector("#nav");
const content = document.querySelector("#content");
const title = document.querySelector("#page-title");

function badge(text, color) {
  return `<span class="badge" style="--badge-color:${color}">${text}</span>`;
}

function card(title, body, extra = "") {
  return `<article class="card">${title ? `<div class="section-head"><h2>${title}</h2>${extra}</div>` : ""}${body}</article>`;
}

function renderNav() {
  nav.innerHTML = pages.map(([name, icon]) => `
    <button class="nav-item ${name === currentPage ? "active" : ""}" data-page="${name}">
      <span class="nav-icon">${icon}</span><span>${name}</span>
    </button>
  `).join("");
  nav.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    currentPage = button.dataset.page;
    ticketView = "cards";
    render();
  }));
}

function metricGrid() {
  return `<div class="grid stats-grid">${metrics.map(([label, value, trend, color]) => `
    <div class="metric-card" style="--accent:${color}">
      <span>${label}</span>
      <strong>${value}</strong>
      <div class="trend">${trend}</div>
    </div>
  `).join("")}</div>`;
}

function chartCard() {
  const bars = [72, 48, 88, 63, 92, 77, 96, 69, 84];
  return card("Team Performance", `
    <div class="chart">${bars.map((height, index) => `<div class="bar" style="height:${height}%; animation-delay:${index * 55}ms"></div>`).join("")}</div>
    <div class="row"><span class="muted">Current sprint completion</span><strong>91%</strong></div>
  `, badge("Live", "#35d7d1"));
}

function activityCard() {
  return card("Recent Activity", `<div class="activity-list">${activities.map((item, index) => `
    <div class="activity-item"><span>${item}</span><small class="muted">${index + 6}m ago</small></div>
  `).join("")}</div>`);
}

function home() {
  return `${metricGrid()}<div style="height:16px"></div><div class="grid two-col">${chartCard()}${activityCard()}</div>`;
}

function ticketsPage() {
  const table = `<div class="card"><table class="table"><thead><tr><th>Ticket</th><th>Assigned</th><th>Created by</th><th>Status</th><th>Priority</th><th>Due</th></tr></thead><tbody>${tickets.map(t => `
    <tr><td><strong>${t[0]}</strong></td><td>${t[1]}</td><td>${t[2]}</td><td>${badge(t[3], statusColors[t[3]])}</td><td>${badge(t[4], priorityColors[t[4]])}</td><td>${t[5]}</td></tr>
  `).join("")}</tbody></table></div>`;
  const cards = `<div class="grid ticket-grid">${tickets.map(t => `
    <article class="ticket-card">
      <div class="section-head"><h3>${t[0]}</h3><span class="muted">PK-${1400 + tickets.indexOf(t)}</span></div>
      <div class="ticket-meta">${badge(t[3], statusColors[t[3]])}${badge(t[4], priorityColors[t[4]])}</div>
      <div class="row"><span class="muted">Assigned</span><strong>${t[1]}</strong></div>
      <div class="row"><span class="muted">Due</span><strong>${t[5]}</strong></div>
    </article>
  `).join("")}</div>`;
  return `
    <div class="toolbar">
      <div class="segment"><button class="active">Assigned to me</button><button>Created by me</button><button>Completed tickets</button></div>
      <div><button class="ghost-button" id="toggle-ticket-view">${ticketView === "cards" ? "Table view" : "Card view"}</button> <button class="primary-button">Create ticket</button></div>
    </div>
    ${ticketView === "cards" ? cards : table}
  `;
}

function tasksPage() {
  return `<div class="grid two-col">
    ${card("Task Management", `<div class="rows">${tasks.map(t => `
      <div class="row">
        <div style="min-width:0; flex:1">
          <h3>${t[0]}</h3>
          <p class="muted">${t[1]} · Due ${t[3]}</p>
          <div class="progress"><span style="width:${t[2]}%"></span></div>
        </div>
        <strong>${t[2]}%</strong>
      </div>`).join("")}</div>`, `<button class="primary-button">New task</button>`)}
    ${card("Comments & AI Next Steps", `<div class="activity-list">${tasks.map(t => `<div class="activity-item"><span>${t[4]}</span></div>`).join("")}</div>`)}
  </div>`;
}

function pipelinesPage() {
  const blocks = ["Create task", "Send email", "Send notification", "Run SQL query", "Call API", "Azure action", "Database sync", "Approval step"];
  return `<div class="pipeline">
    ${card("Prebuilt Blocks", `<div class="block-palette">${blocks.map((b, i) => `<div class="block" draggable="true" data-block="${b}"><strong>${b}</strong><small class="muted">Automation block ${i + 1}</small></div>`).join("")}</div>`)}
    <div class="card canvas" id="pipeline-canvas">
      <div class="flow-node" style="left:48px;top:70px"><strong>Azure action</strong><br><small>Watch blob container</small></div>
      <div class="connector" style="left:258px;top:113px;width:132px"></div>
      <div class="flow-node" style="left:390px;top:70px"><strong>Run SQL query</strong><br><small>Normalize account records</small></div>
      <div class="connector" style="left:600px;top:113px;width:132px"></div>
      <div class="flow-node" style="left:732px;top:70px"><strong>Approval step</strong><br><small>Finance owner review</small></div>
      <div class="flow-node" style="left:246px;top:280px"><strong>Create task</strong><br><small>Assign exceptions</small></div>
      <div class="flow-node" style="left:586px;top:315px"><strong>Send notification</strong><br><small>Teams + email summary</small></div>
    </div>
  </div>`;
}

function aiPage() {
  return `<div class="assistant-panel">
    ${card("AI Execution Assistant", `
      <textarea class="prompt-box">Build a pipeline from Azure to SQL and create a weekly reporting task for Sarah</textarea>
      <div style="margin-top:14px"><button class="primary-button">Analyze & prepare actions</button></div>
      <div style="height:16px"></div>
      <h3>What it understood</h3>
      <p class="muted">Create a production-ready Azure ingestion workflow, connect it to SQL, and schedule recurring reporting ownership for Sarah Kim.</p>
      <div class="step-list">
        <div class="step"><div><strong>Inspect available Azure connections</strong><br><span class="muted">Find approved source and scope permissions.</span></div></div>
        <div class="step"><div><strong>Create database sync pipeline</strong><br><span class="muted">Map records, add validation, and write to SQL.</span></div></div>
        <div class="step"><div><strong>Create weekly task</strong><br><span class="muted">Assign Sarah, attach dashboard, and set Friday cadence.</span></div></div>
      </div>
    `)}
    ${card("Confirmation Panel", `
      <div class="activity-list">
        <div class="activity-item"><span>Actions require admin approval</span>${badge("Ready", "#ffd166")}</div>
        <div class="activity-item"><span>Estimated runtime</span><strong>2m 14s</strong></div>
        <div class="activity-item"><span>Impacted systems</span><strong>Azure, SQL, Tasks</strong></div>
      </div>
      <div style="height:14px"></div>
      <button class="primary-button">Confirm execution</button>
      <button class="ghost-button">Save draft</button>
      <div style="height:16px"></div>
      <h3>Completed Action Summary</h3>
      <p class="muted">Last run created 4 tasks, updated 2 pipelines, and generated 5 performance badges.</p>
    `)}
  </div>`;
}

function environmentPage() {
  const rows = ["customers", "tickets", "tasks", "pipelines", "badge_awards", "ai_execution_logs"];
  return `<div class="grid two-col">
    ${card("No-code Technical Workspace", `
      <div class="form-grid">
        <label>Database selector<select><option>Production Warehouse</option><option>Support Operations</option><option>Finance Lakehouse</option></select></label>
        <label>AI query helper<input value="Show me all tables in this database" /></label>
      </div>
      <div style="height:12px"></div>
      <textarea class="query-box">Show me all tables in this database</textarea>
      <div style="margin-top:12px"><button class="primary-button">Run command</button> <button class="ghost-button">Save query</button></div>
    `)}
    ${card("Saved Queries", `<div class="activity-list">${["Overdue tasks by owner", "Pipeline failures last 24 hours", "Top ticket closers", "AI command audit log"].map(q => `<div class="activity-item"><span>${q}</span><button class="ghost-button">Open</button></div>`).join("")}</div>`)}
    <div class="card" style="grid-column:1/-1"><div class="section-head"><h2>Results</h2>${badge("6 tables", "#35d7d1")}</div><table class="table"><thead><tr><th>Table</th><th>Rows</th><th>Owner</th><th>Last refreshed</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td><strong>${r}</strong></td><td>${(2400 + i * 842).toLocaleString()}</td><td>Ops Platform</td><td>${i + 2} min ago</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}

function dashboardsPage() {
  const dashboards = ["Executive Command Center", "Support SLA Monitor", "Pipeline Reliability", "AI Execution Audit", "Revenue Operations", "Team Performance"];
  return `<div class="toolbar"><div class="segment"><button class="active">All dashboards</button><button>Mine</button><button>Shared</button></div><button class="primary-button">Create dashboard</button></div>
  <div class="grid three-col">${dashboards.map((d, i) => `
    <article class="card">
      <div class="section-head"><h2>${d}</h2>${badge(i % 2 ? "SQL" : "Azure", i % 2 ? "#35d7d1" : "#5aa7ff")}</div>
      <p class="muted">Connected data source: ${i % 2 ? "Operations Warehouse" : "Azure Monitor"}</p>
      <div class="grid" style="grid-template-columns:repeat(3,1fr);margin:14px 0">${[94, 71, 88].map(v => `<div class="mini-card" style="padding:12px;text-align:center"><strong>${v}%</strong><br><span class="muted">KPI</span></div>`).join("")}</div>
      <div class="row"><span class="muted">Last updated</span><strong>${i + 3}m ago</strong></div>
      <div style="margin-top:14px"><button class="ghost-button">Open full dashboard</button></div>
    </article>`).join("")}</div>`;
}

function achievementsPage() {
  const badges = ["Welcome to the Team", "100 Tasks Completed", "300 Tasks Completed", "Top Performer", "Fast Responder", "Automation Builder"];
  return `<div class="grid two-col">
    ${card("Badge Collection", `<div class="grid three-col">${badges.map((b, i) => `<div class="card badge-card"><div class="medal">${i + 1}</div><strong>${b}</strong><span class="muted">${1200 - i * 83} pts</span></div>`).join("")}</div>`)}
    ${card("Leaderboard", `<div class="activity-list">${["Sarah Kim", "Priya Shah", "Mandla Nkosi", "Liam Botha", "Kaedy Smith"].map((u, i) => `<div class="activity-item"><span><strong>#${i + 1}</strong> ${u}</span><strong>${9820 - i * 640}</strong></div>`).join("")}</div><div style="height:16px"></div><h3>Achievement history</h3><p class="muted">Admins created 3 custom badges this week and awarded 48 achievements across the team.</p>`)}
  </div>`;
}

function usersPage() {
  return `<div class="grid three-col">${["Sarah Kim", "Priya Shah", "Mandla Nkosi", "Liam Botha", "Kaedy Smith", "Jordan Vale"].map((u, i) => `
    <article class="card"><div class="section-head"><h2>${u}</h2><div class="avatar">${u.split(" ").map(x => x[0]).join("")}</div></div><p class="muted">${i % 2 ? "Automation admin" : "Operations lead"}</p><div class="progress"><span style="width:${86 - i * 6}%"></span></div><p>${86 - i * 6}% weekly execution score</p></article>
  `).join("")}</div>`;
}

function settingsPage() {
  const groups = ["Company settings", "User roles", "Security settings", "API connections", "AI permissions", "Notification preferences"];
  return `<div class="grid two-col">${groups.map((g, i) => card(g, `
    <div class="settings-list">
      <div class="toggle-row"><span>${g} enabled</span><div class="toggle"></div></div>
      <div class="toggle-row"><span>Require approval for high-impact changes</span><div class="toggle"></div></div>
      <div class="toggle-row"><span>Audit logs retained for 365 days</span><strong>${i % 2 ? "Custom" : "Default"}</strong></div>
    </div>`)).join("")}</div>`;
}

function render() {
  title.textContent = currentPage;
  renderNav();
  const views = {
    "Home Dashboard": home,
    Tickets: ticketsPage,
    Tasks: tasksPage,
    Pipelines: pipelinesPage,
    "AI Automation": aiPage,
    "Environment Center": environmentPage,
    Dashboards: dashboardsPage,
    Achievements: achievementsPage,
    Users: usersPage,
    Settings: settingsPage
  };
  content.innerHTML = views[currentPage]();
  const toggle = document.querySelector("#toggle-ticket-view");
  if (toggle) toggle.addEventListener("click", () => {
    ticketView = ticketView === "cards" ? "table" : "cards";
    render();
  });
  setupPipelineDragDrop();
}

function setupPipelineDragDrop() {
  const canvas = document.querySelector("#pipeline-canvas");
  if (!canvas) return;
  document.querySelectorAll("[data-block]").forEach(block => {
    block.addEventListener("dragstart", event => {
      event.dataTransfer.setData("text/plain", block.dataset.block);
    });
  });
  canvas.addEventListener("dragover", event => event.preventDefault());
  canvas.addEventListener("drop", event => {
    event.preventDefault();
    const blockName = event.dataTransfer.getData("text/plain");
    if (!blockName) return;
    const rect = canvas.getBoundingClientRect();
    const node = document.createElement("div");
    node.className = "flow-node";
    node.style.left = `${Math.max(22, event.clientX - rect.left + canvas.scrollLeft - 105)}px`;
    node.style.top = `${Math.max(52, event.clientY - rect.top + canvas.scrollTop - 28)}px`;
    node.innerHTML = `<strong>${blockName}</strong><br><small>New step ready to configure</small>`;
    canvas.appendChild(node);
  });
}

render();
