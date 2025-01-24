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

  // Упростим логику загрузки
  const fetchItems = async (pageNum, searchQuery, reset = false) => {
    try {
      setLoading(true);
      console.log(`Fetching items: page=${pageNum}, search=${searchQuery}, reset=${reset}`);
      
      const response = await fetch(
        `http://localhost:5001/api/items?page=${pageNum}&search=${searchQuery}`
      );
      const data = await response.json();

      if (reset) {
        setItems(data.items);
      } else {
        setItems(prev => [...prev, ...data.items]);
      }
      
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching items:', error);
      setLoading(false);
    }
  };

  // Один эффект для инициализации
  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      try {
        setLoading(true);
        console.log('Initializing data...');

        // 1. Загружаем значение поиска
        const searchResponse = await fetch('http://localhost:5001/api/search-value');
        const searchData = await searchResponse.json();
        const searchValue = searchData.searchValue || '';
        
        if (isMounted) {
          setSearch(searchValue);
          console.log('Search value loaded:', searchValue);

          // 2. Загружаем выбранные элементы
          const selectedResponse = await fetch(`http://localhost:5001/api/items?selected=true`);
          const selectedData = await selectedResponse.json();
          
          if (isMounted) {
            setSelectedIds(new Set(selectedData.items.map(item => item.id)));
            setSelectedItems(selectedData.items);
            console.log('Selected items loaded:', selectedData.items.length);

            // 3. Загружаем все элементы
            await fetchItems(1, searchValue, true);
          }
        }
      } catch (error) {
        console.error('Error in initialization:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Сохраняем выбранные элементы в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('selectedIds', JSON.stringify(Array.from(selectedIds)));
  }, [selectedIds]);

  const lastItemRef = React.useCallback(node => {
    if (loading || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        console.log('Intersection observed, loading next page');
        setPage(prev => prev + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Упрощаем эффект загрузки
  useEffect(() => {
    let timer;
    
    const loadItems = async () => {
      if (loading) return;

      // Если страница 1 или изменился поиск, делаем сброс
      const reset = page === 1;
      await fetchItems(page, search, reset);
    };

    // Добавляем задержку только для поиска
    if (page === 1) {
      timer = setTimeout(loadItems, 300);
    } else {
      loadItems();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [page, search]);

  // Обработчик изменения поиска
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    setPage(1);
    setHasMore(true);
  };

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

    const reorderedItems = Array.from(selectedItems);
    const [reorderedItem] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, reorderedItem);

    setSelectedItems(reorderedItems);

    try {
      await fetch('http://localhost:5001/api/sort-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          order: reorderedItems.map(item => item.id)
        })
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

      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        {/* Отображаем все элементы */}
        <div className="all-items-list">
          <h3 style={{ paddingBottom: '10px' }}>Все элементы:</h3>
          <div className="items-list">
            {items.map((item, index) => (
              <div
                key={item.id}
                ref={index === items.length - 1 ? lastItemRef : null}
                className={`item ${selectedIds.has(item.id) ? 'selected' : ''}`}
                onClick={() => handleSelect(item.id)}
              >
                {item.value}
              </div>
            ))}
          </div>
        </div>
 
        {/* Отображаем выбранные элементы с возможностью перетаскивания */}
        <div className="selected-items-list">
          <h3 style={{ paddingBottom: '10px' }}>Выбранные элементы ({selectedItems.length}):</h3>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="selected-items">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="items-list"
                >
                  {selectedItems.map((item, index) => (
                    <Draggable
                      key={item.id}
                      draggableId={String(item.id)}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="item selected"
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
      </div>

      {loading && <div className="loading">Загрузка...</div>}
    </div>
  );
};

export default MultiSelect; 