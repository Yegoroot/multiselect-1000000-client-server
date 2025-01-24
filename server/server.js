const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Путь к файлу для хранения состояния
const STORAGE_FILE = path.join(__dirname, 'storage.json');

// Проверяем существование и валидность файла
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const content = fs.readFileSync(STORAGE_FILE, 'utf8');
    if (!content || content.trim() === '') {
      // Если файл пустой, создаем его заново
      console.log('Storage file is empty, creating new one...');
      fs.writeFileSync(STORAGE_FILE, JSON.stringify({
        selectedItems: [],
        sortOrder: [],
        searchValue: '',
        selectedItemsData: []
      }, null, 2));
    } else {
      // Проверяем валидность JSON
      try {
        JSON.parse(content);
      } catch (e) {
        console.log('Invalid JSON in storage file, creating new one...');
        fs.writeFileSync(STORAGE_FILE, JSON.stringify({
          selectedItems: [],
          sortOrder: [],
          searchValue: '',
          selectedItemsData: []
        }, null, 2));
      }
    }
  } else {
    // Создаем новый файл если он не существует
    console.log('Storage file does not exist, creating new one...');
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({
      selectedItems: [],
      sortOrder: [],
      searchValue: '',
      selectedItemsData: []
    }, null, 2));
  }
} catch (error) {
  console.error('Error initializing storage file:', error);
}

// Сохранение состояния в файл
const saveStorage = () => {
  try {
    const selectedItemsArray = Array.from(storage.selectedItems);
    console.log('Saving to file. Selected IDs:', selectedItemsArray);
    console.log('Selected items data:', storage.selectedItemsData);

    const data = {
      selectedItems: selectedItemsArray,
      sortOrder: storage.sortOrder,
      searchValue: storage.searchValue,
      selectedItemsData: storage.selectedItemsData
    };

    // Добавим синхронную запись с проверкой
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));

    // Проверим, что данные записались
    const savedData = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    console.log('Verification - saved data:', savedData);

    if (savedData.selectedItems.length !== selectedItemsArray.length) {
      console.error('Data verification failed - lengths don\'t match');
    } else {
      console.log('File saved and verified successfully');
    }
  } catch (error) {
    console.error('Error saving storage:', error);
    // Попробуем создать файл заново при ошибке
    try {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify({
        selectedItems: selectedItemsArray,
        sortOrder: storage.sortOrder,
        searchValue: storage.searchValue,
        selectedItemsData: storage.selectedItemsData
      }, null, 2), { flag: 'w' });
      console.log('File recreated successfully');
    } catch (retryError) {
      console.error('Error recreating file:', retryError);
    }
  }
};

// Загрузка состояния из файла или создание нового
const loadStorage = () => {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      console.log('Loading from file...');
      const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
      console.log('Loaded data:', data);

      const selectedIds = new Set(data.selectedItems?.map(id => Number(id)) || []);
      console.log('Converted selected IDs:', Array.from(selectedIds));

      const selectedItemsData = (data.selectedItemsData || []).map(item => ({
        ...item,
        id: Number(item.id)
      }));
      console.log('Converted selected items data:', selectedItemsData);

      return {
        items: Array.from({ length: 1000000 }, (_, i) => ({
          id: i + 1,
          value: `Item ${i + 1}`
        })),
        selectedItems: selectedIds,
        sortOrder: (data.sortOrder || []).map(id => Number(id)),
        searchValue: data.searchValue || '',
        selectedItemsData: selectedItemsData
      };
    }
  } catch (error) {
    console.error('Error loading storage:', error);
  }

  console.log('Creating new storage...');
  return {
    items: Array.from({ length: 1000000 }, (_, i) => ({
      id: i + 1,
      value: `Item ${i + 1}`
    })),
    selectedItems: new Set(),
    sortOrder: [],
    searchValue: '',
    selectedItemsData: []
  };
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

  // Если запрошены выбранные элементы
  if (selected === 'true') {
    console.log('Returning selected items...');
    console.log('Current selected IDs:', Array.from(storage.selectedItems));
    console.log('Current selected items data:', storage.selectedItemsData);

    let selectedItems = storage.selectedItemsData;

    // Применяем сортировку
    if (storage.sortOrder.length > 0) {
      const sortOrderMap = new Map(
        storage.sortOrder.map((id, index) => [id, index])
      );

      selectedItems = [...selectedItems].sort((a, b) => {
        const aIndex = sortOrderMap.has(a.id) ? sortOrderMap.get(a.id) : Infinity;
        const bIndex = sortOrderMap.has(b.id) ? sortOrderMap.get(b.id) : Infinity;
        return aIndex - bIndex;
      });
    }

    return res.json({
      items: selectedItems,
      total: selectedItems.length,
      hasMore: false
    });
  }

  // Создаем копию массива и применяем фильтры
  let allFilteredItems = [...storage.items];

  // Применяем поиск
  if (search) {
    const searchLower = search.toLowerCase();
    allFilteredItems = allFilteredItems.filter(item =>
      item.value.toLowerCase().includes(searchLower)
    );
  }

  // Исключаем уже выбранные элементы
  allFilteredItems = allFilteredItems.filter(item => !storage.selectedItems.has(item.id));

  // Применяем пагинацию
  const start = (parseInt(page) - 1) * pageSize;
  const end = start + pageSize;
  const paginatedItems = allFilteredItems.slice(start, end);

  console.log(`Pagination: page=${page}, start=${start}, end=${end}, total=${allFilteredItems.length}`);

  res.json({
    items: paginatedItems,
    total: allFilteredItems.length,
    hasMore: end < allFilteredItems.length
  });
});

// Обновление выбранных элементов
app.post('/api/selected', (req, res) => {
  const { items } = req.body;
  console.log('Received items to select:', items);

  // Преобразуем ID в числа
  const selectedIds = new Set(items.map(id => Number(id)));
  console.log('Converted to numbers:', Array.from(selectedIds));

  storage.selectedItems = selectedIds;

  // Обновляем полные данные о выбранных элементах
  storage.selectedItemsData = storage.items.filter(item => selectedIds.has(item.id));
  console.log('Updated selected items data:', storage.selectedItemsData);

  saveStorage();
  res.json({ success: true });
});

// Обновление порядка сортировки
app.post('/api/sort-order', (req, res) => {
  const { order } = req.body;
  // Преобразуем ID в числа
  storage.sortOrder = order.map(id => Number(id));
  saveStorage();
  res.json({ success: true });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 