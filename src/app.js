import express from 'express';

// Returns an error message, or nothing when the body is fine.
function checkTask(body) {
  if (body === undefined) return 'Send a JSON body (Content-Type: application/json)';
  if (typeof body?.title !== 'string' || body.title.trim() === '') return 'title is required';
  if (body.done !== undefined && typeof body.done !== 'boolean') return 'done must be true or false';
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  // Tasks only live in this array, so they are gone when the server stops.
  const tasks = [];
  let nextId = 1;

  const findTask = (id) => tasks.find((task) => String(task.id) === id);

  app.get('/tasks', (req, res) => {
    res.json(tasks);
  });

  app.get('/tasks/:id', (req, res) => {
    const task = findTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.post('/tasks', (req, res) => {
    const error = checkTask(req.body);
    if (error) return res.status(400).json({ error });

    const task = { id: nextId++, title: req.body.title.trim(), done: req.body.done ?? false };
    tasks.push(task);
    res.status(201).json(task);
  });

  app.put('/tasks/:id', (req, res) => {
    const task = findTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const error = checkTask(req.body);
    if (error) return res.status(400).json({ error });

    task.title = req.body.title.trim();
    task.done = req.body.done ?? false;
    res.json(task);
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Express treats a function with four arguments as the error handler.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}
