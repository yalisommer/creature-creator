import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

// Card type configurations
const CARD_TYPES = [
  {
    id: 'square1',
    name: 'Square 1',
    image: reactLogo,
    width: 120
  },
  {
    id: 'square2',
    name: 'Square 2',
    image: reactLogo,
    width: 120
  }
];

const CARD_SPACING = 40; // Increased spacing between cards
const INITIAL_X = 20; // Initial x position
const INITIAL_Y = window.innerHeight - 160 + (160 - 120) / 2; // Center vertically in bottom bar
const BOTTOM_BAR_HEIGHT = 160;

// Card dimensions
const CARD_PADDING = 12;
const CARD_WIDTH = 120;
const CARD_VISIBLE_WIDTH = CARD_WIDTH - (CARD_PADDING * 2);

function Card({ id, image, name, position, onMouseDown, isColliding }) {
  return (
    <div
      className={`creature-card ${isColliding ? 'colliding' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: 'grab'
      }}
      onMouseDown={(e) => onMouseDown(e, id)}
    >
      <img src={image} alt={name} className="creature-image" />
      <div className="creature-name">{name}</div>
    </div>
  );
}

function App() {
  const [cards, setCards] = useState([
    {
      id: 'square1-1',
      typeId: 'square1',
      image: CARD_TYPES[0].image,
      name: CARD_TYPES[0].name,
      position: { 
        x: INITIAL_X,
        y: INITIAL_Y
      },
      isOriginal: true
    },
    {
      id: 'square2-1',
      typeId: 'square2',
      image: CARD_TYPES[1].image,
      name: CARD_TYPES[1].name,
      position: { 
        x: INITIAL_X + CARD_TYPES[0].width + CARD_SPACING,
        y: INITIAL_Y
      },
      isOriginal: true
    }
  ]);
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const checkCollision = (card1, card2) => {
    const container = document.querySelector('.app-container');
    const containerRect = container.getBoundingClientRect();
    
    // Only check collision if both cards are above the bottom bar
    if (card1.position.y > containerRect.height - BOTTOM_BAR_HEIGHT ||
        card2.position.y > containerRect.height - BOTTOM_BAR_HEIGHT) {
      return false;
    }

    // Calculate the actual visible boundaries of each card
    const card1Right = card1.position.x + CARD_VISIBLE_WIDTH;
    const card1Left = card1.position.x + CARD_PADDING;
    const card2Right = card2.position.x + CARD_VISIBLE_WIDTH;
    const card2Left = card2.position.x + CARD_PADDING;

    return !(card1Right < card2Left || 
             card1Left > card2Right);
  };

  const handleMouseDown = (e, cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    
    // If dragging an original card, create a copy
    if (card.isOriginal) {
      const newCard = {
        ...card,
        id: `${card.typeId}-${Date.now()}`,
        isOriginal: false,
        position: {
          x: card.position.x,
          y: card.position.y
        }
      };
      setCards(prevCards => [...prevCards, newCard]);
      setDraggedCardId(newCard.id);
    } else {
      setDraggedCardId(cardId);
    }

    setDragStart({
      x: e.clientX - card.position.x,
      y: e.clientY - card.position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!draggedCardId) return;
    
    const container = document.querySelector('.app-container');
    const containerRect = container.getBoundingClientRect();
    
    const x = e.clientX - containerRect.left - dragStart.x;
    const y = e.clientY - containerRect.top - dragStart.y;
    
    setCards(prevCards => 
      prevCards.map(card => 
        card.id === draggedCardId
          ? {
              ...card,
              position: {
                x: Math.max(0, Math.min(x, containerRect.width - CARD_WIDTH)),
                y: Math.max(0, Math.min(y, containerRect.height - CARD_WIDTH))
              }
            }
          : card
      )
    );
  };

  const handleMouseUp = () => {
    if (draggedCardId) {
      const container = document.querySelector('.app-container');
      const containerRect = container.getBoundingClientRect();
      const draggedCard = cards.find(card => card.id === draggedCardId);
      
      // Only remove if the card is in the bottom bar and not an original card
      if (draggedCard && !draggedCard.isOriginal && 
          draggedCard.position.y > containerRect.height - BOTTOM_BAR_HEIGHT) {
        setCards(prevCards => prevCards.filter(card => card.id !== draggedCardId));
      }
    }
    setDraggedCardId(null);
  };

  const handleClearAll = () => {
    setCards(prevCards => prevCards.filter(card => card.isOriginal));
  };

  useEffect(() => {
    if (draggedCardId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedCardId, dragStart]);

  // Calculate collisions for each card
  const cardCollisions = cards.map(card => {
    const isColliding = cards.some(otherCard => 
      card.id !== otherCard.id && checkCollision(card, otherCard)
    );
    return { id: card.id, isColliding };
  });

  return (
    <div className="app-container">
      <button className="clear-button" onClick={handleClearAll}>Clear All</button>
      {cards.map(card => (
        <Card
          key={card.id}
          {...card}
          onMouseDown={handleMouseDown}
          isColliding={cardCollisions.find(c => c.id === card.id)?.isColliding}
        />
      ))}
      <div className="bottom-bar">
        {/* Controls removed */}
      </div>
    </div>
  )
}

export default App
