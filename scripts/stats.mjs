// Generates assets/stats.svg, assets/langs.svg, assets/activity.svg
// Runs in GitHub Actions (see .github/workflows/stats.yml). No dependencies.
import { writeFileSync, mkdirSync } from "node:fs";

const USER = process.env.GH_USER || "rahi-bulbul";
const TOKEN = process.env.GH_TOKEN;
const C = { bg: "#0F2A44", title: "#EEF3F8", text: "#8FA9C2", icon: "#F2B84B", border: "#8FA9C2", ring: "#F2B84B" };
const FONT = "font-family:'Segoe UI',Ubuntu,'Helvetica Neue',Sans-Serif";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const k = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));

async function gql(query, variables) {
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

async function getData() {
  const q = `query($login:String!,$after:String){ user(login:$login){
    pullRequests{totalCount} issues{totalCount}
    contributionsCollection{ totalCommitContributions restrictedContributionsCount
      contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } } }
    repositories(ownerAffiliations:OWNER,isFork:false,first:100,after:$after){
      pageInfo{hasNextPage endCursor}
      nodes{ stargazerCount languages(first:10,orderBy:{field:SIZE,direction:DESC}){ edges{ size node{name color} } } } } } }`;
  let after = null, repos = [], user;
  do {
    const d = await gql(q, { login: USER, after });
    user = d.user;
    repos = repos.concat(user.repositories.nodes);
    after = user.repositories.pageInfo.hasNextPage ? user.repositories.pageInfo.endCursor : null;
  } while (after);
  return { user, repos };
}

const icons = {
  star: "M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z",
  commit: "M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM0 7.25h4.5v1.5H0Zm11.5 0H16v1.5h-4.5Z",
  pr: "M4 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-.75 4.4h1.5v4.2h-1.5ZM4 10.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-.75-.4V5.5H8.5V7L6 4.75 8.5 2.5V4h3.5v6.1Z",
  issue: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
  cal: "M2 3h12v11H2Zm1.5 3v6.5h9V6ZM4.5 1h1.5v3H4.5Zm5.5 0h1.5v3H10Z",
};

function statsCard({ user, repos }) {
  const cc = user.contributionsCollection;
  const rows = [
    ["star", "Total stars", repos.reduce((s, r) => s + r.stargazerCount, 0)],
    ["commit", "Commits (last year)", cc.totalCommitContributions + cc.restrictedContributionsCount],
    ["pr", "Pull requests", user.pullRequests.totalCount],
    ["issue", "Issues", user.issues.totalCount],
    ["cal", "Contributions (last year)", cc.contributionCalendar.totalContributions],
  ];
  const W = 467, H = 195;
  const rowsSvg = rows.map(([ic, label, val], i) => `
    <g transform="translate(25,${60 + i * 25})">
      <svg width="16" height="16" viewBox="0 0 16 16" y="-12"><path fill="${C.icon}" d="${icons[ic]}"/></svg>
      <text x="25" style="${FONT};font-size:14px;font-weight:600" fill="${C.text}">${label}:</text>
      <text x="230" style="${FONT};font-size:14px;font-weight:700" fill="${C.title}">${k(val)}</text>
    </g>`).join("");
  const total = cc.contributionCalendar.totalContributions;
  const r = 40, circ = 2 * Math.PI * r, pct = Math.min(total / 1000, 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0.5" y="0.5" rx="4.5" width="${W - 1}" height="${H - 1}" fill="${C.bg}" stroke="${C.border}" stroke-opacity="0.6"/>
  <text x="25" y="35" style="${FONT};font-size:18px;font-weight:600" fill="${C.title}">GitHub activity</text>
  ${rowsSvg}
  <g transform="translate(${W - 85},${H / 2 + 5})">
    <circle r="${r}" fill="none" stroke="${C.ring}" stroke-opacity="0.2" stroke-width="6"/>
    <circle r="${r}" fill="none" stroke="${C.ring}" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}" transform="rotate(-90)"/>
    <text text-anchor="middle" y="6" style="${FONT};font-size:20px;font-weight:800" fill="${C.title}">${k(total)}</text>
    <text text-anchor="middle" y="${r + 22}" style="${FONT};font-size:11px" fill="${C.text}">last 12 months</text>
  </g>
</svg>`;
}

function langsCard({ repos }, count = 8) {
  const map = {};
  for (const r of repos) for (const e of r.languages.edges) {
    const m = (map[e.node.name] ||= { size: 0, color: e.node.color || C.text });
    m.size += e.size;
  }
  const all = Object.entries(map).sort((a, b) => b[1].size - a[1].size);
  const langs = all.slice(0, count);
  const sum = langs.reduce((s, [, v]) => s + v.size, 0) || 1;
  const W = 350, barW = W - 50, rowsN = Math.ceil(langs.length / 2), H = Math.max(195, 90 + rowsN * 25);
  let x = 0;
  const bar = langs.map(([, v]) => {
    const w = (v.size / sum) * barW, s = `<rect x="${x}" y="0" width="${w}" height="8" fill="${v.color}"/>`;
    x += w; return s;
  }).join("");
  const items = langs.map(([name, v], i) => {
    const cx = i % 2 === 0 ? 0 : 150, cy = Math.floor(i / 2) * 25;
    return `<g transform="translate(${cx},${cy})"><circle cx="5" cy="6" r="5" fill="${v.color}"/>
      <text x="15" y="10" style="${FONT};font-size:11px" fill="${C.text}">${esc(name)} ${((v.size / sum) * 100).toFixed(1)}%</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0.5" y="0.5" rx="4.5" width="${W - 1}" height="${H - 1}" fill="${C.bg}" stroke="${C.border}" stroke-opacity="0.6"/>
  <text x="25" y="35" style="${FONT};font-size:18px;font-weight:600" fill="${C.title}">Top languages</text>
  <clipPath id="b"><rect x="0" y="0" width="${barW}" height="8" rx="4"/></clipPath>
  <g transform="translate(25,55)" clip-path="url(#b)">${bar}</g>
  <g transform="translate(25,78)">${items}</g>
</svg>`;
}

function activityCard({ user }, days = 31) {
  const all = user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  const d = all.slice(-days);
  const W = 1000, H = 320, L = 60, R = 30, T = 60, B = 50;
  const max = Math.max(4, ...d.map((x) => x.contributionCount));
  const px = (i) => L + (i * (W - L - R)) / (d.length - 1);
  const py = (v) => H - B - (v / max) * (H - T - B);
  const pts = d.map((x, i) => [px(i), py(x.contributionCount)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const area = `${line}L${px(d.length - 1)},${H - B}L${L},${H - B}Z`;
  const ticks = 4, grid = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = Math.round((max * i) / ticks), y = py(v);
    return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="${C.text}" stroke-opacity="0.15"/>
      <text x="${L - 10}" y="${y + 4}" text-anchor="end" style="${FONT};font-size:12px" fill="${C.text}">${v}</text>`;
  }).join("");
  const xl = d.map((x, i) => (i % 3 === 0 || i === d.length - 1)
    ? `<text x="${px(i)}" y="${H - B + 22}" text-anchor="middle" style="${FONT};font-size:11px" fill="${C.text}">${+x.date.slice(8)}</text>` : "").join("");
  const dots = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${C.title}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.icon}" stop-opacity="0.45"/><stop offset="1" stop-color="${C.icon}" stop-opacity="0.02"/></linearGradient></defs>
  <rect width="${W}" height="${H}" rx="6" fill="${C.bg}"/>
  <text x="${W / 2}" y="35" text-anchor="middle" style="${FONT};font-size:20px;font-weight:600" fill="${C.title}">Contributions (last ${days} days)</text>
  ${grid}
  <path d="${area}" fill="url(#g)"/>
  <path d="${line}" fill="none" stroke="${C.icon}" stroke-width="2.5" stroke-linejoin="round"/>
  ${dots}${xl}
  <text x="${W / 2}" y="${H - 8}" text-anchor="middle" style="${FONT};font-size:12px" fill="${C.text}">Days</text>
</svg>`;
}

const data = process.env.MOCK ? JSON.parse(process.env.MOCK) : await getData();
mkdirSync("assets", { recursive: true });
writeFileSync("assets/stats.svg", statsCard(data));
writeFileSync("assets/langs.svg", langsCard(data));
writeFileSync("assets/activity.svg", activityCard(data));
console.log("Generated assets/stats.svg, assets/langs.svg, assets/activity.svg");
