import React, { useState, useEffect, useRef } from 'react';
import { 
  Book, 
  Plus, 
  Search, 
  Download, 
  Upload,
  UserPlus, 
  RotateCcw, 
  Library,
  LayoutDashboard,
  List,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BookData {
  id: number;
  title: string;
  author: string;
  isbn: string;
  category: string;
  status: 'available' | 'issued';
  issued_to?: string;
  issue_date?: string;
}

export default function App() {
  const [books, setBooks] = useState<BookData[]>([]);
  const [view, setView] = useState<'dashboard' | 'inventory'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const res = await fetch('/api/books');
      const data = await res.json();
      setBooks(data);
    } catch (err) {
      showNotification('Failed to fetch books', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newBook = {
      title: formData.get('title'),
      author: formData.get('author'),
      isbn: formData.get('isbn'),
      category: formData.get('category'),
    };

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook),
      });
      if (res.ok) {
        showNotification('Book added successfully', 'success');
        setShowAddModal(false);
        fetchBooks();
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to add book', 'error');
      }
    } catch (err) {
      showNotification('Error connecting to server', 'error');
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const booksToImport = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const book: any = {};
        headers.forEach((header, index) => {
          if (['title', 'author', 'isbn', 'category'].includes(header)) {
            book[header] = values[index];
          }
        });
        return book;
      }).filter(b => b.title && b.author);

      if (booksToImport.length === 0) {
        showNotification('No valid books found in CSV', 'error');
        return;
      }

      try {
        const res = await fetch('/api/books/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ books: booksToImport }),
        });
        if (res.ok) {
          const result = await res.json();
          showNotification(`Successfully imported ${result.count} books`, 'success');
          fetchBooks();
        } else {
          showNotification('Failed to import books', 'error');
        }
      } catch (err) {
        showNotification('Error connecting to server', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleIssueBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studentName = formData.get('studentName');

    try {
      const res = await fetch('/api/books/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: showIssueModal, studentName }),
      });
      if (res.ok) {
        showNotification('Book issued successfully', 'success');
        setShowIssueModal(null);
        fetchBooks();
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to issue book', 'error');
      }
    } catch (err) {
      showNotification('Error connecting to server', 'error');
    }
  };

  const handleReturnBook = async (bookId: number) => {
    try {
      const res = await fetch('/api/books/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId }),
      });
      if (res.ok) {
        showNotification('Book returned successfully', 'success');
        fetchBooks();
      } else {
        showNotification('Failed to return book', 'error');
      }
    } catch (err) {
      showNotification('Error connecting to server', 'error');
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Title', 'Author', 'ISBN', 'Category', 'Status', 'Issued To', 'Issue Date'];
    const rows = books.map(b => [
      b.id,
      b.title,
      b.author,
      b.isbn,
      b.category,
      b.status,
      b.issued_to || '',
      b.issue_date || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `library_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.isbn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: books.length,
    available: books.filter(b => b.status === 'available').length,
    issued: books.filter(b => b.status === 'issued').length,
  };

  return (
    <div className="min-h-screen bg-white text-[#1A1A1A] font-sans">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#064e3b] border-r border-white/10 hidden lg:flex flex-col z-20 text-white">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#064e3b]">
            <Library size={24} />
          </div>
          <h1 className="font-bold text-xl tracking-tight">Skool</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button 
            onClick={() => setView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 text-white/60'}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            onClick={() => setView('inventory')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'inventory' ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 text-white/60'}`}
          >
            <List size={20} />
            Inventory
          </button>
        </nav>

        <div className="p-4 space-y-2 border-t border-white/10">
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImportCSV}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-medium text-sm"
          >
            <Upload size={16} />
            Import CSV
          </button>
          <button 
            onClick={exportCSV}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-[#064e3b] rounded-xl hover:bg-white/90 transition-all font-medium text-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8 pb-24 lg:pb-8">
        {/* School Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src="https://ais-pre-cdjl2tpza3lrouxxd45po3-660602569879.asia-southeast1.run.app/api/attachments/cdjl2tpza3lrouxxd45po3/input_file_0.png" 
            alt="School Logo" 
            className="h-32 md:h-48 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#064e3b]">
              {view === 'dashboard' ? 'Library Overview' : 'Book Inventory'}
            </h2>
            <p className="text-gray-500 text-sm">Welcome back, Librarian</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search books..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="p-2 bg-[#064e3b] text-white rounded-xl hover:bg-[#064e3b]/90 transition-all shadow-sm"
            >
              <Plus size={24} />
            </button>
          </div>
        </header>

        {/* Views */}
        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Total Books', value: stats.total, color: 'bg-blue-600', icon: Book },
                  { label: 'Available', value: stats.available, color: 'bg-[#064e3b]', icon: CheckCircle2 },
                  { label: 'Issued', value: stats.issued, color: 'bg-orange-600', icon: UserPlus },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white`}>
                        <stat.icon size={24} />
                      </div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Recent Activity / Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                  <h3 className="font-bold text-lg mb-6 text-[#064e3b]">Recent Additions</h3>
                  <div className="space-y-4">
                    {books.slice(-5).reverse().map((book) => (
                      <div key={book.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 group-hover:bg-[#064e3b]/10 group-hover:text-[#064e3b] transition-all">
                            <Book size={20} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{book.title}</p>
                            <p className="text-xs text-gray-500">{book.author}</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-300" />
                      </div>
                    ))}
                    {books.length === 0 && <p className="text-center text-gray-400 py-8">No books added yet.</p>}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                  <h3 className="font-bold text-lg mb-6 text-[#064e3b]">Currently Issued</h3>
                  <div className="space-y-4">
                    {books.filter(b => b.status === 'issued').slice(0, 5).map((book) => (
                      <div key={book.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600">
                            <UserPlus size={20} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{book.title}</p>
                            <p className="text-xs text-gray-500">Issued to: {book.issued_to}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleReturnBook(book.id)}
                          className="p-2 text-[#064e3b] hover:bg-[#064e3b]/10 rounded-lg transition-all"
                          title="Return Book"
                        >
                          <RotateCcw size={18} />
                        </button>
                      </div>
                    ))}
                    {books.filter(b => b.status === 'issued').length === 0 && (
                      <p className="text-center text-gray-400 py-8">No books currently issued.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-black/5">
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Book Details</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {filteredBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-gray-50/50 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                              <Book size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{book.title}</p>
                              <p className="text-xs text-gray-500">{book.author} • {book.isbn}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                            {book.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {book.status === 'available' ? (
                            <span className="flex items-center gap-1.5 text-[#064e3b] text-xs font-bold">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#064e3b]" />
                              Available
                            </span>
                          ) : (
                            <div>
                              <span className="flex items-center gap-1.5 text-orange-600 text-xs font-bold">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                Issued
                              </span>
                              <p className="text-[10px] text-gray-400 mt-1">To: {book.issued_to}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {book.status === 'available' ? (
                              <button 
                                onClick={() => setShowIssueModal(book.id)}
                                className="px-3 py-1.5 bg-[#064e3b] text-white rounded-lg text-xs font-bold hover:bg-[#064e3b]/90 transition-all"
                              >
                                Issue
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleReturnBook(book.id)}
                                className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-all"
                              >
                                Return
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredBooks.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                          No books found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#064e3b] border-t border-white/10 flex lg:hidden items-center justify-around p-4 z-20 text-white">
        <button 
          onClick={() => setView('dashboard')}
          className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-white' : 'text-white/50'}`}
        >
          <LayoutDashboard size={24} />
          <span className="text-[10px] font-bold uppercase">Home</span>
        </button>
        <button 
          onClick={() => setView('inventory')}
          className={`flex flex-col items-center gap-1 ${view === 'inventory' ? 'text-white' : 'text-white/50'}`}
        >
          <List size={24} />
          <span className="text-[10px] font-bold uppercase">Books</span>
        </button>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1 text-white/50"
        >
          <Upload size={24} />
          <span className="text-[10px] font-bold uppercase">Import</span>
        </button>
        <button 
          onClick={exportCSV}
          className="flex flex-col items-center gap-1 text-white/50"
        >
          <Download size={24} />
          <span className="text-[10px] font-bold uppercase">Export</span>
        </button>
      </nav>

      {/* Add Book Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute right-6 top-6 text-gray-400 hover:text-black transition-all"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-2xl font-bold mb-6 text-[#064e3b]">Add New Book</h3>
              <form onSubmit={handleAddBook} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Book Title</label>
                  <input 
                    name="title" 
                    required 
                    placeholder="e.g. The Great Gatsby"
                    className="w-full px-4 py-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Author</label>
                  <input 
                    name="author" 
                    required 
                    placeholder="e.g. F. Scott Fitzgerald"
                    className="w-full px-4 py-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">ISBN</label>
                    <input 
                      name="isbn" 
                      required 
                      placeholder="ISBN-13"
                      className="w-full px-4 py-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Category</label>
                    <select 
                      name="category" 
                      className="w-full px-4 py-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 appearance-none"
                    >
                      <option>Fiction</option>
                      <option>Non-Fiction</option>
                      <option>Science</option>
                      <option>History</option>
                      <option>Biography</option>
                    </select>
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-[#064e3b] text-white rounded-2xl font-bold text-lg hover:bg-[#064e3b]/90 transition-all shadow-lg shadow-[#064e3b]/20 mt-4"
                >
                  Add to Library
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Issue Book Modal */}
      <AnimatePresence>
        {showIssueModal !== null && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowIssueModal(null)}
                className="absolute right-6 top-6 text-gray-400 hover:text-black transition-all"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-2xl font-bold mb-2 text-[#064e3b]">Issue Book</h3>
              <p className="text-gray-500 text-sm mb-6">
                Issuing: <span className="font-bold text-black">{books.find(b => b.id === showIssueModal)?.title}</span>
              </p>
              
              <form onSubmit={handleIssueBook} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Student Name</label>
                  <input 
                    name="studentName" 
                    required 
                    autoFocus
                    placeholder="Enter student's full name"
                    className="w-full px-4 py-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-[#064e3b] text-white rounded-2xl font-bold text-lg hover:bg-[#064e3b]/90 transition-all shadow-lg mt-4"
                >
                  Confirm Issue
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-24 lg:bottom-8 right-4 lg:right-8 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 ${notification.type === 'success' ? 'bg-[#064e3b] text-white' : 'bg-red-500 text-white'}`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
