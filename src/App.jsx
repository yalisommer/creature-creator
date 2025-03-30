import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

const CARD_SPACING = 40;
const INITIAL_X = 20;
const INITIAL_Y = window.innerHeight - 160 + (160 - 120) / 2;
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
  const [cards, setCards] = useState([]);
  const [creatures, setCreatures] = useState([]);
  const [combinations, setCombinations] = useState({});
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load creatures and combinations from server
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [creaturesResponse, combinationsResponse] = await Promise.all([
          fetch('http://localhost:3001/api/creatures'),
          fetch('http://localhost:3001/api/combinations')
        ]);

        if (!creaturesResponse.ok || !combinationsResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const creaturesData = await creaturesResponse.json();
        const combinationsData = await combinationsResponse.json();

        setCreatures(creaturesData);
        setCombinations(combinationsData);

        // Initialize cards with the first two creatures
        if (creaturesData.length >= 2) {
          setCards([
            {
              id: `${creaturesData[0].id}-1`,
              typeId: creaturesData[0].id,
              image: creaturesData[0].image,
              name: creaturesData[0].name,
              position: { 
                x: INITIAL_X,
                y: INITIAL_Y
              },
              isOriginal: true
            },
            {
              id: `${creaturesData[1].id}-1`,
              typeId: creaturesData[1].id,
              image: creaturesData[1].image,
              name: creaturesData[1].name,
              position: { 
                x: INITIAL_X + CARD_WIDTH + CARD_SPACING,
                y: INITIAL_Y
              },
              isOriginal: true
            }
          ]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    fetchData();
  }, []);

  const checkCollision = (card1, card2) => {
    if (card1.position.y > window.innerHeight - BOTTOM_BAR_HEIGHT ||
        card2.position.y > window.innerHeight - BOTTOM_BAR_HEIGHT) {
      return false;
    }

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
