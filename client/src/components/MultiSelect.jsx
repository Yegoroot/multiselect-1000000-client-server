import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './MultiSelect.css';

const MultiSelect = () => {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedItems, setSelectedItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const observer = useRef();
  const searchTimeout = useRef();

  // Загрузка выбранных элементов
  const fetchSelectedItems = async () => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/items?selected=true`
      );
      const data = await response.json();
      const selectedSet = new Set(data.items.map(item => item.id));
      setSelectedIds(selectedSet);
      setSelectedItems(data.items);
    } catch (error) {
      console.error('Error fetching selected items:', error);
    }
  };

  // Инициализация данных
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Сначала загружаем выбранные элементы
        await fetchSelectedItems();
        
        // Затем загружаем значение поиска
        const searchResponse = await fetch('http://localhost:5001/api/search-value');
        const searchData = await searchResponse.json();
        const searchValue = searchData.searchValue || '';
        setSearch(searchValue);
        
        // Загружаем элементы с учетом поискового запроса
        await fetchItems(1, searchValue, true);
      } catch (error) {
        console.error('Error initializing data:', error);
      }
    };

    initializeData();
  }, []);

  // Сохраняем выбранные элементы в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('selectedIds', JSON.stringify(Array.from(selectedIds)));
  }, [selectedIds]);

  const fetchItems = async (pageNum, searchQuery, reset = false) => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:5001/api/items?page=${pageNum}&search=${searchQuery}`
      );
      const data = await response.json();

      setItems(prev => reset ? data.items : [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching items:', error);
      setLoading(false);
    }
  };

  const lastItemRef = React.useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  useEffect(() => {
    if (page > 1) {
      fetchItems(page, search);
    }
  }, [page]);

  // Обработчик поиска
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    setPage(1);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      // Загружаем элементы в любом случае, даже если поиск пустой
      await fetchItems(1, value, true);
      
      try {
        await fetch('http://localhost:5001/api/search-value', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchValue: value })
        });
      } catch (error) {
        console.error('Error saving search value:', error);
      }
    }, 300);
  };

  // Добавим эффект для загрузки элементов при пустом поиске
  useEffect(() => {
    if (!search) {
      fetchItems(1, '', true);
    }
  }, [search]);

  // Обработчик выбора элемента
  const handleSelect = async (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      setSelectedItems(prev => prev.filter(item => item.id !== id));
    } else {
      newSelected.add(id);
      const selectedItem = items.find(item => item.id === id);
      if (selectedItem) {
        setSelectedItems(prev => [...prev, selectedItem]);
      }
    }
    setSelectedIds(newSelected);

    try {
      await fetch('http://localhost:5001/api/selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: Array.from(newSelected) })
      });
    } catch (error) {
      console.error('Error updating selection:', error);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const reorderedItems = Array.from(items);
    const [reorderedItem] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, reorderedItem);

    setItems(reorderedItems);

    try {
      await fetch('http://localhost:5001/api/sort-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: reorderedItems.map(item => item.id) })
      });
    } catch (error) {
      console.error('Error updating sort order:', error);
    }
  };

  return (
    <div className="multi-select">
      <input
        type="text"
        placeholder="Поиск..."
        value={search}
        onChange={handleSearch}
        className="search-input"
      />

      {/* Отображаем выбранные элементы */}
      <div className="selected-items-list">
        <h3>Выбранные элементы ({selectedItems.length}):</h3>
        {selectedItems.map(item => (
          <div
            key={item.id}
            className="item selected"
            onClick={() => handleSelect(item.id)}
          >
            {item.value}
          </div>
        ))}
      </div>

      {/* Отображаем все элементы */}
      <div className="all-items-list">
        <h3>Все элементы:</h3>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="items">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="items-list"
              >
                {items.map((item, index) => (
                  <Draggable
                    key={item.id}
                    draggableId={String(item.id)}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        ref={index === items.length - 1 ? lastItemRef : null}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`item ${selectedIds.has(item.id) ? 'selected' : ''}`}
                        onClick={() => handleSelect(item.id)}
                      >
                        {item.value}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {loading && <div className="loading">Загрузка...</div>}
    </div>
  );
};

export default MultiSelect; 