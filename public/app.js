const STORAGE_KEY = "roamline.trip.v1";
const CHAT_KEY = "roamline.chat.v1";

function isoDate(offset = 0) {
  const date = new Date(Date.now() + offset * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function sampleTrip() {
  return {
    destination: "京都",
    startDate: isoDate(21),
    dayCount: 3,
    notes: "记得提前预约桂离宫。\nICOCA 卡检查余额。\n想买：一只清水烧小杯子。",
    days: [
      {
        title: "抵达与慢慢熟悉",
        stops: [
          { id: crypto.randomUUID(), time: "10:30", title: "京都站 · 放下行李", note: "从中央口出站，先去酒店寄存行李", walk: 8 },
          { id: crypto.randomUUID(), time: "12:00", title: "锦市场午餐", note: "从西侧开始逛，留一点胃口给豆乳甜甜圈", walk: 18 },
          { id: crypto.randomUUID(), time: "15:00", title: "鸭川散步", note: "沿河向北，天气好就在三条大桥附近坐一会儿", walk: 32 },
        ],
      },
      {
        title: "寺院与山间小路",
        stops: [
          { id: crypto.randomUUID(), time: "08:30", title: "银阁寺", note: "尽量赶在旅行团之前到达", walk: 12 },
          { id: crypto.randomUUID(), time: "10:30", title: "哲学之道", note: "慢慢走到南禅寺，沿途选一家咖啡店", walk: 45 },
          { id: crypto.randomUUID(), time: "14:00", title: "南禅寺与水路阁", note: "从三门一侧进入", walk: 20 },
        ],
      },
      { title: "留给偶遇的一天", stops: [] },
    ],
  };
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

let trip = readJson(STORAGE_KEY, sampleTrip());
let activeDay = 0;
let chatMessages = Array.isArray(readJson(CHAT_KEY, [])) ? readJson(CHAT_KEY, []) : [];

const elements = {
  destination: document.querySelector("#destination"),
  startDate: document.querySelector("#start-date"),
  dayCount: document.querySelector("#day-count"),
  stopCount: document.querySelector("#stop-count"),
  walkTotal: document.querySelector("#walk-total"),
  days: document.querySelector("#days"),
  activeDate: document.querySelector("#active-date"),
  dayTitle: document.querySelector("#day-title"),
  timeline: document.querySelector("#timeline"),
  empty: document.querySelector("#empty-state"),
  notes: document.querySelector("#trip-notes"),
  dialog: document.querySelector("#add-dialog"),
  addForm: document.querySelector("#add-form"),
  chatPanel: document.querySelector("#chat-panel"),
  scrim: document.querySelector("#scrim"),
  messages: document.querySelector("#messages"),
  chatForm: document.querySelector("#chat-form"),
  chatInput: document.querySelector("#chat-input"),
  sendChat: document.querySelector("#send-chat"),
  saveState: document.querySelector("#save-state"),
};

function saveTrip() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
  elements.saveState.textContent = "已保存到本机";
}

function dayDate(index) {
  const date = new Date(`${trip.startDate}T12:00:00`);
  date.setDate(date.getDate() + index);
  return date;
}

function dayLabel(index) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(dayDate(index));
}

function ensureDays() {
  const count = Math.max(1, Math.min(7, Number(trip.dayCount) || 1));
  trip.dayCount = count;
  while (trip.days.length < count) trip.days.push({ title: "自由探索", stops: [] });
  trip.days.length = count;
  if (activeDay >= count) activeDay = count - 1;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function render() {
  ensureDays();
  elements.destination.value = trip.destination;
  elements.startDate.value = trip.startDate;
  elements.dayCount.value = String(trip.dayCount);
  elements.notes.value = trip.notes;
  const allStops = trip.days.flatMap((day) => day.stops);
  elements.stopCount.textContent = String(allStops.length);
  elements.walkTotal.textContent = `${allStops.reduce((sum, stop) => sum + (Number(stop.walk) || 0), 0)} min`;
  elements.days.innerHTML = trip.days.map((_, index) => `
    <button class="day-tab ${index === activeDay ? "active" : ""}" type="button" role="tab" aria-selected="${index === activeDay}" data-day="${index}">
      <small>DAY ${index + 1}</small><b>${escapeHtml(dayLabel(index))}</b>
    </button>`).join("");
  const day = trip.days[activeDay];
  elements.activeDate.textContent = `DAY ${activeDay + 1} · ${dayLabel(activeDay)}`;
  elements.dayTitle.textContent = day.title;
  const stops = [...day.stops].sort((a, b) => a.time.localeCompare(b.time));
  elements.timeline.innerHTML = stops.map((stop) => `
    <article class="stop" data-id="${escapeHtml(stop.id)}">
      <time class="stop-time">${escapeHtml(stop.time)}</time><span class="stop-dot"></span>
      <div class="stop-body"><strong>${escapeHtml(stop.title)}</strong><p>${escapeHtml(stop.note || "留一点空白，现场再决定。")}</p>${stop.walk ? `<div class="stop-walk">步行约 ${Number(stop.walk)} 分钟</div>` : ""}</div>
      <div class="stop-actions"><button type="button" data-delete="${escapeHtml(stop.id)}" title="删除">×</button></div>
    </article>`).join("");
  elements.timeline.hidden = stops.length === 0;
  elements.empty.hidden = stops.length !== 0;
  saveTrip();
}

elements.days.addEventListener("click", (event) => {
  const button = event.target.closest("[data-day]");
  if (!button) return;
  activeDay = Number(button.dataset.day);
  render();
});

elements.timeline.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  trip.days[activeDay].stops = trip.days[activeDay].stops.filter((stop) => stop.id !== button.dataset.delete);
  render();
});

elements.destination.addEventListener("input", () => { trip.destination = elements.destination.value.trim() || "未命名目的地"; saveTrip(); });
elements.startDate.addEventListener("change", () => { trip.startDate = elements.startDate.value || isoDate(); render(); });
elements.dayCount.addEventListener("change", () => { trip.dayCount = Number(elements.dayCount.value); render(); });
elements.notes.addEventListener("input", () => { trip.notes = elements.notes.value; saveTrip(); });

function openAdd() {
  elements.addForm.reset();
  elements.addForm.elements.time.value = "10:00";
  elements.addForm.elements.walk.value = "15";
  elements.dialog.showModal();
}
document.querySelector("#open-add").addEventListener("click", openAdd);
document.querySelectorAll("[data-open-add]").forEach((button) => button.addEventListener("click", openAdd));
elements.addForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(elements.addForm);
  trip.days[activeDay].stops.push({
    id: crypto.randomUUID(),
    time: String(data.get("time")),
    title: String(data.get("title")).trim(),
    note: String(data.get("note")).trim(),
    walk: Math.max(0, Math.min(300, Number(data.get("walk")) || 0)),
  });
  elements.dialog.close();
  render();
});

document.querySelector("#reset-trip").addEventListener("click", () => {
  if (!window.confirm("恢复示例行程？你当前的本机行程会被替换。")) return;
  trip = sampleTrip(); activeDay = 0; render();
});

function openChat() {
  elements.chatPanel.classList.add("open");
  elements.chatPanel.setAttribute("aria-hidden", "false");
  elements.scrim.hidden = false;
  elements.chatInput.focus();
}
function closeChat() {
  elements.chatPanel.classList.remove("open");
  elements.chatPanel.setAttribute("aria-hidden", "true");
  elements.scrim.hidden = true;
}
document.querySelector("#chat-toggle").addEventListener("click", openChat);
document.querySelector("#close-chat").addEventListener("click", closeChat);
elements.scrim.addEventListener("click", closeChat);

function renderChat(pending = false) {
  const welcome = chatMessages.length === 0
    ? [{ role: "assistant", content: `你好，我是你的 ${trip.destination} 行程助手。可以帮你检查节奏、补充清单，或根据当前计划提出建议。` }]
    : chatMessages;
  elements.messages.innerHTML = welcome.map((message) => `<div class="message ${message.role === "user" ? "user" : ""}">${escapeHtml(message.content)}</div>`).join("") + (pending ? '<div class="message pending">正在整理你的行程…</div>' : "");
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function appContext() {
  return {
    destination: trip.destination,
    startDate: trip.startDate,
    notes: trip.notes,
    days: trip.days.map((day, index) => ({ day: index + 1, title: day.title, stops: day.stops.map(({ time, title, note, walk }) => ({ time, title, note, walk })) })),
  };
}

async function sendMessage(text) {
  chatMessages.push({ role: "user", content: text });
  localStorage.setItem(CHAT_KEY, JSON.stringify(chatMessages));
  renderChat(true);
  elements.sendChat.disabled = true;
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatMessages, context: appContext() }),
    });
    const payload = await response.json().catch(() => ({}));
    const reply = payload?.choices?.[0]?.message?.content;
    if (!response.ok || typeof reply !== "string") throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    chatMessages.push({ role: "assistant", content: reply });
    localStorage.setItem(CHAT_KEY, JSON.stringify(chatMessages));
  } catch (error) {
    chatMessages.push({ role: "assistant", content: `暂时无法连接 AI 助手：${error.message || "未知错误"}` });
  } finally {
    elements.sendChat.disabled = false;
    renderChat();
  }
}

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = elements.chatInput.value.trim();
  if (!text || elements.sendChat.disabled) return;
  elements.chatInput.value = "";
  sendMessage(text);
});
elements.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); elements.chatForm.requestSubmit(); }
});
document.querySelector("#quick-prompts").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  openChat(); sendMessage(button.textContent);
});
document.querySelector("#clear-chat").addEventListener("click", () => {
  chatMessages = []; localStorage.removeItem(CHAT_KEY); renderChat();
});

render();
renderChat();
