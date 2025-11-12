type Task = {
  id: string;
  name: string;
  completed: boolean;
  createdAt: Date;
};

const list = document.querySelector<HTMLUListElement>("#list")!;
const input = document.querySelector<HTMLInputElement>("#todo-input")!;
const form = document.getElementById("container") as HTMLFormElement;

const tasks: Task[] = loadTasks();
tasks.forEach(addListItem);

form.addEventListener("submit", (e) => {
  e.preventDefault();

  if (!input.value.trim()) return;

  const task: Task = {
    id: crypto.randomUUID(),
    name: input.value.trim(),
    completed: false,
    createdAt: new Date(),
  };

  tasks.push(task);
  saveTasks();
  addListItem(task);
  input.value = "";
});

function addListItem(task: Task) {
  const item = document.createElement("li");
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  const span = document.createElement("span");

  checkbox.type = "checkbox";
  checkbox.checked = task.completed;

  checkbox.addEventListener("change", () => {
    task.completed = checkbox.checked;
    saveTasks();
  });

  span.innerText = task.name;

  label.append(checkbox);
  label.append(span);
  item.append(label);
  list.append(item);
}

function saveTasks() {
  localStorage.setItem("TASKS", JSON.stringify(tasks));
}

function loadTasks(): Task[] {
  const taskJSON = localStorage.getItem("TASKS");
  if (taskJSON == null) return [];
    // Convert createdAt from text to Date
    const parsed = JSON.parse(taskJSON) as Array<
    Omit<Task, "createdAt"> & { createdAt: string }
  >;
  return parsed.map((t) => ({ ...t, createdAt: new Date(t.createdAt) }));
}

export {};