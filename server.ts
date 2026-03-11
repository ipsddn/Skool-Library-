import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("library.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT UNIQUE,
    category TEXT,
    status TEXT DEFAULT 'available', -- 'available', 'issued'
    issued_to TEXT,
    issue_date TEXT
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/books", (req, res) => {
    const books = db.prepare("SELECT * FROM books").all();
    res.json(books);
  });

  app.post("/api/books", (req, res) => {
    const { title, author, isbn, category } = req.body;
    try {
      const info = db.prepare(
        "INSERT INTO books (title, author, isbn, category) VALUES (?, ?, ?, ?)"
      ).run(title, author, isbn, category);
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/books/issue", (req, res) => {
    const { bookId, studentName } = req.body;
    const issueDate = new Date().toISOString();
    try {
      const result = db.prepare(
        "UPDATE books SET status = 'issued', issued_to = ?, issue_date = ? WHERE id = ? AND status = 'available'"
      ).run(studentName, issueDate, bookId);
      
      if (result.changes === 0) {
        return res.status(400).json({ error: "Book not available or not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/books/return", (req, res) => {
    const { bookId } = req.body;
    try {
      const result = db.prepare(
        "UPDATE books SET status = 'available', issued_to = NULL, issue_date = NULL WHERE id = ?"
      ).run(bookId);
      
      if (result.changes === 0) {
        return res.status(400).json({ error: "Book not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/books/bulk", (req, res) => {
    const { books } = req.body;
    if (!Array.isArray(books)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    const insert = db.prepare(
      "INSERT INTO books (title, author, isbn, category) VALUES (?, ?, ?, ?)"
    );

    const insertMany = db.transaction((books) => {
      for (const book of books) {
        insert.run(book.title, book.author, book.isbn, book.category);
      }
    });

    try {
      insertMany(books);
      res.json({ success: true, count: books.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
