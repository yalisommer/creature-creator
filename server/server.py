from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import json
import os
from openai import OpenAI
from pathlib import Path
import base64
import uuid

app = Flask(__name__)
CORS(app)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Serve static files from the public directory
app.static_folder = 'public'

# Create images directory if it doesn't exist
IMAGES_DIR = os.path.join('data', 'images')
os.makedirs(IMAGES_DIR, exist_ok=True)

def read_json_file(file_path):
    try:
        with open(file_path, 'r') as file:
            return json.load(file)
    except Exception as error:
        print(f"Error reading {file_path}:", error)
        raise

def write_json_file(file_path, data):
    try:
        with open(file_path, 'w') as file:
            json.dump(data, file, indent=2)
    except Exception as error:
        print(f"Error writing {file_path}:", error)
        raise

def save_image(image_data, creature_id):
    try:
        # Remove the data URL prefix
        image_data = image_data.split(',')[1]
        # Decode base64 data
        image_bytes = base64.b64decode(image_data)
        
        # Generate unique filename
        filename = f"{creature_id}-{uuid.uuid4()}.png"
        filepath = os.path.join(IMAGES_DIR, filename)
        
        # Save the image
        with open(filepath, 'wb') as f:
            f.write(image_bytes)
        
        # Return the relative path to the image
        return os.path.join('images', filename)
    except Exception as e:
        print(f"Error saving image: {e}")
        raise

def generate_combination(card1_name, card2_name):
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a creative creature combination generator. When given two creatures, create a new creature that combines their characteristics in an interesting way. Respond with only the name of the new creature, nothing else."},
                {"role": "user", "content": f"Combine {card1_name} and {card2_name}"}
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as error:
        print(f"Error generating combination: {error}")
        return f"{card1_name}-{card2_name}"  # Fallback name if API fails

@app.route('/api/creatures')
def get_creatures():
    try:
        data = read_json_file(os.path.join('data', 'creatures.json'))
        return jsonify(data['creatures'])
    except Exception as error:
        return jsonify({'error': 'Failed to fetch creatures'}), 500

@app.route('/api/combinations')
def get_combinations():
    try:
        data = read_json_file(os.path.join('data', 'combinations.json'))
        return jsonify(data)
    except Exception as error:
        return jsonify({'error': 'Failed to fetch combinations'}), 500

@app.route('/api/combine', methods=['POST'])
def combine_cards():
    try:
        data = request.json
        card1_id = data.get('card1_id')
        card2_id = data.get('card2_id')
        
        if not card1_id or not card2_id:
            return jsonify({'error': 'Missing card IDs'}), 400

        # Read current data
        creatures_data = read_json_file(os.path.join('data', 'creatures.json'))
        
        # Initialize combinations data if it doesn't exist
        combinations_file = os.path.join('data', 'combinations.json')
        try:
            combinations_data = read_json_file(combinations_file)
            print("Loaded combinations data:", combinations_data)  # Debug log
        except:
            print("No combinations file found, initializing new one")  # Debug log
            combinations_data = {'combinations': []}
        
        # Ensure combinations_data has the correct structure
        if not isinstance(combinations_data, dict):
            print("Combinations data is not a dict, fixing structure")  # Debug log
            combinations_data = {'combinations': []}
        if 'combinations' not in combinations_data:
            print("No combinations list found, adding it")  # Debug log
            combinations_data['combinations'] = []
        
        # Find the creatures
        card1 = next((c for c in creatures_data['creatures'] if c['id'] == card1_id), None)
        card2 = next((c for c in creatures_data['creatures'] if c['id'] == card2_id), None)
        
        if not card1 or not card2:
            return jsonify({'error': 'Creatures not found'}), 404

        # Check if combination already exists based on card IDs
        existing_combination = next(
            (c for c in combinations_data['combinations'] 
             if (c['card1_id'] == card1_id and c['card2_id'] == card2_id) or
                (c['card1_id'] == card2_id and c['card2_id'] == card1_id)),
            None
        )

        if existing_combination:
            return jsonify(existing_combination)

        # Generate new combination
        new_name = generate_combination(card1['name'], card2['name'])
        
        # Create a key from the name (lowercase, spaces to hyphens)
        combination_key = new_name.lower().replace(' ', '-')
        
        # Create new combination without an image (will be added later)
        new_combination = {
            'key': combination_key,
            'card1_id': card1_id,
            'card2_id': card2_id,
            'result': {
                'name': new_name,
                'image': None  # No image yet, will be added when drawing is saved
            }
        }

        # Add to combinations
        combinations_data['combinations'].append(new_combination)
        write_json_file(combinations_file, combinations_data)

        return jsonify(new_combination)

    except Exception as error:
        print(f"Error combining cards: {error}")
        print(f"Error type: {type(error)}")  # Debug log
        import traceback
        print(f"Traceback: {traceback.format_exc()}")  # Debug log
        return jsonify({'error': 'Failed to combine cards'}), 500

@app.route('/api/update-combination', methods=['POST'])
def update_combination():
    try:
        data = request.get_json()
        combination_key = data.get('combination_key')
        new_image = data.get('image')

        if not combination_key or not new_image:
            return jsonify({'error': 'Missing required fields'}), 400

        # Load current combinations
        try:
            with open(os.path.join('data', 'combinations.json'), 'r') as f:
                combinations_data = json.load(f)
        except FileNotFoundError:
            combinations_data = {'combinations': []}

        # Find and update the combination
        combination = None
        for c in combinations_data['combinations']:
            if c['key'] == combination_key:
                combination = c
                break

        if not combination:
            return jsonify({'error': 'Combination not found'}), 404

        # Save the image and get its path
        image_path = save_image(new_image, combination_key)
        
        # Update the combination with the image path
        combination['result']['image'] = image_path

        # Save updated combinations
        with open(os.path.join('data', 'combinations.json'), 'w') as f:
            json.dump(combinations_data, f, indent=2)

        # Add to creatures list if not already there
        creatures_file = os.path.join('data', 'creatures.json')
        try:
            with open(creatures_file, 'r') as f:
                creatures_data = json.load(f)
        except FileNotFoundError:
            creatures_data = {'creatures': []}

        # Check if creature already exists
        if not any(c['id'] == combination_key for c in creatures_data['creatures']):
            new_creature = {
                'id': combination_key,
                'name': combination['result']['name'],
                'image': image_path
            }
            creatures_data['creatures'].append(new_creature)
            with open(creatures_file, 'w') as f:
                json.dump(creatures_data, f, indent=2)

        return jsonify({'message': 'Combination updated successfully'})

    except Exception as e:
        print(f"Error updating combination: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Serve images from the images directory
@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(IMAGES_DIR, filename)

if __name__ == '__main__':
    app.run(port=3001, debug=True) 