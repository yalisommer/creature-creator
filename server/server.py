from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import json
import os
from openai import OpenAI
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Serve static files from the public directory
app.static_folder = 'public'

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
        
        # Create new combination
        new_combination = {
            'key': combination_key,
            'card1_id': card1_id,
            'card2_id': card2_id,
            'result': {
                'name': new_name,
                'image': f"https://api.dicebear.com/7.x/bottts/svg?seed={new_name}"  # Using bottts for placeholder images
            }
        }

        # Add to combinations
        combinations_data['combinations'].append(new_combination)
        write_json_file(combinations_file, combinations_data)

        # Add the new creature to the creatures list
        new_creature = {
            'id': combination_key,  # Use the name-based key as the ID
            'name': new_name,
            'image': new_combination['result']['image']
        }
        creatures_data['creatures'].append(new_creature)
        write_json_file(os.path.join('data', 'creatures.json'), creatures_data)

        return jsonify(new_combination)

    except Exception as error:
        print(f"Error combining cards: {error}")
        print(f"Error type: {type(error)}")  # Debug log
        import traceback
        print(f"Traceback: {traceback.format_exc()}")  # Debug log
        return jsonify({'error': 'Failed to combine cards'}), 500

if __name__ == '__main__':
    app.run(port=3001, debug=True) 