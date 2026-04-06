const Database = require('better-sqlite3');

module.exports = function initDb(dbPath) {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      folder_path TEXT,
      github_url TEXT,
      status TEXT DEFAULT 'active',
      thumbnail_path TEXT,
      brief TEXT,
      brief_timestamp TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      status TEXT DEFAULT 'todo',
      deadline TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Migration: add deadline column if missing
  try {
    db.exec('ALTER TABLE tasks ADD COLUMN deadline TEXT');
  } catch (e) {
    // Column already exists
  }

  return {
    getAllProjects() {
      return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
    },

    getProject(id) {
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    },

    addProject(data) {
      const stmt = db.prepare(`
        INSERT INTO projects (name, folder_path, github_url, status, thumbnail_path)
        VALUES (@name, @folder_path, @github_url, @status, @thumbnail_path)
      `);
      const result = stmt.run({
        name: data.name,
        folder_path: data.folder_path || null,
        github_url: data.github_url || null,
        status: data.status || 'active',
        thumbnail_path: data.thumbnail_path || null,
      });
      return this.getProject(result.lastInsertRowid);
    },

    updateProject(id, data) {
      const fields = [];
      const values = {};
      for (const [key, value] of Object.entries(data)) {
        if (['name', 'folder_path', 'github_url', 'status', 'thumbnail_path', 'brief', 'brief_timestamp'].includes(key)) {
          fields.push(`${key} = @${key}`);
          values[key] = value;
        }
      }
      if (fields.length === 0) return;
      fields.push("updated_at = datetime('now')");
      values.id = id;
      db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = @id`).run(values);
    },

    deleteProject(id) {
      db.prepare('DELETE FROM tasks WHERE project_id = ?').run(id);
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    },

    saveBrief(projectId, brief) {
      db.prepare(`
        UPDATE projects SET brief = ?, brief_timestamp = datetime('now'), updated_at = datetime('now') WHERE id = ?
      `).run(brief, projectId);
    },

    getTasksByProject(projectId) {
      return db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC').all(projectId);
    },

    getTask(id) {
      return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    },

    getAllTasks() {
      return db.prepare(`
        SELECT tasks.*, projects.name as project_name
        FROM tasks
        JOIN projects ON tasks.project_id = projects.id
        ORDER BY tasks.deadline ASC NULLS LAST
      `).all();
    },

    addTask(projectId, text, status, deadline) {
      const result = db.prepare(`
        INSERT INTO tasks (project_id, text, status, deadline) VALUES (?, ?, ?, ?)
      `).run(projectId, text, status || 'todo', deadline || null);
      return this.getTask(result.lastInsertRowid);
    },

    updateTask(id, data) {
      const fields = [];
      const values = {};
      for (const [key, value] of Object.entries(data)) {
        if (['text', 'status', 'deadline'].includes(key)) {
          fields.push(`${key} = @${key}`);
          values[key] = value;
        }
      }
      if (fields.length === 0) return;
      fields.push("updated_at = datetime('now')");
      values.id = id;
      db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = @id`).run(values);
    },

    deleteTask(id) {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    },
  };
};
