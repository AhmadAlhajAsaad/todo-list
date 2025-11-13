import { v4 as uuidv4 } from "uuid";

/** ===== Types & Storage Keys ===== */
type Filter = "all" | "active" | "completed";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

const STORAGE_KEY = "todo.tasks.v1";
const FILTER_KEY  = "todo.filter.v1";

/** ===== DOM Refs ===== */
const form = document.getElementById("container") as HTMLFormElement;
const input = document.getElementById("todo-input") as HTMLInputElement;
const list = document.getElementById("list") as HTMLUListElement;

const btnCompleteAll   = document.getElementById("complete-all") as HTMLButtonElement;
const btnIncompleteAll = document.getElementById("incomplete-all") as HTMLButtonElement;
const btnClearCompleted = document.getElementById("clear-completed") as HTMLButtonElement;

const filterAllBtn       = document.getElementById("filter-all") as HTMLButtonElement;
const filterActiveBtn    = document.getElementById("filter-active") as HTMLButtonElement;
const filterCompletedBtn = document.getElementById("filter-completed") as HTMLButtonElement;

const itemsLeft = document.getElementById("items-left") as HTMLSpanElement;

/** ===== App State ===== */
let tasks: Task[] = loadTasks();
let filter: Filter = loadFilter();

/** ===== Load/Save from localStorage ===== */
function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadFilter(): Filter {
  const f = localStorage.getItem(FILTER_KEY);
  if (f === "all" || f === "active" || f === "completed") return f;
  return "all";
}

function saveFilter() {
  localStorage.setItem(FILTER_KEY, filter);
}

/** ===== Helpers ===== */
function addTask(title: string) {
  const t = title.trim();
  if (!t) return;
  const task: Task = {
    id: uuidv4(),
    title: t,
    completed: false,
    createdAt: Date.now(),
  };
  tasks.unshift(task);
  saveTasks();
  render();
}

function deleteTask(id: string) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
}

function toggleTask(id: string, completed: boolean) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.completed = completed;
  saveTasks();
  render();
}

function renameTask(id: string, newTitle: string) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  const nt = newTitle.trim();
  if (nt) {
    t.title = nt;
    saveTasks();
    render();
  } else {
    deleteTask(id);
  }
}

function clearCompleted() {
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  render();
}

function setAll(completed: boolean) {
  let changed = false;
  for (const t of tasks) {
    if (t.completed !== completed) {
      t.completed = completed;
      changed = true;
    }
  }
  if (changed) {
    saveTasks();
    render();
  }
}

function getVisibleTasks(): Task[] {
  switch (filter) {
    case "active": return tasks.filter(t => !t.completed);
    case "completed": return tasks.filter(t => t.completed);
    default: return tasks;
  }
}

/** ===== Render ===== */
function render() {
  const visible = getVisibleTasks();
  list.innerHTML = "";

  for (const t of visible) {
    const li = document.createElement("li");
    li.className = "todo-item";
    li.dataset.id = t.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "toggle";
    checkbox.checked = t.completed;
    checkbox.setAttribute("aria-label", "Toggle task completion");

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = t.title;
    if (t.completed) title.classList.add("completed");

    // Inline rename on double click
    title.addEventListener("dblclick", () => {
      startInlineEdit(li, t);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "delete";
    delBtn.type = "button";
    delBtn.title = "Delete this task";
    delBtn.textContent = "Delete";

    li.appendChild(checkbox);
    li.appendChild(title);
    li.appendChild(delBtn);

    list.appendChild(li);
  }

  // Items left counter
  const left = tasks.filter(t => !t.completed).length;
  itemsLeft.textContent = String(left);

  // Highlight active filter
  for (const btn of [filterAllBtn, filterActiveBtn, filterCompletedBtn]) {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  }
}

function startInlineEdit(li: HTMLLIElement, task: Task) {
  const span = li.querySelector(".title") as HTMLSpanElement;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.value = task.title;
  input.setSelectionRange(task.title.length, task.title.length);

  li.replaceChild(input, span);
  input.focus();

  const commit = () => {
    renameTask(task.id, input.value);
  };
  const cancel = () => {
    render();
  };

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  });
  input.addEventListener("blur", commit);
}

/** ===== UI Events ===== */
// Add task
form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTask(input.value);
  input.value = "";
  input.focus();
});

// Delegated events inside list (toggle/delete)
list.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const li = target.closest("li") as HTMLLIElement | null;
  if (!li) return;
  const id = li.dataset.id!;
  if (target.classList.contains("delete")) {
    deleteTask(id);
  }
});

list.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.classList.contains("toggle")) {
    const li = el.closest("li") as HTMLLIElement | null;
    if (!li) return;
    toggleTask(li.dataset.id!, el.checked);
  }
});

// Bulk actions
btnCompleteAll.addEventListener("click", () => setAll(true));
btnIncompleteAll.addEventListener("click", () => setAll(false));
btnClearCompleted.addEventListener("click", () => clearCompleted());

// Filters
function setFilter(f: Filter) {
  filter = f;
  saveFilter();
  render();
}
filterAllBtn.addEventListener("click", () => setFilter("all"));
filterActiveBtn.addEventListener("click", () => setFilter("active"));
filterCompletedBtn.addEventListener("click", () => setFilter("completed"));

/** ===== Cross-tab Sync ===== */
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY && e.newValue) {
    try { tasks = JSON.parse(e.newValue) as Task[]; render(); } catch {}
  }
  if (e.key === FILTER_KEY && e.newValue) {
    if (e.newValue === "all" || e.newValue === "active" || e.newValue === "completed") {
      filter = e.newValue;
      render();
    }
  }
});

/** ===== Initial Render ===== */
render();