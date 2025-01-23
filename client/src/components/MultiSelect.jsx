import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './MultiSelect.css';

const MultiSelect = () => {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const observer = useRef();
  const searchTimeout = useRef();

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
    fetchItems(1, search, true);
  }, [search]);

  useEffect(() => {
    if (page > 1) {
      fetchItems(page, search);
    }
  }, [page]);

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    setPage(1);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      fetchItems(1, value, true);
    }, 300);
  };

  const handleSelect = async (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
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

      {loading && <div className="loading">Загрузка...</div>}
    </div>
  );
};

export default MultiSelect; 