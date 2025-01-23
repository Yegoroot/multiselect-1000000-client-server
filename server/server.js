const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Хранение данных в памяти
const storage = {
  items: Array.from({ length: 1000000 }, (_, i) => ({
    id: i + 1,
    value: `Item ${i + 1}`
  })),
  selectedItems: new Set(),
  sortOrder: []
};

// Получение элементов с пагинацией и поиском
app.get('/api/items', (req, res) => {
  const { page = 1, search = '', selected = false } = req.query;
  const pageSize = 20;

  let filteredItems = storage.items;

  // Применяем поиск
  if (search) {
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
  res.json({ success: true });
});

// Обновление порядка сортировки
app.post('/api/sort-order', (req, res) => {
  const { order } = req.body;
  storage.sortOrder = order;
  res.json({ success: true });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 