const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Путь к файлу для хранения состояния
const STORAGE_FILE = path.join(__dirname, 'storage.json');

// Загрузка состояния из файла или создание нового
const loadStorage = () => {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
      return {
        items: Array.from({ length: 1000000 }, (_, i) => ({
          id: i + 1,
          value: `Item ${i + 1}`
        })),
        selectedItems: new Set(data.selectedItems || []),
        sortOrder: data.sortOrder || [],
        searchValue: data.searchValue || ''
      };
    }
  } catch (error) {
    console.error('Error loading storage:', error);
  }

  // Возвращаем начальное состояние, если файл не существует
  return {
    items: Array.from({ length: 1000000 }, (_, i) => ({
      id: i + 1,
      value: `Item ${i + 1}`
    })),
    selectedItems: new Set(),
    sortOrder: [],
    searchValue: ''
  };
};

// Сохранение состояния в файл
const saveStorage = () => {
  try {
    const data = {
      selectedItems: Array.from(storage.selectedItems),
      sortOrder: storage.sortOrder,
      searchValue: storage.searchValue
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving storage:', error);
  }
};

// Инициализация хранилища
const storage = loadStorage();

// Получение значения поиска
app.get('/api/search-value', (req, res) => {
  res.json({ searchValue: storage.searchValue });
});

// Сохранение значения поиска
app.post('/api/search-value', (req, res) => {
  const { searchValue } = req.body;
  storage.searchValue = searchValue;
  saveStorage(); // Сохраняем состояние в файл
  res.json({ success: true });
});

// Получение элементов с пагинацией и поиском
app.get('/api/items', (req, res) => {
  const { page = 1, search = '', selected = false } = req.query;
  const pageSize = 20;

  let filteredItems = storage.items;

  // Применяем поиск только если он не пустой
  if (search && search.trim() !== '') {
    filteredItems = filteredItems.filter(item =>
      item.value.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Если запрошены только выбранные элементы
  if (selected) {
    filteredItems = filteredItems.filter(item =>
      storage.selectedItems.has(item.id)
    );
  }

  // Применяем сортировку
  if (storage.sortOrder.length > 0) {
    const sortOrderMap = new Map(
      storage.sortOrder.map((id, index) => [id, index])
    );

    filteredItems = filteredItems.sort((a, b) => {
      const aIndex = sortOrderMap.has(a.id) ? sortOrderMap.get(a.id) : Infinity;
      const bIndex = sortOrderMap.has(b.id) ? sortOrderMap.get(b.id) : Infinity;
      return aIndex - bIndex;
    });
  }

  const start = (page - 1) * pageSize;
  const paginatedItems = filteredItems.slice(start, start + pageSize);

  res.json({
    items: paginatedItems,
    total: filteredItems.length,
    hasMore: start + pageSize < filteredItems.length
  });
});

// Обновление выбранных элементов
app.post('/api/selected', (req, res) => {
  const { items } = req.body;
  storage.selectedItems = new Set(items);
  saveStorage(); // Сохраняем состояние в файл
  res.json({ success: true });
});

// Обновление порядка сортировки
app.post('/api/sort-order', (req, res) => {
  const { order } = req.body;
  storage.sortOrder = order;
  saveStorage(); // Сохраняем состояние в файл
  res.json({ success: true });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 