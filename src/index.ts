const uuidv4 = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

/** ===== Types & Storage Keys ===== */
type Filter = "all" | "active" | "completed";
type Priority = "low" | "medium" | "high";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  dueDate?: number; // timestamp
  priority: Priority;
  category: string;
  parentId?: string; // for subtasks
  timeSpent: number; // milliseconds
  isTracking: boolean;
  startedAt?: number; // when tracking started
}

const STORAGE_KEY = "todo.tasks.v2";
const FILTER_KEY = "todo.filter.v1";
const DARK_MODE_KEY = "todo.darkmode.v1";
const CATEGORIES_KEY = "todo.categories.v1";

/** ===== DOM Refs ===== */
const form = document.getElementById("container") as HTMLFormElement;
const input = document.getElementById("todo-input") as HTMLInputElement;
const list = document.getElementById("list") as HTMLUListElement;

const btnCompleteAll = document.getElementById("complete-all") as HTMLButtonElement;
const btnIncompleteAll = document.getElementById("incomplete-all") as HTMLButtonElement;
const btnClearCompleted = document.getElementById("clear-completed") as HTMLButtonElement;

const filterAllBtn = document.getElementById("filter-all") as HTMLButtonElement;
const filterActiveBtn = document.getElementById("filter-active") as HTMLButtonElement;
const filterCompletedBtn = document.getElementById(
  "filter-completed"
) as HTMLButtonElement;

const itemsLeft = document.getElementById("items-left") as HTMLSpanElement;

// New: search + export/import
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const exportBtn = document.getElementById("export-json") as HTMLButtonElement;
const importBtn = document.getElementById("import-json") as HTMLButtonElement;
const importFileInput = document.getElementById("import-file") as HTMLInputElement;

/** ===== App State ===== */
let tasks: Task[] = loadTasks();
let filter: Filter = loadFilter();
let searchQuery = "";
let draggedId: string | null = null;
let isDarkMode = loadDarkMode();
let categories: string[] = loadCategories();
let activeCategory = "all";

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

function loadDarkMode(): boolean {
  const saved = localStorage.getItem(DARK_MODE_KEY);
  if (saved === null) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return saved === "true";
}

function saveDarkMode() {
  localStorage.setItem(DARK_MODE_KEY, isDarkMode ? "true" : "false");
}

function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : ["Work", "Personal", "Shopping"];
  } catch {
    return ["Work", "Personal", "Shopping"];
  }
}

function saveCategories() {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

/** ===== Helpers ===== */
function addTask(title: string, dueDate?: number, priority: Priority = "medium", category: string = "Personal", parentId?: string) {
  const t = title.trim();
  if (!t) return;
  const task: Task = {
    id: uuidv4(),
    title: t,
    completed: false,
    createdAt: Date.now(),
    dueDate,
    priority,
    category: category || "Personal",
    parentId,
    timeSpent: 0,
    isTracking: false,
  };
  tasks.unshift(task);
  saveTasks();
  render();
}

function deleteTask(id: string) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  render();
}

function toggleTask(id: string, completed: boolean) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.completed = completed;
  saveTasks();
  render();
}

function renameTask(id: string, newTitle: string) {
  const t = tasks.find((x) => x.id === id);
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

function updateTaskPriority(id: string, priority: Priority) {
  const t = tasks.find((x) => x.id === id);
  if (t) {
    t.priority = priority;
    saveTasks();
    render();
  }
}

function updateTaskCategory(id: string, category: string) {
  const t = tasks.find((x) => x.id === id);
  if (t) {
    t.category = category;
    saveTasks();
    render();
  }
}

function updateTaskDueDate(id: string, dueDate?: number) {
  const t = tasks.find((x) => x.id === id);
  if (t) {
    t.dueDate = dueDate;
    saveTasks();
    render();
  }
}

function toggleTimeTracking(id: string) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  
  if (t.isTracking) {
    // Stop tracking
    if (t.startedAt) {
      t.timeSpent += Date.now() - t.startedAt;
    }
    t.isTracking = false;
    t.startedAt = undefined;
  } else {
    // Start tracking
    t.isTracking = true;
    t.startedAt = Date.now();
  }
  saveTasks();
  render();
}

function addSubtask(parentId: string, title: string) {
  const t = title.trim();
  if (!t) return;
  const parent = tasks.find((x) => x.id === parentId);
  if (!parent) return;
  
  const task: Task = {
    id: uuidv4(),
    title: t,
    completed: false,
    createdAt: Date.now(),
    priority: "medium",
    category: parent.category,
    parentId,
    timeSpent: 0,
    isTracking: false,
  };
  tasks.push(task);
  saveTasks();
  render();
}

function getSubtasks(parentId: string): Task[] {
  return tasks.filter((t) => t.parentId === parentId);
}

function addCategory(name: string) {
  const n = name.trim();
  if (n && !categories.includes(n)) {
    categories.push(n);
    saveCategories();
  }
}

function clearCompleted() {
  tasks = tasks.filter((t) => !t.completed);
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

/** Filter + Search combined */
function getVisibleTasks(): Task[] {
  let filtered = tasks.filter(t => !t.parentId); // Only top-level tasks

  switch (filter) {
    case "active":
      filtered = filtered.filter((t) => !t.completed);
      break;
    case "completed":
      filtered = filtered.filter((t) => t.completed);
      break;
    case "all":
    default:
      break;
  }

  // Filter by category
  if (activeCategory !== "all") {
    filtered = filtered.filter((t) => t.category === activeCategory);
  }

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((t) =>
      t.title.toLowerCase().includes(q)
    );
  }

  // Sort by priority (high > medium > low) and then by due date
  filtered.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority];
    const bPriority = priorityOrder[b.priority];
    
    if (aPriority !== bPriority) return bPriority - aPriority;
    
    // Then sort by due date
    const aDue = a.dueDate || Infinity;
    const bDue = b.dueDate || Infinity;
    return aDue - bDue;
  });

  return filtered;
}

/** Drag & Drop reordering (reorder in array) */
function reorderTasks(sourceId: string, targetId: string) {
  if (sourceId === targetId) return;

  const sourceTask = tasks.find((t) => t.id === sourceId);
  const targetTask = tasks.find((t) => t.id === targetId);
  if (!sourceTask || !targetTask) return;

  const sourceIndex = tasks.indexOf(sourceTask);
  let targetIndex = tasks.indexOf(targetTask);
  if (sourceIndex < 0 || targetIndex < 0) return;

  // Remove source
  tasks.splice(sourceIndex, 1);
  // After removal, recalculate target index
  targetIndex = tasks.indexOf(targetTask);
  if (targetIndex < 0) {
    tasks.push(sourceTask);
  } else {
    tasks.splice(targetIndex, 0, sourceTask);
  }

  saveTasks();
  render();
}

/** Utility to format time */
function formatTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** ===== Render ===== */
function render() {
  const visible = getVisibleTasks();
  list.innerHTML = "";

  for (const t of visible) {
    const li = createTaskElement(t);
    list.appendChild(li);
    
    // Add subtasks if any
    const subtasks = getSubtasks(t.id);
    for (const sub of subtasks) {
      const subLi = createTaskElement(sub, true);
      list.appendChild(subLi);
    }
  }

  // Items left counter
  const left = tasks.filter((t) => !t.completed && !t.parentId).length;
  itemsLeft.textContent = String(left);

  // Highlight active filter
  for (const btn of [filterAllBtn, filterActiveBtn, filterCompletedBtn]) {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  }
}

function createTaskElement(t: Task, isSubtask = false): HTMLLIElement {
  const li = document.createElement("li");
  li.className = isSubtask ? "todo-item subtask" : "todo-item";
  li.dataset.id = t.id;
  li.draggable = true;

  // Checkbox
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "toggle";
  checkbox.checked = t.completed;
  checkbox.setAttribute("aria-label", "Toggle task completion");

  // Priority badge
  const priorityBadge = document.createElement("span");
  priorityBadge.className = `priority-badge priority-${t.priority}`;
  priorityBadge.title = `Priority: ${t.priority}`;
  
  // Title
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = t.title;
  if (t.completed) title.classList.add("completed");

  title.addEventListener("dblclick", () => {
    startInlineEdit(li, t);
  });

  // Task info container
  const infoContainer = document.createElement("div");
  infoContainer.className = "task-info";

  // Category badge
  const categoryBadge = document.createElement("span");
  categoryBadge.className = "category-badge";
  categoryBadge.textContent = t.category;
  infoContainer.appendChild(categoryBadge);

  // Due date badge
  if (t.dueDate) {
    const dueBadge = document.createElement("span");
    dueBadge.className = "due-badge";
    const isOverdue = t.dueDate < Date.now() && !t.completed;
    if (isOverdue) dueBadge.classList.add("overdue");
    dueBadge.textContent = formatDate(t.dueDate);
    infoContainer.appendChild(dueBadge);
  }

  // Time tracking display
  if (t.timeSpent > 0 || t.isTracking) {
    const timeBadge = document.createElement("span");
    timeBadge.className = "time-badge";
    if (t.isTracking) {
      timeBadge.classList.add("tracking");
      // Update time display every second
      setInterval(() => {
        const current = t.timeSpent + (t.isTracking && t.startedAt ? Date.now() - t.startedAt : 0);
        timeBadge.textContent = formatTime(current);
      }, 1000);
    }
    timeBadge.textContent = formatTime(t.timeSpent);
    infoContainer.appendChild(timeBadge);
  }

  // Action buttons container
  const actionsContainer = document.createElement("div");
  actionsContainer.className = "task-actions";

  // Time tracking button
  const trackBtn = document.createElement("button");
  trackBtn.className = `track-btn ${t.isTracking ? "tracking" : ""}`;
  trackBtn.type = "button";
  trackBtn.title = t.isTracking ? "Stop tracking" : "Start tracking";
  trackBtn.textContent = t.isTracking ? "⏸" : "⏱";
  trackBtn.addEventListener("click", () => toggleTimeTracking(t.id));
  actionsContainer.appendChild(trackBtn);

  // Add subtask button (only for parent tasks)
  if (!t.parentId) {
    const addSubBtn = document.createElement("button");
    addSubBtn.className = "add-sub-btn";
    addSubBtn.type = "button";
    addSubBtn.title = "Add subtask";
    addSubBtn.textContent = "+";
    addSubBtn.addEventListener("click", () => {
      const title = prompt("Subtask title:");
      if (title) addSubtask(t.id, title);
    });
    actionsContainer.appendChild(addSubBtn);
  }

  // Delete button
  const delBtn = document.createElement("button");
  delBtn.className = "delete";
  delBtn.type = "button";
  delBtn.title = "Delete this task";
  delBtn.textContent = "Delete";
  actionsContainer.appendChild(delBtn);

  // Edit button
  const editBtn = document.createElement("button");
  editBtn.className = "edit-btn";
  editBtn.type = "button";
  editBtn.title = "Edit task";
  editBtn.textContent = "✏";
  editBtn.addEventListener("click", () => openTaskEditor(t));
  actionsContainer.appendChild(editBtn);

  li.appendChild(checkbox);
  li.appendChild(priorityBadge);
  li.appendChild(title);
  li.appendChild(infoContainer);
  li.appendChild(actionsContainer);

  return li;
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

function openTaskEditor(task: Task) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  
  const title = document.createElement("h2");
  title.textContent = "Edit Task";
  
  const form = document.createElement("div");
  form.className = "edit-form";
  
  // Title field
  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Title:";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = task.title;
  form.appendChild(titleLabel);
  form.appendChild(titleInput);
  
  // Priority field
  const priorityLabel = document.createElement("label");
  priorityLabel.textContent = "Priority:";
  const prioritySelect = document.createElement("select");
  const priorities: Priority[] = ["low", "medium", "high"];
  for (const p of priorities) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p.charAt(0).toUpperCase() + p.slice(1);
    opt.selected = task.priority === p;
    prioritySelect.appendChild(opt);
  }
  form.appendChild(priorityLabel);
  form.appendChild(prioritySelect);
  
  // Category field
  const categoryLabel = document.createElement("label");
  categoryLabel.textContent = "Category:";
  const categorySelect = document.createElement("select");
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    opt.selected = task.category === cat;
    categorySelect.appendChild(opt);
  }
  form.appendChild(categoryLabel);
  form.appendChild(categorySelect);
  
  // Due date field
  const dueDateLabel = document.createElement("label");
  dueDateLabel.textContent = "Due Date:";
  const dueDateInput = document.createElement("input");
  dueDateInput.type = "date";
  if (task.dueDate) {
    dueDateInput.valueAsDate = new Date(task.dueDate);
  }
  form.appendChild(dueDateLabel);
  form.appendChild(dueDateInput);
  
  // Buttons
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "modal-buttons";
  
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => {
    renameTask(task.id, titleInput.value);
    updateTaskPriority(task.id, prioritySelect.value as Priority);
    updateTaskCategory(task.id, categorySelect.value);
    const dueDate = dueDateInput.valueAsDate ? dueDateInput.valueAsDate.getTime() : undefined;
    updateTaskDueDate(task.id, dueDate);
    document.body.removeChild(modal);
  });
  
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(modal);
  });
  
  buttonContainer.appendChild(saveBtn);
  buttonContainer.appendChild(cancelBtn);
  form.appendChild(buttonContainer);
  
  modalContent.appendChild(title);
  modalContent.appendChild(form);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
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

/** Search */
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  render();
});

/** Bulk actions */
btnCompleteAll.addEventListener("click", () => setAll(true));
btnIncompleteAll.addEventListener("click", () => setAll(false));
btnClearCompleted.addEventListener("click", () => clearCompleted());

/** Filters */
function setFilter(f: Filter) {
  filter = f;
  saveFilter();
  render();
}
filterAllBtn.addEventListener("click", () => setFilter("all"));
filterActiveBtn.addEventListener("click", () => setFilter("active"));
filterCompletedBtn.addEventListener("click", () => setFilter("completed"));

/** Drag & Drop events on the list */
function resetDragVisualState() {
  draggedId = null;
  list.querySelectorAll(".todo-item").forEach((el) => {
    el.classList.remove("dragging", "drag-over");
  });
}

list.addEventListener("dragstart", (e) => {
  const li = (e.target as HTMLElement).closest("li") as HTMLLIElement | null;
  if (!li) return;
  draggedId = li.dataset.id || null;
  li.classList.add("dragging");
  if (e.dataTransfer && draggedId) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedId);
  }
});

list.addEventListener("dragover", (e) => {
  e.preventDefault();
  const li = (e.target as HTMLElement).closest("li") as HTMLLIElement | null;
  if (!li || !draggedId) return;
  list.querySelectorAll(".todo-item").forEach((el) =>
    el.classList.remove("drag-over")
  );
  li.classList.add("drag-over");
});

list.addEventListener("dragleave", (e) => {
  const li = (e.target as HTMLElement).closest("li") as HTMLLIElement | null;
  if (!li) return;
  li.classList.remove("drag-over");
});

list.addEventListener("drop", (e) => {
  e.preventDefault();
  const li = (e.target as HTMLElement).closest("li") as HTMLLIElement | null;
  if (!li || !draggedId) {
    resetDragVisualState();
    return;
  }
  const targetId = li.dataset.id;
  if (!targetId) {
    resetDragVisualState();
    return;
  }
  reorderTasks(draggedId, targetId);
  resetDragVisualState();
});

list.addEventListener("dragend", () => {
  resetDragVisualState();
});

/** Export / Import JSON */
exportBtn.addEventListener("click", () => {
  const dataStr = JSON.stringify(tasks, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `todo-tasks-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", () => {
  const file = importFileInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result as string);
      if (!Array.isArray(parsed)) {
        alert("Invalid JSON format.");
        return;
      }

      const imported: Task[] = parsed
        .map((item: any) => ({
          id: typeof item.id === "string" ? item.id : uuidv4(),
          title: String(item.title ?? "").trim(),
          completed: Boolean(item.completed),
          createdAt:
            typeof item.createdAt === "number"
              ? item.createdAt
              : Date.now(),
        }))
        .filter((t: Task) => t.title.length > 0);

      tasks = imported;
      saveTasks();
      render();
    } catch {
      alert("Could not read JSON file.");
    } finally {
      importFileInput.value = "";
    }
  };
  reader.readAsText(file);
});

/** Cross-tab Sync */
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY && e.newValue) {
    try {
      tasks = JSON.parse(e.newValue) as Task[];
      render();
    } catch {
      // ignore
    }
  }
  if (e.key === FILTER_KEY && e.newValue) {
    if (
      e.newValue === "all" ||
      e.newValue === "active" ||
      e.newValue === "completed"
    ) {
      filter = e.newValue;
      render();
    }
  }
});

/** Initial Render */
render();