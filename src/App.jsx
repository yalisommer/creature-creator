import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

const CARD_SPACING = 40;
const INITIAL_X = 40;
const INITIAL_Y = window.innerHeight - 160 + (160 - 80) / 2;
const BOTTOM_BAR_HEIGHT = 160;

// Card dimensions
const CARD_PADDING = 8;
const CARD_WIDTH = 80;
const CARD_VISIBLE_WIDTH = CARD_WIDTH - (CARD_PADDING * 2);

function Card({ id, image, name, position, onMouseDown, isColliding }) {
  return (
    <div
      className={`creature-card absolute ${isColliding ? 'colliding' : ''}`}
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

        // Initialize cards with all creatures
        const initialCards = creaturesData.map((creature, index) => ({
          id: `${creature.id}-1`,
          typeId: creature.id,
          image: creature.image,
          name: creature.name,
          position: { 
            x: INITIAL_X + (CARD_WIDTH + CARD_SPACING) * index,
            y: INITIAL_Y
          },
          isOriginal: true
        }));
        
        setCards(initialCards);
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
    const card1Bottom = card1.position.y + CARD_VISIBLE_WIDTH;
    const card1Top = card1.position.y + CARD_PADDING;

    const card2Right = card2.position.x + CARD_VISIBLE_WIDTH;
    const card2Left = card2.position.x + CARD_PADDING;
    const card2Bottom = card2.position.y + CARD_VISIBLE_WIDTH;
    const card2Top = card2.position.y + CARD_PADDING;

    // Check for both x and y axis collisions
    return !(card1Right < card2Left || 
             card1Left > card2Right ||
             card1Bottom < card2Top ||
             card1Top > card2Bottom);
  };

  const handleCollision = async (card1, card2) => {
    try {
      // Extract the base ID (remove the timestamp suffix)
      const card1BaseId = card1.typeId;
      const card2BaseId = card2.typeId;

      // Call the combination endpoint
      const response = await fetch('http://localhost:3001/api/combine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card1_id: card1BaseId,
          card2_id: card2BaseId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to combine cards');
      }

      const combination = await response.json();

      // Calculate the midpoint between the two cards
      const midX = (card1.position.x + card2.position.x) / 2;
      const midY = (card1.position.y + card2.position.y) / 2;

      // Create a new card with the combination result
      const newCard = {
        id: `combined-${Date.now()}`,
        typeId: combination.key,  // Use the combination key as the typeId
        image: combination.result.image,
        name: combination.result.name,
        position: {
          x: midX,
          y: midY
        },
        isOriginal: false
      };

      // Remove only the collided cards and add the new one
      setCards(prevCards => 
        [...prevCards.filter(card => 
          card.id !== card1.id && card.id !== card2.id  // Only remove the two collided cards
        ), newCard]
      );

      // Check if this combination already exists in the bottom bar
      const existingCombination = cards.find(card => 
        card.isOriginal && card.typeId === combination.key
      );

      // Only add to bottom bar if it doesn't already exist
      if (!existingCombination) {
        // Refresh the creatures list to include the new combination
        const creaturesResponse = await fetch('http://localhost:3001/api/creatures');
        if (creaturesResponse.ok) {
          const creaturesData = await creaturesResponse.json();
          setCreatures(creaturesData);
          
          // Count existing cards in the bottom bar
          const bottomBarCards = cards.filter(card => card.isOriginal);
          
          // Add the new creature to the bottom bar
          const newCreatureCard = {
            id: `${combination.key}-1`,
            typeId: combination.key,
            image: combination.result.image,
            name: combination.result.name,
            position: { 
              x: INITIAL_X + (CARD_WIDTH + CARD_SPACING) * bottomBarCards.length,
              y: INITIAL_Y
            },
            isOriginal: true
          };
          setCards(prevCards => [...prevCards, newCreatureCard]);
        }
      }
    } catch (error) {
      console.error('Error handling collision:', error);
      // Fallback to creating an empty card if the combination fails
      const midX = (card1.position.x + card2.position.x) / 2;
      const midY = (card1.position.y + card2.position.y) / 2;

      const newCard = {
        id: `empty-${Date.now()}`,
        typeId: 'empty',
        image: '',
        name: 'Empty',
        position: {
          x: midX,
          y: midY
        },
        isOriginal: false
      };

      // Remove only the collided cards and add the new one
      setCards(prevCards => 
        [...prevCards.filter(card => 
          card.id !== card1.id && card.id !== card2.id  // Only remove the two collided cards
        ), newCard]
      );
    }
  };

  const handleMouseDown = (e, cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    
    if (card.isOriginal) {
      // Get the current position of the card relative to the viewport
      const cardElement = e.currentTarget;
      const rect = cardElement.getBoundingClientRect();
      const container = document.querySelector('.app-container');
      const containerRect = container.getBoundingClientRect();
      
      // Calculate position relative to the container
      const x = rect.left - containerRect.left;
      const y = rect.top - containerRect.top;

      // Transform the original card into a draggable one
      setCards(prevCards => {
        // Find the index of the original card
        const originalIndex = prevCards.findIndex(c => c.id === cardId);
        
        // Create the new array with the transformed card
        const newCards = [...prevCards];
        newCards[originalIndex] = {
          ...card,
          isOriginal: false,
          position: {
            x,
            y
          }
        };

        // Insert the duplicate card at the same index
        const duplicateCard = {
          ...card,
          id: `${card.typeId}-${Date.now()}`,
          position: { 
            x: card.position.x,
            y: card.position.y
          },
          isOriginal: true
        };

        // Insert the duplicate at the same index
        newCards.splice(originalIndex, 0, duplicateCard);

        return newCards;
      });
      
      setDraggedCardId(cardId);
      setDragStart({
        x: e.clientX - x,
        y: e.clientY - y
      });
    } else {
      setDraggedCardId(cardId);
      setDragStart({
        x: e.clientX - card.position.x,
        y: e.clientY - card.position.y
      });
    }
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
      const draggedCard = cards.find(card => card.id === draggedCardId);
      
      // Check for collisions with any non-original cards except the dragged one
      const collidingCard = cards.find(otherCard => 
        otherCard.id !== draggedCardId && // Not the same card
        !otherCard.isOriginal && // Not an original card
        checkCollision(draggedCard, otherCard) // Actually colliding
      );

      if (collidingCard) {
        handleCollision(draggedCard, collidingCard);
      }
      setDraggedCardId(null);
    }
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

  // Add continuous collision checking for stationary cards
  useEffect(() => {
    // Only check when no card is being dragged
    if (!draggedCardId) {
      const nonOriginalCards = cards.filter(card => !card.isOriginal);
      
      // Check each pair of cards
      for (let i = 0; i < nonOriginalCards.length; i++) {
        for (let j = i + 1; j < nonOriginalCards.length; j++) {
          const card1 = nonOriginalCards[i];
          const card2 = nonOriginalCards[j];
          
          if (checkCollision(card1, card2)) {
            handleCollision(card1, card2);
            return; // Exit after handling first collision
          }
        }
      }
    }
  }, [cards, draggedCardId]); // Re-run when cards change or drag state changes

  // Keep visual collision detection for highlighting
  const cardCollisions = cards.map(card => {
    const isColliding = cards.some(otherCard => 
      card.id !== otherCard.id && 
      !otherCard.isOriginal &&
      checkCollision(card, otherCard)
    );
    return { id: card.id, isColliding };
  });

  return (
    <div className="app-container">
      <button className="clear-button" onClick={handleClearAll}>Clear All</button>
      {cards
        .filter(card => !card.isOriginal)
        .map(card => (
          <Card
            key={card.id}
            {...card}
            onMouseDown={handleMouseDown}
            isColliding={cardCollisions.find(c => c.id === card.id)?.isColliding}
          />
        ))}
      <div className="bottom-bar">
        <div className="cards-container">
          {cards
            .filter(card => card.isOriginal)
            .map(card => (
              <div
                key={card.id}
                className="creature-card relative"
                style={{
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  border: '2px solid #81c784',
                  borderRadius: '8px',
                  width: '100px',
                  height: '100px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  boxSizing: 'border-box',
                  transition: 'transform 0.2s',
                  userSelect: 'none',
                  zIndex: 2
                }}
                onMouseDown={(e) => handleMouseDown(e, card.id)}
                onMouseMove={(e) => handleMouseMove(e)}
                onMouseUp={(e) => handleMouseUp()}
                onMouseLeave={(e) => handleMouseUp()}
              >
                <img
                  src={card.image}
                  alt={card.name}
                  className="creature-image"
                  style={{
                    width: '40px',
                    height: '40px',
                    objectFit: 'contain',
                    marginBottom: '4px',
                    pointerEvents: 'none'
                  }}
                />
                <div
                  className="creature-name"
                  style={{
                    fontSize: '10px',
                    textAlign: 'center',
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '2px',
                    color: '#333',
                    pointerEvents: 'none'
                  }}
                >
                  {card.name}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default App
