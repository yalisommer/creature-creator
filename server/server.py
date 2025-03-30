from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)

# Serve static files from the public directory
app.static_folder = 'public'

def read_json_file(file_path):
    try:
        with open(file_path, 'r') as file:
            return json.load(file)
    except Exception as error:
        print(f"Error reading {file_path}:", error)
        raise

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
        return jsonify(data['combinations'])
    except Exception as error:
        return jsonify({'error': 'Failed to fetch combinations'}), 500

if __name__ == '__main__':
    app.run(port=3001, debug=True) 